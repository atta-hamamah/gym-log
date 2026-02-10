import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WorkoutSession, Exercise, UserStats, Set, ExerciseLog } from '../types';
import { StorageService } from '../services/storage';
import { generateId } from '../utils/generateId';
import { EXERCISES } from '../constants/exercises';

interface WorkoutContextType {
    workouts: WorkoutSession[];
    exercises: Exercise[];
    currentWorkout: WorkoutSession | null;
    userStats: UserStats | null;
    loading: boolean;

    startWorkout: (name?: string) => void;
    finishWorkout: (notes?: string) => Promise<void>;
    cancelWorkout: () => Promise<void>;

    addExerciseToWorkout: (exercise: Exercise) => void;
    removeExerciseFromWorkout: (exerciseLogId: string) => void;

    logSet: (exerciseLogId: string, set: Omit<Set, 'id' | 'completed'>) => void;
    updateSet: (exerciseLogId: string, setId: string, updates: Partial<Set>) => void;
    deleteSet: (exerciseLogId: string, setId: string) => void;

    refreshData: () => Promise<void>;
    updateUserStats: (stats: Partial<UserStats>) => Promise<void>;
    deleteWorkout: (id: string) => Promise<void>;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>(EXERCISES);
    const [currentWorkout, setCurrentWorkout] = useState<WorkoutSession | null>(null);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);

    const refreshData = useCallback(async () => {
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

            const savedSession = await StorageService.getCurrentWorkout();
            if (savedSession) {
                setCurrentWorkout(savedSession);
            }
        } catch (e) {
            console.error('Error refreshing data:', e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        if (currentWorkout) {
            StorageService.saveCurrentWorkout(currentWorkout);
        }
    }, [currentWorkout]);

    const startWorkout = useCallback((name: string = 'New Workout') => {
        const newSession: WorkoutSession = {
            id: generateId(),
            name,
            startTime: Date.now(),
            exercises: [],
        };
        setCurrentWorkout(newSession);
        StorageService.saveCurrentWorkout(newSession);
    }, []);

    const finishWorkout = useCallback(async (notes?: string) => {
        if (!currentWorkout) return;

        const completedSession: WorkoutSession = {
            ...currentWorkout,
            endTime: Date.now(),
            notes,
        };

        await StorageService.saveWorkout(completedSession);
        setWorkouts(prev => [completedSession, ...prev]);

        setCurrentWorkout(null);
        await StorageService.saveCurrentWorkout(null);
    }, [currentWorkout]);

    const cancelWorkout = useCallback(async () => {
        setCurrentWorkout(null);
        await StorageService.saveCurrentWorkout(null);
    }, []);

    const addExerciseToWorkout = useCallback((exercise: Exercise) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            const newLog: ExerciseLog = {
                id: generateId(),
                exerciseId: exercise.id,
                exerciseName: exercise.name,
                sets: [],
            };
            return {
                ...prev,
                exercises: [...prev.exercises, newLog],
            };
        });
    }, []);

    const removeExerciseFromWorkout = useCallback((exerciseLogId: string) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                exercises: prev.exercises.filter(e => e.id !== exerciseLogId),
            };
        });
    }, []);

    const logSet = useCallback((exerciseLogId: string, setConfig: Omit<Set, 'id' | 'completed'>) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;

            const newSet: Set = {
                id: generateId(),
                ...setConfig,
                completed: true,
            };

            const updatedExercises = prev.exercises.map(ex => {
                if (ex.id === exerciseLogId) {
                    return { ...ex, sets: [...ex.sets, newSet] };
                }
                return ex;
            });

            return { ...prev, exercises: updatedExercises };
        });
    }, []);

    const updateSet = useCallback((exerciseLogId: string, setId: string, updates: Partial<Set>) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;

            const updatedExercises = prev.exercises.map(ex => {
                if (ex.id === exerciseLogId) {
                    const newSets = ex.sets.map(s => s.id === setId ? { ...s, ...updates } : s);
                    return { ...ex, sets: newSets };
                }
                return ex;
            });

            return { ...prev, exercises: updatedExercises };
        });
    }, []);

    const deleteSet = useCallback((exerciseLogId: string, setId: string) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;

            const updatedExercises = prev.exercises.map(ex => {
                if (ex.id === exerciseLogId) {
                    return { ...ex, sets: ex.sets.filter(s => s.id !== setId) };
                }
                return ex;
            });

            return { ...prev, exercises: updatedExercises };
        });
    }, []);

    const updateUserStats = useCallback(async (stats: Partial<UserStats>) => {
        await StorageService.updateUserStats(stats);
        const current = userStats || { weight: 0, lastUpdated: Date.now() };
        setUserStats({ ...current, ...stats, lastUpdated: Date.now() });
    }, [userStats]);

    const deleteWorkout = useCallback(async (id: string) => {
        await StorageService.deleteWorkout(id);
        setWorkouts(prev => prev.filter(w => w.id !== id));
    }, []);

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
                deleteWorkout,
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
