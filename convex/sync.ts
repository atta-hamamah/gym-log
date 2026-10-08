import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import {
  getCurrentUser,
  requireCurrentUser,
  bumpDataVersion,
  deleteUserDocs,
  tablesForScope,
} from "./users";
import { hasActiveAI, subscriptionRequiredError } from "./entitlements";

/**
 * Two-way sync between the device's local store and the cloud.
 *
 * Every record is identified by its client-generated ID (`localId`), so all
 * pushes are idempotent upserts: retries, re-uploads and multiple devices can
 * never create duplicates. Personal records use the natural key
 * (workoutLocalId, exerciseId, type) because they have no ID of their own.
 *
 * All functions resolve the user from the Clerk token, and cloud access needs
 * an active AI subscription (the app calls entitlements.ensureAccess first so
 * a fresh purchase is confirmed with RevenueCat before syncing).
 */

/** Signed-in user with an active AI subscription, or throws. */
async function requireSyncAccess(ctx: QueryCtx | MutationCtx): Promise<Doc<"users">> {
  const user = await requireCurrentUser(ctx);
  if (!hasActiveAI(user)) throw subscriptionRequiredError();
  return user;
}

const setType = v.union(
  v.literal("warmup"),
  v.literal("normal"),
  v.literal("failure"),
  v.literal("drop")
);

const workoutValidator = v.object({
  id: v.string(),
  name: v.string(),
  startTime: v.float64(),
  endTime: v.optional(v.float64()),
  notes: v.optional(v.string()),
  bodyWeight: v.optional(v.float64()),
  mood: v.optional(v.float64()),
  exercises: v.array(
    v.object({
      id: v.string(),
      exerciseId: v.string(),
      exerciseName: v.string(),
      notes: v.optional(v.string()),
      supersetGroupId: v.optional(v.string()),
      sets: v.array(
        v.object({
          id: v.string(),
          weight: v.float64(),
          reps: v.float64(),
          rpe: v.optional(v.float64()),
          completed: v.boolean(),
          type: setType,
        })
      ),
    })
  ),
});

const customExerciseValidator = v.object({
  id: v.string(),
  name: v.string(),
  category: v.union(v.literal("strength"), v.literal("cardio"), v.literal("flexibility")),
  muscleGroup: v.string(),
});

const personalRecordValidator = v.object({
  exerciseId: v.string(),
  exerciseName: v.string(),
  type: v.union(v.literal("max_weight"), v.literal("best_volume"), v.literal("est_1rm")),
  value: v.float64(),
  reps: v.optional(v.float64()),
  date: v.float64(),
  workoutId: v.string(),
});

const measurementFields = {
  date: v.float64(),
  neck: v.optional(v.float64()),
  chest: v.optional(v.float64()),
  waist: v.optional(v.float64()),
  hips: v.optional(v.float64()),
  biceps: v.optional(v.float64()),
  thighs: v.optional(v.float64()),
  calves: v.optional(v.float64()),
};

const measurementValidator = v.object({ id: v.string(), ...measurementFields });

// ── Reads ────────────────────────────────────────────────

/** Changes whenever this user's cloud data changes (used to trigger pulls). */
export const version = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    return user && hasActiveAI(user) ? user.dataVersion ?? 0 : null;
  },
});

/**
 * Everything the client needs to reconcile: workout IDs (full workouts are
 * fetched separately, only for the ones the device is missing) plus the small
 * collections in full. Returns null if the profile row doesn't exist yet.
 */
export const manifest = query({
  args: {},
  handler: async (ctx) => {
    const user = await getCurrentUser(ctx);
    if (!user) return null;
    if (!hasActiveAI(user)) throw subscriptionRequiredError();

    const workouts = await ctx.db
      .query("workouts")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const customExercises = await ctx.db
      .query("customExercises")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const personalRecords = await ctx.db
      .query("personalRecords")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    const bodyMeasurements = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId", (q) => q.eq("userId", user._id))
      .collect();

    return {
      workoutIds: workouts.map((w) => w.localId),
      customExercises: customExercises.map((e) => ({
        id: e.localId,
        name: e.name,
        category: e.category,
        muscleGroup: e.muscleGroup,
      })),
      personalRecords: personalRecords.map((pr) => ({
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.value,
        reps: pr.reps,
        date: pr.date,
        workoutId: pr.workoutLocalId,
      })),
      bodyMeasurements: bodyMeasurements.map((m) => ({
        // Rows created before sync v2 have no localId; their _id was used as the local ID.
        id: m.localId ?? m._id,
        date: m.date,
        neck: m.neck,
        chest: m.chest,
        waist: m.waist,
        hips: m.hips,
        biceps: m.biceps,
        thighs: m.thighs,
        calves: m.calves,
      })),
    };
  },
});

