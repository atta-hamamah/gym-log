import { v } from "convex/values";

/** Validators shared by the sync functions and the AI actions. */

export const setType = v.union(
  v.literal("warmup"),
  v.literal("normal"),
  v.literal("failure"),
  v.literal("drop")
);

export const sourceValidator = v.object({
  type: v.union(v.literal("manual"), v.literal("ai"), v.literal("program")),
  programId: v.optional(v.string()),
  dayName: v.optional(v.string()),
  reasoning: v.optional(v.string()),
});

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
