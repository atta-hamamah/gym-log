/**
 * Deterministic tests for AI training plans (no API key needed): schedule,
 * progress, session resolution, and validation of the model's answers.
 * Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  dateKey,
  fromDateKey,
  nextMonday,
  planProgress,
  resolveSession,
  sessionStatus,
  weekOf,
  weekSchedule,
} from "../src/utils/trainingPlan";
import { buildCheckInRequest, buildPlanRequest, finalizeCheckIn, finalizePlan, normalizePlanArgs, sessionDayOrder } from "../convex/planner";
import { buildCoachContext } from "../convex/coachPrompt";
import type { TrainingPlan, WorkoutSession } from "../src/types";
import { FIXTURES, NOW, coachData, e, session } from "./fixtures";

/** Thursday 2026-11-05, training Mon / Wed / Fri, 4 weeks with a deload in week 4. */
function makePlan(overrides: Partial<TrainingPlan> = {}): TrainingPlan {
  return {
    id: "plan1",
    name: "Test Plan",
    goal: "Build muscle",
    overview: "",
    progression: "Add weight when you hit the top of the range.",
    startDate: "2026-11-05",
    weeks: 4,
    trainingDays: [1, 3, 5],
    sessionMinutes: 60,
    phases: [
      { name: "Build", startWeek: 1, endWeek: 3, focus: "Volume", deload: false },
      { name: "Deload", startWeek: 4, endWeek: 4, focus: "Recover", deload: true },
    ],
    sessions: [
      { id: "s1", name: "Upper A", focus: "Chest & back", exercises: [{ exerciseId: "ex-bench-press", exerciseName: "Barbell Bench Press", sets: 3, reps: "8-10", restSeconds: 120, startWeight: 80 }] },
      { id: "s2", name: "Lower A", focus: "Legs", exercises: [{ exerciseId: "ex-squat", exerciseName: "Barbell Squat", sets: 4, reps: "6-8", restSeconds: 150, startWeight: 100 }] },
      { id: "s3", name: "Upper B", focus: "Shoulders & arms", exercises: [{ exerciseId: "ex-ohp", exerciseName: "Overhead Press", sets: 3, reps: "8-10", restSeconds: 90 }] },
    ],
    checkIns: [],
    createdAt: 0,
    ...overrides,
  };
}

const done = (planId: string, week: number, sessionId: string): Pick<WorkoutSession, "source"> => ({
  source: { type: "plan", planId, planWeek: week, planSessionId: sessionId },
});

test("weeks start on the start date and sessions follow the weekday order", () => {
  const plan = makePlan();
  const w1 = weekSchedule(plan, 1);
  // Week 1 runs Thu 5 → Wed 11: Fri 6 (s1), Mon 9 (s2), Wed 11 (s3).
  assert.deepEqual(w1.map((s) => [s.session.id, s.dateKey]), [["s1", "2026-11-06"], ["s2", "2026-11-09"], ["s3", "2026-11-11"]]);
  assert.deepEqual(weekSchedule(plan, 2).map((s) => s.dateKey), ["2026-11-13", "2026-11-16", "2026-11-18"]);
  assert.deepEqual(sessionDayOrder(plan.startDate, plan.trainingDays), [5, 1, 3]);
});

test("weekOf counts 7-day blocks from the start date", () => {
  const plan = makePlan();
  assert.equal(weekOf(plan, fromDateKey("2026-11-04")), 0);
  assert.equal(weekOf(plan, fromDateKey("2026-11-05")), 1);
  assert.equal(weekOf(plan, fromDateKey("2026-11-11")), 1);
  assert.equal(weekOf(plan, fromDateKey("2026-11-12")), 2);
  assert.equal(weekOf(plan, fromDateKey("2026-12-03")), 5);
});

test("date helpers", () => {
  assert.equal(dateKey(addDays(fromDateKey("2026-12-30"), 3)), "2027-01-02");
  assert.equal(dateKey(nextMonday(fromDateKey("2026-11-05"))), "2026-11-09");
  assert.equal(dateKey(nextMonday(fromDateKey("2026-11-09"))), "2026-11-16");
});

test("resolveSession: week-1 loads, deload sets, check-in changes", () => {
  const plan = makePlan({
    checkIns: [{
      week: 2,
      summary: "Good week.",
      checkedInAt: 0,
      adjustments: [
        { sessionId: "s1", exerciseId: "ex-bench-press", targetWeight: 82.5 },
        { sessionId: "s3", exerciseId: "ex-ohp", replaceWith: "ex-db-shoulder-press", replaceName: "Seated Dumbbell Shoulder Press", sets: 4 },
      ],
    }],
  });
  assert.equal(resolveSession(plan, 1, "s1")!.exercises[0].targetWeight, 80);
  const w2 = resolveSession(plan, 2, "s1")!;
  assert.equal(w2.exercises[0].targetWeight, 82.5);
  assert.equal(w2.exercises[0].changed, false, "a load change alone isn't flagged as 'updated'");
  const swapped = resolveSession(plan, 2, "s3")!.exercises[0];
  assert.equal(swapped.exerciseId, "ex-db-shoulder-press");
  assert.equal(swapped.replacedId, "ex-ohp");
  assert.equal(swapped.sets, 4);
  assert.equal(swapped.changed, true);
  assert.equal(resolveSession(plan, 3, "s1")!.exercises[0].targetWeight, undefined, "no check-in yet: no load");
  const deload = resolveSession(plan, 4, "s2")!;
  assert.equal(deload.deload, true);
  assert.equal(deload.exercises[0].sets, 2, "4 sets → ~60%");
});