/** Full workouts (with exercises and sets) for the given local IDs. */
export const getWorkouts = query({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await getCurrentUser(ctx);
    if (!user) return [];
    if (!hasActiveAI(user)) throw subscriptionRequiredError();

    const result = [];
    for (const localId of args.ids.slice(0, 100)) {
      const w = await ctx.db
        .query("workouts")
        .withIndex("by_userId_localId", (q) => q.eq("userId", user._id).eq("localId", localId))
        .first();
      if (!w) continue;

      const logs = await ctx.db
        .query("exerciseLogs")
        .withIndex("by_workoutId", (q) => q.eq("workoutId", w._id))
        .collect();
      logs.sort((a, b) => a.order - b.order);

      const exercises = [];
      for (const log of logs) {
        const sets = await ctx.db
          .query("sets")
          .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", log._id))
          .collect();
        sets.sort((a, b) => a.order - b.order);

        exercises.push({
          id: log.localId,
          exerciseId: log.exerciseId,
          exerciseName: log.exerciseName,
          notes: log.notes,
          supersetGroupId: log.supersetGroupId,
          sets: sets.map((s) => ({
            id: s._id as string,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            completed: s.completed,
            type: s.type,
          })),
        });
      }

      result.push({
        id: w.localId,
        cloudId: w._id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        notes: w.notes,
        bodyWeight: w.bodyWeight,
        mood: w.mood,
        exercises,
      });
    }
    return result;
  },
});

// ── Writes ───────────────────────────────────────────────

/** Insert workouts that don't exist yet. Returns the cloud ID for each. */
export const pushWorkouts = mutation({
  args: { workouts: v.array(workoutValidator) },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    const results: { id: string; cloudId: Id<"workouts"> }[] = [];
    let inserted = 0;

    for (const w of args.workouts) {
      const existing = await ctx.db
        .query("workouts")
        .withIndex("by_userId_localId", (q) => q.eq("userId", user._id).eq("localId", w.id))
        .first();
      if (existing) {
        results.push({ id: w.id, cloudId: existing._id });
        continue;
      }

      const workoutId = await ctx.db.insert("workouts", {
        userId: user._id,
        localId: w.id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        notes: w.notes,
        bodyWeight: w.bodyWeight,
        mood: w.mood,
      });

      for (let exIdx = 0; exIdx < w.exercises.length; exIdx++) {
        const ex = w.exercises[exIdx];
        const exerciseLogId = await ctx.db.insert("exerciseLogs", {
          workoutId,
          userId: user._id,
          localId: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          notes: ex.notes,
          supersetGroupId: ex.supersetGroupId,
          order: exIdx,
        });
        for (let setIdx = 0; setIdx < ex.sets.length; setIdx++) {
          const s = ex.sets[setIdx];
          await ctx.db.insert("sets", {
            exerciseLogId,
            userId: user._id,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            completed: s.completed,
            type: s.type,
            order: setIdx,
          });
        }
      }

      results.push({ id: w.id, cloudId: workoutId });
      inserted++;
    }

    if (inserted > 0) await bumpDataVersion(ctx, user);
    return results;
  },
});

async function deleteWorkoutTree(ctx: MutationCtx, workout: Doc<"workouts">) {
  const logs = await ctx.db
    .query("exerciseLogs")
    .withIndex("by_workoutId", (q) => q.eq("workoutId", workout._id))
    .collect();
  for (const log of logs) {
    const sets = await ctx.db
      .query("sets")
      .withIndex("by_exerciseLogId", (q) => q.eq("exerciseLogId", log._id))
      .collect();
    for (const s of sets) await ctx.db.delete(s._id);
    await ctx.db.delete(log._id);
  }
  await ctx.db.delete(workout._id);
}

export const deleteWorkouts = mutation({
  args: { ids: v.array(v.string()) },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    let deleted = 0;
    for (const localId of args.ids) {
      // collect() rather than first(): older app versions could insert duplicates.
      const matches = await ctx.db
        .query("workouts")
        .withIndex("by_userId_localId", (q) => q.eq("userId", user._id).eq("localId", localId))
        .collect();
      for (const w of matches) {
        await deleteWorkoutTree(ctx, w);
        deleted++;
      }
    }
    if (deleted > 0) await bumpDataVersion(ctx, user);
  },
});

