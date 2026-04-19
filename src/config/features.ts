/**
 * Central feature flags — edit THIS file to change what's free vs Pro.
 * Every screen checks these flags via the useFeatureAccess() hook.
 *
 * true  = requires Pro (locked after trial expires)
 * false = free for everyone forever
 */

export const PRO_FEATURES = {
  // Body Measurements (neck, chest, waist, hips, biceps, thighs, calves)
  bodyMeasurements: true,

  // Supersets / Circuits / Giant Sets
  supersets: true,

  // CSV Export
  csvExport: true,

  // Progress Charts (max weight, volume, best set)
  progressCharts: false,

  // Programs (browsing built-in programs)
  programs: false,

  // Custom Exercises (creating your own exercises)
  customExercises: false,

  // Workout History (viewing past workouts)
  workoutHistory: false,

  // RPE Tracking
  rpeTracking: true,

  // Workout Aura (post-workout summary screen)
  workoutAura: true,
} as const;

export type ProFeatureKey = keyof typeof PRO_FEATURES;
