/**
 * AI training plans, minus the Convex plumbing: prompts, response schemas
 * and validation for building a plan and for the weekly check-in. Used by
 * the planAI.ts actions and by the tests / evals.
 *
 * A plan is a weekly rotation of sessions (same exercises every week) split
 * into phases. The model sets week-1 loads; from week 2 a weekly check-in
 * reviews last week (planned vs. actual) and sets that week's loads and
 * changes. src/utils/trainingPlan.ts turns this into dated sessions.
 *
 * Pure apart from the OpenAI calls (no Convex runtime APIs).
 */
import type OpenAI from "openai";
import type { Doc } from "./_generated/dataModel";
import type { CoachData, CoachWorkout } from "./coachData";
import { buildCoachContext, describeWorkout, lastPerformanceBlock, profileBlock, unitsOf, type Units } from "./coachPrompt";
import { guardLoad } from "./loadGuard";
import { AI_MODEL, temperatureFor } from "./aiModels";
import { buildCatalog, catalogText, normalizeReps, type CatalogEntry } from "./workoutPlanner";
import { addDays, fromDateKey, phaseOf, planCompletions, sessionKey, weekRange, weekSchedule } from "../src/utils/trainingPlan";
import type { Equipment, PlanAdjustment, PlanCheckIn, PlanExercise, PlanPhase, PlanSession, TrainingPlan } from "../src/types";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const LANGUAGES: Record<string, string> = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", hi: "Hindi" };

/** Language name for the model, from an app language code ("ar", "fr-FR"...). */
export const languageName = (code?: string) => LANGUAGES[(code ?? "en").split("-")[0]] ?? "English";

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const text = (value: unknown, max: number, fallback = "") =>
  typeof value === "string" && value.trim() ? value.trim().slice(0, max) : fallback;
const int = (value: unknown, lo: number, hi: number, fallback: number) => {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? clamp(n, lo, hi) : fallback;
};

/** Drop undefined fields (Convex values can't hold undefined). */
function compact<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;
}

// ── Shared model call ────────────────────────────────────

/** Strict structured output, falling back to plain JSON mode (some accounts reject big strict schemas). */
async function requestJson(
  openai: OpenAI,
  opts: { model: string; messages: OpenAI.ChatCompletionMessageParam[]; name: string; schema: object; shape: string; maxTokens: number },
): Promise<string | null | undefined> {
  try {
    const response = await openai.chat.completions.create({
      model: opts.model,
      messages: opts.messages,
      ...temperatureFor(opts.model, 0.5),
      max_completion_tokens: opts.maxTokens,
      response_format: { type: "json_schema", json_schema: { name: opts.name, strict: true, schema: opts.schema as Record<string, unknown> } },
    });
    return response.choices[0]?.message?.content;
  } catch (e) {
    console.warn(`[Plan] Structured output failed for ${opts.name}, retrying with JSON mode:`, e);
    const response = await openai.chat.completions.create({
      model: opts.model,
      messages: [...opts.messages, { role: "system", content: `Return ONLY a JSON object of this shape: ${opts.shape}` }],
      ...temperatureFor(opts.model, 0.5),
      max_completion_tokens: opts.maxTokens,
      response_format: { type: "json_object" },
    });
    return response.choices[0]?.message?.content;
  }
}

// ── Building a plan ──────────────────────────────────────

export interface PlanArgs {
  weeks: number;
  trainingDays: number[];
  sessionMinutes: number;
  startDate: string;
  goal?: string;
  focus?: string[];
  comment?: string;
  language?: string;
}

/** Fix ranges of what the app sent; throws on unusable input. */
export function normalizePlanArgs(args: PlanArgs): PlanArgs {
  const days = [...new Set(args.trainingDays.map((d) => Math.round(d)).filter((d) => d >= 0 && d <= 6))];
  if (days.length === 0) throw new Error("Pick at least one training day");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(args.startDate)) throw new Error("Invalid start date");
  return {
    ...args,
    weeks: int(args.weeks, 2, 16, 8),
    trainingDays: days,
    sessionMinutes: int(args.sessionMinutes, 20, 180, 60),
    goal: text(args.goal, 200) || undefined,
    focus: args.focus?.slice(0, 8).map((f) => text(f, 30)).filter(Boolean),
    comment: text(args.comment, 400) || undefined,
  };
}

