/**
 * Turns a user's training data into compact text the AI coach can reason
 * over: every set, planned vs. actual, measured rest times, session timing,
 * muscle recovery, weekly volume per muscle group and strength trends.
 *
 * Pure functions (no Convex runtime APIs), shared by the chat, workout
 * generation and post-workout summary actions.
 */
import type { Doc } from "./_generated/dataModel";
import type { CoachData, CoachExercise, CoachSet, CoachWorkout } from "./coachData";
import { EXERCISE_BY_ID, GROUP_MUSCLES } from "../src/constants/exerciseCatalog";

export type Units = "metric" | "imperial";

const DAY = 24 * 60 * 60 * 1000;
const KG_TO_LB = 2.20462;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ── Formatting helpers ───────────────────────────────────

const round1 = (n: number) => Math.round(n * 10) / 10;

export function fmtWeight(kg: number, units: Units): string {
  if (units === "imperial") return `${Math.round(kg * KG_TO_LB * 2) / 2}lb`;
  return `${round1(kg)}kg`;
}

function fmtNum(kg: number, units: Units): string {
  return units === "imperial" ? String(Math.round(kg * KG_TO_LB * 2) / 2) : String(round1(kg));
}

function fmtDistance(km: number, units: Units): string {
  return units === "imperial" ? `${round1(km * 0.621371)}mi` : `${round1(km)}km`;
}

export function fmtDuration(sec: number): string {
  const s = Math.round(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}h${String(m % 60).padStart(2, "0")}m`;
  return r === 0 ? `${m}m` : m === 0 ? `${r}s` : `${m}m${String(r).padStart(2, "0")}s`;
}

function fmtDate(t: number, now: number): string {
  const d = new Date(t);
  const days = Math.floor((now - t) / DAY);
  const ago = days <= 0 ? "today" : days === 1 ? "yesterday" : `${days}d ago`;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.toISOString().slice(0, 10)} (${ago})`;
}

function hoursAgo(t: number, now: number): string {
  const h = (now - t) / 3600000;
  if (h < 1) return "just now";
  if (h < 48) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

/** Epley estimate; only meaningful for sets of 12 reps or fewer. */
export function est1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  if (reps === 1) return weight;
  return weight * (1 + Math.min(reps, 12) / 30);
}

const isWorking = (s: CoachSet) => s.completed !== false && s.type !== "warmup";

export function setText(s: CoachSet, units: Units): string {
  const parts: string[] = [];
  if (s.durationSec || s.distance) {
    if (s.durationSec) parts.push(fmtDuration(s.durationSec));
    if (s.distance) parts.push(fmtDistance(s.distance, units));
    if (s.weight > 0) parts.push(`+${fmtWeight(s.weight, units)}`);
    if (s.reps > 0) parts.push(`${s.reps} reps`);
  } else {
    parts.push(s.weight > 0 ? `${fmtNum(s.weight, units)}×${s.reps}` : `BW×${s.reps}`);
  }
  let text = parts.join(" ");
  if (s.rpe) text += ` @RPE${s.rpe}`;
  if (s.type === "warmup") text = `warmup ${text}`;
  if (s.type === "failure") text += " (failure)";
  if (s.type === "drop") text += " (drop)";
  return text;
}

/** Seconds between consecutive logged sets (ignores gaps that can't be rest). */
export function restGaps(sets: CoachSet[]): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < sets.length; i++) {
    const a = sets[i - 1].completedAt;
    const b = sets[i].completedAt;
    if (!a || !b) continue;
    const gap = (b - a) / 1000;
    if (gap >= 5 && gap <= 20 * 60) gaps.push(gap);
  }
  return gaps;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

// ── Exercise metadata ────────────────────────────────────

const MUSCLE_TO_GROUP: Record<string, string> = {};
for (const [group, muscles] of Object.entries(GROUP_MUSCLES)) {
  for (const m of muscles) MUSCLE_TO_GROUP[m] = group;
}

type Customs = CoachData["customExercises"];

