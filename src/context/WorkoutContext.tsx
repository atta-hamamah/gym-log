import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { WorkoutSession, Exercise, UserStats, Set, ExerciseLog, DetectedPR, PersonalRecord, BodyMeasurement } from '../types';
import { StorageService } from '../services/storage';
import { generateId } from '../utils/generateId';
import { EXERCISES } from '../constants/exercises';
import { detectPRs, createPRRecords } from '../utils/prDetection';
import { useCloudSync } from './CloudSyncContext';

interface WorkoutContextType {
    workouts: WorkoutSession[];
    exercises: Exercise[];
    currentWorkout: WorkoutSession | null;
    userStats: UserStats | null;
    loading: boolean;
    lastDetectedPRs: DetectedPR[];
    personalRecords: PersonalRecord[];
    bodyMeasurements: BodyMeasurement[];

    startWorkout: (name?: string) => void;
    finishWorkout: (notes?: string, mood?: number) => Promise<string | null>;
    cancelWorkout: () => Promise<void>;

    addExerciseToWorkout: (exercise: Exercise) => void;
    removeExerciseFromWorkout: (exerciseLogId: string) => void;

    logSet: (exerciseLogId: string, set: Omit<Set, 'id' | 'completed'>) => void;
    updateSet: (exerciseLogId: string, setId: string, updates: Partial<Set>) => void;
    deleteSet: (exerciseLogId: string, setId: string) => void;

    // Superset management
    linkSuperset: (exerciseLogIds: string[]) => void;
    unlinkSuperset: (exerciseLogId: string) => void;
    reorderExercise: (fromIndex: number, toIndex: number) => void;

    // Notes & measurements
    updateExerciseNotes: (exerciseLogId: string, notes: string) => void;
    setWorkoutMood: (mood: number) => void;
    addBodyMeasurement: (measurement: BodyMeasurement) => Promise<void>;
    deleteBodyMeasurement: (id: string) => Promise<void>;

    refreshData: () => Promise<void>;
    updateUserStats: (stats: Partial<UserStats>) => Promise<void>;
    deleteWorkout: (id: string) => Promise<void>;
    /** Delete all workouts and PRs (cloud too, when linked to an account) */
    clearAllWorkouts: () => Promise<void>;
    /** Delete all workouts, PRs, measurements, custom exercises and body stats */
    clearAllData: () => Promise<void>;
    clearDetectedPRs: () => void;
}

const WorkoutContext = createContext<WorkoutContextType | undefined>(undefined);

