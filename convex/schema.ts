import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { planFields, sourceValidator } from "./validators";

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
    goal: v.optional(v.string()),          // fitness goal text
    unitPreference: v.optional(v.union(v.literal("metric"), v.literal("imperial"))),
    // Training profile the AI coach plans around
    experience: v.optional(v.union(v.literal("beginner"), v.literal("intermediate"), v.literal("advanced"))),
    equipment: v.optional(v.array(v.string())),   // available equipment (see exerciseCatalog.ts)
    trainingDays: v.optional(v.float64()),        // sessions per week
    sessionMinutes: v.optional(v.float64()),      // preferred session length
    limitations: v.optional(v.string()),          // injuries / things to avoid
    createdAt: v.float64(),
    migrationComplete: v.boolean(),
    // Bumped on every cloud data change so other devices know to pull.
    dataVersion: v.optional(v.float64()),
    // AI subscription as last reported by RevenueCat (see entitlements.ts).
    aiActive: v.optional(v.boolean()),
    aiExpiresAt: v.optional(v.float64()),   // missing while active = never expires
    entitlementCheckedAt: v.optional(v.float64()),
  })
    .index("by_clerkId", ["clerkId"])
    .index("by_email", ["email"]),

  // ── Workouts ──────────────────────────────────────────
  workouts: defineTable({
    userId: v.id("users"),
    localId: v.string(),                   // client-generated ID (stable across devices)
    name: v.string(),
    startTime: v.float64(),
    endTime: v.optional(v.float64()),
    notes: v.optional(v.string()),
    bodyWeight: v.optional(v.float64()),
    mood: v.optional(v.float64()),
    auraTitle: v.optional(v.string()),
    auraDescription: v.optional(v.string()),
    // Where the session came from (AI coach, program, training plan, manual)
    source: v.optional(sourceValidator),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_startTime", ["userId", "startTime"])
    .index("by_userId_localId", ["userId", "localId"]),

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
    // What the plan prescribed for this exercise
    target: v.optional(v.object({
      sets: v.float64(),
      reps: v.string(),
      restSeconds: v.float64(),
      weight: v.optional(v.float64()),
      notes: v.optional(v.string()),
    })),
  })
    .index("by_workoutId", ["workoutId"])
    .index("by_userId", ["userId"])
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
    durationSec: v.optional(v.float64()),   // timed holds / cardio
    distance: v.optional(v.float64()),      // km
    completedAt: v.optional(v.float64()),   // when the set was logged (for rest times)
  })
    .index("by_exerciseLogId", ["exerciseLogId"])
    .index("by_userId", ["userId"]),

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
    .index("by_userId", ["userId"])
    .index("by_userId_localId", ["userId", "localId"]),

  // ── Personal Records ──────────────────────────────────
  // Natural key: (userId, workoutLocalId, exerciseId, type)
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
    .index("by_userId_exerciseId", ["userId", "exerciseId"])
    .index("by_userId_workoutLocalId", ["userId", "workoutLocalId"]),

  // ── Body Measurements ─────────────────────────────────
  bodyMeasurements: defineTable({
    userId: v.id("users"),
    // Client-generated ID. Missing on rows created before sync v2.
    localId: v.optional(v.string()),
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
    .index("by_userId_date", ["userId", "date"])
    .index("by_userId_localId", ["userId", "localId"]),

  // ── AI usage (fair-use limits, see aiUsage.ts) ────────
  // One row per user, feature and UTC day.
  aiUsage: defineTable({
    userId: v.id("users"),
    feature: v.union(v.literal("chat"), v.literal("workout"), v.literal("aura"), v.literal("plan")),
    day: v.string(),   // "2026-11-02" (UTC)
    count: v.float64(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_feature_day", ["userId", "feature", "day"]),

  // ── AI training plans (see plans.ts) ──────────────────
  // At most one "active" plan per user; older ones are kept as "ended".
  trainingPlans: defineTable({
    userId: v.id("users"),
    status: v.union(v.literal("active"), v.literal("ended")),
    ...planFields,
    createdAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"]),

  // ── Coach nudges for AI subscribers (see notifications.ts) ──
  // Expo push token of each device signed in to the account.
  pushTokens: defineTable({
    userId: v.id("users"),
    token: v.string(),
    platform: v.union(v.literal("android"), v.literal("ios")),
    updatedAt: v.float64(),
  })
    .index("by_token", ["token"])
    .index("by_userId", ["userId"]),

  // One row per user: who nudges them, in which language, and when.
  nudgeSettings: defineTable({
    userId: v.id("users"),
    enabled: v.boolean(),
    coach: v.union(v.literal("mix"), v.literal("repai"), v.literal("chad"), v.literal("kevin")),
    language: v.string(),
    timeZone: v.string(),
    /** Local hour nudges go out (an hour before they usually train). */
    hour: v.float64(),
    /** Next time to consider a nudge (UTC ms); the cron picks up rows that are due. */
    nextAt: v.float64(),
    updatedAt: v.float64(),
  })
    .index("by_userId", ["userId"])
    .index("by_nextAt", ["nextAt"]),

  // Nudges sent, for the daily / weekly caps and spacing.
  nudgeLog: defineTable({
    userId: v.id("users"),
    /** User's local day number (days since 1970-01-01 in their time zone). */
    day: v.float64(),
    kind: v.string(),
    group: v.optional(v.string()),
    coach: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("sent"), v.literal("failed")),
    body: v.optional(v.string()),
    createdAt: v.float64(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_day", ["userId", "day"]),
});