/** Training weekdays in the order sessions happen each week (weeks start on the start date's weekday). */
export function sessionDayOrder(startDate: string, trainingDays: number[]): number[] {
  const start = fromDateKey(startDate);
  const order: number[] = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(start, d).getDay();
    if (trainingDays.includes(day)) order.push(day);
  }
  return order;
}

export interface PlanRequest {
  messages: OpenAI.ChatCompletionMessageParam[];
  catalog: CatalogEntry[];
  args: PlanArgs;
  units: Units;
  now: number;
}

function planSchema(ids: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["name", "goal", "overview", "progression", "phases", "sessions"],
    properties: {
      name: { type: "string" },
      goal: { type: "string" },
      overview: { type: "string" },
      progression: { type: "string" },
      phases: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "weeks", "focus", "deload"],
          properties: {
            name: { type: "string" },
            weeks: { type: "integer" },
            focus: { type: "string" },
            deload: { type: "boolean" },
          },
        },
      },
      sessions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["name", "focus", "estimatedMinutes", "exercises"],
          properties: {
            name: { type: "string" },
            focus: { type: "string" },
            estimatedMinutes: { type: "number" },
            exercises: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["exerciseId", "sets", "reps", "restSeconds", "targetWeight", "supersetGroup", "notes"],
                properties: {
                  exerciseId: { type: "string", enum: ids },
                  sets: { type: "integer" },
                  reps: { type: "string" },
                  restSeconds: { type: "integer" },
                  targetWeight: { anyOf: [{ type: "number" }, { type: "null" }] },
                  supersetGroup: { anyOf: [{ type: "string" }, { type: "null" }] },
                  notes: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
  };
}

const PLAN_SHAPE = `{"name": string, "goal": string, "overview": string, "progression": string, "phases": [{"name": string, "weeks": number, "focus": string, "deload": boolean}], "sessions": [{"name": string, "focus": string, "estimatedMinutes": number, "exercises": [{"exerciseId": string, "sets": number, "reps": string, "restSeconds": number, "targetWeight": number|null, "supersetGroup": string|null, "notes": string}]}]}`;

