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

export type RootStackParamList = {
  Main: undefined;
  WorkoutSession: { workoutId?: string };
  ExerciseList: undefined;
  WorkoutDetails: { workoutId: string };
};

export type TabParamList = {
  Home: undefined;
  History: undefined;
  Progress: undefined;
  Settings: undefined;
};
