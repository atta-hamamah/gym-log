/**
 * AI coach evals: runs the real workout generator and coach chat (same
 * prompts, models and post-processing as the Convex actions) against the
 * made-up users in fixtures.ts, checks the answers and writes a report.
 *
 *   npm run eval                       all fixtures, workout + chat + judge
 *   npm run eval -- --only=imperial-5x5,ppl-stalled-bench
 *   npm run eval -- --repeat=3         generate each workout 3 times (variance)
 *   npm run eval -- --no-chat | --no-workout | --no-judge
 *   npm run eval -- --dry              no API calls: just write the prompts
 *   npm run eval -- --model=gpt-5.1            try another model for workouts and chat
 *   npm run eval -- --judge-model=gpt-5.1      grade chat with another model (default gpt-6.1-sol)
 *
 * The report includes real token usage and cost per workout / chat answer.
 *
 * Needs OPENAI_API_KEY (environment or .env.local). Without it, runs --dry.
 * Reports go to evals/results/<timestamp>/report.md (git-ignored).
 * Exits with code 1 when a hard check fails.
 */
import fs from "node:fs";
import path from "node:path";
import { AsyncLocalStorage } from "node:async_hooks";
import OpenAI from "openai";
import { FIXTURES, NOW, type Check, type Fixture } from "./fixtures";
import { buildWorkoutRequest, finalizeWorkout, requestWorkout, type FinalizedWorkout, type WorkoutRequest } from "../convex/workoutPlanner";
import { chatSystemPrompt, runCoachChat } from "../convex/coachChat";
import { buildCoachContext, unitsOf } from "../convex/coachPrompt";
import { AI_MODEL, temperatureFor } from "../convex/aiModels";
import { EXERCISE_BY_ID } from "../src/constants/exerciseCatalog";
import type { AIGeneratedWorkout } from "../src/types";

// ── Options ──────────────────────────────────────────────

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes(`--${name}`);
const value = (name: string) => argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];

function apiKey(): string | undefined {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY;
  try {
    const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
    return env.match(/^OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
  } catch {
    return undefined;
  }
}

const key = apiKey();
const opts = {
  dry: flag("dry") || !key,
  only: value("only")?.split(",").filter(Boolean),
  repeat: Math.max(1, Number(value("repeat") ?? 1) || 1),
  workout: !flag("no-workout"),
  chat: !flag("no-chat"),
  judge: !flag("no-judge"),
  /** Model for workouts and chat (defaults to what ships). */
  model: value("model") ?? AI_MODEL,
  /** A different model grades chat answers, so the coach never grades itself. */
  judgeModel: value("judge-model") ?? "gpt-6.1-sol",
};

// ── Token metering ───────────────────────────────────────

/** USD per 1M tokens, standard tier (https://developers.openai.com/api/docs/pricing, Nov 2026). */
const PRICES: Record<string, { input: number; cached: number; output: number }> = {
  "gpt-5.1": { input: 1.25, cached: 0.125, output: 10 },
  "gpt-6.1-terra": { input: 1, cached: 0.05, output: 5 },
  "gpt-6.1-sol": { input: 2, cached: 0.1, output: 10 },
  "gpt-4o-mini": { input: 0.15, cached: 0.075, output: 0.6 },
};

interface Meter {
  operations: number;
  calls: number;
  input: number;
  output: number;
  reasoning: number;
  cost: number;
  seconds: number;
}
const meters: Record<"workout" | "chat", Meter> = {
  workout: { operations: 0, calls: 0, input: 0, output: 0, reasoning: 0, cost: 0, seconds: 0 },
  chat: { operations: 0, calls: 0, input: 0, output: 0, reasoning: 0, cost: 0, seconds: 0 },
};
const unpriced = new Set<string>();
const meterScope = new AsyncLocalStorage<keyof typeof meters>();

/** Count tokens and cost of every call the coach code makes (judge calls use their own client). */
function metered(client: OpenAI): OpenAI {
  const completions = client.chat.completions;
  const create = completions.create.bind(completions);
  completions.create = (async (body: any, options?: any) => {
    const response: any = await create(body, options);
    const kind = meterScope.getStore();
    const u = response?.usage;
    if (kind && u) {
      const price = PRICES[body.model];
      if (!price) unpriced.add(body.model);
      const cached = u.prompt_tokens_details?.cached_tokens ?? 0;
      const m = meters[kind];
      m.calls++;
      m.input += u.prompt_tokens;
      m.output += u.completion_tokens;
      m.reasoning += u.completion_tokens_details?.reasoning_tokens ?? 0;
      if (price) m.cost += ((u.prompt_tokens - cached) * price.input + cached * price.cached + u.completion_tokens * price.output) / 1e6;
    }
    return response;
  }) as any;
  return client;
}

async function measure<T>(kind: keyof typeof meters, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await meterScope.run(kind, fn);
  } finally {
    meters[kind].operations++;
    meters[kind].seconds += (Date.now() - started) / 1000;
  }
}

