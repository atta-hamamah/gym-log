import { WorkoutSession, ExerciseLog, PersonalRecord, DetectedPR, PRType } from '../types';

/**
 * Epley formula for estimated 1RM.
 * If reps = 1, just return the weight.
 */
export function estimate1RM(weight: number, reps: number): number {
    if (reps <= 0 || weight <= 0) return 0;
    if (reps === 1) return weight;
    return Math.round(weight * (1 + reps / 30));
}

/**
 * Extracts the best stats from a single exercise log
 */
function getExerciseStats(log: ExerciseLog): {
    maxWeight: { value: number; reps: number };
    bestVolume: number;
    est1RM: number;
} {
    let maxWeight = 0;
    let maxWeightReps = 0;
    let bestVolume = 0;
    let est1RM = 0;

    for (const set of log.sets) {
        if (set.weight <= 0 || set.reps <= 0) continue;

        // Max weight
        if (set.weight > maxWeight) {
            maxWeight = set.weight;
            maxWeightReps = set.reps;
        }

        // Best single-set volume (weight × reps)
        const vol = set.weight * set.reps;
        if (vol > bestVolume) {
            bestVolume = vol;
        }

        // Estimated 1RM
        const e1rm = estimate1RM(set.weight, set.reps);
        if (e1rm > est1RM) {
            est1RM = e1rm;
        }
    }

    return {
        maxWeight: { value: maxWeight, reps: maxWeightReps },
        bestVolume,
        est1RM,
    };
}

/**
 * Extract all historical personal records from completed workouts
 * for a specific exercise. Returns best values across all history.
 */
function getHistoricalBests(
    exerciseId: string,
    workouts: WorkoutSession[]
): { maxWeight: number; bestVolume: number; est1RM: number } {
    let maxWeight = 0;
    let bestVolume = 0;
    let est1RM = 0;

    for (const workout of workouts) {
        for (const log of workout.exercises) {
            if (log.exerciseId !== exerciseId) continue;

            const stats = getExerciseStats(log);

            if (stats.maxWeight.value > maxWeight) maxWeight = stats.maxWeight.value;
            if (stats.bestVolume > bestVolume) bestVolume = stats.bestVolume;
            if (stats.est1RM > est1RM) est1RM = stats.est1RM;
        }
    }

    return { maxWeight, bestVolume, est1RM };
}

/**
 * Detect new PRs in a completed workout by comparing against all
 * historically completed workouts. The completed workout should NOT
 * yet be in the workouts array.
 */
export function detectPRs(
    completedWorkout: WorkoutSession,
    historicalWorkouts: WorkoutSession[]
): DetectedPR[] {
    const detected: DetectedPR[] = [];

    for (const log of completedWorkout.exercises) {
        if (log.sets.length === 0) continue;

        const current = getExerciseStats(log);
        const history = getHistoricalBests(log.exerciseId, historicalWorkouts);

        // Max Weight PR
        if (current.maxWeight.value > 0 && current.maxWeight.value > history.maxWeight) {
            detected.push({
                exerciseId: log.exerciseId,
                exerciseName: log.exerciseName,
                type: 'max_weight',
                newValue: current.maxWeight.value,
                previousValue: history.maxWeight > 0 ? history.maxWeight : null,
                reps: current.maxWeight.reps,
            });
        }

        // Best Volume PR (single-set volume)
        if (current.bestVolume > 0 && current.bestVolume > history.bestVolume) {
            detected.push({
                exerciseId: log.exerciseId,
                exerciseName: log.exerciseName,
                type: 'best_volume',
                newValue: current.bestVolume,
                previousValue: history.bestVolume > 0 ? history.bestVolume : null,
            });
        }

        // Estimated 1RM PR
        if (current.est1RM > 0 && current.est1RM > history.est1RM) {
            detected.push({
                exerciseId: log.exerciseId,
                exerciseName: log.exerciseName,
                type: 'est_1rm',
                newValue: current.est1RM,
                previousValue: history.est1RM > 0 ? history.est1RM : null,
            });
        }
    }

    return detected;
}

/**
 * Convert detected PRs into PersonalRecord objects for storage
 */
export function createPRRecords(
    detectedPRs: DetectedPR[],
    workoutId: string,
    date: number
): PersonalRecord[] {
    return detectedPRs.map(pr => ({
        exerciseId: pr.exerciseId,
        exerciseName: pr.exerciseName,
        type: pr.type,
        value: pr.newValue,
        reps: pr.reps,
        date,
        workoutId,
    }));
}

/**
 * Get all-time PRs for all exercises from a stored PR history.
 * Returns a Map of exerciseId → { max_weight, best_volume, est_1rm }
 */
export function getAllTimePRs(
    prHistory: PersonalRecord[]
): Map<string, Map<PRType, PersonalRecord>> {
    const result = new Map<string, Map<PRType, PersonalRecord>>();

    for (const record of prHistory) {
        if (!result.has(record.exerciseId)) {
            result.set(record.exerciseId, new Map());
        }
        const exercisePRs = result.get(record.exerciseId)!;
        const existing = exercisePRs.get(record.type);

        if (!existing || record.value > existing.value) {
            exercisePRs.set(record.type, record);
        }
    }

    return result;
}
