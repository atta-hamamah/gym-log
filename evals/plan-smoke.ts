/**
 * Live smoke test for AI training plans: builds ONE plan and runs ONE weekly
 * check-in on a made-up user, with the same prompts, model and validation as
 * the app. Two model calls (~$0.05), so run it after changing planner.ts.
 *
 *   npm run eval:plan
 *   npm run eval:plan -- --model=gpt-5.1
 *
 * Needs OPENAI_API_KEY (environment or .env.local).
 * Writes evals/results/<timestamp>-plan.md (git-ignored).
 */
import fs from "node:fs";
import path from "node:path";
import OpenAI from "openai";
import { AI_MODEL } from "../convex/aiModels";
import { buildCheckInRequest, buildPlanRequest, finalizeCheckIn, finalizePlan, requestCheckIn, requestPlan } from "../convex/planner";
import { addDays, dateKey, resolveSession, weekSchedule } from "../src/utils/trainingPlan";
import type { TrainingPlan } from "../src/types";
import { FIXTURES, NOW, coachData, e, session } from "./fixtures";

const model = process.argv.find((a) => a.startsWith("--model="))?.split("=")[1] ?? AI_MODEL;
const key =
  process.env.OPENAI_API_KEY ??
  (() => {
    try {
      return fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8").match(/^OPENAI_API_KEY\s*=\s*"?([^"\r\n]+)"?/m)?.[1];
    } catch {
      return undefined;
    }
  })();
if (!key) {
  console.error("No OPENAI_API_KEY (environment or .env.local).");
  process.exit(1);
}
const openai = new OpenAI({ apiKey: key });

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const started = Date.now();
  const result = await fn();
  console.log(`${label}: ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return result;
}

async function main() {
  const f = FIXTURES.find((x) => x.id === "ppl-stalled-bench")!;
  const lines: string[] = [`# Plan smoke test — ${model}`, ""];

  // 1) Build an 8-week, 4-day plan that started 8 days ago (so week 2 can be checked in).
  const startDate = dateKey(addDays(new Date(NOW), -8));
  const req = buildPlanRequest(
    f.user,
    f.data,
    { weeks: 8, trainingDays: [1, 2, 4, 5], sessionMinutes: 60, startDate, goal: "Build muscle, bring up my bench", language: "en" },
    NOW,
  );
  const content = await timed("Plan", () => requestPlan(openai, req, model));
  const draft = finalizePlan(content, req, f.data);
  const plan: TrainingPlan = { ...draft, id: "smoke-plan", createdAt: NOW };

  lines.push(`## ${plan.name}`, `_${plan.goal}_`, "", plan.overview, "", `**Progression:** ${plan.progression}`, "", "**Phases:**");
  for (const p of plan.phases) lines.push(`- Weeks ${p.startWeek}-${p.endWeek}: ${p.name}${p.deload ? " (deload)" : ""}: ${p.focus}`);
  lines.push("");
  for (const s of weekSchedule(plan, 1)) {
    lines.push(`### ${s.session.id} · ${s.dateKey} · ${s.session.name} (${s.session.focus}, ~${s.session.estimatedMinutes ?? "?"} min)`);
    for (const ex of s.session.exercises) {
      lines.push(`- ${ex.exerciseName}: ${ex.sets}×${ex.reps}, rest ${ex.restSeconds}s${ex.startWeight ? `, start ${ex.startWeight} kg` : ""}${ex.supersetGroup ? ` [${ex.supersetGroup}]` : ""}${ex.notes ? ` — ${ex.notes}` : ""}`);
    }
  }

  // 2) Week 1: the first session done from the plan (bench a bit short of the top of the range), the rest skipped.
  const first = weekSchedule(plan, 1)[0];
  const days = Math.max(0, Math.round((NOW - first.date.getTime()) / 86400000));
  const sets = first.session.exercises.map((ex) => {
    const kg = ex.startWeight ?? 0;
    const reps = Number(String(ex.reps).split("-")[0]) || 8;
    return e(ex.exerciseId, Array(ex.sets).fill(kg ? `${kg}x${reps}` : `BWx${reps}`).join(" "), { plan: `${ex.sets}x${ex.reps}@${ex.restSeconds}` });
  });
  const w = session(days, first.session.name, sets);
  w.source = { type: "plan", planId: plan.id, planWeek: 1, planSessionId: first.session.id, dayName: first.session.name };
  const data = coachData([w, ...f.data.workouts], plan);

  const checkReq = buildCheckInRequest(f.user, data, plan, 2, { comment: "Bench felt heavy, slept badly", language: "en", now: NOW });
  const checkContent = await timed("Check-in", () => requestCheckIn(openai, checkReq, model));
  const checkIn = finalizeCheckIn(checkContent, checkReq, data);
  plan.checkIns = [checkIn];

  lines.push("", "## Week 2 check-in", "", `> ${checkIn.summary}`, "");
  for (const a of checkIn.adjustments) {
    lines.push(`- ${a.sessionId} ${a.exerciseId}: ${[a.replaceWith ? `→ ${a.replaceName}` : null, a.sets ? `${a.sets} sets` : null, a.reps ? `${a.reps} reps` : null, a.targetWeight ? `${a.targetWeight} kg` : null].filter(Boolean).join(", ")}`);
  }
  const resolved = resolveSession(plan, 2, first.session.id)!;
  lines.push("", `Week 2 ${resolved.session.name} as the app shows it: ${resolved.exercises.map((x) => `${x.exerciseName} ${x.sets}×${x.reps}${x.targetWeight ? ` @${x.targetWeight}kg` : ""}`).join("; ")}`);

  const checks = [
    ["4 sessions, one per training day", plan.sessions.length === 4],
    ["phases cover 8 weeks", plan.phases[plan.phases.length - 1].endWeek === 8],
    ["has a deload week", plan.phases.some((p) => p.deload)],
    ["every session has 3+ exercises", plan.sessions.every((s) => s.exercises.length >= 3)],
    ["check-in summary written", checkIn.summary.length > 20],
    ["check-in set loads", checkIn.adjustments.some((a) => a.targetWeight)],
  ] as const;
  lines.push("", "## Checks", ...checks.map(([name, ok]) => `- ${ok ? "✅" : "❌"} ${name}`));

  const out = path.join(__dirname, "results", `${new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19)}-plan.md`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, lines.join("\n"), "utf8");
  for (const [name, ok] of checks) console.log(`${ok ? "✔" : "✖"} ${name}`);
  console.log(`Report: ${out}`);
  process.exitCode = checks.every(([, ok]) => ok) ? 0 : 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