export function buildPlanRequest(user: Doc<"users">, data: CoachData, rawArgs: PlanArgs, now = Date.now()): PlanRequest {
  const args = normalizePlanArgs(rawArgs);
  const units = unitsOf(user);
  const unit = units === "imperial" ? "lb" : "kg";
  const catalog = buildCatalog(user.equipment as Equipment[] | undefined, data.customExercises);
  const order = sessionDayOrder(args.startDate, args.trainingDays);
  const n = order.length;
  const days = order.map((d, i) => `${i + 1}) ${WEEKDAY_NAMES[d]}`).join(", ");
  const language = languageName(args.language);

  const request = [
    `- Length: ${args.weeks} weeks`,
    `- ${n} sessions a week, in this order: ${days} (the same order every week)`,
    `- Session length: ${args.sessionMinutes} minutes including warm-up`,
    args.goal ? `- Goal for this plan: "${args.goal}"` : null,
    args.focus?.length ? `- Areas to emphasize: ${args.focus.join(", ")}` : null,
    args.comment ? `- User says: "${args.comment}"` : null,
  ].filter(Boolean).join("\n");

  const system = `You are an elite strength & conditioning coach. Design a ${args.weeks}-week training plan the user will follow, built on their data.

AVAILABLE EXERCISES (id | name | primary muscles | equipment | level | how it's logged). Only these fit the user's equipment:
${catalogText(catalog)}

HOW TO DESIGN THE PLAN:
1. Sessions: exactly ${n} sessions, listed in the order they happen each week (session 1 = ${WEEKDAY_NAMES[order[0]]}). The same sessions repeat every week. Choose a split that fits ${n} days (e.g. full body for 2-3 days, upper/lower for 4, push/pull/legs for 3 or 6), train each major muscle group about twice a week where the days allow, and don't put hard sessions for the same muscles on back-to-back days (look at the weekday order).
2. Phases: split the ${args.weeks} weeks into 2-4 phases whose weeks add up to exactly ${args.weeks}, each with a clear purpose (e.g. Foundation, Build, Peak). Plans of 6+ weeks include a deload week (a phase with deload: true, usually 1 week) every 4-6 weeks or at the end. Each phase gets a short focus.
3. Fit ${args.sessionMinutes} minutes per session: about 8-12 min per compound exercise with 3-4 sets, 5-7 min per isolation exercise, plus the warm-up. Typically 4-7 exercises. Report a realistic estimatedMinutes.
4. Match the goal and experience:
   - strength: main lifts 3-6 reps, 2-4 min rest
   - hypertrophy / muscle: 6-12 reps (12-20 for small muscles), 60-120s rest
   - fat loss / conditioning / general fitness: 10-15 reps, 30-75s rest, supersets welcome
   - beginners: simple stable movements, 2-3 sets, technique cues; no advanced lifts
5. Respect injuries/limitations: leave out anything that could aggravate them. Use catalog IDs exactly.
6. Continuity: keep exercises they already do when they fit, and add what the goal needs.
7. targetWeight: the week-1 working load in ${unit} (the user's units), from LAST PERFORMANCE: about what they recently used for similar reps, slightly conservative for the first week. Use loads that exist: barbells in 2.5 kg / 5 lb steps, dumbbells and machines in whole kg or 2.5 kg steps (5 lb). null for bodyweight, timed and cardio exercises, or exercises they haven't done.
   reps: a range like "8-10", a number like "5", "AMRAP", seconds like "45s" for timed holds or minutes like "20min" for cardio, matching the exercise's "log" type.
8. supersetGroup: the same letter ("A", "B") pairs non-competing exercises when it saves time; otherwise null.
9. Text, all in ${language}: name (max 40 characters, e.g. "8-Week Strength Builder"), goal (one line), overview (3-4 sentences: the strategy and why it fits them, referencing their data), progression (1-2 sentences: how loads and reps go up week to week), session name (short, e.g. "Upper A", "Push") and focus (max 40 characters), notes (one short cue per exercise).

USER DATA:
${buildCoachContext(user, data, { detailed: 4, now })}

LAST PERFORMANCE PER EXERCISE (newest first):
${lastPerformanceBlock(data.workouts, units, now)}

THE PLAN THEY ASKED FOR:
${request}`;

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: "Build my training plan." },
    ],
    catalog,
    args,
    units,
    now,
  };
}

export async function requestPlan(openai: OpenAI, req: PlanRequest, model = AI_MODEL): Promise<string | null | undefined> {
  return requestJson(openai, {
    model,
    messages: req.messages,
    name: "training_plan",
    schema: planSchema(req.catalog.map((e) => e.id)),
    shape: PLAN_SHAPE,
    maxTokens: 12000,
  });
}

/** Everything that defines a plan, ready to store (see plans.create). */
export type PlanDraft = Omit<TrainingPlan, "id" | "createdAt">;

/** Phase lengths that add up to the plan length (extra weeks go to the longest training phase). */
function fitPhases(raw: unknown, total: number): PlanPhase[] {
  const list = (Array.isArray(raw) ? raw : []).slice(0, 6).map((p: any, i: number) => ({
    name: text(p?.name, 30, `Phase ${i + 1}`),
    focus: text(p?.focus, 140),
    deload: p?.deload === true,
    weeks: int(p?.weeks, 1, total, 1),
  }));
  if (list.length === 0) return [{ name: "Training", startWeek: 1, endWeek: total, focus: "", deload: false }];

  let sum = list.reduce((a, p) => a + p.weeks, 0);
  // Too long: trim from the end (keeping at least one week per phase), then drop phases that don't fit.
  for (let i = list.length - 1; sum > total && i >= 0; i--) {
    const cut = Math.min(list[i].weeks - 1, sum - total);
    list[i].weeks -= cut;
    sum -= cut;
  }
  while (sum > total && list.length > 1) sum -= list.pop()!.weeks;
  // Too short: extend the longest training (non-deload) phase.
  if (sum < total) {
    const target = list.filter((p) => !p.deload).sort((a, b) => b.weeks - a.weeks)[0] ?? list[list.length - 1];
    target.weeks += total - sum;
  }

  let start = 1;
  return list.map((p) => {
    const phase = { name: p.name, startWeek: start, endWeek: start + p.weeks - 1, focus: p.focus, deload: p.deload };
    start += p.weeks;
    return phase;
  });
}

