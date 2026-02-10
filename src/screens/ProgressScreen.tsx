import React, { useState, useMemo } from 'react';
import { ScrollView, Dimensions, View, TouchableOpacity, Modal } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { ProgressChart } from '../components/ProgressChart';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { format } from 'date-fns';
import { Exercise, WorkoutSession, ExerciseLog, Set as WorkoutSet } from '../types';

const screenWidth = Dimensions.get('window').width;

export const ProgressScreen = () => {
    const { workouts, exercises } = useWorkout();
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Filter to only exercises user has actually done
    const exercisesWithData = useMemo(() => {
        const loggedIds = new Set<string>();
        workouts.forEach((w: WorkoutSession) => {
            w.exercises.forEach((e: ExerciseLog) => {
                loggedIds.add(e.exerciseId);
            });
        });
        return exercises.filter(e => loggedIds.has(e.id));
    }, [workouts, exercises]);

    const chartData = useMemo(() => {
        if (!selectedExercise) return [];

        const relevantWorkouts = workouts
            .filter((w: WorkoutSession) =>
                w.exercises.some((e: ExerciseLog) => e.exerciseId === selectedExercise.id)
            )
            .sort((a, b) => a.startTime - b.startTime);

        if (relevantWorkouts.length === 0) return [];

        return relevantWorkouts
            .map((w: WorkoutSession) => {
                const exerciseLog = w.exercises.find(
                    (e: ExerciseLog) => e.exerciseId === selectedExercise.id
                );
                if (!exerciseLog || exerciseLog.sets.length === 0) return null;

                const maxWeight = Math.max(...exerciseLog.sets.map((s: WorkoutSet) => s.weight), 0);
                return {
                    label: format(w.startTime, 'MM/dd'),
                    value: maxWeight,
                };
            })
            .filter(Boolean)
            .slice(-10) as { label: string; value: number }[];
    }, [selectedExercise, workouts]);

    // Personal records
    const stats = useMemo(() => {
        if (!selectedExercise || chartData.length === 0) return null;

        const values = chartData.map(d => d.value);
        const maxWeight = Math.max(...values);
        const latestWeight = values[values.length - 1];
        const firstWeight = values[0];
        const improvement = latestWeight - firstWeight;

        return { maxWeight, latestWeight, improvement, sessions: chartData.length };
    }, [selectedExercise, chartData]);

    return (
        <ScreenLayout>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography variant="h1">Progress</Typography>
                <Button
                    title={selectedExercise ? 'Change' : 'Select Exercise'}
                    variant="secondary"
                    onPress={() => setModalVisible(true)}
                    style={{ height: 36, paddingHorizontal: 12 }}
                />
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {selectedExercise ? (
                    <View>
                        <Typography variant="h3" style={{ marginBottom: 4, color: colors.primary }}>
                            {selectedExercise.name}
                        </Typography>
                        <Typography variant="caption" style={{ marginBottom: 16 }}>
                            Max Weight Over Time
                        </Typography>

                        <ProgressChart
                            data={chartData}
                            width={screenWidth - 32}
                            height={220}
                            unit="kg"
                        />

                        {/* Stats cards */}
                        {stats && (
                            <View style={styles.statsRow}>
                                <Card style={styles.statCard}>
                                    <Typography variant="caption" color={colors.textSecondary}>PR</Typography>
                                    <Typography variant="h2" color={colors.primary}>{stats.maxWeight}</Typography>
                                    <Typography variant="caption" color={colors.textSecondary}>kg</Typography>
                                </Card>
                                <Card style={styles.statCard}>
                                    <Typography variant="caption" color={colors.textSecondary}>Latest</Typography>
                                    <Typography variant="h2">{stats.latestWeight}</Typography>
                                    <Typography variant="caption" color={colors.textSecondary}>kg</Typography>
                                </Card>
                                <Card style={styles.statCard}>
                                    <Typography variant="caption" color={colors.textSecondary}>Progress</Typography>
                                    <Typography
                                        variant="h2"
                                        color={stats.improvement >= 0 ? colors.success : colors.error}
                                    >
                                        {stats.improvement >= 0 ? '+' : ''}{stats.improvement}
                                    </Typography>
                                    <Typography variant="caption" color={colors.textSecondary}>kg</Typography>
                                </Card>
                            </View>
                        )}

                        <Typography variant="caption" style={{ textAlign: 'center', marginTop: 8 }}>
                            Based on {stats?.sessions || 0} sessions
                        </Typography>
                    </View>
                ) : (
                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
                        <Typography variant="h3" color={colors.textSecondary} style={{ marginBottom: 8 }}>
                            📈
                        </Typography>
                        <Typography variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                            Select an exercise to view your{'\n'}progress over time.
                        </Typography>
                    </View>
                )}
            </ScrollView>

            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Typography variant="h2">Select Exercise</Typography>
                            <Button title="Close" variant="text" onPress={() => setModalVisible(false)} />
                        </View>

                        {exercisesWithData.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Typography variant="body" color={colors.textSecondary}>
                                    Complete workouts first to track progress.
                                </Typography>
                            </View>
                        ) : (
                            <ScrollView style={{ maxHeight: 400 }}>
                                {exercisesWithData.map(ex => (
                                    <TouchableOpacity
                                        key={ex.id}
                                        style={[
                                            styles.exerciseItem,
                                            selectedExercise?.id === ex.id && styles.exerciseItemActive,
                                        ]}
                                        onPress={() => {
                                            setSelectedExercise(ex);
                                            setModalVisible(false);
                                        }}
                                    >
                                        <Typography variant="body">{ex.name}</Typography>
                                        <Typography variant="caption">{ex.muscleGroup}</Typography>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    );
};

import { StyleSheet } from 'react-native';

const styles = StyleSheet.create({
    statsRow: {
        flexDirection: 'row',
        marginTop: 16,
        gap: 8,
    },
    statCard: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 12,
        marginBottom: 0,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.l,
        borderTopRightRadius: borderRadius.l,
        padding: 20,
        maxHeight: '70%',
    },
    exerciseItem: {
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    exerciseItemActive: {
        backgroundColor: colors.surfaceLight,
    },
});
