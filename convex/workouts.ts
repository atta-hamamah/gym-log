import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

/**
 * Workout queries — primarily for future AI assistant use.
 */

/**
 * Get all workouts for a user, sorted by date descending.
 */
export const getWorkoutsByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.float64()),
    sinceTimestamp: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    const q = ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (idx) => {
        const base = idx.eq("userId", args.userId);
        return args.sinceTimestamp
          ? base.gte("startTime", args.sinceTimestamp)
          : base;
      })
      .order("desc");

    return await q.take(limit);
  },
});

/**
 * Get exercise logs for a specific workout.
 */
export const getExerciseLogsByWorkout = query({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("exerciseLogs")
      .withIndex("by_workoutId", (q) => q.eq("workoutId", args.workoutId))
      .collect();
  },
});

/**
 * Get sets for a specific exercise log.
 */
export const getSetsByExerciseLog = query({
  args: { exerciseLogId: v.id("exerciseLogs") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sets")
      .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", args.exerciseLogId))
      .collect();
  },
});

/**
 * Get all exercise history for a user + specific exercise.
 * Useful for AI queries like "show me all bench press progress".
 */
export const getExerciseHistory = query({
  args: {
    userId: v.id("users"),
    exerciseId: v.string(),
  },
  handler: async (ctx, args) => {
    const logs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_userId_exerciseId", (q) =>
        q.eq("userId", args.userId).eq("exerciseId", args.exerciseId)
      )
      .collect();

    // Enrich with workout date and sets
    const enriched = await Promise.all(
      logs.map(async (log) => {
        const workout = await ctx.db.get(log.workoutId);
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", log._id))
          .collect();
        return {
          ...log,
          workoutDate: workout?.startTime,
          workoutName: workout?.name,
          sets,
        };
      })
    );

    return enriched.sort((a, b) => (b.workoutDate || 0) - (a.workoutDate || 0));
  },
});

/**
 * Get detailed data for a workout to generate an aura.
 */
export const getWorkoutDetailsForAura = query({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    const workout = await ctx.db.get(args.workoutId);
    if (!workout) throw new Error("Workout not found");

    const exerciseLogs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_workoutId", (q) => q.eq("workoutId", args.workoutId))
      .collect();

    let totalSets = 0;
    let totalVolume = 0;
    const exercisesWithSets = await Promise.all(
      exerciseLogs.map(async (log) => {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", log._id))
          .collect();
        const validSets = sets.filter((s) => s.type === "normal" && s.completed);
        totalSets += validSets.length;
        const volume = validSets.reduce((acc, s) => acc + s.weight * s.reps, 0);
        totalVolume += volume;
        return {
          name: log.exerciseName,
          sets: validSets.length,
          volume,
        };
      })
    );

    return {
      workout,
      exercises: exercisesWithSets,
      totalVolume,
      totalSets,
    };
  },
});

/**
 * Update a workout with its generated aura.
 */
export const updateWorkoutAura = mutation({
  args: {
    workoutId: v.id("workouts"),
    auraTitle: v.string(),
    auraDescription: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.workoutId, {
      auraTitle: args.auraTitle,
      auraDescription: args.auraDescription,
    });
  },
});

/**
 * Get detailed workout stats for the shareable stats card.
 * Returns per-exercise best sets, totals, and workout metadata.
 */
export const getWorkoutStatsCard = query({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args) => {
    const workout = await ctx.db.get(args.workoutId);
    if (!workout) throw new Error("Workout not found");

    const exerciseLogs = await ctx.db
      .query("exerciseLogs")
      .withIndex("by_workoutId", (q) => q.eq("workoutId", args.workoutId))
      .collect();

    let totalSets = 0;
    let totalVolume = 0;
    const exercises: {
      name: string;
      bestWeight: number;
      bestReps: number;
      sets: number;
      volume: number;
    }[] = [];

    for (const log of exerciseLogs) {
      const sets = await ctx.db
        .query("sets")
        .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", log._id))
        .collect();
      const validSets = sets.filter((s) => s.type === "normal" && s.completed);
      totalSets += validSets.length;
      const volume = validSets.reduce((acc, s) => acc + s.weight * s.reps, 0);
      totalVolume += volume;

      const bestSet = validSets.reduce(
        (best, s) => (s.weight > (best?.weight || 0) ? s : best),
        validSets[0]
      );

      if (bestSet) {
        exercises.push({
          name: log.exerciseName,
          bestWeight: bestSet.weight,
          bestReps: bestSet.reps,
          sets: validSets.length,
          volume,
        });
      }
    }

    const durationMin =
      workout.endTime && workout.startTime
        ? Math.round((workout.endTime - workout.startTime) / 60000)
        : null;

    return {
      name: workout.name,
      durationMin,
      totalSets,
      totalVolume: Math.round(totalVolume),
      exerciseCount: exerciseLogs.length,
      exercises,
    };
  },
});
