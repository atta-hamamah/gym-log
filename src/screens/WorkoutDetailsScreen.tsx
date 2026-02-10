import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { format } from 'date-fns';
import { colors, spacing, borderRadius } from '../theme/colors';
import { WorkoutSession, ExerciseLog, Set } from '../types';

export const WorkoutDetailsScreen = ({ route }: any) => {
    const { workoutId } = route.params as { workoutId: string };
    const { workouts } = useWorkout();

    const workout = workouts.find((w: WorkoutSession) => w.id === workoutId);

    if (!workout) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2">Workout not found</Typography>
                </View>
            </ScreenLayout>
        );
    }

    const duration = workout.endTime ? Math.round((workout.endTime - workout.startTime) / 60000) : 0;
    const totalSets = workout.exercises.reduce((acc, e) => acc + e.sets.length, 0);
    const totalVolume = workout.exercises.reduce(
        (acc, e) => acc + e.sets.reduce((a, s) => a + s.weight * s.reps, 0),
        0
    );

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Typography variant="h1" style={{ marginBottom: 4 }}>{workout.name}</Typography>
                <Typography variant="caption" style={{ marginBottom: 16 }}>
                    {format(workout.startTime, 'EEEE, MMM dd, yyyy • HH:mm')}
                </Typography>

                {/* Summary Row */}
                <View style={styles.summaryRow}>
                    <Card style={styles.summaryCard}>
                        <Typography variant="h3" color={colors.primary}>{duration}</Typography>
                        <Typography variant="caption">min</Typography>
                    </Card>
                    <Card style={styles.summaryCard}>
                        <Typography variant="h3" color={colors.success}>{totalSets}</Typography>
                        <Typography variant="caption">sets</Typography>
                    </Card>
                    <Card style={styles.summaryCard}>
                        <Typography variant="h3" color={colors.warning}>
                            {totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                        </Typography>
                        <Typography variant="caption">kg vol</Typography>
                    </Card>
                </View>

                {workout.notes && (
                    <Card style={{ marginBottom: 20 }}>
                        <Typography variant="caption" style={{ marginBottom: 4 }}>Notes</Typography>
                        <Typography variant="body">{workout.notes}</Typography>
                    </Card>
                )}

                {workout.exercises.map((log: ExerciseLog) => (
                    <Card key={log.id} style={{ marginBottom: 12 }}>
                        <Typography variant="h3" style={{ marginBottom: 8 }}>{log.exerciseName}</Typography>

                        <View style={styles.tableHeader}>
                            <Typography variant="label" style={{ width: 40 }}>Set</Typography>
                            <Typography variant="label" style={{ width: 80 }}>kg</Typography>
                            <Typography variant="label" style={{ width: 80 }}>Reps</Typography>
                            <Typography variant="label" style={{ flex: 1, textAlign: 'right' }}>Volume</Typography>
                        </View>

                        {log.sets.map((set: Set, index: number) => (
                            <View key={set.id} style={styles.row}>
                                <Typography variant="body" style={{ width: 40 }}>{index + 1}</Typography>
                                <Typography variant="body" style={{ width: 80 }}>{set.weight}</Typography>
                                <Typography variant="body" style={{ width: 80 }}>{set.reps}</Typography>
                                <Typography variant="body" color={colors.textSecondary} style={{ flex: 1, textAlign: 'right' }}>
                                    {set.weight * set.reps} kg
                                </Typography>
                            </View>
                        ))}

                        {log.sets.length > 0 && (
                            <View style={styles.exerciseSummary}>
                                <Typography variant="caption" color={colors.primary}>
                                    Best: {Math.max(...log.sets.map(s => s.weight))} kg
                                </Typography>
                                <Typography variant="caption" color={colors.textSecondary}>
                                    Volume: {log.sets.reduce((a, s) => a + s.weight * s.reps, 0)} kg
                                </Typography>
                            </View>
                        )}
                    </Card>
                ))}
            </ScrollView>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    summaryCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 0,
    },
    tableHeader: {
        flexDirection: 'row',
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingBottom: 4,
    },
    row: {
        flexDirection: 'row',
        marginBottom: 4,
        alignItems: 'center',
    },
    exerciseSummary: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});