function musclesOf(exerciseId: string, customs: Customs): { primary: string[]; secondary: string[]; group: string } {
  const known = EXERCISE_BY_ID[exerciseId];
  // Cardio and mobility work doesn't count towards strength volume.
  if (known && known.category !== "strength") return { primary: [], secondary: [], group: known.muscleGroup };
  if (known) {
    const primary = (known.primaryMuscles ?? []).map((m) => MUSCLE_TO_GROUP[m]).filter(Boolean);
    const secondary = (known.secondaryMuscles ?? []).map((m) => MUSCLE_TO_GROUP[m]).filter(Boolean);
    return { primary: [...new Set(primary)], secondary: [...new Set(secondary)].filter((g) => !primary.includes(g)), group: known.muscleGroup };
  }
  const custom = customs.find((c) => c.id === exerciseId);
  const group = custom?.muscleGroup ?? "Other";
  if (custom && custom.category !== "strength") return { primary: [], secondary: [], group };
  return { primary: GROUP_MUSCLES[group] ? [group] : [], secondary: [], group };
}

// ── Analysis ─────────────────────────────────────────────

export interface RecoveryRow {
  group: string;
  lastTrained: number | null;
  sets7d: number;
}

/** Last time each muscle group was trained and hard sets in the last 7 days (secondary = ½ set). */
export function analyzeRecovery(workouts: CoachWorkout[], customs: Customs, now: number): RecoveryRow[] {
  const rows = new Map<string, RecoveryRow>();
  for (const group of Object.keys(GROUP_MUSCLES)) rows.set(group, { group, lastTrained: null, sets7d: 0 });
  for (const w of workouts) {
    const t = w.endTime ?? w.startTime;
    for (const ex of w.exercises) {
      const n = ex.sets.filter(isWorking).length;
      if (n === 0) continue;
      const { primary, secondary } = musclesOf(ex.exerciseId, customs);
      for (const g of primary) {
        const row = rows.get(g);
        if (!row) continue;
        if (!row.lastTrained || t > row.lastTrained) row.lastTrained = t;
        if (now - t <= 7 * DAY) row.sets7d += n;
      }
      for (const g of secondary) {
        const row = rows.get(g);
        if (row && now - t <= 7 * DAY) row.sets7d += n / 2;
      }
    }
  }
  return [...rows.values()];
}

function recoveryBlock(workouts: CoachWorkout[], customs: Customs, now: number): string {
  const rows = analyzeRecovery(workouts, customs, now);
  return rows
    .map((r) => {
      const last = r.lastTrained ? `last trained directly ${hoursAgo(r.lastTrained, now)}` : "no direct work in the last 60 days";
      return `  - ${r.group}: ${last}, ${round1(r.sets7d)} hard sets in the last 7 days (indirect work counts ½)`;
    })
    .join("\n");
}

function exerciseLine(ex: CoachExercise, units: Units, labels: Map<string, string>): string {
  const working = ex.sets.filter(isWorking);
  const setsText = ex.sets.length ? ex.sets.map((s) => setText(s, units)).join(", ") : "no sets logged";
  const bits: string[] = [];
  if (ex.target) {
    const t = ex.target;
    bits.push(`plan ${t.sets}×${t.reps}, rest ${t.restSeconds}s${t.weight ? `, ~${fmtWeight(t.weight, units)}` : ""}`);
  }
  const gaps = restGaps(ex.sets);
  let restInfo = "";
  if (gaps.length) {
    restInfo = ` | rest avg ${Math.round(avg(gaps))}s (range ${Math.round(Math.min(...gaps))}-${Math.round(Math.max(...gaps))}s)`;
  }
  const times = ex.sets.map((s) => s.completedAt).filter((t): t is number => !!t);
  const span = times.length >= 2 ? ` | ${fmtDuration((Math.max(...times) - Math.min(...times)) / 1000)} on this exercise` : "";
  const done = ex.target ? ` | ${working.length}/${ex.target.sets} planned sets done` : "";
  const ss = ex.supersetGroupId ? ` (superset ${labels.get(ex.supersetGroupId)})` : "";
  const note = ex.notes ? `\n      note: "${ex.notes.slice(0, 200)}"` : "";
  return `    • ${ex.name}${ss}${bits.length ? ` [${bits.join("; ")}]` : ""}: ${setsText}${restInfo}${done}${span}${note}`;
}

function sourceText(source: CoachWorkout["source"]): string {
  if (!source || source.type === "manual") return "logged freely";
  if (source.type === "ai") return "planned by RepAI";
  return `program day "${source.dayName ?? "?"}"`;
}

/** Totals for one session. */
export function sessionStats(w: CoachWorkout) {
  let sets = 0;
  let volume = 0;
  let targetSets = 0;
  let doneTargetSets = 0;
  const gaps: number[] = [];
  for (const ex of w.exercises) {
    const working = ex.sets.filter(isWorking);
    sets += working.length;
    volume += working.reduce((a, s) => a + s.weight * s.reps, 0);
    if (ex.target) {
      targetSets += ex.target.sets;
      doneTargetSets += Math.min(working.length, ex.target.sets);
    }
    gaps.push(...restGaps(ex.sets));
  }
  const durationMin = w.endTime ? Math.round((w.endTime - w.startTime) / 60000) : null;
  return { sets, volume, targetSets, doneTargetSets, avgRest: gaps.length ? Math.round(avg(gaps)) : null, durationMin };
}

