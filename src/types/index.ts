export interface Set {
  id: string;
  weight: number;
  reps: number;
  rpe?: number; // Rate of Perceived Exertion (1-10)
  completed: boolean;
  type: 'warmup' | 'normal' | 'failure' | 'drop';
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

export interface Exercise {
  id: string;
  name: string;
  category: 'strength' | 'cardio' | 'flexibility';
  muscleGroup: string;
  isCustom: boolean;
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
export type SubscriptionTier = 'trial' | 'expired' | 'local_premium';
// ──────────────────────────────────────────────────────────

export type RootStackParamList = {
  Main: undefined;
  WorkoutSession: { workoutId?: string };
  ExerciseList: undefined;
  WorkoutDetails: { workoutId: string };
  ProgramDetail: { programId: string };
  Paywall: undefined;
  GoLive: undefined;
  AIChat: undefined;
};

export type TabParamList = {
  Home: undefined;
  Programs: undefined;
  History: undefined;
  Progress: undefined;
  Settings: undefined;
};
