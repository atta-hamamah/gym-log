import { v } from "convex/values";
import { query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";

/**
 * Paginated workout query for History screen.
 * Returns workouts with their exercises and sets, 10 at a time.
 */
export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { page: [], isDone: true, continueCursor: "" };

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return { page: [], isDone: true, continueCursor: "" };

    // Paginate workouts
    const results = await ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (q) => q.eq("userId", user._id))
      .order("desc")
      .paginate(args.paginationOpts);

    // Enrich each workout with exercises + sets
    const enrichedPage = await Promise.all(
      results.page.map(async (w) => {
        const logs = await ctx.db
          .query("exerciseLogs")
          .withIndex("by_workoutId", (q) => q.eq("workoutId", w._id))
          .collect();

        const exercises = await Promise.all(
          logs.map(async (log) => {
            const sets = await ctx.db
              .query("sets")
              .withIndex("by_exerciseLogId", (q) =>
                q.eq("exerciseLogId", log._id)
              )
              .collect();

            return {
              id: log.localId,
              exerciseId: log.exerciseId,
              exerciseName: log.exerciseName,
              notes: log.notes,
              supersetGroupId: log.supersetGroupId,
              sets: sets
                .sort((a, b) => a.order - b.order)
                .map((s) => ({
                  id: s._id.toString(),
                  weight: s.weight,
                  reps: s.reps,
                  rpe: s.rpe,
                  completed: s.completed,
                  type: s.type,
                })),
            };
          })
        );

        return {
          id: w.localId,
          name: w.name,
          startTime: w.startTime,
          endTime: w.endTime,
          notes: w.notes,
          bodyWeight: w.bodyWeight,
          mood: w.mood,
          exercises: exercises.sort(
            (a, b) =>
              logs.findIndex((l) => l.localId === a.id) -
              logs.findIndex((l) => l.localId === b.id)
          ),
        };
      })
    );

    return {
      ...results,
      page: enrichedPage,
    };
  },
});

/**
 * Get total workout count for a user (for the header badge).
 */
export const count = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return 0;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) return 0;

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return workouts.length;
  },
});
