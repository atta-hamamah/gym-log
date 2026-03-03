import { ExerciseLog, SupersetType } from '../types';

/**
 * Derive the superset type based on the number of exercises in a group.
 * - 2 exercises → superset
 * - 3+ exercises → circuit or giant_set
 */
export const getSupersetType = (groupSize: number): SupersetType => {
    if (groupSize <= 2) return 'superset';
    return 'circuit'; // 3+ exercises
};

/**
 * Get the label for a superset type.
 */
export const getSupersetLabel = (type: SupersetType): string => {
    switch (type) {
        case 'superset': return 'Superset';
        case 'circuit': return 'Circuit';
        case 'giant_set': return 'Giant Set';
    }
};

/**
 * Get the emoji for a superset type.
 */
export const getSupersetEmoji = (type: SupersetType): string => {
    switch (type) {
        case 'superset': return '🔗';
        case 'circuit': return '🔄';
        case 'giant_set': return '⚡';
    }
};

/**
 * Get the color accent for a superset type.
 */
export const getSupersetColor = (type: SupersetType): string => {
    switch (type) {
        case 'superset': return '#7C4DFF';  // violet
        case 'circuit': return '#FF9800';   // orange
        case 'giant_set': return '#FF4081';  // pink
    }
};

/**
 * Group exercises by their supersetGroupId.
 * Returns a map from groupId → ExerciseLog[]
 */
export const getExerciseGroups = (exercises: ExerciseLog[]): Map<string, ExerciseLog[]> => {
    const groups = new Map<string, ExerciseLog[]>();
    exercises.forEach(ex => {
        if (ex.supersetGroupId) {
            const existing = groups.get(ex.supersetGroupId) || [];
            existing.push(ex);
            groups.set(ex.supersetGroupId, existing);
        }
    });
    return groups;
};

/**
 * For a given exercise, get its position label within its superset group.
 * e.g. "A1", "A2", "B1", "B2", "B3" etc.
 */
export const getSupersetPositionLabel = (
    exercise: ExerciseLog,
    allExercises: ExerciseLog[]
): string | null => {
    if (!exercise.supersetGroupId) return null;

    // Find all unique group IDs in order of first appearance
    const seenGroups: string[] = [];
    allExercises.forEach(ex => {
        if (ex.supersetGroupId && !seenGroups.includes(ex.supersetGroupId)) {
            seenGroups.push(ex.supersetGroupId);
        }
    });

    const groupIndex = seenGroups.indexOf(exercise.supersetGroupId);
    const letter = String.fromCharCode(65 + groupIndex); // A, B, C...

    const groupMembers = allExercises.filter(
        ex => ex.supersetGroupId === exercise.supersetGroupId
    );
    const positionInGroup = groupMembers.findIndex(ex => ex.id === exercise.id) + 1;

    return `${letter}${positionInGroup}`;
};
