/**
 * Migration Service
 * Reads all local data from AsyncStorage and pushes it to Convex.
 */

import { StorageService } from './storage';
import { ConvexReactClient } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

export interface MigrationProgress {
  step: string;
  current: number;
  total: number;
}

export type MigrationCallback = (progress: MigrationProgress) => void;

export interface MigrationResult {
  success: boolean;
  workoutsInserted: number;
  exercisesInserted: number;
  prsInserted: number;
  measurementsInserted: number;
  error?: string;
}

/**
 * Migrate all local data to Convex.
 */
export async function migrateLocalToConvex(
  convexClient: ConvexReactClient,
  userId: Id<"users">,
  onProgress?: MigrationCallback,
): Promise<MigrationResult> {
  try {
    // ── 1. Read all local data ──
    onProgress?.({ step: 'reading', current: 0, total: 4 });

    const [workouts, customExercisesRaw, personalRecords, bodyMeasurements] = await Promise.all([
      StorageService.getWorkouts(),
      StorageService.getCustomExercises(),
      StorageService.getPersonalRecords(),
      StorageService.getBodyMeasurements(),
    ]);

    // Filter to only custom exercises (not built-in)
    const customExercises = customExercisesRaw.filter(e => e.isCustom);

    onProgress?.({ step: 'uploading', current: 1, total: 4 });

    // ── 2. Call migration mutation ──
    const result = await convexClient.mutation(api.migration.migrateLocalData, {
      userId,
      workouts: workouts.map(w => ({
        id: w.id,
        name: w.name,
        startTime: w.startTime,
        endTime: w.endTime,
        exercises: w.exercises.map(ex => ({
          id: ex.id,
          exerciseId: ex.exerciseId,
          exerciseName: ex.exerciseName,
          sets: ex.sets.map(s => ({
            id: s.id,
            weight: s.weight,
            reps: s.reps,
            rpe: s.rpe,
            completed: s.completed,
            type: s.type,
          })),
          notes: ex.notes,
          supersetGroupId: ex.supersetGroupId,
        })),
        notes: w.notes,
        bodyWeight: w.bodyWeight,
        mood: w.mood,
      })),
      customExercises: customExercises.map(e => ({
        id: e.id,
        name: e.name,
        category: e.category,
        muscleGroup: e.muscleGroup,
      })),
      personalRecords: personalRecords.map(pr => ({
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.value,
        reps: pr.reps,
        date: pr.date,
        workoutId: pr.workoutId,
      })),
      bodyMeasurements: bodyMeasurements.map(m => ({
        id: m.id,
        date: m.date,
        neck: m.neck,
        chest: m.chest,
        waist: m.waist,
        hips: m.hips,
        biceps: m.biceps,
        thighs: m.thighs,
        calves: m.calves,
      })),
    });

    onProgress?.({ step: 'complete', current: 4, total: 4 });

    // ── 3. Mark as live locally ──
    await StorageService.setIsLive(true);

    return {
      success: true,
      workoutsInserted: result.workoutsInserted,
      exercisesInserted: result.exercisesInserted,
      prsInserted: result.prsInserted,
      measurementsInserted: result.measurementsInserted,
    };
  } catch (error: any) {
    console.error('[Migration] Failed:', error);
    return {
      success: false,
      workoutsInserted: 0,
      exercisesInserted: 0,
      prsInserted: 0,
      measurementsInserted: 0,
      error: error?.message || 'Migration failed',
    };
  }
}

/**
 * Reverse Migration: Sync Cloud Data down to local AsyncStorage.
 * Call this when a returning user logs onto a fresh device.
 */
export async function syncConvexToLocal(
  convexClient: ConvexReactClient
): Promise<boolean> {
  try {
    const data = await convexClient.query(api.migration.getCloudData);
    
    // Reverse save all items back to local AsyncStorage
    await StorageService.setAllWorkouts(data.workouts as any);
    await StorageService.setAllCustomExercises(data.customExercises as any);
    await StorageService.savePersonalRecords(data.personalRecords as any);
    await StorageService.setAllBodyMeasurements(data.bodyMeasurements as any);

    // Mark as live to immediately unlock normal app flow
    await StorageService.setIsLive(true);
    return true;
  } catch (error) {
    console.error('[Reverse Sync] Failed to sync down from convex:', error);
    return false;
  }
}
