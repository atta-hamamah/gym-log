
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WorkoutSession, Exercise, UserStats, PersonalRecord, BodyMeasurement } from '../types';
import { EXERCISES } from '../constants/exercises';

const KEYS = {
  WORKOUTS: '@gym_log_workouts',
  CUSTOM_EXERCISES: '@gym_log_custom_exercises',
  USER_STATS: '@gym_log_user_stats',
  CURRENT_WORKOUT: '@gym_log_current_workout', // For resuming if app crashes
  PERSONAL_RECORDS: '@gym_log_personal_records',
  BODY_MEASUREMENTS: '@gym_log_body_measurements',
  FIRST_OPEN: '@gym_log_first_open',
  PURCHASE_STATUS: '@gym_log_purchase_status',
  IS_LIVE: '@gym_log_is_live',
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
  },

  // PERSONAL RECORDS
  async getPersonalRecords(): Promise<PersonalRecord[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.PERSONAL_RECORDS);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Failed to load PRs', e);
      return [];
    }
  },

  async savePersonalRecords(records: PersonalRecord[]): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PERSONAL_RECORDS, JSON.stringify(records));
    } catch (e) {
      console.error('Failed to save PRs', e);
    }
  },

  async addPersonalRecords(newRecords: PersonalRecord[]): Promise<void> {
    const existing = await this.getPersonalRecords();
    const combined = [...existing, ...newRecords];
    await this.savePersonalRecords(combined);
  },

  // BODY MEASUREMENTS
  async getBodyMeasurements(): Promise<BodyMeasurement[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.BODY_MEASUREMENTS);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      console.error('Failed to load measurements', e);
      return [];
    }
  },

  async saveBodyMeasurement(measurement: BodyMeasurement): Promise<void> {
    try {
      const existing = await this.getBodyMeasurements();
      existing.push(measurement);
      // Sort by date descending
      existing.sort((a, b) => b.date - a.date);
      await AsyncStorage.setItem(KEYS.BODY_MEASUREMENTS, JSON.stringify(existing));
    } catch (e) {
      console.error('Failed to save measurement', e);
    }
  },

  async deleteBodyMeasurement(id: string): Promise<void> {
    const existing = await this.getBodyMeasurements();
    const filtered = existing.filter(m => m.id !== id);
    await AsyncStorage.setItem(KEYS.BODY_MEASUREMENTS, JSON.stringify(filtered));
  },

  // SUBSCRIPTION / TRIAL
  async getFirstOpenDate(): Promise<number | null> {
    try {
      const value = await AsyncStorage.getItem(KEYS.FIRST_OPEN);
      return value ? parseInt(value, 10) : null;
    } catch (e) {
      console.error('Failed to get first open date', e);
      return null;
    }
  },

  async setFirstOpenDate(timestamp: number): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.FIRST_OPEN, timestamp.toString());
    } catch (e) {
      console.error('Failed to set first open date', e);
    }
  },

  async getPurchaseStatus(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(KEYS.PURCHASE_STATUS);
    } catch (e) {
      console.error('Failed to get purchase status', e);
      return null;
    }
  },

  async setPurchaseStatus(status: string): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.PURCHASE_STATUS, status);
    } catch (e) {
      console.error('Failed to set purchase status', e);
    }
  },

  // GO LIVE
  async getIsLive(): Promise<boolean> {
    try {
      const value = await AsyncStorage.getItem(KEYS.IS_LIVE);
      return value === 'true';
    } catch (e) {
      return false;
    }
  },

  async setIsLive(value: boolean): Promise<void> {
    try {
      await AsyncStorage.setItem(KEYS.IS_LIVE, value.toString());
    } catch (e) {
      console.error('Failed to set is live', e);
    }
  },

  // CUSTOM EXERCISES (direct access for migration)
  async getCustomExercises(): Promise<Exercise[]> {
    try {
      const json = await AsyncStorage.getItem(KEYS.CUSTOM_EXERCISES);
      return json ? JSON.parse(json) : [];
    } catch (e) {
      return [];
    }
  },
};
