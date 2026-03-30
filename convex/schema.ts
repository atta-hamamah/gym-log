import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // ── User Profile ──────────────────────────────────────
  users: defineTable({
    clerkId: v.string(),
    name: v.string(),
    email: v.string(),
    dateOfBirth: v.optional(v.string()),   // ISO date string "1995-06-15"
    gender: v.optional(v.union(v.literal("male"), v.literal("female"), v.literal("other"))),
    weight: v.optional(v.float64()),       // kg
    bodyFat: v.optional(v.float64()),      // percentage
    height: v.optional(v.float64()),       // cm
    createdAt: v.float64(),
    migrationComplete: v.boolean(),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // ── Workouts ──────────────────────────────────────────
  workouts: defineTable({
    userId: v.id("users"),
    localId: v.string(),                   // original AsyncStorage ID
    name: v.string(),
    startTime: v.float64(),
    endTime: v.optional(v.float64()),
    notes: v.optional(v.string()),
    bodyWeight: v.optional(v.float64()),
    mood: v.optional(v.float64()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_startTime", ["userId", "startTime"])
    .index("by_localId", ["localId"]),

  // ── Exercise Logs (child of Workout) ──────────────────
  exerciseLogs: defineTable({
    workoutId: v.id("workouts"),
    userId: v.id("users"),
    localId: v.string(),
    exerciseId: v.string(),
    exerciseName: v.string(),
    notes: v.optional(v.string()),
    supersetGroupId: v.optional(v.string()),
    order: v.float64(),
  })
    .index("by_workoutId", ["workoutId"])
    .index("by_userId_exerciseId", ["userId", "exerciseId"]),

  // ── Sets (child of ExerciseLog) ───────────────────────
  sets: defineTable({
    exerciseLogId: v.id("exerciseLogs"),
    userId: v.id("users"),
    weight: v.float64(),
    reps: v.float64(),
    rpe: v.optional(v.float64()),
    completed: v.boolean(),
    type: v.union(
      v.literal("warmup"),
      v.literal("normal"),
      v.literal("failure"),
      v.literal("drop")
    ),
    order: v.float64(),
  })
    .index("by_exerciseLogId", ["exerciseLogId"]),

  // ── Custom Exercises ──────────────────────────────────
  customExercises: defineTable({
    userId: v.id("users"),
    localId: v.string(),
    name: v.string(),
    category: v.union(
      v.literal("strength"),
      v.literal("cardio"),
      v.literal("flexibility")
    ),
    muscleGroup: v.string(),
  })
    .index("by_userId", ["userId"]),

  // ── Personal Records ──────────────────────────────────
  personalRecords: defineTable({
    userId: v.id("users"),
    exerciseId: v.string(),
    exerciseName: v.string(),
    type: v.union(
      v.literal("max_weight"),
      v.literal("best_volume"),
      v.literal("est_1rm")
    ),
    value: v.float64(),
    reps: v.optional(v.float64()),
    date: v.float64(),
    workoutLocalId: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_exerciseId", ["userId", "exerciseId"]),

  // ── Body Measurements ─────────────────────────────────
  bodyMeasurements: defineTable({
    userId: v.id("users"),
    date: v.float64(),
    neck: v.optional(v.float64()),
    chest: v.optional(v.float64()),
    waist: v.optional(v.float64()),
    hips: v.optional(v.float64()),
    biceps: v.optional(v.float64()),
    thighs: v.optional(v.float64()),
    calves: v.optional(v.float64()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_date", ["userId", "date"]),
});
