import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";

/**
 * Everything the AI coach needs about a user, read in one query:
 * recent sessions with every set (timestamps, targets, cardio), PRs,
 * measurements, custom exercises and long-term stats.
 * Internal-only: it takes a userId, so clients must not call it directly.
 */

export interface CoachSet {
  weight: number;
  reps: number;
  rpe?: number;
  type: Doc<"sets">["type"];
  completed: boolean;
  durationSec?: number;
  distance?: number;
  completedAt?: number;
}

export interface CoachExercise {
  exerciseId: string;
  name: string;
  notes?: string;
  supersetGroupId?: string;
  target?: Doc<"exerciseLogs">["target"];
  sets: CoachSet[];
}

export interface CoachWorkout {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  notes?: string;
  mood?: number;
  bodyWeight?: number;
  source?: Doc<"workouts">["source"];
  exercises: CoachExercise[];
}

export interface CoachData {
  workouts: CoachWorkout[];
  personalRecords: Doc<"personalRecords">[];
  measurements: Doc<"bodyMeasurements">[];
  customExercises: { id: string; name: string; muscleGroup: string; category: string }[];
  yearly: { totalWorkouts: number; avgDurationMin: number; sessionsPerWeek: number; firstWorkoutAt: number | null };
}

const DAY = 24 * 60 * 60 * 1000;

export async function loadWorkoutTree(ctx: { db: any }, w: Doc<"workouts">): Promise<CoachWorkout> {
  const logs: Doc<"exerciseLogs">[] = await ctx.db
    .query("exerciseLogs")
    .withIndex("by_workoutId", (q: any) => q.eq("workoutId", w._id))
    .collect();
  logs.sort((a, b) => a.order - b.order);
  const exercises: CoachExercise[] = [];
  for (const log of logs) {
    const sets: Doc<"sets">[] = await ctx.db
      .query("sets")
      .withIndex("by_exerciseLogId", (q: any) => q.eq("exerciseLogId", log._id))
      .collect();
    sets.sort((a, b) => a.order - b.order);
    exercises.push({
      exerciseId: log.exerciseId,
      name: log.exerciseName,
      notes: log.notes,
      supersetGroupId: log.supersetGroupId,
      target: log.target,
      sets: sets.map((s) => ({
        weight: s.weight,
        reps: s.reps,
        rpe: s.rpe,
        type: s.type,
        completed: s.completed,
        durationSec: s.durationSec,
        distance: s.distance,
        completedAt: s.completedAt,
      })),
    });
  }
  return {
    id: w._id,
    name: w.name,
    startTime: w.startTime,
    endTime: w.endTime,
    notes: w.notes,
    mood: w.mood,
    bodyWeight: w.bodyWeight,
    source: w.source,
    exercises,
  };
}

export const getCoachData = internalQuery({
  args: {
    userId: v.id("users"),
    days: v.optional(v.float64()),
    maxWorkouts: v.optional(v.float64()),
  },
  handler: async (ctx, args): Promise<CoachData> => {
    const since = Date.now() - (args.days ?? 60) * DAY;
    const recent = await ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (q) => q.eq("userId", args.userId).gte("startTime", since))
      .order("desc")
      .take(args.maxWorkouts ?? 40);

    const workouts: CoachWorkout[] = [];
    for (const w of recent) workouts.push(await loadWorkoutTree(ctx, w));

    const personalRecords = await ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    const measurements = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId_date", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(3);

    const customs = await ctx.db
      .query("customExercises")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .collect();

    // Long-term stats from workout rows only (cheap).
    const yearAgo = Date.now() - 365 * DAY;
    const year = await ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (q) => q.eq("userId", args.userId).gte("startTime", yearAgo))
      .collect();
    const durations = year.filter((w) => w.endTime).map((w) => (w.endTime! - w.startTime) / 60000);
    const first = year.length > 0 ? Math.min(...year.map((w) => w.startTime)) : null;
    const weeks = first ? Math.max((Date.now() - first) / (7 * DAY), 1) : 1;

    return {
      workouts,
      personalRecords,
      measurements,
      customExercises: customs.map((e) => ({ id: e.localId, name: e.name, muscleGroup: e.muscleGroup, category: e.category })),
      yearly: {
        totalWorkouts: year.length,
        avgDurationMin: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        sessionsPerWeek: Math.round((year.length / weeks) * 10) / 10,
        firstWorkoutAt: first,
      },
    };
  },
});

/** One workout with all its details (for the post-workout summary). */
export const getWorkoutForCoach = internalQuery({
  args: { workoutId: v.id("workouts") },
  handler: async (ctx, args): Promise<{ userId: string; workout: CoachWorkout } | null> => {
    const w = await ctx.db.get(args.workoutId);
    if (!w) return null;
    return { userId: w.userId, workout: await loadWorkoutTree(ctx, w) };
  },
});