export function describeWorkout(w: CoachWorkout, units: Units, now: number, detail: "full" | "brief"): string {
  const st = sessionStats(w);
  const header = [
    `📅 ${fmtDate(w.startTime, now)} — "${w.name}"`,
    st.durationMin !== null ? `${st.durationMin} min` : null,
    w.mood ? `energy ${w.mood}/5` : null,
    sourceText(w.source),
  ].filter(Boolean).join(" · ");

  if (detail === "brief") {
    const list = w.exercises
      .map((ex) => {
        const working = ex.sets.filter(isWorking);
        const best = working.reduce<CoachSet | null>((b, s) => (!b || est1RM(s.weight, s.reps) > est1RM(b.weight, b.reps) ? s : b), null);
        return best ? `${ex.name} ${working.length}×(best ${setText(best, units)})` : `${ex.name} (no sets)`;
      })
      .join("; ");
    return `${header}\n    ${list}`;
  }

  const labels = new Map<string, string>();
  w.exercises.forEach((ex) => {
    if (ex.supersetGroupId && !labels.has(ex.supersetGroupId)) labels.set(ex.supersetGroupId, String.fromCharCode(65 + labels.size));
  });
  const lines = [header];
  if (w.source?.type === "ai" && w.source.reasoning) lines.push(`    plan reasoning: "${w.source.reasoning.slice(0, 300)}"`);
  lines.push(...w.exercises.map((ex) => exerciseLine(ex, units, labels)));
  const totals = [
    `${st.sets} working sets`,
    st.volume > 0 ? `volume ${fmtWeight(st.volume, units)}` : null,
    st.avgRest !== null ? `avg rest ${st.avgRest}s` : null,
    st.targetSets > 0 ? `plan completion ${Math.round((st.doneTargetSets / st.targetSets) * 100)}%` : null,
  ].filter(Boolean).join(", ");
  lines.push(`    totals: ${totals}`);
  if (w.notes) lines.push(`    session notes: "${w.notes.slice(0, 300)}"`);
  return lines.join("\n");
}

/** Best estimated 1RM per session for the most frequent lifts, oldest → newest. */
function progressBlock(workouts: CoachWorkout[], units: Units): string {
  const series = new Map<string, { name: string; points: { t: number; e1rm: number; best: CoachSet }[] }>();
  for (const w of [...workouts].sort((a, b) => a.startTime - b.startTime)) {
    for (const ex of w.exercises) {
      const working = ex.sets.filter((s) => isWorking(s) && s.weight > 0 && s.reps > 0);
      if (!working.length) continue;
      const best = working.reduce((b, s) => (est1RM(s.weight, s.reps) > est1RM(b.weight, b.reps) ? s : b));
      const entry = series.get(ex.exerciseId) ?? { name: ex.name, points: [] };
      entry.points.push({ t: w.startTime, e1rm: est1RM(best.weight, best.reps), best });
      series.set(ex.exerciseId, entry);
    }
  }
  const rows = [...series.values()]
    .filter((s) => s.points.length >= 2)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 12)
    .map((s) => {
      const pts = s.points.slice(-6);
      const trend = pts.map((p) => fmtNum(p.e1rm, units)).join(" → ");
      const first = pts[0].e1rm;
      const last = pts[pts.length - 1].e1rm;
      const change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
      const flag = pts.length >= 3 && Math.abs(change) <= 1 ? " (stalled)" : change < -3 ? " (dropping)" : "";
      return `  - ${s.name}: est. 1RM ${trend} ${units === "imperial" ? "lb" : "kg"} (${change >= 0 ? "+" : ""}${change}%)${flag}`;
    });
  return rows.length ? rows.join("\n") : "  Not enough repeated lifts yet.";
}

