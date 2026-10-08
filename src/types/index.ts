export interface Set {
  id: string;
  weight: number;
  reps: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  completed: boolean;
  type: 'warmup' | 'normal' | 'failure' | 'drop';
  durationSec?: number; // timed holds and cardio
  distance?: number;    // km, cardio
  completedAt?: number; // when the set was logged (rest = gap between sets)
}

export interface CardioData {
  distance?: number;   // km
  duration?: number;   // minutes
  calories?: number;
}

export type SupersetType = 'superset' | 'circuit' | 'giant_set';

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: Set[];
  cardio?: CardioData;
  notes?: string;
  supersetGroupId?: string;  // shared ID to link exercises in a superset/circuit/giant set
  target?: ExerciseTarget;   // what the plan prescribed
}

/** What the plan (AI coach or program) prescribed for an exercise. */
export interface ExerciseTarget {
  sets: number;
  reps: string;          // e.g. "8-12", "5", "AMRAP", "30s"
  restSeconds: number;
  weight?: number;       // suggested load in kg
  notes?: string;
}

export type WorkoutSourceType = 'manual' | 'ai' | 'program';

/** Where a workout came from, so the coach can compare plan vs. reality. */
export interface WorkoutSource {
  type: WorkoutSourceType;
  programId?: string;
  dayName?: string;
  reasoning?: string;    // the AI's reason for this session
}

export interface WorkoutSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  exercises: ExerciseLog[];
  notes?: string;
  bodyWeight?: number;
  mood?: number;  // 1-5 energy/mood rating
  source?: WorkoutSource;
}

// ── Body Measurements ────────────────────────────────
export interface BodyMeasurement {
  id: string;
  date: number;       // timestamp
  neck?: number;      // cm
  chest?: number;
  waist?: number;
  hips?: number;
  biceps?: number;
  thighs?: number;
  calves?: number;
}

export type MeasurementKey = 'neck' | 'chest' | 'waist' | 'hips' | 'biceps' | 'thighs' | 'calves';
// ──────────────────────────────────────────────────────

export type Equipment =
  | 'barbell' | 'dumbbell' | 'kettlebell' | 'ez_bar' | 'trap_bar' | 'plate'
  | 'machine' | 'cable' | 'smith' | 'rack' | 'bench'
  | 'pullup_bar' | 'dip_bars' | 'band' | 'box' | 'medicine_ball' | 'ab_wheel'
  | 'jump_rope' | 'cardio_machine' | 'battle_ropes' | 'sled' | 'pool';

export type Muscle =
  | 'chest' | 'upper_chest' | 'front_delts' | 'side_delts' | 'rear_delts'
  | 'biceps' | 'triceps' | 'forearms'
  | 'lats' | 'upper_back' | 'traps' | 'lower_back'
  | 'abs' | 'obliques' | 'hip_flexors'
  | 'glutes' | 'quads' | 'hamstrings' | 'adductors' | 'abductors' | 'calves';

/**
 * How sets are logged:
 * weight_reps = load × reps, reps = bodyweight reps (optional added load),
 * time = timed hold (optional load), cardio = duration + distance.
 */
export type TrackingType = 'weight_reps' | 'reps' | 'time' | 'cardio';

export type ExperienceLevel = 'beginner' | 'intermediate' | 'advanced';

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'cardio' | 'flexibility';
  muscleGroup: string;
  isCustom: boolean;
  /** Equipment required (empty = none, bodyweight). */
  equipment?: Equipment[];
  primaryMuscles?: Muscle[];
  secondaryMuscles?: Muscle[];
  level?: ExperienceLevel;
  mechanic?: 'compound' | 'isolation';
  tracking?: TrackingType;
}

export interface UserStats {
  weight: number;
  bodyFat?: number;
  height?: number;
  lastUpdated: number;
}

// ── Programs ──────────────────────────────────────────
export interface ProgramExercise {
  exerciseId: string;
  exerciseName: string;
  sets: number;
  reps: string;       // e.g. "8-12", "5", "AMRAP"
  restSeconds: number;
  notes?: string;
}

export interface ProgramDay {
  dayLabel: string;     // e.g. "Day 1", "Monday"
  name: string;         // e.g. "Push", "Upper Body"
  exercises: ProgramExercise[];
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  daysPerWeek: number;
  goal: 'strength' | 'hypertrophy' | 'general' | 'fat_loss';
  duration: string;     // e.g. "8 weeks", "Ongoing"
  icon: string;         // emoji
  color: string;        // accent color for card
  days: ProgramDay[];
}
// ──────────────────────────────────────────────────────

// ── Personal Records ─────────────────────────────────
export type PRType = 'max_weight' | 'best_volume' | 'est_1rm';

export interface PersonalRecord {
  exerciseId: string;
  exerciseName: string;
  type: PRType;
  value: number;
  reps?: number;         // reps at that weight (for max_weight)
  date: number;          // timestamp
  workoutId: string;
}

export interface DetectedPR {
  exerciseId: string;
  exerciseName: string;
  type: PRType;
  newValue: number;
  previousValue: number | null;
  reps?: number;
}
// ──────────────────────────────────────────────────────

// ── Subscription ─────────────────────────────────────────
export type SubscriptionTier = 'pro_trial' | 'free' | 'pro' | 'ai_subscriber';
// ──────────────────────────────────────────────────────────

// ── AI Workout Generation ────────────────────────────────
export interface AIGeneratedExercise {
  isNew: boolean;
  exerciseId?: string;       // Only when isNew=false
  exerciseName: string;
  muscleGroup?: string;      // Only when isNew=true
  category?: string;         // Only when isNew=true
  sets: number;
  reps: string;              // e.g. "8-10", "5", "AMRAP", "45s"
  restSeconds: number;
  targetWeight?: number;     // suggested load in kg
  supersetGroup?: string;    // exercises sharing a label are done back to back
  notes?: string;
}

export interface AIGeneratedWorkout {
  workoutName: string;
  reasoning: string;
  estimatedMinutes?: number;
  warmup?: string;
  exercises: AIGeneratedExercise[];
}

/** Options sent with an AI workout request. */
export interface AIWorkoutRequest {
  userComment?: string;
  sessionMinutes?: number;
  equipment?: string[];   // equipment available today (overrides the profile)
  focus?: string[];       // muscle groups to focus on
}

/** Training preferences the AI coach plans around (stored in the cloud profile). */
export interface TrainingProfile {
  experience?: ExperienceLevel;
  equipment?: Equipment[];
  trainingDays?: number;     // sessions per week
  sessionMinutes?: number;   // preferred session length
  limitations?: string;      // injuries / things to avoid
}
// ──────────────────────────────────────────────────────────

export type RootStackParamList = {
  Main: undefined;
  WorkoutSession: { workoutId?: string };
  ExerciseList: undefined;
  WorkoutDetails: { workoutId: string };
  ProgramDetail: { programId: string };
  AIWorkoutPreview: { workout: AIGeneratedWorkout; options?: AIWorkoutRequest };
  Paywall: undefined;
  AIOnboarding: { mode?: 'signin' | 'signup' } | undefined;
  WorkoutAura: {
    workoutId?: string;
    localStats?: {
      name: string;
      durationMin: number | null;
      totalSets: number;
      totalVolume: number;
      exerciseCount: number;
      exercises: { name: string; bestWeight: number; bestReps: number }[];
    };
  };
};

export type TabParamList = {
  Home: undefined;
  Programs: undefined;
  History: undefined;
  Progress: undefined;
  AI: undefined;
  Settings: undefined;
};
