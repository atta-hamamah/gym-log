import { v } from "convex/values";
import { query } from "./_generated/server";

/**
 * Helper queries for the AI chat action.
 * These must be in a separate file (not "use node") because
 * queries run in the Convex runtime, not Node.js.
 */

export const getPersonalRecords = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const getBodyMeasurements = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(5);
  },
});

/**
 * Aggregate yearly training statistics for the AI prompt.
 * Computes everything server-side so only a tiny summary is sent to OpenAI.
 */
export const getYearlyStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (q) =>
        q.eq("userId", args.userId).gte("startTime", oneYearAgo)
      )
      .collect();

    const totalWorkouts = workouts.length;
    if (totalWorkouts === 0) {
      return {
        totalWorkouts: 0,
        avgDurationMin: 0,
        sessionsPerWeek: 0,
        topExercises: [],
      };
    }

    // Average workout duration
    const durations = workouts
      .filter((w) => w.endTime)
      .map((w) => (w.endTime! - w.startTime) / 60000);
    const avgDurationMin =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0;

    // Sessions per week
    const rangeMs = Date.now() - oneYearAgo;
    const weeksInRange = Math.max(rangeMs / (7 * 24 * 60 * 60 * 1000), 1);
    const sessionsPerWeek =
      Math.round((totalWorkouts / weeksInRange) * 10) / 10;

    // Top exercises by frequency
    const exerciseFreq: Record<string, number> = {};
    for (const w of workouts) {
      const logs = await ctx.db
        .query("exerciseLogs")
        .withIndex("by_workoutId", (q) => q.eq("workoutId", w._id))
        .collect();
      for (const log of logs) {
        exerciseFreq[log.exerciseName] =
          (exerciseFreq[log.exerciseName] || 0) + 1;
      }
    }

    const topExercises = Object.entries(exerciseFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    return { totalWorkouts, avgDurationMin, sessionsPerWeek, topExercises };
  },
});
