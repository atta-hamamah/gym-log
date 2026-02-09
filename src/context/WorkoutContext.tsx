
import React, { createContext, useContext, useState, useEffect } from 'react';
import { WorkoutSession, Exercise, UserStats, Set, ExerciseLog } from '../types';
import { StorageService } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { EXERCISES } from '../constants/exercises';

interface WorkoutContextType {
    workouts: WorkoutSession[];
    exercises: Exercise[];
    currentWorkout: WorkoutSession | null;
    userStats: UserStats | null;
    loading: boolean;

    startWorkout: (name?: string) => void;
    finishWorkout: (notes?: string) => Promise<void>;
    cancelWorkout: () => void;

    addExerciseToWorkout: (exercise: Exercise) => void;
    removeExerciseFromWorkout: (exerciseId: string) => void;

    logSet: (exerciseId: string, set: Omit<Set, 'id' | 'completed'>) => void;
    updateSet: (exerciseId: string, setId: string, updates: Partial<Set>) => void;
    deleteSet: (exerciseId: string, setId: string) => void;

    refreshData: () => Promise<void>;
    updateUserStats: (stats: Partial<UserStats>) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>(EXERCISES);
    const [currentWorkout, setCurrentWorkout] = useState<WorkoutSession | null>(null);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshData = async () => {
        setLoading(true);
        try {
            const [loadedWorkouts, loadedExercises, loadedStats] = await Promise.all([
                StorageService.getWorkouts(),
                StorageService.getExercises(),
                StorageService.getUserStats(),
            ]);
            setWorkouts(loadedWorkouts);
            setExercises(loadedExercises);
            setUserStats(loadedStats);

            // Check for active workout
            const savedSession = await StorageService.getCurrentWorkout();
            if (savedSession) {
                setCurrentWorkout(savedSession);
            }
        } catch (e) {
            console.error("Error refreshing data:", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        refreshData();
    }, []);

    // Save current workout state whenever it changes
    useEffect(() => {
        if (currentWorkout) {
            StorageService.saveCurrentWorkout(currentWorkout);
        }
    }, [currentWorkout]);

    const startWorkout = (name: string = 'New Workout') => {
        const newSession: WorkoutSession = {
            id: uuidv4(),
            name,
            startTime: Date.now(),
            exercises: [],
        };
        setCurrentWorkout(newSession);
        StorageService.saveCurrentWorkout(newSession);
    };

    const finishWorkout = async (notes?: string) => {
        if (!currentWorkout) return;

        const completedSession: WorkoutSession = {
            ...currentWorkout,
            endTime: Date.now(),
            notes,
        };

        // Save to history
        const allWorkouts = await StorageService.getWorkouts();
        allWorkouts.unshift(completedSession);
        await StorageService.saveWorkout(completedSession);
        setWorkouts(allWorkouts);

        // Clear current
        setCurrentWorkout(null);
        await StorageService.saveCurrentWorkout(null);
    };

    const cancelWorkout = async () => {
        setCurrentWorkout(null);
        await StorageService.saveCurrentWorkout(null);
    };

    const addExerciseToWorkout = (exercise: Exercise) => {
        if (!currentWorkout) return;

        // Check if exercise already logged in this session? usually allow multiple entries or just one.
        // Let's assume one entry per exercise type for simplicity, but users might do supersets.
        // Let's just create a new log entry.

        const newlog: ExerciseLog = {
            id: uuidv4(),
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            sets: [],
        };

        setCurrentWorkout({
            ...currentWorkout,
            exercises: [...currentWorkout.exercises, newlog],
        });
    };

    const removeExerciseFromWorkout = (exerciseId: string) => {
        if (!currentWorkout) return;
        setCurrentWorkout({
            ...currentWorkout,
            exercises: currentWorkout.exercises.filter(e => e.id !== exerciseId),
        });
    };

    const logSet = (exerciseLogId: string, setConfig: Omit<Set, 'id' | 'completed'>) => {
        if (!currentWorkout) return;

        const newSet: Set = {
            id: uuidv4(),
            ...setConfig,
            completed: true, // Auto-complete for now when adding? or maybe user adds empty set then checks it? 
            // The requirement says "log sets", implying adding completed data usually.
        };

        const updatedExercises = currentWorkout.exercises.map(ex => {
            if (ex.id === exerciseLogId) {
                return { ...ex, sets: [...ex.sets, newSet] };
            }
            return ex;
        });

        setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
    };

    const updateSet = (exerciseLogId: string, setId: string, updates: Partial<Set>) => {
        if (!currentWorkout) return;

        const updatedExercises = currentWorkout.exercises.map(ex => {
            if (ex.id === exerciseLogId) {
                const newSets = ex.sets.map(s => s.id === setId ? { ...s, ...updates } : s);
                return { ...ex, sets: newSets };
            }
            return ex;
        });

        setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
    };

    const deleteSet = (exerciseLogId: string, setId: string) => {
        if (!currentWorkout) return;

        const updatedExercises = currentWorkout.exercises.map(ex => {
            if (ex.id === exerciseLogId) {
                return { ...ex, sets: ex.sets.filter(s => s.id !== setId) };
            }
            return ex;
        });

        setCurrentWorkout({ ...currentWorkout, exercises: updatedExercises });
    };

    const updateUserStats = async (stats: Partial<UserStats>) => {
        await StorageService.updateUserStats(stats);
        const current = userStats || { weight: 0, lastUpdated: Date.now() };
        setUserStats({ ...current, ...stats, lastUpdated: Date.now() });
    };

    return (
        <WorkoutContext.Provider
            value={{
                workouts,
                exercises,
                currentWorkout,
                userStats,
                loading,
                startWorkout,
                finishWorkout,
                cancelWorkout,
                addExerciseToWorkout,
                removeExerciseFromWorkout,
                logSet,
                updateSet,
                deleteSet,
                refreshData,
                updateUserStats,
            }}
        >
            {children}
        </WorkoutContext.Provider>
    );
};

export const useWorkout = () => {
    const context = useContext(WorkoutContext);
    if (!context) {
        throw new Error('useWorkout must be used within a WorkoutProvider');
    }
    return context;
};