test("planProgress: completions, adherence, next session, finish", () => {
  const plan = makePlan();
  const workouts = [done("plan1", 1, "s1"), done("plan1", 1, "s2"), done("other", 1, "s3")];
  // Wednesday of week 1, s3 is today.
  const p = planProgress(plan, workouts, fromDateKey("2026-11-11"));
  assert.equal(p.currentWeek, 1);
  assert.equal(p.done, 2);
  assert.equal(p.total, 12);
  assert.equal(p.due, 3);
  assert.equal(Math.round(p.adherence! * 100), 67);
  assert.equal(p.next?.session.id, "s3");
  assert.equal(sessionStatus(p.next!, p.completions, fromDateKey("2026-11-11")), "today");

  // Week 2, Wednesday, nothing done: the missed Friday session comes first.
  const p2 = planProgress(plan, workouts, fromDateKey("2026-11-18"));
  assert.equal(p2.currentWeek, 3 - 1);
  assert.equal(p2.next?.session.id, "s1");
  assert.equal(sessionStatus(p2.next!, p2.completions, fromDateKey("2026-11-18")), "missed");

  const after = planProgress(plan, workouts, fromDateKey("2026-12-10"));
  assert.equal(after.finished, true);
  assert.equal(after.next, null);
  assert.equal(after.currentWeek, 4);
});

test("normalizePlanArgs clamps ranges and rejects bad input", () => {
  const a = normalizePlanArgs({ weeks: 40, trainingDays: [1, 1, 3, 9], sessionMinutes: 5, startDate: "2026-11-05" });
  assert.equal(a.weeks, 16);
  assert.deepEqual(a.trainingDays, [1, 3]);
  assert.equal(a.sessionMinutes, 20);
  assert.throws(() => normalizePlanArgs({ weeks: 8, trainingDays: [], sessionMinutes: 60, startDate: "2026-11-05" }));
  assert.throws(() => normalizePlanArgs({ weeks: 8, trainingDays: [1], sessionMinutes: 60, startDate: "Nov 5" }));
});

test("finalizePlan: phases fit the length, rotation fills every day, loads are guarded", () => {
  const f = FIXTURES.find((x) => x.id === "imperial-5x5")!;
  const req = buildPlanRequest(f.user, f.data, { weeks: 8, trainingDays: [1, 3, 5], sessionMinutes: 75, startDate: "2026-11-09", language: "en" }, NOW);
  const ex = (o: Record<string, unknown>) => ({ sets: 5, reps: "5", restSeconds: 180, targetWeight: null, supersetGroup: null, notes: "", ...o });
  const answer = JSON.stringify({
    name: "Strength Block",
    goal: "Stronger squat, bench, deadlift",
    overview: "Linear progression.",
    progression: "+5 lb per session.",
    phases: [
      { name: "Base", weeks: 4, focus: "Volume", deload: false },
      { name: "Peak", weeks: 5, focus: "Heavier", deload: false },
      { name: "Deload", weeks: 1, focus: "Recover", deload: true },
    ],
    sessions: [
      { name: "A", focus: "Squat & bench", estimatedMinutes: 70, exercises: [ex({ exerciseId: "ex-squat", targetWeight: 231 }), ex({ exerciseId: "ex-squat" }), ex({ exerciseId: "ex-nope" }), ex({ exerciseId: "ex-bench-press", targetWeight: 185 })] },
      { name: "B", focus: "Squat & pull", estimatedMinutes: 70, exercises: [ex({ exerciseId: "ex-deadlift", sets: 1, targetWeight: 700 })] },
    ],
  });
  const plan = finalizePlan(answer, req, f.data);

  assert.deepEqual(plan.phases.map((p) => [p.name, p.startWeek, p.endWeek]), [["Base", 1, 4], ["Peak", 5, 7], ["Deload", 8, 8]]);
  assert.deepEqual(plan.sessions.map((s) => [s.id, s.name]), [["s1", "A"], ["s2", "B"], ["s3", "A"]], "3 training days, 2 sessions: rotation repeats");
  assert.deepEqual(plan.sessions[0].exercises.map((e) => e.exerciseId), ["ex-squat", "ex-bench-press"], "duplicates and unknown IDs dropped");
  const lb = (kg: number) => Math.round(+(kg * 2.20462).toFixed(1) * 2) / 2;
  assert.equal(lb(plan.sessions[0].exercises[0].startWeight!), 230);
  assert.equal(lb(plan.sessions[1].exercises[0].startWeight!), 345, "700 lb capped near the last 315 lb");
  assert.equal(plan.startDate, "2026-11-09");
  assert.equal(plan.weeks, 8);
  assert.throws(() => finalizePlan(JSON.stringify({ sessions: [{ name: "x", exercises: [{ exerciseId: "nope" }] }] }), req, f.data));
});