export const WorkoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [workouts, setWorkouts] = useState<WorkoutSession[]>([]);
    const [exercises, setExercises] = useState<Exercise[]>(EXERCISES);
    const [currentWorkout, setCurrentWorkout] = useState<WorkoutSession | null>(null);
    const [userStats, setUserStats] = useState<UserStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastDetectedPRs, setLastDetectedPRs] = useState<DetectedPR[]>([]);
    const [personalRecords, setPersonalRecords] = useState<PersonalRecord[]>([]);
    const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>([]);

    // Local storage is the source the UI reads. Cloud sync (when the AI
    // subscription is active) runs in the background via CloudSyncContext:
    // every local write below is queued for upload by the storage layer.
    const { pushWorkoutNow } = useCloudSync();

    const loadCollections = useCallback(async () => {
        const [loadedWorkouts, loadedExercises, loadedStats, loadedPRs, loadedMeasurements] = await Promise.all([
            StorageService.getWorkouts(),
            StorageService.getExercises(),
            StorageService.getUserStats(),
            StorageService.getPersonalRecords(),
            StorageService.getBodyMeasurements(),
        ]);
        setWorkouts(loadedWorkouts);
        setExercises(loadedExercises);
        setUserStats(loadedStats);
        setPersonalRecords(loadedPRs);
        setBodyMeasurements(loadedMeasurements);
    }, []);

    const refreshData = useCallback(async () => {
        setLoading(true);
        try {
            await loadCollections();
            const savedSession = await StorageService.getCurrentWorkout();
            if (savedSession) {
                setCurrentWorkout(savedSession);
            }
        } catch (e) {
            console.error('Error refreshing data:', e);
        } finally {
            setLoading(false);
        }
    }, [loadCollections]);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Cloud sync replaced local data (pull from another device, account switch)
    // → reload silently. The in-progress workout is never touched by sync.
    useEffect(() => {
        return StorageService.onDataChange(source => {
            if (source === 'remote') {
                loadCollections().catch(e => console.error('Error reloading synced data:', e));
            }
        });
    }, [loadCollections]);

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

    const finishWorkout = useCallback(async (notes?: string, mood?: number): Promise<string | null> => {
        if (!currentWorkout) return null;

        const completedSession: WorkoutSession = {
            ...currentWorkout,
            endTime: Date.now(),
            notes,
            ...(mood ? { mood } : {}),
        };

        // ── PR Detection ──
        const detected = detectPRs(completedSession, workouts);
        if (detected.length > 0) {
            const prRecords = createPRRecords(detected, completedSession.id, completedSession.endTime!);
            await StorageService.addPersonalRecords(prRecords);
            setPersonalRecords(prev => [...prev, ...prRecords]);
            setLastDetectedPRs(detected);
        } else {
            setLastDetectedPRs([]);
        }
        // ─────────────────────

        // Saved locally first and queued for upload — never lost if the upload fails.
        await StorageService.saveWorkout(completedSession);
        setWorkouts(prev => [completedSession, ...prev.filter(w => w.id !== completedSession.id)]);

        // When cloud sync is active, upload now to get the cloud ID the AI summary needs.
        const convexWorkoutId = await pushWorkoutNow(completedSession.id);

        setCurrentWorkout(null);
        await StorageService.saveCurrentWorkout(null);

        return convexWorkoutId;
    }, [currentWorkout, workouts, pushWorkoutNow]);

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

    // ── Superset management ──────────────────────────────
    const linkSuperset = useCallback((exerciseLogIds: string[]) => {
        if (exerciseLogIds.length < 2) return;
        const groupId = generateId();
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            const updatedExercises = prev.exercises.map(ex => {
                if (exerciseLogIds.includes(ex.id)) {
                    return { ...ex, supersetGroupId: groupId };
                }
                return ex;
            });
            // Reorder: put linked exercises adjacent to each other
            const firstLinkedIdx = updatedExercises.findIndex(ex => exerciseLogIds.includes(ex.id));
            const linked = updatedExercises.filter(ex => exerciseLogIds.includes(ex.id));
            const rest = updatedExercises.filter(ex => !exerciseLogIds.includes(ex.id));
            const reordered = [
                ...rest.slice(0, firstLinkedIdx > rest.length ? rest.length : firstLinkedIdx),
                ...linked,
                ...rest.slice(firstLinkedIdx > rest.length ? rest.length : firstLinkedIdx),
            ];
            return { ...prev, exercises: reordered };
        });
    }, []);

    const unlinkSuperset = useCallback((exerciseLogId: string) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            const target = prev.exercises.find(ex => ex.id === exerciseLogId);
            if (!target?.supersetGroupId) return prev;
            const groupId = target.supersetGroupId;
            const groupMembers = prev.exercises.filter(
                ex => ex.supersetGroupId === groupId && ex.id !== exerciseLogId
            );
            const updatedExercises = prev.exercises.map(ex => {
                if (ex.id === exerciseLogId) {
                    const { supersetGroupId, ...rest } = ex;
                    return rest as typeof ex;
                }
                // If only 1 member left in group, unlink them too
                if (groupMembers.length <= 1 && ex.supersetGroupId === groupId) {
                    const { supersetGroupId, ...rest } = ex;
                    return rest as typeof ex;
                }
                return ex;
            });
            return { ...prev, exercises: updatedExercises };
        });
    }, []);

    const reorderExercise = useCallback((fromIndex: number, toIndex: number) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            const exercises = [...prev.exercises];
            const [moved] = exercises.splice(fromIndex, 1);
            exercises.splice(toIndex, 0, moved);
            return { ...prev, exercises };
        });
    }, []);
    // ─────────────────────────────────────────────────────

    const updateUserStats = useCallback(async (stats: Partial<UserStats>) => {
        await StorageService.updateUserStats(stats);
        const current = userStats || { weight: 0, lastUpdated: Date.now() };
        setUserStats({ ...current, ...stats, lastUpdated: Date.now() });
    }, [userStats]);

    const deleteWorkout = useCallback(async (id: string) => {
        // The storage layer records the delete so it reaches the cloud on the next sync.
        await StorageService.deleteWorkout(id);
        setWorkouts(prev => prev.filter(w => w.id !== id));
    }, []);

    const clearDetectedPRs = useCallback(() => {
        setLastDetectedPRs([]);
    }, []);

    const clearAllWorkouts = useCallback(async () => {
        await StorageService.clearWorkoutHistory();
        setWorkouts([]);
        setPersonalRecords([]);
        setCurrentWorkout(null);
    }, []);

    const clearAllData = useCallback(async () => {
        await StorageService.clearAllUserData();
        setCurrentWorkout(null);
        await loadCollections();
    }, [loadCollections]);

    // ── Exercise notes ───────────────────────────────────
    const updateExerciseNotes = useCallback((exerciseLogId: string, notes: string) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            const updatedExercises = prev.exercises.map(ex => {
                if (ex.id === exerciseLogId) {
                    return { ...ex, notes: notes || undefined };
                }
                return ex;
            });
            return { ...prev, exercises: updatedExercises };
        });
    }, []);

    const setWorkoutMood = useCallback((mood: number) => {
        setCurrentWorkout(prev => {
            if (!prev) return prev;
            return { ...prev, mood };
        });
    }, []);
    // ─────────────────────────────────────────────────────

    // ── Body measurements ────────────────────────────────
    const addBodyMeasurement = useCallback(async (measurement: BodyMeasurement) => {
        await StorageService.saveBodyMeasurement(measurement);
        setBodyMeasurements(prev =>
            [measurement, ...prev.filter(m => m.id !== measurement.id)].sort((a, b) => b.date - a.date)
        );
    }, []);

    const deleteBodyMeasurement = useCallback(async (id: string) => {
        await StorageService.deleteBodyMeasurement(id);
        setBodyMeasurements(prev => prev.filter(m => m.id !== id));
    }, []);
    // ─────────────────────────────────────────────────────

    return (
        <WorkoutContext.Provider
            value={{
                workouts,
                exercises,
                currentWorkout,
                userStats,
                loading,
                lastDetectedPRs,
                personalRecords,
                bodyMeasurements,
                startWorkout,
                finishWorkout,
                cancelWorkout,
                addExerciseToWorkout,
                removeExerciseFromWorkout,
                logSet,
                updateSet,
                deleteSet,
                linkSuperset,
                unlinkSuperset,
                reorderExercise,
                updateExerciseNotes,
                setWorkoutMood,
                addBodyMeasurement,
                deleteBodyMeasurement,
                refreshData,
                updateUserStats,
                deleteWorkout,
                clearAllWorkouts,
                clearAllData,
                clearDetectedPRs,
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