/** Last performance per exercise, used for load suggestions. */
function lastPerformanceBlock(workouts: CoachWorkout[], units: Units, now: number): string {
  const seen = new Set<string>();
  const rows: string[] = [];
  for (const w of workouts) {
    for (const ex of w.exercises) {
      if (seen.has(ex.exerciseId)) continue;
      const working = ex.sets.filter(isWorking);
      if (!working.length) continue;
      seen.add(ex.exerciseId);
      rows.push(`  - ${ex.exerciseId} (${ex.name}), ${fmtDate(w.startTime, now)}: ${working.map((s) => setText(s, units)).join(", ")}`);
      if (rows.length >= 40) break;
    }
    if (rows.length >= 40) break;
  }
  return rows.length ? rows.join("\n") : "  No history yet.";
}

function frequencyBlock(workouts: CoachWorkout[], now: number, yearly: CoachData["yearly"]): string {
  const last28 = workouts.filter((w) => now - w.startTime <= 28 * DAY).length;
  const last7 = workouts.filter((w) => now - w.startTime <= 7 * DAY).length;
  const lastSession = workouts[0] ? hoursAgo(workouts[0].endTime ?? workouts[0].startTime, now) : "never";
  const durations = workouts.map((w) => sessionStats(w).durationMin).filter((d): d is number => d !== null);
  const rests = workouts.map((w) => sessionStats(w).avgRest).filter((r): r is number => r !== null);
  return [
    `  - Sessions: ${last7} in the last 7 days, ${last28} in the last 28 days (${round1(last28 / 4)}/week); last session ${lastSession}`,
    `  - Last 12 months: ${yearly.totalWorkouts} sessions, ${yearly.sessionsPerWeek}/week, avg ${yearly.avgDurationMin} min`,
    durations.length ? `  - Recent session length: avg ${Math.round(avg(durations))} min` : null,
    rests.length ? `  - Recent average rest between sets: ${Math.round(avg(rests))}s` : null,
  ].filter(Boolean).join("\n");
}

// ── Profile ──────────────────────────────────────────────

export function ageOf(dateOfBirth?: string): number | null {
  if (!dateOfBirth) return null;
  const t = new Date(dateOfBirth).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / (365.25 * DAY));
}

export function unitsOf(user: Doc<"users">): Units {
  return user.unitPreference === "imperial" ? "imperial" : "metric";
}

