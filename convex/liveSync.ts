import { v } from "convex/values";
import { mutation } from "./_generated/server";

/**
 * Live Sync mutations — used by AI subscribers to write directly to Convex
 * instead of only to local AsyncStorage.
 *
 * All mutations are auth-aware — they look up the userId from Clerk identity,
 * so the client never needs to pass userId.
 */

// ── Helpers ──────────────────────────────────────────────
async function getUserId(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerkId", (q: any) => q.eq("clerkId", identity.subject))
    .unique();

  if (!user) throw new Error("User not found in Convex");
  return user._id;
}

// ── Save a completed workout ────────────────────────────
export const saveWorkout = mutation({
  args: {
    localId: v.string(),
    name: v.string(),
    startTime: v.float64(),
    endTime: v.optional(v.float64()),
    notes: v.optional(v.string()),
    bodyWeight: v.optional(v.float64()),
    mood: v.optional(v.float64()),
    exercises: v.array(
      v.object({
        localId: v.string(),
        exerciseId: v.string(),
        exerciseName: v.string(),
        notes: v.optional(v.string()),
        supersetGroupId: v.optional(v.string()),
        sets: v.array(
          v.object({
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
          })
        ),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    // Insert workout
    const workoutId = await ctx.db.insert("workouts", {
      userId,
      localId: args.localId,
      name: args.name,
      startTime: args.startTime,
      endTime: args.endTime,
      notes: args.notes,
      bodyWeight: args.bodyWeight,
      mood: args.mood,
    });

    // Insert exercise logs + sets
    for (let exIdx = 0; exIdx < args.exercises.length; exIdx++) {
      const exercise = args.exercises[exIdx];
      const exerciseLogId = await ctx.db.insert("exerciseLogs", {
        workoutId,
        userId,
        localId: exercise.localId,
        exerciseId: exercise.exerciseId,
        exerciseName: exercise.exerciseName,
        notes: exercise.notes,
        supersetGroupId: exercise.supersetGroupId,
        order: exIdx,
      });

      for (let setIdx = 0; setIdx < exercise.sets.length; setIdx++) {
        const set = exercise.sets[setIdx];
        await ctx.db.insert("sets", {
          exerciseLogId,
          userId,
          weight: set.weight,
          reps: set.reps,
          rpe: set.rpe,
          completed: set.completed,
          type: set.type,
          order: setIdx,
        });
      }
    }

    return workoutId;
  },
});

// ── Delete a workout ────────────────────────────────────
export const deleteWorkout = mutation({
  args: { localId: v.string() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const workout = await ctx.db
      .query("workouts")
      .withIndex("by_localId", (q: any) => q.eq("localId", args.localId))
      .first();

    if (!workout || workout.userId !== userId) return;

    // Delete sets → exercise logs → workout
    const logs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_workoutId", (q: any) => q.eq("workoutId", workout._id))
      .collect();

    for (const log of logs) {
      const sets = await ctx.db
        .query("sets")
        .withIndex("by_exerciseLogId", (q: any) => q.eq("exerciseLogId", log._id))
        .collect();
      for (const set of sets) {
        await ctx.db.delete(set._id);
      }
      await ctx.db.delete(log._id);
    }

    await ctx.db.delete(workout._id);
  },
});

// ── Save personal records ───────────────────────────────
export const savePersonalRecords = mutation({
  args: {
    records: v.array(
      v.object({
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
    ),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    for (const pr of args.records) {
      await ctx.db.insert("personalRecords", {
        userId,
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.value,
        reps: pr.reps,
        date: pr.date,
        workoutLocalId: pr.workoutLocalId,
      });
    }
  },
});

// ── Save body measurement ───────────────────────────────
export const saveBodyMeasurement = mutation({
  args: {
    localId: v.string(),
    date: v.float64(),
    neck: v.optional(v.float64()),
    chest: v.optional(v.float64()),
    waist: v.optional(v.float64()),
    hips: v.optional(v.float64()),
    biceps: v.optional(v.float64()),
    thighs: v.optional(v.float64()),
    calves: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    await ctx.db.insert("bodyMeasurements", {
      userId,
      date: args.date,
      neck: args.neck,
      chest: args.chest,
      waist: args.waist,
      hips: args.hips,
      biceps: args.biceps,
      thighs: args.thighs,
      calves: args.calves,
    });
  },
});

// ── Delete body measurement ─────────────────────────────
export const deleteBodyMeasurement = mutation({
  args: { date: v.float64() },
  handler: async (ctx, args) => {
    const userId = await getUserId(ctx);

    const measurement = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId_date", (q: any) =>
        q.eq("userId", userId).eq("date", args.date)
      )
      .first();

    if (measurement) {
      await ctx.db.delete(measurement._id);
    }
  },
});
