/**
 * Deterministic tests for the AI plumbing (no API key needed):
 * the load safety net, validation of the generator's answer, and that every
 * eval fixture builds valid prompts.   Run: npm test
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { guardLoad, lowestReps } from "../convex/loadGuard";
import { buildWorkoutRequest, finalizeWorkout } from "../convex/workoutPlanner";
import { chatSystemPrompt } from "../convex/coachChat";
import type { Units } from "../convex/coachPrompt";
import { FIXTURES, NOW, e, session } from "./fixtures";

/** How the app shows a kg value to a pounds user (UnitsContext + preview rounding). */
const lbOf = (kg: number) => Math.round(+(kg * 2.20462).toFixed(1) * 2) / 2;

const bench = (daysAgo: number, sets: string, units?: Units) =>
  session(daysAgo, "Upper", [e("ex-bench-press", sets, { plan: "3x8-10@120" })], { units });

const guard = (suggested: unknown, workouts: ReturnType<typeof bench>[], extra: { reps?: string; units?: Units; exerciseId?: string } = {}) =>
  guardLoad({ suggested, exerciseId: extra.exerciseId ?? "ex-bench-press", reps: extra.reps ?? "8-10", workouts, units: extra.units ?? "metric", now: NOW });

test("lowestReps reads the bottom of a rep prescription", () => {
  assert.equal(lowestReps("8-10"), 8);
  assert.equal(lowestReps("5"), 5);
  assert.equal(lowestReps("12 - 15"), 12);
  assert.equal(lowestReps("AMRAP"), null);
  assert.equal(lowestReps("45s"), null);
  assert.equal(lowestReps("20min"), null);
});

test("keeps a sensible suggestion untouched", () => {
  const d = guard(82.5, [bench(3, "80x10 80x10 80x10"), bench(7, "77.5x10 77.5x9 77.5x9")]);
  assert.equal(d.kg, 82.5);
  assert.deepEqual(d.changes, []);
});

test("rounds to the user's plate increments", () => {
  const d = guard(81.5, [bench(3, "80x10 80x10 80x10"), bench(7, "77.5x10 77.5x9 77.5x9")]);
  assert.equal(d.kg, 82.5);
  assert.equal(d.changes[0].kind, "rounded");
});

test("leaves loadable choices alone, even off the user's usual jumps (found by the live eval)", () => {
  // RDL went 85 → 90 kg; 92.5 is still loadable on a barbell.
  const rdl = [session(3, "Legs", [e("ex-rdl", "90x10 90x10 90x9")]), session(10, "Legs", [e("ex-rdl", "85x10 85x10 85x10")])];
  const d = guard(92.5, rdl, { exerciseId: "ex-rdl" });
  assert.equal(d.kg, 92.5);
  assert.deepEqual(d.changes, []);
  // Deadlift went 295 → 305 → 315 lb; the model's 320 lb is a valid +5 lb.
  const dl = (days: number, w: number) => session(days, "B", [e("ex-deadlift", `${w}x5`)], { units: "imperial" });
  const pulled = guard(320, [dl(2, 315), dl(5, 305), dl(9, 295)], { exerciseId: "ex-deadlift", reps: "5", units: "imperial" });
  assert.equal(lbOf(pulled.kg!), 320);
  assert.deepEqual(pulled.changes, []);
  // 5 kg dumbbells exist: don't push them onto a 2 kg grid.
  assert.equal(guard(5, [], { exerciseId: "ex-lateral-raise", reps: "12-15" }).kg, 5);
});

test("follows microplates in the user's history", () => {
  const d = guard(81.25, [bench(3, "80x10 80x10 80x10"), bench(7, "78.75x10 78.75x10 78.75x9")]);
  assert.equal(d.kg, 81.25);
  assert.deepEqual(d.changes, []);
});

test("pound loads land on 5 lb steps and display cleanly", () => {
  const squat = (d: number, w: number) =>
    session(d, "A", [e("ex-squat", Array(5).fill(`${w}x5`).join(" "), { plan: "5x5@180" })], { units: "imperial" });
  const d = guard(231, [squat(2, 225), squat(5, 220)], { exerciseId: "ex-squat", reps: "5", units: "imperial" });
  assert.equal(lbOf(d.kg!), 230);
});

test("caps an unrealistic jump from the last session", () => {
  const d = guard(100, [bench(3, "80x10 80x10 80x10")]);
  assert.equal(d.kg, 87.5);
  assert.equal(d.changes[0].kind, "capped");
});

test("allows heavier loads when the rep range drops", () => {
  const d = guard(112.5, [bench(3, "100x10 100x10 100x10")], { reps: "3-5" });
  assert.equal(d.kg, 112.5);
  assert.deepEqual(d.changes, []);
});

test("no increase after 3+ weeks off, lighter is fine", () => {
  const history = [bench(30, "100x5 100x5 100x5")];
  const heavier = guard(102.5, history, { reps: "5" });
  assert.equal(heavier.kg, 100);
  assert.equal(heavier.changes[0].kind, "capped");
  const lighter = guard(90, history, { reps: "5" });
  assert.equal(lighter.kg, 90);
  assert.deepEqual(lighter.changes, []);
});