export function profileBlock(user: Doc<"users">, data: CoachData): string {
  const units = unitsOf(user);
  const age = ageOf(user.dateOfBirth);
  const m = data.measurements[0];
  const measurementParts = m
    ? (["chest", "waist", "hips", "biceps", "thighs", "neck", "calves"] as const)
        .filter((k) => m[k])
        .map((k) => `${k} ${units === "imperial" ? `${round1(m[k]! / 2.54)}in` : `${m[k]}cm`}`)
    : [];
  return [
    `- Name: ${user.name || "unknown"}`,
    `- Age: ${age ?? "unknown"}; gender: ${user.gender ?? "unknown"}`,
    `- Body: ${user.weight ? fmtWeight(user.weight, units) : "weight unknown"}, ${user.height ? `${user.height}cm` : "height unknown"}${user.bodyFat ? `, ${user.bodyFat}% body fat` : ""}`,
    `- Goal: ${user.goal || "not specified"}`,
    `- Experience: ${user.experience ?? "not specified (infer from history)"}`,
    `- Wants to train: ${user.trainingDays ? `${user.trainingDays} days/week` : "not specified"}, ${user.sessionMinutes ? `${user.sessionMinutes} min per session` : "session length not specified"}`,
    `- Equipment available: ${user.equipment ? (user.equipment.length ? user.equipment.join(", ") : "none (bodyweight only)") : "full gym (not specified)"}`,
    `- Injuries / limitations: ${user.limitations || "none reported"}`,
    `- Units: ${units === "imperial" ? "imperial (lb, in, mi)" : "metric (kg, cm, km)"} — all weights below are already in these units`,
    measurementParts.length ? `- Latest measurements: ${measurementParts.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

function prBlock(prs: Doc<"personalRecords">[], units: Units, now: number): string {
  // Keep the best record per exercise and type.
  const best = new Map<string, Doc<"personalRecords">>();
  for (const pr of prs) {
    const key = `${pr.exerciseId}|${pr.type}`;
    const cur = best.get(key);
    if (!cur || pr.value > cur.value) best.set(key, pr);
  }
  const rows = [...best.values()]
    .filter((pr) => pr.type !== "best_volume")
    .sort((a, b) => b.date - a.date)
    .slice(0, 20)
    .map((pr) =>
      pr.type === "max_weight"
        ? `  - ${pr.exerciseName}: heaviest ${fmtWeight(pr.value, units)} × ${pr.reps ?? "?"} (${fmtDate(pr.date, now)})`
        : `  - ${pr.exerciseName}: est. 1RM ${fmtWeight(pr.value, units)} (${fmtDate(pr.date, now)})`,
    );
  return rows.length ? rows.join("\n") : "  No PRs yet.";
}

// ── Full context ─────────────────────────────────────────

export interface ContextOptions {
  now?: number;
  /** How many recent sessions to show set by set. */
  detailed?: number;
  /** The session the user is doing right now (not saved yet). */
  activeWorkout?: CoachWorkout | null;
}

export function activeWorkoutBlock(w: CoachWorkout, units: Units, now: number): string {
  const started = Math.round((now - w.startTime) / 60000);
  const times = w.exercises.flatMap((e) => e.sets.map((s) => s.completedAt ?? 0)).filter(Boolean);
  const lastSet = times.length ? `last set logged ${Math.round((now - Math.max(...times)) / 1000)}s ago` : "no sets logged yet";
  const remaining = w.exercises
    .filter((ex) => ex.target && ex.sets.filter(isWorking).length < ex.target.sets)
    .map((ex) => `${ex.name} (${ex.sets.filter(isWorking).length}/${ex.target!.sets} sets)`);
  return [
    `IN PROGRESS — started ${started} min ago, ${lastSet}.`,
    describeWorkout({ ...w, endTime: undefined }, units, now, "full"),
    remaining.length ? `    still planned: ${remaining.join(", ")}` : null,
  ].filter(Boolean).join("\n");
}

export function buildCoachContext(user: Doc<"users">, data: CoachData, opts: ContextOptions = {}): string {
  const now = opts.now ?? Date.now();
  const units = unitsOf(user);
  const detailed = opts.detailed ?? 8;
  const workouts = data.workouts;
  const recent = workouts.slice(0, detailed);
  const older = workouts.slice(detailed, detailed + 15);
  const allForAnalysis = opts.activeWorkout ? [opts.activeWorkout, ...workouts] : workouts;

  const sections = [
    `USER PROFILE:\n${profileBlock(user, data)}`,
    `TRAINING FREQUENCY:\n${frequencyBlock(workouts, now, data.yearly)}`,
    `MUSCLE RECOVERY & WEEKLY VOLUME (computed from logged sets; ~10-20 hard sets/week per muscle group is a typical hypertrophy range):\n${recoveryBlock(allForAnalysis, data.customExercises, now)}`,
  ];
  if (opts.activeWorkout) sections.push(`CURRENT WORKOUT:\n${activeWorkoutBlock(opts.activeWorkout, units, now)}`);
  sections.push(
    `RECENT SESSIONS, SET BY SET (newest first). Format: weight×reps; "plan" is what was prescribed; rest = measured time between logged sets:\n${recent.length ? recent.map((w) => describeWorkout(w, units, now, "full")).join("\n\n") : "  No workouts in the last 60 days."}`,
  );
  if (older.length) sections.push(`OLDER SESSIONS (summary):\n${older.map((w) => describeWorkout(w, units, now, "brief")).join("\n")}`);
  sections.push(`STRENGTH TRENDS (best set per session as est. 1RM):\n${progressBlock(workouts, units)}`);
  sections.push(`PERSONAL RECORDS:\n${prBlock(data.personalRecords, units, now)}`);
  return sections.join("\n\n");
}

export { lastPerformanceBlock };

/** Shape of a workout sent by the app (see validators.workoutValidator). */
export interface ClientWorkout {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  notes?: string;
  mood?: number;
  bodyWeight?: number;
  source?: CoachWorkout["source"];
  exercises: {
    exerciseId: string;
    exerciseName: string;
    notes?: string;
    supersetGroupId?: string;
    target?: CoachExercise["target"];
    sets: CoachSet[];
  }[];
}

/** Convert (and bound the size of) a workout sent by the client. */
export function fromClientWorkout(w: ClientWorkout): CoachWorkout {
  return {
    id: w.id,
    name: w.name.slice(0, 100),
    startTime: w.startTime,
    endTime: w.endTime,
    notes: w.notes?.slice(0, 500),
    mood: w.mood,
    bodyWeight: w.bodyWeight,
    source: w.source,
    exercises: w.exercises.slice(0, 30).map((ex) => ({
      exerciseId: ex.exerciseId,
      name: ex.exerciseName.slice(0, 100),
      notes: ex.notes?.slice(0, 300),
      supersetGroupId: ex.supersetGroupId,
      target: ex.target,
      sets: ex.sets.slice(0, 30),
    })),
  };
}