/** Validate the model's plan and turn it into what's stored. Throws if nothing usable came back. */
export function finalizePlan(content: string | null | undefined, req: PlanRequest, data: CoachData): PlanDraft {
  if (!content) throw new Error("No content generated");
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed.sessions) || parsed.sessions.length === 0) throw new Error("Plan has no sessions");

  const { args } = req;
  const n = sessionDayOrder(args.startDate, args.trainingDays).length;
  const byId = new Map(req.catalog.map((e) => [e.id, e]));

  const sessions: Omit<PlanSession, "id">[] = [];
  for (const raw of parsed.sessions.slice(0, n)) {
    const seen = new Set<string>();
    const exercises: PlanExercise[] = [];
    for (const ex of (Array.isArray(raw?.exercises) ? raw.exercises : []).slice(0, 10)) {
      const entry = byId.get(String(ex?.exerciseId));
      if (!entry || seen.has(entry.id)) continue;
      seen.add(entry.id);
      const reps = normalizeReps(ex.reps);
      const load = guardLoad({ suggested: ex.targetWeight, exerciseId: entry.id, reps, workouts: data.workouts, units: req.units, now: req.now });
      exercises.push(compact({
        exerciseId: entry.id,
        exerciseName: entry.name,
        sets: int(ex.sets, 1, 8, 3),
        reps,
        restSeconds: int(ex.restSeconds, 15, 300, 90),
        startWeight: load.kg,
        supersetGroup: text(ex.supersetGroup, 3) || undefined,
        notes: text(ex.notes, 200) || undefined,
      }));
    }
    if (exercises.length === 0) continue;
    const minutes = Number(raw.estimatedMinutes);
    sessions.push(compact({
      name: text(raw.name, 40, `Session ${sessions.length + 1}`),
      focus: text(raw.focus, 60),
      estimatedMinutes: Number.isFinite(minutes) && minutes > 0 ? Math.round(minutes) : undefined,
      exercises,
    }));
  }
  if (sessions.length === 0) throw new Error("No valid sessions in AI plan");

  // Fewer sessions than training days: repeat the rotation so every day has one.
  const rotation: PlanSession[] = Array.from({ length: n }, (_, i) => ({ ...sessions[i % sessions.length], id: `s${i + 1}` }));

  return {
    name: text(parsed.name, 60, "Training Plan"),
    goal: text(parsed.goal, 160, args.goal ?? ""),
    overview: text(parsed.overview, 900),
    progression: text(parsed.progression, 400),
    startDate: args.startDate,
    weeks: args.weeks,
    trainingDays: args.trainingDays,
    sessionMinutes: args.sessionMinutes,
    phases: fitPhases(parsed.phases, args.weeks),
    sessions: rotation,
    checkIns: [],
  };
}

// ── Weekly check-in ──────────────────────────────────────

export interface CheckInRequest {
  messages: OpenAI.ChatCompletionMessageParam[];
  plan: TrainingPlan;
  week: number;
  catalog: CatalogEntry[];
  units: Units;
  now: number;
}