test("flags a suspiciously light load but keeps it", () => {
  const d = guard(40, [bench(3, "80x10 80x10 80x10")]);
  assert.equal(d.kg, 40);
  assert.equal(d.changes[0].kind, "low");
});

test("ignores missing loads and drops implausible ones", () => {
  for (const s of [null, undefined, 0, -5, "abc", NaN]) assert.equal(guard(s, []).kg, undefined);
  const huge = guard(900, []);
  assert.equal(huge.kg, undefined);
  assert.equal(huge.changes[0].kind, "dropped");
});

test("without history, rounds to standard increments", () => {
  assert.equal(guard(61, []).kg, 60);
  assert.equal(guard(11.3, [], { exerciseId: "ex-db-curl", reps: "10" }).kg, 11.5);
  assert.equal(lbOf(guard(46, [], { exerciseId: "ex-db-curl", reps: "10", units: "imperial" }).kg!), 45);
});

test("finalizeWorkout validates the model's answer", () => {
  const f = FIXTURES.find((x) => x.id === "imperial-5x5")!;
  const req = buildWorkoutRequest(f.user, f.data, {}, NOW);
  const row = (o: Record<string, unknown>) => ({ newExercise: null, sets: 5, reps: "5", restSeconds: 180, targetWeight: null, supersetGroup: null, notes: "", ...o });
  const answer = JSON.stringify({
    workoutName: "Workout B",
    reasoning: "Squat, press and pull.",
    estimatedMinutes: 70,
    warmup: "Bar, then ramp up.",
    exercises: [
      row({ exerciseId: "ex-squat", targetWeight: 231 }),
      row({ exerciseId: "ex-squat", targetWeight: 230 }),
      row({ exerciseId: "ex-made-up", exerciseName: "Overhead Press", targetWeight: 115 }),
      row({ exerciseId: "ex-nonexistent" }),
      row({ exerciseId: "NEW", newExercise: { name: "Zercher Squat", muscleGroup: "Legs", category: "strength" }, sets: 3, reps: "8" }),
      row({ exerciseId: "ex-deadlift", sets: 99, restSeconds: 9999, targetWeight: 700 }),
    ],
  });

  const { workout, loadChanges, dropped } = finalizeWorkout(answer, req, f.data);
  assert.deepEqual(workout.exercises.map((x) => x.exerciseId ?? x.exerciseName), ["ex-squat", "ex-ohp", "Zercher Squat", "ex-deadlift"]);
  assert.deepEqual(dropped, ["Barbell Squat (duplicate)", "ex-nonexistent (unknown exercise)"]);

  const [squat, ohp, zercher, deadlift] = workout.exercises;
  assert.equal(lbOf(squat.targetWeight!), 230);
  assert.equal(lbOf(ohp.targetWeight!), 115);
  assert.equal(zercher.isNew, true);
  assert.equal(zercher.targetWeight, undefined);
  assert.equal(deadlift.sets, 8);
  assert.equal(deadlift.restSeconds, 300);
  assert.equal(lbOf(deadlift.targetWeight!), 345); // capped: last top set 315 lb + 10% = 346.5, down to a 5 lb step
  assert.ok(loadChanges.some((c) => c.exercise === "Deadlift" && c.kind === "capped"));
});

test("finalizeWorkout rejects unusable answers", () => {
  const f = FIXTURES[0];
  const req = buildWorkoutRequest(f.user, f.data, {}, NOW);
  assert.throws(() => finalizeWorkout(null, req, f.data));
  assert.throws(() => finalizeWorkout("{}", req, f.data));
  assert.throws(() => finalizeWorkout(JSON.stringify({ workoutName: "x", exercises: [{ exerciseId: "nope" }] }), req, f.data));
});

test("every fixture builds prompts that contain what its rubric relies on", () => {
  for (const f of FIXTURES) {
    const req = buildWorkoutRequest(f.user, f.data, f.workout?.args ?? {}, NOW);
    const system = String(req.messages[0].content);
    assert.match(system, /USER DATA:/, f.id);
    assert.match(system, f.user.unitPreference === "imperial" ? /targetWeight in lb/ : /targetWeight in kg/, f.id);
    assert.ok(req.catalog.length > 0, f.id);
    assert.match(chatSystemPrompt(f.user, f.data, null, NOW), /USER DATA:/, f.id);
  }
  const ppl = FIXTURES.find((x) => x.id === "ppl-stalled-bench")!;
  const chat = chatSystemPrompt(ppl.user, ppl.data, null, NOW);
  assert.match(chat, /Barbell Bench Press \[plan 3×8-10, rest 120s\]: warmup 60×8, 80×8, 80×8, 80×7 \| rest avg 85s/);
  assert.match(chat, /Bench felt heavy again/);
  const jake = FIXTURES.find((x) => x.id === "imperial-5x5")!;
  assert.match(chatSystemPrompt(jake.user, jake.data, null, NOW), /Barbell Squat \[plan 5×5.*225×5, 225×5, 225×5, 225×5, 225×5/);
});
