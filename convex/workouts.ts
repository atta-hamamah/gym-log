import { v } from "convex/values";
import { query } from "./_generated/server";

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
  },
  handler: async (ctx, args) => {
    const limit = args.limit || 50;
    return await ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(limit);
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
