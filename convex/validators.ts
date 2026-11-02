import { v } from "convex/values";

/** Validators shared by the sync functions and the AI actions. */

export const setType = v.union(
  v.literal("warmup"),
  v.literal("normal"),
  v.literal("failure"),
  v.literal("drop")
);

export const sourceValidator = v.object({
  type: v.union(v.literal("manual"), v.literal("ai"), v.literal("program"), v.literal("plan")),
  programId: v.optional(v.string()),
  dayName: v.optional(v.string()),
  reasoning: v.optional(v.string()),
  // AI training plan session (type "plan")
  planId: v.optional(v.string()),
  planWeek: v.optional(v.float64()),
  planSessionId: v.optional(v.string()),
});

// ── AI training plans (see plans.ts / planner.ts) ────────

export const planExerciseValidator = v.object({
  exerciseId: v.string(),
  exerciseName: v.string(),
  sets: v.float64(),
  reps: v.string(),
  restSeconds: v.float64(),
  startWeight: v.optional(v.float64()),   // kg, week 1
  supersetGroup: v.optional(v.string()),
  notes: v.optional(v.string()),
});

export const planSessionValidator = v.object({
  id: v.string(),
  name: v.string(),
  focus: v.string(),
  estimatedMinutes: v.optional(v.float64()),
  exercises: v.array(planExerciseValidator),
});

export const planPhaseValidator = v.object({
  name: v.string(),
  startWeek: v.float64(),
  endWeek: v.float64(),
  focus: v.string(),
  deload: v.boolean(),
});

export const planCheckInValidator = v.object({
  week: v.float64(),
  summary: v.string(),
  adjustments: v.array(
    v.object({
      sessionId: v.string(),
      exerciseId: v.string(),
      replaceWith: v.optional(v.string()),
      replaceName: v.optional(v.string()),
      sets: v.optional(v.float64()),
      reps: v.optional(v.string()),
      targetWeight: v.optional(v.float64()),   // kg
    })
  ),
  checkedInAt: v.float64(),
});

/** Everything that defines a plan (the table adds userId, status and timestamps). */
export const planFields = {
  name: v.string(),
  goal: v.string(),
  overview: v.string(),
  progression: v.string(),
  startDate: v.string(),                  // "YYYY-MM-DD", the user's local date
  weeks: v.float64(),
  trainingDays: v.array(v.float64()),     // Date.getDay numbers, 0 = Sunday
  sessionMinutes: v.float64(),
  phases: v.array(planPhaseValidator),
  sessions: v.array(planSessionValidator),
  checkIns: v.array(planCheckInValidator),
};

export const targetValidator = v.object({
  sets: v.float64(),
  reps: v.string(),
  restSeconds: v.float64(),
  weight: v.optional(v.float64()),
  notes: v.optional(v.string()),
});

export const setValidator = v.object({
  id: v.string(),
  weight: v.float64(),
  reps: v.float64(),
  rpe: v.optional(v.float64()),
  completed: v.boolean(),
  type: setType,
  durationSec: v.optional(v.float64()),
  distance: v.optional(v.float64()),
  completedAt: v.optional(v.float64()),
});

export const workoutValidator = v.object({
  id: v.string(),
  name: v.string(),
  startTime: v.float64(),
  endTime: v.optional(v.float64()),
  notes: v.optional(v.string()),
  bodyWeight: v.optional(v.float64()),
  mood: v.optional(v.float64()),
  source: v.optional(sourceValidator),
  exercises: v.array(
    v.object({
      id: v.string(),
      exerciseId: v.string(),
      exerciseName: v.string(),
      notes: v.optional(v.string()),
      supersetGroupId: v.optional(v.string()),
      target: v.optional(targetValidator),
      sets: v.array(setValidator),
    })
  ),
});
