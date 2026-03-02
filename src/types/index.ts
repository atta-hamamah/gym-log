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

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: Set[];
  cardio?: CardioData;
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  exercises: ExerciseLog[];
  notes?: string;
  bodyWeight?: number;
}

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

export type RootStackParamList = {
  Main: undefined;
  WorkoutSession: { workoutId?: string };
  ExerciseList: undefined;
  WorkoutDetails: { workoutId: string };
  ProgramDetail: { programId: string };
};

export type TabParamList = {
  Home: undefined;
  Programs: undefined;
  History: undefined;
  Progress: undefined;
  Settings: undefined;
};
