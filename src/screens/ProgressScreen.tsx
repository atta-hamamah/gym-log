import React, { useState, useMemo } from 'react';
import { ScrollView, Dimensions, View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { ProgressChart } from '../components/ProgressChart';
import { StatBadge } from '../components/StatBadge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useWorkout } from '../context/WorkoutContext';
import { format } from 'date-fns';
import { Exercise, WorkoutSession, ExerciseLog, Set as WorkoutSet } from '../types';

const screenWidth = Dimensions.get('window').width;

type Metric = 'maxWeight' | 'totalVolume' | 'bestSet';

export const ProgressScreen = () => {
    const { workouts, exercises } = useWorkout();
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [modalVisible, setModalVisible] = useState(false);
    const [metric, setMetric] = useState<Metric>('maxWeight');

    const exercisesWithData = useMemo(() => {
        const loggedIds = new Set<string>();
        workouts.forEach((w: WorkoutSession) => {
            w.exercises.forEach((e: ExerciseLog) => loggedIds.add(e.exerciseId));
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

        return relevantWorkouts
            .map((w: WorkoutSession) => {
                const exerciseLog = w.exercises.find(
                    (e: ExerciseLog) => e.exerciseId === selectedExercise.id
                );
                if (!exerciseLog || exerciseLog.sets.length === 0) return null;

                let value = 0;
                switch (metric) {
                    case 'maxWeight':
                        value = Math.max(...exerciseLog.sets.map((s: WorkoutSet) => s.weight), 0);
                        break;
                    case 'totalVolume':
                        value = exerciseLog.sets.reduce((a, s) => a + s.weight * s.reps, 0);
                        break;
                    case 'bestSet':
                        value = Math.max(...exerciseLog.sets.map((s: WorkoutSet) => s.weight * s.reps), 0);
                        break;
                }

                return { label: format(w.startTime, 'MM/dd'), value };
            })
            .filter(Boolean)
            .slice(-12) as { label: string; value: number }[];
    }, [selectedExercise, workouts, metric]);

    const stats = useMemo(() => {
        if (!selectedExercise || chartData.length === 0) return null;
        const values = chartData.map(d => d.value);
        const max = Math.max(...values);
        const latest = values[values.length - 1];
        const first = values[0];
        const improvement = latest - first;
        const improvementPct = first > 0 ? Math.round((improvement / first) * 100) : 0;
        return { max, latest, improvement, improvementPct, sessions: chartData.length };
    }, [selectedExercise, chartData]);

    const metricLabel = {
        maxWeight: 'Max Weight',
        totalVolume: 'Total Volume',
        bestSet: 'Best Set',
    };

    const metricUnit = {
        maxWeight: 'kg',
        totalVolume: 'kg',
        bestSet: 'kg',
    };

    return (
        <ScreenLayout>
            <View style={styles.headerRow}>
                <Typography variant="h1">Progress</Typography>
                <Button
                    title={selectedExercise ? 'Change' : 'Select Exercise'}
                    variant={selectedExercise ? 'outline' : 'secondary'}
                    size="small"
                    onPress={() => setModalVisible(true)}
                />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {selectedExercise ? (
                    <View>
                        {/* Exercise Title */}
                        <View style={styles.exerciseHeader}>
                            <Typography variant="h2" color={colors.primary}>
                                {selectedExercise.name}
                            </Typography>
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {selectedExercise.muscleGroup} • {metricLabel[metric]}
                            </Typography>
                        </View>

                        {/* Metric Toggle */}
                        <View style={styles.metricRow}>
                            {(['maxWeight', 'totalVolume', 'bestSet'] as Metric[]).map(m => (
                                <TouchableOpacity
                                    key={m}
                                    style={[styles.metricChip, metric === m && styles.metricChipActive]}
                                    onPress={() => setMetric(m)}
                                >
                                    <Typography
                                        variant="caption"
                                        color={metric === m ? colors.black : colors.textSecondary}
                                        style={{ fontWeight: metric === m ? '700' : '500', fontSize: 11 }}
                                    >
                                        {metricLabel[m]}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Chart */}
                        <ProgressChart
                            data={chartData}
                            width={screenWidth - 40}
                            height={220}
                            unit={metricUnit[metric]}
                        />

                        {/* Stats Grid */}
                        {stats && (
                            <View style={styles.statsGrid}>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge value={stats.max} label="All-time PR" color={colors.primary} />
                                </Card>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge value={stats.latest} label="Latest" color={colors.secondary} />
                                </Card>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge
                                        value={`${stats.improvement >= 0 ? '+' : ''}${stats.improvement}`}
                                        label="Change"
                                        color={stats.improvement >= 0 ? colors.success : colors.error}
                                    />
                                </Card>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge
                                        value={`${stats.improvementPct >= 0 ? '+' : ''}${stats.improvementPct}%`}
                                        label="Growth"
                                        color={stats.improvementPct >= 0 ? colors.success : colors.error}
                                    />
                                </Card>
                            </View>
                        )}

                        <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
                            Based on {stats?.sessions || 0} sessions
                        </Typography>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Typography variant="number" style={{ fontSize: 52, marginBottom: 12 }}>📈</Typography>
                        <Typography variant="h3" color={colors.textMuted} align="center" style={{ marginBottom: 8 }}>
                            Track Your Gains
                        </Typography>
                        <Typography variant="body" color={colors.textMuted} align="center" style={{ marginBottom: 24 }}>
                            Select an exercise to see your{'\n'}progress over time.
                        </Typography>
                        <Button
                            title="Select Exercise"
                            onPress={() => setModalVisible(true)}
                        />
                    </View>
                )}
            </ScrollView>

            {/* Exercise Picker Modal */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <Typography variant="h2">Select Exercise</Typography>
                            <Button
                                title="Close"
                                variant="ghost"
                                size="small"
                                onPress={() => setModalVisible(false)}
                            />
                        </View>

                        {exercisesWithData.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Typography variant="body" color={colors.textMuted} align="center">
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
                                        activeOpacity={0.6}
                                    >
                                        <View style={styles.exDot} />
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" bold>{ex.name}</Typography>
                                            <Typography variant="caption" style={{ fontSize: 12 }}>{ex.muscleGroup}</Typography>
                                        </View>
                                        {selectedExercise?.id === ex.id && (
                                            <Typography variant="body" color={colors.primary}>✓</Typography>
                                        )}
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

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    exerciseHeader: {
        marginBottom: 12,
    },
    metricRow: {
        flexDirection: 'row',
        marginBottom: 16,
        gap: 6,
    },
    metricChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    metricChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 16,
    },
    statCard: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        paddingVertical: 16,
        marginBottom: 0,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 60,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: borderRadius.xl,
        borderTopRightRadius: borderRadius.xl,
        padding: 20,
        maxHeight: '70%',
    },
    modalHandle: {
        width: 40,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.textMuted,
        alignSelf: 'center',
        marginBottom: 16,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    exerciseItemActive: {
        backgroundColor: colors.primary + '10',
    },
    exDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.secondary,
        marginRight: 12,
    },
});