function checkInSchema(sessionIds: string[], exerciseIds: string[], catalogIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["summary", "adjustments"],
    properties: {
      summary: { type: "string" },
      adjustments: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["sessionId", "exerciseId", "targetWeight", "sets", "reps", "replaceWith"],
          properties: {
            sessionId: { type: "string", enum: sessionIds },
            exerciseId: { type: "string", enum: exerciseIds },
            targetWeight: { anyOf: [{ type: "number" }, { type: "null" }] },
            sets: { anyOf: [{ type: "integer" }, { type: "null" }] },
            reps: { anyOf: [{ type: "string" }, { type: "null" }] },
            replaceWith: { anyOf: [{ type: "string", enum: catalogIds }, { type: "null" }] },
          },
        },
      },
    },
  };
}

const CHECK_IN_SHAPE = `{"summary": string, "adjustments": [{"sessionId": string, "exerciseId": string, "targetWeight": number|null, "sets": number|null, "reps": string|null, "replaceWith": string|null}]}`;

/** Last week, planned vs. actual: each session's logged workout, or that it was skipped. */
function lastWeekBlock(plan: TrainingPlan, week: number, workouts: CoachWorkout[], units: Units, now: number): string {
  if (week < 1) return "  (first week, nothing to review)";
  const completions = planCompletions(plan, workouts);
  return weekSchedule(plan, week)
    .map((s) => {
      const w = completions.get(sessionKey(week, s.session.id));
      return w
        ? `  ${s.session.id} "${s.session.name}":\n${describeWorkout(w, units, now, "full")}`
        : `  ${s.session.id} "${s.session.name}" (${WEEKDAY_NAMES[s.date.getDay()]}): NOT DONE`;
    })
    .join("\n\n");
}

export function buildCheckInRequest(
  user: Doc<"users">,
  data: CoachData,
  plan: TrainingPlan,
  week: number,
  opts: { comment?: string; language?: string; now?: number } = {},
): CheckInRequest {
  const now = opts.now ?? Date.now();
  const units = unitsOf(user);
  const unit = units === "imperial" ? "lb" : "kg";
  const catalog = buildCatalog(user.equipment as Equipment[] | undefined, data.customExercises);
  const phase = phaseOf(plan, week);
  const deload = !!phase?.deload;

  const phases = plan.phases
    .map((p) => `  - Weeks ${p.startWeek}-${p.endWeek}: ${p.name}${p.deload ? " (deload)" : ""}: ${p.focus}${week >= p.startWeek && week <= p.endWeek ? "  ← THIS WEEK" : ""}`)
    .join("\n");
  const sessions = plan.sessions
    .map((s) => `  ${s.id} "${s.name}" (${s.focus}):\n${s.exercises.map((e) => `    • ${e.exerciseId} (${e.exerciseName}): ${e.sets}×${e.reps}, rest ${e.restSeconds}s`).join("\n")}`)
    .join("\n");

  // Training outside the plan since last week started (it affects recovery).
  const lastWeekStart = weekRange(plan, week - 1).start.getTime();
  const other = data.workouts
    .filter((w) => w.source?.type !== "plan" && w.startTime >= lastWeekStart)
    .map((w) => describeWorkout(w, units, now, "brief"));

  const system = `You are the user's strength coach running the weekly check-in of their training plan. Review last week (planned vs. actual) and set up week ${week}.

PROFILE:
${profileBlock(user, data)}

PLAN: "${plan.name}", goal: ${plan.goal}. ${plan.weeks} weeks, now starting week ${week}.
Progression rule: ${plan.progression}
Phases:
${phases}

WEEKLY SESSIONS (id "name": exerciseId (name): sets×reps, rest):
${sessions}

LAST WEEK (week ${week - 1}), what they actually did. Format: weight×reps; "plan" = what was prescribed; rest = measured time between logged sets:
${lastWeekBlock(plan, week - 1, data.workouts, units, now)}

OTHER TRAINING SINCE THEN:
${other.length ? other.join("\n") : "  none"}

LAST PERFORMANCE PER EXERCISE (newest first):
${lastPerformanceBlock(data.workouts, units, now)}
${opts.comment ? `\nTHE USER SAYS: "${opts.comment}"\n` : ""}
YOUR TASK:
- summary: 2-3 sentences in ${languageName(opts.language)}, personal and specific: how last week went (sessions done, wins, misses, rest or effort issues) and what changes this week and why.
- adjustments: one entry per exercise that needs something for week ${week}:
  • targetWeight: this week's working load in ${unit} (the user's units), a load that exists (barbells in 2.5 kg / 5 lb steps, dumbbells in whole kg or 2.5 kg steps). Give it for every weighted exercise with history: add load if they hit the top of the rep range on all sets, keep it if they were within the range, reduce ~5-10% if they missed reps two weeks in a row or reported pain or fatigue. null for bodyweight, timed and cardio exercises.
  • sets / reps: only to change the prescription (new phase, fatigue, too easy), otherwise null.
  • replaceWith: a catalog ID only if the exercise should be swapped (pain, missing equipment, stalled 3+ weeks), otherwise null.
${deload ? `- This is a DELOAD week: about 60% of the usual sets (set "sets" for each exercise) and loads ~10-15% lighter.` : "- Skipped sessions: don't pile the missed work onto this week."}

AVAILABLE EXERCISES for replacements (id | name | primary muscles | equipment | level | how it's logged):
${catalogText(catalog)}`;

  return {
    messages: [
      { role: "system", content: system },
      { role: "user", content: opts.comment ? `Check in for week ${week}. ${opts.comment}` : `Check in for week ${week}.` },
    ],
    plan,
    week,
    catalog,
    units,
    now,
  };
}

