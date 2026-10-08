import { Exercise } from '../types';
import { TFunction } from 'i18next';
import { EXERCISE_CATALOG, MUSCLE_GROUP_LIST } from './exerciseCatalog';

export { EXERCISE_BY_ID } from './exerciseCatalog';

export const EXERCISES: Exercise[] = EXERCISE_CATALOG;

export const MUSCLE_GROUPS = ['All', 'My Exercises', ...MUSCLE_GROUP_LIST];

/**
 * Translate an exercise name using the exercise ID.
 * Falls back to the provided fallbackName (for custom exercises).
 */
export function getExerciseName(exerciseId: string, t: TFunction, fallbackName?: string): string {
  const key = `exercises.${exerciseId}`;
  const translated = t(key, { defaultValue: '' });
  // If i18next returns the key itself or empty, use the fallback
  if (!translated || translated === key) {
    return fallbackName || exerciseId;
  }
  return translated;
}

/**
 * Translate a muscle group label.
 * Falls back to the raw muscleGroup string (for custom groups).
 */
export function getMuscleGroupName(muscleGroup: string, t: TFunction): string {
  const key = `muscleGroups.${muscleGroup}`;
  const translated = t(key, { defaultValue: '' });
  if (!translated || translated === key) {
    return muscleGroup;
  }
  return translated;
}

