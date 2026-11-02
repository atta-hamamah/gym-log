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
 *
 * Needs OPENAI_API_KEY (environment or .env.local). Without it, runs --dry.
 * Reports go to evals/results/<timestamp>/report.md (git-ignored).
 * Exits with code 1 when a hard check fails.
 */
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { FIXTURES, NOW, type Check, type Fixture } from "./fixtures";
import { buildWorkoutRequest, finalizeWorkout, requestWorkout, type FinalizedWorkout, type WorkoutRequest } from "../convex/workoutPlanner";
import { chatSystemPrompt, runCoachChat } from "../convex/coachChat";
import { buildCoachContext, unitsOf } from "../convex/coachPrompt";
import { MODEL_SMART } from "../convex/aiModels";
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
};
const openai = opts.dry ? null : new OpenAI({ apiKey: key });

const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
const outDir = path.join(__dirname, "results", opts.dry ? `${stamp}-dry` : stamp);
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
  const response = await openai!.chat.completions.create({
    model: MODEL_SMART,
    temperature: 0,
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
    content = await requestWorkout(openai!, req);
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
    const { reply, model } = await runCoachChat(openai!, { user: f.user, data: f.data, message: c.question, history: [], now: NOW });
    const checks: Check[] = [
      { name: "reply is concise", pass: reply.length <= 2500, detail: `${reply.length} chars`, soft: true },
      ...(c.checks?.(reply) ?? []),
    ];
    let judged = "";
    let score: number | undefined;
    if (opts.judge) {
      const v = await judge(f, reply);
      score = v.score;
      checks.push({ name: `judge score ${v.score}/5`, pass: v.score >= 4, soft: v.score === 3, detail: v.verdict });
      judged = v.issues.length ? `\n**Judge's issues:**\n${v.issues.map((i) => `- ${i}`).join("\n")}\n` : "";
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

  const summary = [
    `# AI coach eval — ${new Date().toLocaleString()}`,
    opts.dry ? "**Dry run:** no model calls; prompts saved next to this report." : "",
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