export async function requestCheckIn(openai: OpenAI, req: CheckInRequest, model = AI_MODEL): Promise<string | null | undefined> {
  const exerciseIds = [...new Set(req.plan.sessions.flatMap((s) => s.exercises.map((e) => e.exerciseId)))];
  return requestJson(openai, {
    model,
    messages: req.messages,
    name: "plan_check_in",
    schema: checkInSchema(req.plan.sessions.map((s) => s.id), exerciseIds, req.catalog.map((e) => e.id)),
    shape: CHECK_IN_SHAPE,
    maxTokens: 5000,
  });
}

/** Validate the model's check-in. Throws if there's no summary. */
export function finalizeCheckIn(content: string | null | undefined, req: CheckInRequest, data: CoachData): PlanCheckIn {
  if (!content) throw new Error("No content generated");
  const parsed = JSON.parse(content);
  const summary = text(parsed.summary, 700);
  if (!summary) throw new Error("Check-in has no summary");

  const byId = new Map(req.catalog.map((e) => [e.id, e]));
  const seen = new Set<string>();
  const adjustments: PlanAdjustment[] = [];
  for (const raw of (Array.isArray(parsed.adjustments) ? parsed.adjustments : []).slice(0, 80)) {
    const session = req.plan.sessions.find((s) => s.id === raw?.sessionId);
    const ex = session?.exercises.find((e) => e.exerciseId === raw?.exerciseId);
    if (!session || !ex) continue;
    const key = `${session.id}/${ex.exerciseId}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const replacement = typeof raw.replaceWith === "string" && raw.replaceWith !== ex.exerciseId ? byId.get(raw.replaceWith) : undefined;
    const reps = raw.reps ? normalizeReps(raw.reps, "") || undefined : undefined;
    const sets = raw.sets === null || raw.sets === undefined ? undefined : int(raw.sets, 1, 8, ex.sets);
    const targetWeight = guardLoad({
      suggested: raw.targetWeight,
      exerciseId: replacement?.id ?? ex.exerciseId,
      reps: reps ?? ex.reps,
      workouts: data.workouts,
      units: req.units,
      now: req.now,
    }).kg;

    const adjustment = compact({
      sessionId: session.id,
      exerciseId: ex.exerciseId,
      replaceWith: replacement?.id,
      replaceName: replacement?.name,
      sets: sets !== undefined && sets !== ex.sets ? sets : undefined,
      reps: reps && reps !== ex.reps ? reps : undefined,
      targetWeight,
    });
    if (Object.keys(adjustment).length > 2) adjustments.push(adjustment);
  }

  return { week: req.week, summary, adjustments, checkedInAt: req.now };
}
