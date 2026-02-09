export interface Set {
  id: string;
  weight: number;
  reps: number;
  completed: boolean;
  type: 'warmup' | 'normal' | 'failure' | 'drop';
}

export interface ExerciseLog {
  id: string;
  exerciseId: string;
  exerciseName: string;
  sets: Set[];
  notes?: string;
}

export interface WorkoutSession {
  id: string;
  name: string;
  startTime: number; // timestamp
  endTime?: number; // timestamp
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
  WorkoutSession: { workoutId?: string }; // if undefined, start new
  ExerciseList: { onSelect: (exercise: Exercise) => void };
  WorkoutDetails: { workoutId: string };
};

export type TabParamList = {
  Home: undefined;
  History: undefined;
  Progress: undefined;
  Settings: undefined;
};
