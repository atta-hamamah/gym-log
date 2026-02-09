
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession, Exercise, UserStats } from '../types';
import { EXERCISES } from '../constants/exercises';

const KEYS = {
  WORKOUTS: '@gym_log_workouts',
  CUSTOM_EXERCISES: '@gym_log_custom_exercises',
  USER_STATS: '@gym_log_user_stats',
  CURRENT_WORKOUT: '@gym_log_current_workout', // For resuming if app crashes
};

export const StorageService = {
  // WORKOUTS
  async getWorkouts(): Promise<WorkoutSession[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.WORKOUTS);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Failed to load workouts', e);
      return [];
    }
  },

  async saveWorkout(workout: WorkoutSession): Promise<void> {
    const workouts = await this.getWorkouts();
    // Check if updating existing workout
    const index = workouts.findIndex(w => w.id === workout.id);
    if (index >= 0) {
      workouts[index] = workout;
    } else {
      workouts.unshift(workout); // Add to beginning (newest first)
    }
    await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
  },

  async deleteWorkout(id: string): Promise<void> {
    const workouts = await this.getWorkouts();
    const filtered = workouts.filter(w => w.id !== id);
    await AsyncStorage.setItem(KEYS.WORKOUTS, JSON.stringify(filtered));
  },

  // EXERCISES
  async getExercises(): Promise<Exercise[]> {
    try {
      const customJson = await AsyncStorage.getItem(KEYS.CUSTOM_EXERCISES);
      const customExercises = customJson ? JSON.parse(customJson) : [];
      // Combine with built-in exercises, ensure unique IDs if any collisions (though UUIDs should be fine)
      return [...EXERCISES, ...customExercises];
    } catch (e) {
      console.error('Failed to load exercises', e);
      return EXERCISES;
    }
  },

  async addCustomExercise(exercise: Exercise): Promise<void> {
    try {
      const customJson = await AsyncStorage.getItem(KEYS.CUSTOM_EXERCISES);
      const customExercises = customJson ? JSON.parse(customJson) : [];
      customExercises.push({ ...exercise, isCustom: true });
      await AsyncStorage.setItem(KEYS.CUSTOM_EXERCISES, JSON.stringify(customExercises));
    } catch (e) {
      console.error('Failed to save custom exercise', e);
    }
  },

  // USER STATS
  async getUserStats(): Promise<UserStats | null> {
    try {
      const json = await AsyncStorage.getItem(KEYS.USER_STATS);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      console.error('Failed to load stats', e);
      return null;
    }
  },

  async updateUserStats(stats: Partial<UserStats>): Promise<void> {
    try {
      const current = await this.getUserStats();
      const newStats = { ...current, ...stats, lastUpdated: Date.now() };
      await AsyncStorage.setItem(KEYS.USER_STATS, JSON.stringify(newStats));
    } catch (e) {
      console.error('Failed to update stats', e);
    }
  },
  
  // CURRENT ACTIVE WORKOUT (Resume on restart)
  async saveCurrentWorkout(workout: WorkoutSession | null): Promise<void> {
    if (!workout) {
      await AsyncStorage.removeItem(KEYS.CURRENT_WORKOUT);
    } else {
      await AsyncStorage.setItem(KEYS.CURRENT_WORKOUT, JSON.stringify(workout));
    }
  },

  async getCurrentWorkout(): Promise<WorkoutSession | null> {
    try {
      const json = await AsyncStorage.getItem(KEYS.CURRENT_WORKOUT);
      return json ? JSON.parse(json) : null;
    } catch (e) {
      return null;
    }
  }
};