const openai = opts.dry ? null : metered(new OpenAI({ apiKey: key }));
const judgeClient = opts.dry ? null : new OpenAI({ apiKey: key });

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outDir = path.join(__dirname, "results", opts.dry ? `${stamp}-dry` : `${stamp}-${opts.model}`);
fs.mkdirSync(outDir, { recursive: true });
const save = (name: string, text: string) => fs.writeFileSync(path.join(outDir, name), text, "utf8");

// ── Checks that apply to every generated workout ─────────

function commonWorkoutChecks(f: Fixture, req: WorkoutRequest, result: FinalizedWorkout): Check[] {
  const w = result.workout;
  const have = req.equipment ? new Set<string>(req.equipment) : null;
  const missing = have
    ? w.exercises.filter((x) => !x.isNew && (EXERCISE_BY_ID[x.exerciseId ?? ""]?.equipment ?? []).some((item) => !have.has(item)))
    : [];
  // Rough duration: 45 s per set plus the prescribed rest, plus a 5 min warm-up.
  const ownEstimate = 5 + w.exercises.reduce((a, x) => a + (x.sets * (45 + x.restSeconds)) / 60, 0);
  const needsCorrection = result.loadChanges.filter((c) => c.kind !== "rounded");
  return [
    { name: "valid exercises only", pass: result.dropped.length === 0, detail: result.dropped.join(", "), soft: true },
    { name: "fits the equipment", pass: missing.length === 0, detail: missing.map((x) => x.exerciseName).join(", ") },
    {
      name: `claims to fit ${req.minutes} min`,
      pass: w.estimatedMinutes !== undefined && w.estimatedMinutes <= req.minutes,
      detail: `estimated ${w.estimatedMinutes ?? "?"} min`,
    },
    {
      name: `sets × rest really fit ${req.minutes} min`,
      pass: ownEstimate <= req.minutes * 1.2,
      detail: `~${Math.round(ownEstimate)} min by sets and rest (supersets make it shorter)`,
      soft: true,
    },
    {
      name: "AI loads needed no correction",
      pass: needsCorrection.length === 0,
      detail: needsCorrection.map((c) => `${c.exercise}: ${c.kind} — ${c.detail}`).join("; "),
      soft: true,
    },
  ];
}

// ── Judge for chat answers ───────────────────────────────

interface Verdict {
  score: number;
  verdict: string;
  issues: string[];
}

async function judge(f: Fixture, answer: string): Promise<Verdict> {
  const response = await judgeClient!.chat.completions.create({
    model: opts.judgeModel,
    ...temperatureFor(opts.judgeModel, 0),
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `You audit an AI strength coach inside a workout app. You get the user's data (exactly what the coach saw), the question, the coach's answer and a rubric describing a good answer.
Score 1-5:
5 = excellent: accurate, specific to this user's data, safe, actionable
4 = good, minor issues
3 = acceptable but generic, or misses something important from the rubric
2 = poor: wrong or misleading in a way that matters
1 = harmful, or presents invented data as the user's
Any number the answer presents as the user's own data that is not in USER DATA counts as invented: score 2 or lower.
Return JSON only: {"score": number, "verdict": "one sentence", "issues": ["short issue", ...]}`,
      },
      {
        role: "user",
        content: `USER DATA:\n${buildCoachContext(f.user, f.data, { now: NOW })}\n\nQUESTION:\n${f.chat!.question}\n\nCOACH'S ANSWER:\n${answer}\n\nRUBRIC:\n${f.chat!.rubric}`,
      },
    ],
  });
  const parsed = JSON.parse(response.choices[0]?.message?.content ?? "{}");
  return { score: Number(parsed.score) || 0, verdict: String(parsed.verdict ?? ""), issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [] };
}

// ── Running one fixture ──────────────────────────────────

interface LoadStats {
  suggested: number;
  rounded: number;
  corrected: number;
}

interface FixtureResult {
  fixture: Fixture;
  checks: Check[];
  markdown: string;
  loads: LoadStats;
  judgeScore?: number;
}

const mark = (c: Check) => (c.pass ? "✅" : c.soft ? "⚠️" : "❌");
const checkLines = (checks: Check[]) => checks.map((c) => `- ${mark(c)} ${c.name}${c.detail ? ` — ${c.detail}` : ""}`).join("\n");

function loadText(kg: number | undefined, f: Fixture): string {
  if (kg === undefined) return "—";
  return unitsOf(f.user) === "imperial" ? `${Math.round(+(kg * 2.20462).toFixed(1) * 2) / 2} lb` : `${Math.round(kg * 2) / 2} kg`;
}

