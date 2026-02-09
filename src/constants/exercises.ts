
import { Exercise } from '../types';

export const EXERCISES: Exercise[] = [
  // CHEST
  { id: '1', name: 'Barbell Bench Press', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: '2', name: 'Incline Dumbbell Press', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  { id: '3', name: 'Cable Crossovers', category: 'strength', muscleGroup: 'Chest', isCustom: false },
  // BACK
  { id: '4', name: 'Deadlift', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: '5', name: 'Pull Ups', category: 'strength', muscleGroup: 'Back', isCustom: false },
  { id: '6', name: 'Bent Over Rows', category: 'strength', muscleGroup: 'Back', isCustom: false },
  // LEGS
  { id: '7', name: 'Barbell Squat', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: '8', name: 'Leg Press', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  { id: '9', name: 'Lunges', category: 'strength', muscleGroup: 'Legs', isCustom: false },
  // SHOULDERS
  { id: '10', name: 'Overhead Press', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  { id: '11', name: 'Lateral Raise', category: 'strength', muscleGroup: 'Shoulders', isCustom: false },
  // ARMS
  { id: '12', name: 'Barbell Curl', category: 'strength', muscleGroup: 'Biceps', isCustom: false },
  { id: '13', name: 'Tricep Pushdown', category: 'strength', muscleGroup: 'Triceps', isCustom: false },
  // CARDIO
  { id: '14', name: 'Treadmill Run', category: 'cardio', muscleGroup: 'Full Body', isCustom: false },
  { id: '15', name: 'Rowing Machine', category: 'cardio', muscleGroup: 'Full Body', isCustom: false },
];