test("plan prompt states the weekday order, length and language", () => {
  const f = FIXTURES.find((x) => x.id === "ppl-stalled-bench")!;
  const req = buildPlanRequest(f.user, f.data, { weeks: 6, trainingDays: [1, 3, 5], sessionMinutes: 60, startDate: "2026-11-05", language: "ar" }, NOW);
  const system = String(req.messages[0].content);
  assert.match(system, /3 sessions a week, in this order: 1\) Friday, 2\) Monday, 3\) Wednesday/);
  assert.match(system, /6-week training plan/);
  assert.match(system, /all in Arabic/);
  assert.match(system, /targetWeight: the week-1 working load in kg/);
});

test("check-in: prompt shows last week planned vs. actual; answer is validated", () => {
  const f = FIXTURES.find((x) => x.id === "ppl-stalled-bench")!;
  // Week 1 started 8 days ago; the bench session was done from the plan, the others weren't.
  const start = dateKey(addDays(new Date(NOW), -8));
  const plan = makePlan({ id: "plan-ppl", startDate: start, weeks: 6 });
  const benchDay = weekSchedule(plan, 1)[0];
  const w = session(Math.round((NOW - benchDay.date.getTime()) / 86400000), "Upper A", [e("ex-bench-press", "80x10 80x10 80x9", { plan: "3x8-10@120" })]);
  w.source = { type: "plan", planId: "plan-ppl", planWeek: 1, planSessionId: "s1", dayName: "Upper A" };
  const data = coachData([w, ...f.data.workouts], plan);

  const req = buildCheckInRequest(f.user, data, plan, 2, { comment: "Shoulder a bit sore", language: "en", now: NOW });
  const system = String(req.messages[0].content);
  assert.match(system, /LAST WEEK \(week 1\)/);
  assert.match(system, /s1 "Upper A":\n.*training plan session "Upper A" \(week 1\)/);
  assert.match(system, /s2 "Lower A" \(\w+\): NOT DONE/);
  assert.match(system, /THE USER SAYS: "Shoulder a bit sore"/);

  const answer = JSON.stringify({
    summary: "Solid bench week; you missed Lower A.",
    adjustments: [
      { sessionId: "s1", exerciseId: "ex-bench-press", targetWeight: 82.5, sets: 3, reps: null, replaceWith: null },
      { sessionId: "s1", exerciseId: "ex-bench-press", targetWeight: 90, sets: null, reps: null, replaceWith: null },
      { sessionId: "s9", exerciseId: "ex-squat", targetWeight: 100, sets: null, reps: null, replaceWith: null },
      { sessionId: "s3", exerciseId: "ex-ohp", targetWeight: null, sets: 4, reps: "10-12", replaceWith: "ex-db-shoulder-press" },
      { sessionId: "s2", exerciseId: "ex-squat", targetWeight: null, sets: 4, reps: null, replaceWith: null },
    ],
  });
  const result = finalizeCheckIn(answer, req, data);
  assert.equal(result.week, 2);
  assert.equal(result.summary, "Solid bench week; you missed Lower A.");
  assert.deepEqual(result.adjustments, [
    { sessionId: "s1", exerciseId: "ex-bench-press", targetWeight: 82.5 },
    { sessionId: "s3", exerciseId: "ex-ohp", replaceWith: "ex-db-shoulder-press", replaceName: "Seated Dumbbell Shoulder Press", sets: 4, reps: "10-12" },
  ], "unchanged sets, duplicates, unknown sessions and no-op entries are dropped");
  assert.throws(() => finalizeCheckIn(JSON.stringify({ summary: "", adjustments: [] }), req, data));
});

test("the coach sees the plan: week, phase, this week's sessions", () => {
  const f = FIXTURES.find((x) => x.id === "ppl-stalled-bench")!;
  const plan = makePlan({ startDate: dateKey(addDays(new Date(NOW), -8)), weeks: 6 });
  const context = buildCoachContext(f.user, coachData(f.data.workouts, plan), { now: NOW });
  assert.match(context, /TRAINING PLAN THEY FOLLOW/);
  assert.match(context, /"Test Plan", goal: Build muscle/);
  assert.match(context, /Week 2 of 6, phase "Build"/);
  assert.match(context, /This week: \w{3} Upper A \((done|today|missed|upcoming)\)/);
});
