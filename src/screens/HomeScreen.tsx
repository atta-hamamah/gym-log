import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StatBadge } from '../components/StatBadge';
import { format, isThisWeek } from 'date-fns';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { WorkoutSession } from '../types';

export const HomeScreen = ({ navigation }: any) => {
    const { currentWorkout, startWorkout, workouts } = useWorkout();
    const [nameModalVisible, setNameModalVisible] = useState(false);
    const [workoutName, setWorkoutName] = useState('');

    const recentWorkouts = workouts.slice(0, 5);

    const weeklyStats = useMemo(() => {
        const thisWeekWorkouts = workouts.filter((w: WorkoutSession) =>
            isThisWeek(w.startTime, { weekStartsOn: 1 })
        );
        const totalSets = thisWeekWorkouts.reduce(
            (acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.length, 0),
            0
        );
        const totalDuration = thisWeekWorkouts.reduce((acc, w) => {
            if (w.endTime) return acc + Math.round((w.endTime - w.startTime) / 60000);
            return acc;
        }, 0);
        const totalVolume = thisWeekWorkouts.reduce(
            (acc, w) =>
                acc +
                w.exercises.reduce(
                    (a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0),
                    0
                ),
            0
        );

        return {
            sessions: thisWeekWorkouts.length,
            sets: totalSets,
            minutes: totalDuration,
            volume: totalVolume,
        };
    }, [workouts]);

    const handleStartWorkout = () => {
        if (currentWorkout) {
            navigation.navigate('WorkoutSession');
        } else {
            setNameModalVisible(true);
        }
    };

    const handleConfirmStart = () => {
        const name = workoutName.trim() || 'Workout';
        startWorkout(name);
        setWorkoutName('');
        setNameModalVisible(false);
        navigation.navigate('WorkoutSession');
    };

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View>
                        <Typography variant="h1">Gym Log</Typography>
                        <Typography variant="caption" style={{ marginTop: 2 }}>
                            Track every rep. Beat every PR.
                        </Typography>
                    </View>
                </View>

                {/* Hero Card */}
                <Card
                    variant={currentWorkout ? 'glass' : 'default'}
                    glowColor={currentWorkout ? colors.primary : undefined}
                    style={styles.heroCard}
                >
                    <View style={styles.heroContent}>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h2" style={{ marginBottom: 6 }}>
                                {currentWorkout ? '💪 Workout Active' : '🏋️ Ready to lift?'}
                            </Typography>
                            <Typography variant="bodySmall" color={colors.textSecondary}>
                                {currentWorkout
                                    ? `"${currentWorkout.name}" — ${currentWorkout.exercises.length} exercises`
                                    : 'Start a new session to track your progress.'
                                }
                            </Typography>
                        </View>
                    </View>
                    <Button
                        title={currentWorkout ? 'Resume Workout' : 'Start Workout'}
                        onPress={handleStartWorkout}
                        size="large"
                        fullWidth
                        style={{ marginTop: 16 }}
                    />
                </Card>

                {/* Weekly Stats */}
                <Typography variant="h3" style={styles.sectionTitle}>This Week</Typography>
                <View style={styles.statsGrid}>
                    <Card style={styles.statCell}>
                        <StatBadge value={weeklyStats.sessions} label="Workouts" color={colors.primary} />
                    </Card>
                    <Card style={styles.statCell}>
                        <StatBadge value={weeklyStats.sets} label="Sets" color={colors.secondary} />
                    </Card>
                    <Card style={styles.statCell}>
                        <StatBadge value={weeklyStats.minutes} label="Minutes" color={colors.warning} />
                    </Card>
                    <Card style={styles.statCell}>
                        <StatBadge
                            value={weeklyStats.volume > 999 ? `${(weeklyStats.volume / 1000).toFixed(1)}k` : weeklyStats.volume}
                            label="kg Volume"
                            color={colors.accent}
                        />
                    </Card>
                </View>

                {/* Recent Activity */}
                <Typography variant="h3" style={styles.sectionTitle}>Recent Activity</Typography>
                {recentWorkouts.length === 0 ? (
                    <Card variant="outlined">
                        <Typography variant="body" color={colors.textMuted} align="center" style={{ paddingVertical: 20 }}>
                            No workouts logged yet.{'\n'}Start your first session!
                        </Typography>
                    </Card>
                ) : (
                    recentWorkouts.map((workout: WorkoutSession) => {
                        const duration = workout.endTime
                            ? Math.round((workout.endTime - workout.startTime) / 60000)
                            : 0;
                        const volume = workout.exercises.reduce(
                            (a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0),
                            0
                        );
                        return (
                            <TouchableOpacity
                                key={workout.id}
                                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
                                activeOpacity={0.7}
                            >
                                <Card style={{ marginBottom: 8 }}>
                                    <View style={styles.recentRow}>
                                        <View style={styles.recentDot} />
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" bold>
                                                {workout.name}
                                            </Typography>
                                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                                {format(workout.startTime, 'EEE, MMM dd')} • {workout.exercises.length} exercises • {duration} min
                                                {volume > 0 ? ` • ${volume > 999 ? `${(volume / 1000).toFixed(1)}k` : volume} kg` : ''}
                                            </Typography>
                                        </View>
                                        <Typography variant="body" color={colors.primary} style={{ fontSize: 18 }}>›</Typography>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        );
                    })
                )}
            </ScrollView>

            {/* Workout Name Modal */}
            <Modal
                visible={nameModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setNameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Card variant="elevated" style={styles.modalCard}>
                        <Typography variant="h2" style={{ marginBottom: 4 }}>New Workout</Typography>
                        <Typography variant="caption" style={{ marginBottom: 20 }}>
                            Give your session a name
                        </Typography>

                        <TextInput
                            style={styles.nameInput}
                            placeholder="e.g. Push Day, Leg Day..."
                            placeholderTextColor={colors.textMuted}
                            value={workoutName}
                            onChangeText={setWorkoutName}
                            autoFocus
                            onSubmitEditing={handleConfirmStart}
                            returnKeyType="go"
                        />

                        <View style={styles.modalButtons}>
                            <Button
                                title="Cancel"
                                variant="ghost"
                                size="medium"
                                onPress={() => { setNameModalVisible(false); setWorkoutName(''); }}
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button
                                title="Let's Go! 🔥"
                                onPress={handleConfirmStart}
                                size="medium"
                                style={{ flex: 1.5 }}
                            />
                        </View>
                    </Card>
                </View>
            </Modal>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        marginTop: 8,
    },
    heroCard: {
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        marginTop: 28,
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statCell: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        paddingVertical: 18,
        marginBottom: 0,
    },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    recentDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        marginRight: 12,
        opacity: 0.7,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        padding: 24,
        marginBottom: 0,
    },
    nameInput: {
        height: 52,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 20,
    },
});
