import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Migrate all local data to Convex in a single batch.
 * Called once when user taps "Go Live" and completes signup.
 */

const setValidator = v.object({
  id: v.string(),
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
});

const exerciseLogValidator = v.object({
  id: v.string(),
  exerciseId: v.string(),
  exerciseName: v.string(),
  sets: v.array(setValidator),
  notes: v.optional(v.string()),
  supersetGroupId: v.optional(v.string()),
});

const workoutValidator = v.object({
  id: v.string(),
  name: v.string(),
  startTime: v.float64(),
  endTime: v.optional(v.float64()),
  exercises: v.array(exerciseLogValidator),
  notes: v.optional(v.string()),
  bodyWeight: v.optional(v.float64()),
  mood: v.optional(v.float64()),
});

const customExerciseValidator = v.object({
  id: v.string(),
  name: v.string(),
  category: v.union(
    v.literal("strength"),
    v.literal("cardio"),
    v.literal("flexibility")
  ),
  muscleGroup: v.string(),
});

const personalRecordValidator = v.object({
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
  workoutId: v.string(),
});

const bodyMeasurementValidator = v.object({
  id: v.string(),
  date: v.float64(),
  neck: v.optional(v.float64()),
  chest: v.optional(v.float64()),
  waist: v.optional(v.float64()),
  hips: v.optional(v.float64()),
  biceps: v.optional(v.float64()),
  thighs: v.optional(v.float64()),
  calves: v.optional(v.float64()),
});

export const migrateLocalData = mutation({
  args: {
    userId: v.id("users"),
    workouts: v.array(workoutValidator),
    customExercises: v.array(customExerciseValidator),
    personalRecords: v.array(personalRecordValidator),
    bodyMeasurements: v.array(bodyMeasurementValidator),
  },
  handler: async (ctx, args) => {
    const { userId, workouts, customExercises, personalRecords, bodyMeasurements } = args;

    let totalInserted = 0;

    // ── 1. Migrate Workouts (flatten nested structure) ──
    for (const workout of workouts) {
      const workoutId = await ctx.db.insert("workouts", {
        userId,
        localId: workout.id,
        name: workout.name,
        startTime: workout.startTime,
        endTime: workout.endTime,
        notes: workout.notes,
        bodyWeight: workout.bodyWeight,
        mood: workout.mood,
      });

      // Insert exercise logs
      for (let exIdx = 0; exIdx < workout.exercises.length; exIdx++) {
        const exercise = workout.exercises[exIdx];
        const exerciseLogId = await ctx.db.insert("exerciseLogs", {
          workoutId,
          userId,
          localId: exercise.id,
          exerciseId: exercise.exerciseId,
          exerciseName: exercise.exerciseName,
          notes: exercise.notes,
          supersetGroupId: exercise.supersetGroupId,
          order: exIdx,
        });

        // Insert sets
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

      totalInserted++;
    }

    // ── 2. Migrate Custom Exercises ──
    for (const exercise of customExercises) {
      await ctx.db.insert("customExercises", {
        userId,
        localId: exercise.id,
        name: exercise.name,
        category: exercise.category,
        muscleGroup: exercise.muscleGroup,
      });
    }

    // ── 3. Migrate Personal Records ──
    for (const pr of personalRecords) {
      await ctx.db.insert("personalRecords", {
        userId,
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.value,
        reps: pr.reps,
        date: pr.date,
        workoutLocalId: pr.workoutId,
      });
    }

    // ── 4. Migrate Body Measurements ──
    for (const measurement of bodyMeasurements) {
      await ctx.db.insert("bodyMeasurements", {
        userId,
        date: measurement.date,
        neck: measurement.neck,
        chest: measurement.chest,
        waist: measurement.waist,
        hips: measurement.hips,
        biceps: measurement.biceps,
        thighs: measurement.thighs,
        calves: measurement.calves,
      });
    }

    // ── 5. Mark migration complete ──
    await ctx.db.patch(userId, { migrationComplete: true });

    return {
      workoutsInserted: workouts.length,
      exercisesInserted: customExercises.length,
      prsInserted: personalRecords.length,
      measurementsInserted: bodyMeasurements.length,
    };
  },
});

export const getCloudData = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerkId", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // 1. Fetch workouts (last 1 year only for restore efficiency)
    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const rawWorkouts = await ctx.db
      .query("workouts")
      .withIndex("by_userId_startTime", (q) =>
        q.eq("userId", user._id).gte("startTime", oneYearAgo)
      )
      .collect();

    const workouts = [];
    for (const w of rawWorkouts) {
      const logs = await ctx.db
        .query("exerciseLogs")
        .withIndex("by_workoutId", (q) => q.eq("workoutId", w._id))
        .collect();
      
      const exercises = [];
      for (const log of logs) {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", log._id))
          .collect();
        
        exercises.push({
          id: log.localId,
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          notes: log.notes,
          supersetGroupId: log.supersetGroupId,
          order: log.order,
          sets: sets.map(s => ({
            id: s._id.toString(), // Assign generated local id if we want, but stringified is fine
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            completed: s.completed,
            type: s.type,
            order: s.order,
          })).sort((a, b) => a.order - b.order),
        });
      }
      
      workouts.push({
        id: w.localId,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        notes: w.notes,
        bodyWeight: w.bodyWeight,
        mood: w.mood,
        exercises: exercises.sort((a, b) => a.order - b.order),
      });
    }

    const customExercisesData = await ctx.db
      .query("customExercises")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const customExercises = customExercisesData.map(e => ({
      id: e.localId,
      name: e.name,
      category: e.category,
      muscleGroup: e.muscleGroup,
      isCustom: true,
    }));

    const personalRecordsData = await ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const personalRecords = personalRecordsData.map(pr => ({
      exerciseId: pr.exerciseId,
      exerciseName: pr.exerciseName,
      type: pr.type,
      value: pr.value,
      reps: pr.reps,
      date: pr.date,
      workoutId: pr.workoutLocalId,
    }));

    const bodyMeasurementsData = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();
    
    const bodyMeasurements = bodyMeasurementsData.map(m => ({
      id: m._id.toString(),
      date: m.date,
      neck: m.neck,
      chest: m.chest,
      waist: m.waist,
      hips: m.hips,
      biceps: m.biceps,
      thighs: m.thighs,
      calves: m.calves,
    }));

    return {
      workouts: workouts.sort((a, b) => b.startTime - a.startTime),
      customExercises,
      personalRecords,
      bodyMeasurements,
    };
  },
});
