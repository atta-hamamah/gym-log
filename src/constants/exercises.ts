import { Exercise } from '../types';

export const EXERCISES: Exercise[] = [
  // CHEST
  { id: 'ex-bench-press', name: 'Barbell Bench Press', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: 'ex-incline-db', name: 'Incline Dumbbell Press', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: 'ex-cable-cross', name: 'Cable Crossovers', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: 'ex-chest-dips', name: 'Chest Dips', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: 'ex-db-fly', name: 'Dumbbell Fly', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: 'ex-decline-bench', name: 'Decline Bench Press', category: 'strength', muscleGroup: 'Chest', isCustom: false },

  // BACK
  { id: 'ex-deadlift', name: 'Deadlift', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: 'ex-pull-ups', name: 'Pull Ups', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: 'ex-bent-rows', name: 'Bent Over Rows', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: 'ex-lat-pulldown', name: 'Lat Pulldown', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: 'ex-seated-row', name: 'Seated Cable Row', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: 'ex-tbar-row', name: 'T-Bar Row', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: 'ex-chinups', name: 'Chin Ups', category: 'strength', muscleGroup: 'Back', isCustom: false },

  // LEGS
  { id: 'ex-squat', name: 'Barbell Squat', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-leg-press', name: 'Leg Press', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-lunges', name: 'Lunges', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-leg-curl', name: 'Leg Curl', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-leg-ext', name: 'Leg Extension', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-calf-raise', name: 'Calf Raise', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-rdl', name: 'Romanian Deadlift', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-hack-squat', name: 'Hack Squat', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: 'ex-bulgarian', name: 'Bulgarian Split Squat', category: 'strength', muscleGroup: 'Legs', isCustom: false },

  // SHOULDERS
  { id: 'ex-ohp', name: 'Overhead Press', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  { id: 'ex-lateral-raise', name: 'Lateral Raise', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  { id: 'ex-face-pull', name: 'Face Pull', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  { id: 'ex-front-raise', name: 'Front Raise', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  { id: 'ex-rear-delt-fly', name: 'Rear Delt Fly', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  { id: 'ex-arnold-press', name: 'Arnold Press', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },

  // ARMS - BICEPS
  { id: 'ex-bb-curl', name: 'Barbell Curl', category: 'strength', muscleGroup: 'Biceps', isCustom: false },
  { id: 'ex-hammer-curl', name: 'Hammer Curl', category: 'strength', muscleGroup: 'Biceps', isCustom: false },
  { id: 'ex-preacher-curl', name: 'Preacher Curl', category: 'strength', muscleGroup: 'Biceps', isCustom: false },
  { id: 'ex-concentration', name: 'Concentration Curl', category: 'strength', muscleGroup: 'Biceps', isCustom: false },

  // ARMS - TRICEPS
  { id: 'ex-tri-pushdown', name: 'Tricep Pushdown', category: 'strength', muscleGroup: 'Triceps', isCustom: false },
  { id: 'ex-skull-crusher', name: 'Skull Crushers', category: 'strength', muscleGroup: 'Triceps', isCustom: false },
  { id: 'ex-tri-dips', name: 'Tricep Dips', category: 'strength', muscleGroup: 'Triceps', isCustom: false },
  { id: 'ex-overhead-ext', name: 'Overhead Tricep Extension', category: 'strength', muscleGroup: 'Triceps', isCustom: false },

  // CORE
  { id: 'ex-plank', name: 'Plank', category: 'strength', muscleGroup: 'Core', isCustom: false },
  { id: 'ex-cable-crunch', name: 'Cable Crunch', category: 'strength', muscleGroup: 'Core', isCustom: false },
  { id: 'ex-hanging-raise', name: 'Hanging Leg Raise', category: 'strength', muscleGroup: 'Core', isCustom: false },
  { id: 'ex-ab-rollout', name: 'Ab Rollout', category: 'strength', muscleGroup: 'Core', isCustom: false },

  // CARDIO
  { id: 'ex-treadmill', name: 'Treadmill Run', category: 'cardio', muscleGroup: 'Cardio', isCustom: false },
  { id: 'ex-rowing', name: 'Rowing Machine', category: 'cardio', muscleGroup: 'Cardio', isCustom: false },
  { id: 'ex-cycling', name: 'Cycling', category: 'cardio', muscleGroup: 'Cardio', isCustom: false },
  { id: 'ex-elliptical', name: 'Elliptical', category: 'cardio', muscleGroup: 'Cardio', isCustom: false },
  { id: 'ex-stairmaster', name: 'Stairmaster', category: 'cardio', muscleGroup: 'Cardio', isCustom: false },
  { id: 'ex-jump-rope', name: 'Jump Rope', category: 'cardio', muscleGroup: 'Cardio', isCustom: false },
];

export const MUSCLE_GROUPS = [
  'All',
  'Chest',
  'Back',
  'Legs',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Core',
  'Cardio',
];