function workoutTable(w: AIGeneratedWorkout, f: Fixture): string {
  const rows = w.exercises.map((x) =>
    `| ${x.exerciseName}${x.isNew ? " (new)" : ""} | ${x.sets}×${x.reps} | ${x.restSeconds}s | ${loadText(x.targetWeight, f)} | ${x.supersetGroup ?? ""} | ${(x.notes ?? "").replace(/\|/g, "/")} |`,
  );
  return [
    `**${w.workoutName}** · est. ${w.estimatedMinutes ?? "?"} min`,
    "",
    `> ${w.reasoning}`,
    "",
    w.warmup ? `Warm-up: ${w.warmup}\n` : "",
    "| Exercise | Sets×Reps | Rest | Load | SS | Notes |",
    "|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

async function runWorkout(f: Fixture, run: number): Promise<{ checks: Check[]; markdown: string; loads: LoadStats }> {
  const req = buildWorkoutRequest(f.user, f.data, f.workout!.args, NOW);
  const label = opts.repeat > 1 ? ` (run ${run})` : "";
  const loads: LoadStats = { suggested: 0, rounded: 0, corrected: 0 };
  if (opts.dry) {
    save(`${f.id}.workout-prompt.txt`, req.messages.map((m) => `### ${m.role}\n${m.content}`).join("\n\n"));
    return { checks: [], markdown: `### Workout${label}\nDry run — prompt saved to \`${f.id}.workout-prompt.txt\`.`, loads };
  }
  const started = Date.now();
  let content: string | null | undefined;
  try {
    content = await measure("workout", () => requestWorkout(openai!, req, opts.model));
    save(`${f.id}.workout-raw${opts.repeat > 1 ? `-${run}` : ""}.json`, content ?? "");
    const result = finalizeWorkout(content, req, f.data);
    const raw = JSON.parse(content!);
    loads.suggested = (raw.exercises ?? []).filter((x: any) => typeof x.targetWeight === "number" && x.targetWeight > 0).length;
    loads.rounded = result.loadChanges.filter((c) => c.kind === "rounded").length;
    loads.corrected = result.loadChanges.filter((c) => c.kind !== "rounded").length;
    const checks = [...commonWorkoutChecks(f, req, result), ...(f.workout!.checks?.(result.workout) ?? [])];
    const changes = result.loadChanges.length
      ? `\n**Load safety net:**\n${result.loadChanges.map((c) => `- ${c.exercise}: ${c.kind} — ${c.detail}`).join("\n")}\n`
      : "";
    return {
      checks,
      loads,
      markdown: `### Workout${label} · ${((Date.now() - started) / 1000).toFixed(1)}s\n${workoutTable(result.workout, f)}\n${changes}\n${checkLines(checks)}`,
    };
  } catch (e: any) {
    const checks: Check[] = [{ name: "generator returned a usable plan", pass: false, detail: e?.message ?? String(e) }];
    return { checks, loads, markdown: `### Workout${label}\n${checkLines(checks)}\n\nRaw answer:\n\`\`\`\n${content ?? "(none)"}\n\`\`\`` };
  }
}

async function runChat(f: Fixture): Promise<{ checks: Check[]; markdown: string; score?: number }> {
  const c = f.chat!;
  if (opts.dry) {
    save(`${f.id}.chat-prompt.txt`, `${chatSystemPrompt(f.user, f.data, null, NOW)}\n\n### user\n${c.question}`);
    return { checks: [], markdown: `### Chat\nDry run — prompt saved to \`${f.id}.chat-prompt.txt\`.` };
  }
  const started = Date.now();
  try {
    const { reply, model } = await measure("chat", () =>
      runCoachChat(openai!, { user: f.user, data: f.data, message: c.question, history: [], now: NOW, model: opts.model }),
    );
    const checks: Check[] = [
      { name: "reply is concise", pass: reply.length <= 2500, detail: `${reply.length} chars`, soft: true },
      ...(c.checks?.(reply) ?? []),
    ];
    let judged = "";
    let score: number | undefined;
    if (opts.judge) {
      // A grader error must not be blamed on the coach's answer.
      try {
        const v = await judge(f, reply);
        score = v.score;
        checks.push({ name: `judge score ${v.score}/5`, pass: v.score >= 4, soft: v.score === 3, detail: v.verdict });
        judged = v.issues.length ? `\n**Judge's issues:**\n${v.issues.map((i) => `- ${i}`).join("\n")}\n` : "";
      } catch (e: any) {
        checks.push({ name: "judge ran", pass: false, soft: true, detail: e?.message ?? String(e) });
      }
    }
    const quoted = reply.split("\n").map((l) => `> ${l}`).join("\n");
    return {
      checks,
      score,
      markdown: `### Chat · ${model} · ${((Date.now() - started) / 1000).toFixed(1)}s\n**Q:** ${c.question}\n\n${quoted}\n${judged}\n${checkLines(checks)}`,
    };
  } catch (e: any) {
    const checks: Check[] = [{ name: "chat answered", pass: false, detail: e?.message ?? String(e) }];
    return { checks, markdown: `### Chat\n${checkLines(checks)}` };
  }
}

async function runFixture(f: Fixture): Promise<FixtureResult> {
  const parts: string[] = [`## ${f.id}\n_${f.description}_`];
  const checks: Check[] = [];
  const loads: LoadStats = { suggested: 0, rounded: 0, corrected: 0 };
  let judgeScore: number | undefined;
  if (f.workout && opts.workout) {
    for (let run = 1; run <= opts.repeat; run++) {
      const r = await runWorkout(f, run);
      checks.push(...r.checks);
      parts.push(r.markdown);
      loads.suggested += r.loads.suggested;
      loads.rounded += r.loads.rounded;
      loads.corrected += r.loads.corrected;
    }
  }
  if (f.chat && opts.chat) {
    const r = await runChat(f);
    checks.push(...r.checks);
    parts.push(r.markdown);
    judgeScore = r.score;
  }
  return { fixture: f, checks, markdown: parts.join("\n\n"), loads, judgeScore };
}

// ── Main ─────────────────────────────────────────────────

async function main() {
  const fixtures = FIXTURES.filter((f) => !opts.only || opts.only.includes(f.id));
  if (!fixtures.length) throw new Error(`No fixture matches --only=${opts.only?.join(",")}. Known: ${FIXTURES.map((f) => f.id).join(", ")}`);
  if (opts.dry) console.log(key ? "Dry run: writing prompts only." : "No OPENAI_API_KEY found (env or .env.local): dry run, writing prompts only.");
  console.log(`Running ${fixtures.length} fixture(s)…`);

  const results = await Promise.all(
    fixtures.map(async (f) => {
      const r = await runFixture(f);
      const failed = r.checks.filter((c) => !c.pass && !c.soft).length;
      const warned = r.checks.filter((c) => !c.pass && c.soft).length;
      console.log(`${failed ? "✖" : warned ? "!" : "✔"} ${f.id.padEnd(22)} ${r.checks.length - failed - warned}/${r.checks.length} passed${warned ? `, ${warned} warning(s)` : ""}${failed ? `, ${failed} FAILED` : ""}`);
      return r;
    }),
  );

  const all = results.flatMap((r) => r.checks);
  const failed = all.filter((c) => !c.pass && !c.soft).length;
  const warned = all.filter((c) => !c.pass && c.soft).length;
  const loads = results.reduce((a, r) => ({ suggested: a.suggested + r.loads.suggested, rounded: a.rounded + r.loads.rounded, corrected: a.corrected + r.loads.corrected }), { suggested: 0, rounded: 0, corrected: 0 });
  const scores = results.map((r) => r.judgeScore).filter((s): s is number => s !== undefined);

  const usage = (["workout", "chat"] as const)
    .filter((k) => meters[k].operations > 0)
    .map((k) => {
      const m = meters[k];
      const n = m.operations;
      return `${k === "workout" ? "Workout" : "Chat answer"}: avg $${(m.cost / n).toFixed(4)}, ${(m.seconds / n).toFixed(1)}s, ${Math.round(m.input / n)} input / ${Math.round(m.output / n)} output tokens${m.reasoning ? ` (${Math.round(m.reasoning / n)} reasoning)` : ""} over ${n}`;
    });

  const summary = [
    `# AI coach eval — ${new Date().toLocaleString()}`,
    opts.dry ? "**Dry run:** no model calls; prompts saved next to this report." : `Model: **${opts.model}** · judge: ${opts.judgeModel}`,
    usage.length ? usage.join("\n\n") : "",
    unpriced.size ? `No price on file for: ${[...unpriced].join(", ")} (cost excludes them).` : "",
    `Checks: ${all.length - failed - warned} passed, ${warned} warnings, ${failed} failed.`,
    loads.suggested ? `AI loads: ${loads.suggested} suggested, ${loads.rounded} rounded to loadable plates, ${loads.corrected} capped/flagged by the safety net.` : "",
    scores.length ? `Chat judge: average ${(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)}/5 over ${scores.length} answers.` : "",
  ].filter(Boolean).join("\n\n");

  save("report.md", [summary, ...results.map((r) => r.markdown)].join("\n\n---\n\n"));
  console.log(`\n${summary.replace(/^# .*\n\n/, "").replace(/\*\*/g, "")}`);
  console.log(`\nReport: ${path.join(outDir, "report.md")}`);
  process.exitCode = failed ? 1 : 0;
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
