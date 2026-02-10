import React, { useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { format, isThisWeek } from 'date-fns';
import { colors, spacing, borderRadius } from '../theme/colors';
import { WorkoutSession } from '../types';

export const HomeScreen = ({ navigation }: any) => {
    const { currentWorkout, startWorkout, workouts } = useWorkout();

    const recentWorkouts = workouts.slice(0, 5);

    const weeklyStats = useMemo(() => {
        const thisWeekWorkouts = workouts.filter((w: WorkoutSession) =>
            isThisWeek(w.startTime, { weekStartsOn: 1 })
        );
        const totalSets = thisWeekWorkouts.reduce((acc, w) =>
            acc + w.exercises.reduce((a, e) => a + e.sets.length, 0), 0
        );
        const totalDuration = thisWeekWorkouts.reduce((acc, w) => {
            if (w.endTime) return acc + Math.round((w.endTime - w.startTime) / 60000);
            return acc;
        }, 0);

        return {
            sessions: thisWeekWorkouts.length,
            sets: totalSets,
            minutes: totalDuration,
        };
    }, [workouts]);

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false}>
                <Typography variant="h1" style={{ marginBottom: 8 }}>Gym Log</Typography>
                <Typography variant="caption" style={{ marginBottom: 24 }}>
                    Track every rep, set, and PR.
                </Typography>

                {/* Start/Resume Workout */}
                <Card style={styles.heroCard}>
                    <Typography variant="h2" style={{ marginBottom: 8 }}>
                        {currentWorkout ? '💪 Workout Active' : '🏋️ Ready to lift?'}
                    </Typography>
                    <Typography variant="body" style={{ marginBottom: 16, color: colors.textSecondary }}>
                        {currentWorkout
                            ? `Resume "${currentWorkout.name}" — ${currentWorkout.exercises.length} exercises logged.`
                            : 'Start a new session to track your progress.'
                        }
                    </Typography>
                    <Button
                        title={currentWorkout ? 'Resume Workout' : 'Start Workout'}
                        onPress={() => {
                            if (!currentWorkout) startWorkout();
                            navigation.navigate('WorkoutSession');
                        }}
                    />
                </Card>

                {/* This Week Summary */}
                <Typography variant="h3" style={{ marginTop: 24, marginBottom: 12 }}>This Week</Typography>
                <View style={styles.statsRow}>
                    <Card style={styles.statCard}>
                        <Typography variant="h2" color={colors.primary}>{weeklyStats.sessions}</Typography>
                        <Typography variant="caption">Workouts</Typography>
                    </Card>
                    <Card style={styles.statCard}>
                        <Typography variant="h2" color={colors.success}>{weeklyStats.sets}</Typography>
                        <Typography variant="caption">Sets</Typography>
                    </Card>
                    <Card style={styles.statCard}>
                        <Typography variant="h2" color={colors.warning}>{weeklyStats.minutes}</Typography>
                        <Typography variant="caption">Minutes</Typography>
                    </Card>
                </View>

                {/* Recent Activity */}
                <Typography variant="h3" style={{ marginTop: 24, marginBottom: 12 }}>Recent Activity</Typography>
                {recentWorkouts.length === 0 ? (
                    <Card>
                        <Typography variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                            No workouts logged yet. Start your first session!
                        </Typography>
                    </Card>
                ) : (
                    recentWorkouts.map((workout: WorkoutSession) => {
                        const duration = workout.endTime
                            ? Math.round((workout.endTime - workout.startTime) / 60000)
                            : 0;
                        return (
                            <TouchableOpacity
                                key={workout.id}
                                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
                                activeOpacity={0.7}
                            >
                                <Card style={{ marginBottom: 8 }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" style={{ fontWeight: '600' }}>
                                                {workout.name}
                                            </Typography>
                                            <Typography variant="caption">
                                                {format(workout.startTime, 'EEE, MMM dd')} • {workout.exercises.length} exercises • {duration} min
                                            </Typography>
                                        </View>
                                        <Typography variant="caption" color={colors.primary}>→</Typography>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    heroCard: {
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 0,
    },
});
