
import React from 'react';
import { ScrollView, View, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { format } from 'date-fns';
import { colors, spacing } from '../theme/colors';
import { WorkoutSession, ExerciseLog, Set } from '../types';

export const WorkoutDetailsScreen = ({ route }: any) => {
    const { workoutId } = route.params as { workoutId: string };
    const { workouts } = useWorkout();

    const workout = workouts.find((w: WorkoutSession) => w.id === workoutId);

    if (!workout) {
        return (
            <ScreenLayout>
                <Typography variant="h2">Workout not found</Typography>
            </ScreenLayout>
        );
    }

    const duration = workout.endTime ? Math.round((workout.endTime - workout.startTime) / 60000) : 0;

    return (
        <ScreenLayout>
            <ScrollView>
                <Typography variant="h1" style={{ marginBottom: 4 }}>{workout.name}</Typography>
                <Typography variant="caption" style={{ marginBottom: 20 }}>
                    {format(workout.startTime, 'MMM dd, yyyy - HH:mm')} • {duration} min
                </Typography>

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
                        </View>

                        {log.sets.map((set: Set, index: number) => (
                            <View key={set.id} style={styles.row}>
                                <Typography variant="body" style={{ width: 40 }}>{index + 1}</Typography>
                                <Typography variant="body" style={{ width: 80 }}>{set.weight}</Typography>
                                <Typography variant="body" style={{ width: 80 }}>{set.reps}</Typography>
                            </View>
                        ))}
                    </Card>
                ))}
            </ScrollView>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
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
    }
});