export const pushCustomExercises = mutation({
  args: { exercises: v.array(customExerciseValidator) },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    let changed = 0;
    for (const e of args.exercises) {
      const existing = await ctx.db
        .query("customExercises")
        .withIndex("by_userId_localId", (q) => q.eq("userId", user._id).eq("localId", e.id))
        .first();
      if (existing) {
        if (
          existing.name !== e.name ||
          existing.category !== e.category ||
          existing.muscleGroup !== e.muscleGroup
        ) {
          await ctx.db.patch(existing._id, {
            name: e.name,
            category: e.category,
            muscleGroup: e.muscleGroup,
          });
          changed++;
        }
        continue;
      }
      await ctx.db.insert("customExercises", {
        userId: user._id,
        localId: e.id,
        name: e.name,
        category: e.category,
        muscleGroup: e.muscleGroup,
      });
      changed++;
    }
    if (changed > 0) await bumpDataVersion(ctx, user);
  },
});

export const pushPersonalRecords = mutation({
  args: { records: v.array(personalRecordValidator) },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    let inserted = 0;
    for (const pr of args.records) {
      const sameWorkout = await ctx.db
        .query("personalRecords")
        .withIndex("by_userId_workoutLocalId", (q) =>
          q.eq("userId", user._id).eq("workoutLocalId", pr.workoutId)
        )
        .collect();
      if (sameWorkout.some((e) => e.exerciseId === pr.exerciseId && e.type === pr.type)) {
        continue;
      }
      await ctx.db.insert("personalRecords", {
        userId: user._id,
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.value,
        reps: pr.reps,
        date: pr.date,
        workoutLocalId: pr.workoutId,
      });
      inserted++;
    }
    if (inserted > 0) await bumpDataVersion(ctx, user);
  },
});

/**
 * Find the cloud row for a measurement: by localId, then by legacy _id
 * (old app versions used it as the local ID), then by exact timestamp
 * (rows created before localId existed). Same timestamp = same measurement.
 */
async function findMeasurement(
  ctx: MutationCtx,
  userId: Id<"users">,
  id: string,
  date?: number,
): Promise<Doc<"bodyMeasurements"> | null> {
  const byLocalId = await ctx.db
    .query("bodyMeasurements")
    .withIndex("by_userId_localId", (q) => q.eq("userId", userId).eq("localId", id))
    .first();
  if (byLocalId) return byLocalId;

  const legacyId = ctx.db.normalizeId("bodyMeasurements", id);
  if (legacyId) {
    const doc = await ctx.db.get(legacyId);
    if (doc && doc.userId === userId) return doc;
  }

  if (date !== undefined) {
    const byDate = await ctx.db
      .query("bodyMeasurements")
      .withIndex("by_userId_date", (q) => q.eq("userId", userId).eq("date", date))
      .first();
    if (byDate) return byDate;
  }
  return null;
}

export const pushBodyMeasurements = mutation({
  args: { measurements: v.array(measurementValidator) },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    let changed = 0;
    for (const m of args.measurements) {
      const { id, ...fields } = m;
      const existing = await findMeasurement(ctx, user._id, id, m.date);
      if (existing) {
        // Claim legacy rows with this device's ID; otherwise the next pull converges IDs.
        if (!existing.localId) {
          await ctx.db.patch(existing._id, { localId: id });
          changed++;
        }
        continue;
      }
      await ctx.db.insert("bodyMeasurements", { userId: user._id, localId: id, ...fields });
      changed++;
    }
    if (changed > 0) await bumpDataVersion(ctx, user);
  },
});

export const deleteBodyMeasurements = mutation({
  args: { items: v.array(v.object({ id: v.string(), date: v.optional(v.float64()) })) },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    let deleted = 0;
    for (const item of args.items) {
      const existing = await findMeasurement(ctx, user._id, item.id, item.date);
      if (existing) {
        await ctx.db.delete(existing._id);
        deleted++;
      }
    }
    if (deleted > 0) await bumpDataVersion(ctx, user);
  },
});

/**
 * Delete the user's cloud data in batches. Call repeatedly (passing back
 * `before`) until `done` is true. Only data created before the first call
 * is removed, so anything pushed afterwards is kept.
 */
export const wipeData = mutation({
  args: {
    scope: v.union(v.literal("history"), v.literal("all")),
    before: v.optional(v.float64()),
  },
  handler: async (ctx, args) => {
    const user = await requireSyncAccess(ctx);
    const before = args.before ?? Date.now();
    const done = await deleteUserDocs(ctx, user._id, tablesForScope(args.scope), 1000, before);
    await bumpDataVersion(ctx, user);
    return { done, before };
  },
});
