import React, { useState, useMemo } from 'react';
import { ScrollView, Dimensions, View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { ProgressChart } from '../components/ProgressChart';
import { StatBadge } from '../components/StatBadge';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { borderRadius, spacing } from '../theme/colors';
import { useWorkout } from '../context/WorkoutContext';
import { format, startOfWeek, subWeeks, isAfter } from 'date-fns';
import { Exercise, WorkoutSession, ExerciseLog, Set as WorkoutSet } from '../types';
import { useTranslation } from 'react-i18next';
import { getExerciseName, getMuscleGroupName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';

const screenWidth = Dimensions.get('window').width;

type Metric = 'maxWeight' | 'totalVolume' | 'bestSet';

export const ProgressScreen = () => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
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

    // ── Overview / aggregate data (shown before any exercise is selected) ──

    const overviewStats = useMemo(() => {
        if (workouts.length === 0) return null;

        let totalSets = 0;
        let totalVolume = 0;
        let totalDurationMin = 0;
        let durationCount = 0;

        workouts.forEach((w: WorkoutSession) => {
            w.exercises.forEach((e: ExerciseLog) => {
                totalSets += e.sets.length;
                e.sets.forEach((s: WorkoutSet) => {
                    totalVolume += s.weight * s.reps;
                });
            });
            if (w.endTime && w.startTime) {
                const dur = (w.endTime - w.startTime) / 60000;
                if (dur > 0 && dur < 600) {
                    totalDurationMin += dur;
                    durationCount++;
                }
            }
        });

        const avgDuration = durationCount > 0 ? Math.round(totalDurationMin / durationCount) : 0;

        return {
            totalWorkouts: workouts.length,
            totalSets,
            totalVolume: Math.round(totalVolume),
            avgDuration,
        };
    }, [workouts]);

    const weeklyVolumeData = useMemo(() => {
        if (workouts.length === 0) return [];

        const now = new Date();
        const weekCount = 8;
        const buckets: { weekStart: Date; label: string; value: number }[] = [];

        for (let i = weekCount - 1; i >= 0; i--) {
            const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
            buckets.push({
                weekStart: ws,
                label: format(ws, 'MM/dd'),
                value: 0,
            });
        }

        const cutoff = buckets[0].weekStart;

        workouts.forEach((w: WorkoutSession) => {
            if (!isAfter(new Date(w.startTime), cutoff) && new Date(w.startTime).getTime() !== cutoff.getTime()) return;
            const wWeekStart = startOfWeek(new Date(w.startTime), { weekStartsOn: 1 });
            const bucket = buckets.find(b => b.weekStart.getTime() === wWeekStart.getTime());
            if (bucket) {
                w.exercises.forEach((e: ExerciseLog) => {
                    e.sets.forEach((s: WorkoutSet) => {
                        bucket.value += s.weight * s.reps;
                    });
                });
            }
        });

        return buckets.map(b => ({ label: b.label, value: Math.round(b.value) }));
    }, [workouts]);

    const muscleGroupData = useMemo(() => {
        if (workouts.length === 0) return [];

        const counts: Record<string, number> = {};

        workouts.forEach((w: WorkoutSession) => {
            w.exercises.forEach((e: ExerciseLog) => {
                const ex = exercises.find(ex => ex.id === e.exerciseId);
                const group = ex?.muscleGroup || 'Other';
                counts[group] = (counts[group] || 0) + e.sets.length;
            });
        });

        const sorted = Object.entries(counts)
            .map(([group, sets]) => ({ group, sets }))
            .sort((a, b) => b.sets - a.sets);

        const maxSets = sorted.length > 0 ? sorted[0].sets : 1;

        return sorted.map(item => ({
            ...item,
            pct: Math.round((item.sets / maxSets) * 100),
        }));
    }, [workouts, exercises]);

    const weeklyWorkoutCount = useMemo(() => {
        if (workouts.length === 0) return [];

        const now = new Date();
        const weekCount = 8;
        const buckets: { weekStart: Date; label: string; value: number }[] = [];

        for (let i = weekCount - 1; i >= 0; i--) {
            const ws = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
            buckets.push({
                weekStart: ws,
                label: format(ws, 'MM/dd'),
                value: 0,
            });
        }

        const cutoff = buckets[0].weekStart;

        workouts.forEach((w: WorkoutSession) => {
            if (!isAfter(new Date(w.startTime), cutoff) && new Date(w.startTime).getTime() !== cutoff.getTime()) return;
            const wWeekStart = startOfWeek(new Date(w.startTime), { weekStartsOn: 1 });
            const bucket = buckets.find(b => b.weekStart.getTime() === wWeekStart.getTime());
            if (bucket) {
                bucket.value += 1;
            }
        });

        return buckets.map(b => ({ label: b.label, value: b.value }));
    }, [workouts]);

    const metricLabel: Record<Metric, string> = {
        maxWeight: t('progress.maxWeight'),
        totalVolume: t('progress.totalVolume'),
        bestSet: t('progress.bestSet'),
    };

    const metricUnit = {
        maxWeight: t('common.kg'),
        totalVolume: t('common.kg'),
        bestSet: t('common.kg'),
    };

    const barColors = [
        colors.primary,
        colors.secondary,
        colors.accent,
        colors.success,
        colors.warning,
        colors.primaryLight,
        colors.secondaryLight,
        colors.accentLight,
    ];

    const formatVolume = (v: number): string => {
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
        return v.toString();
    };

    return (
        <ScreenLayout>
            <View style={styles.headerRow}>
                <Typography variant="h1">{t('progress.title')}</Typography>
                <Button
                    title={selectedExercise ? t('progress.change') : t('progress.selectExercise')}
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
                                {getExerciseName(selectedExercise.id, t, selectedExercise.name)}
                            </Typography>
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {getMuscleGroupName(selectedExercise.muscleGroup, t)} • {metricLabel[metric]}
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
                                    <StatBadge value={stats.max} label={t('progress.allTimePR')} color={colors.primary} />
                                </Card>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge value={stats.latest} label={t('progress.latest')} color={colors.secondary} />
                                </Card>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge
                                        value={`${stats.improvement >= 0 ? '+' : ''}${stats.improvement}`}
                                        label={t('progress.changeLabel')}
                                        color={stats.improvement >= 0 ? colors.success : colors.error}
                                    />
                                </Card>
                                <Card style={styles.statCard} variant="glass">
                                    <StatBadge
                                        value={`${stats.improvementPct >= 0 ? '+' : ''}${stats.improvementPct}%`}
                                        label={t('progress.growth')}
                                        color={stats.improvementPct >= 0 ? colors.success : colors.error}
                                    />
                                </Card>
                            </View>
                        )}

                        <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
                            {t('progress.basedOnSessions', { count: stats?.sessions || 0 })}
                        </Typography>
                    </View>
                ) : overviewStats ? (
                    /* ── Overview Dashboard ── */
                    <View>
                        {/* Summary Stats */}
                        <Typography variant="h3" style={{ marginBottom: 12 }}>
                            {t('progress.overviewTitle')}
                        </Typography>
                        <View style={styles.statsGrid}>
                            <Card style={styles.statCard} variant="glass">
                                <StatBadge
                                    value={overviewStats.totalWorkouts}
                                    label={t('progress.totalWorkouts')}
                                    color={colors.primary}
                                />
                            </Card>
                            <Card style={styles.statCard} variant="glass">
                                <StatBadge
                                    value={formatVolume(overviewStats.totalVolume)}
                                    label={t('progress.totalVolumeAll')}
                                    color={colors.secondary}
                                />
                            </Card>
                            <Card style={styles.statCard} variant="glass">
                                <StatBadge
                                    value={overviewStats.totalSets}
                                    label={t('progress.totalSets')}
                                    color={colors.accent}
                                />
                            </Card>
                            <Card style={styles.statCard} variant="glass">
                                <StatBadge
                                    value={overviewStats.avgDuration > 0 ? `${overviewStats.avgDuration}m` : '—'}
                                    label={t('progress.avgDuration')}
                                    color={colors.success}
                                />
                            </Card>
                        </View>

                        {/* Weekly Volume Chart */}
                        {weeklyVolumeData.some(d => d.value > 0) && (
                            <View style={{ marginTop: 20 }}>
                                <Typography variant="h3" style={{ marginBottom: 12 }}>
                                    {t('progress.weeklyVolume')}
                                </Typography>
                                <ProgressChart
                                    data={weeklyVolumeData}
                                    width={screenWidth - 40}
                                    height={200}
                                    unit={t('common.kg')}
                                    color={colors.secondary}
                                    gradientTo={colors.primary}
                                />
                            </View>
                        )}

                        {/* Weekly Workout Frequency */}
                        {weeklyWorkoutCount.some(d => d.value > 0) && (
                            <View style={{ marginTop: 20 }}>
                                <Typography variant="h3" style={{ marginBottom: 12 }}>
                                    {t('progress.weeklyFrequency')}
                                </Typography>
                                <ProgressChart
                                    data={weeklyWorkoutCount}
                                    width={screenWidth - 40}
                                    height={180}
                                    unit=""
                                    color={colors.accent}
                                    gradientTo={colors.warning}
                                />
                            </View>
                        )}

                        {/* Muscle Group Breakdown */}
                        {muscleGroupData.length > 0 && (
                            <View style={{ marginTop: 20 }}>
                                <Typography variant="h3" style={{ marginBottom: 12 }}>
                                    {t('progress.muscleBreakdown')}
                                </Typography>
                                <Card variant="default" style={{ paddingVertical: 12, paddingHorizontal: 16 }}>
                                    {muscleGroupData.map((item, index) => (
                                        <View key={item.group} style={styles.muscleRow}>
                                            <View style={styles.muscleLabel}>
                                                <Typography variant="caption" bold style={{ fontSize: 12 }}>
                                                    {getMuscleGroupName(item.group, t)}
                                                </Typography>
                                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>
                                                    {item.sets} {t('common.sets')}
                                                </Typography>
                                            </View>
                                            <View style={styles.barContainer}>
                                                <View
                                                    style={[
                                                        styles.bar,
                                                        {
                                                            width: `${Math.max(item.pct, 4)}%`,
                                                            backgroundColor: barColors[index % barColors.length],
                                                        },
                                                    ]}
                                                />
                                            </View>
                                        </View>
                                    ))}
                                </Card>
                            </View>
                        )}

                        {/* Hint to explore per-exercise */}
                        <TouchableOpacity
                            style={styles.hintCard}
                            onPress={() => setModalVisible(true)}
                            activeOpacity={0.7}
                        >
                            <Typography variant="body" color={colors.primary} style={{ fontWeight: '600' }}>
                                📊 {t('progress.drillDown')}
                            </Typography>
                            <Typography variant="caption" color={colors.textMuted} style={{ marginTop: 4 }}>
                                {t('progress.drillDownHint')}
                            </Typography>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <Typography variant="number" style={{ fontSize: 52, marginBottom: 12 }}>📈</Typography>
                        <Typography variant="h3" color={colors.textMuted} align="center" style={{ marginBottom: 8 }}>
                            {t('progress.trackYourGains')}
                        </Typography>
                        <Typography variant="body" color={colors.textMuted} align="center" style={{ marginBottom: 24 }}>
                            {t('progress.trackDescription')}
                        </Typography>
                        <Button
                            title={t('progress.selectExercise')}
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
                            <Typography variant="h2">{t('progress.selectExercise')}</Typography>
                            <Button
                                title={t('common.close')}
                                variant="ghost"
                                size="small"
                                onPress={() => setModalVisible(false)}
                            />
                        </View>

                        {exercisesWithData.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Typography variant="body" color={colors.textMuted} align="center">
                                    {t('progress.completeFirst')}
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
                                            <Typography variant="body" bold>{getExerciseName(ex.id, t, ex.name)}</Typography>
                                            <Typography variant="caption" style={{ fontSize: 12 }}>{getMuscleGroupName(ex.muscleGroup, t)}</Typography>
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

const createStyles = (colors: any) => StyleSheet.create({
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
        marginTop: 4,
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
    // ── Muscle group breakdown bars ──
    muscleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 10,
    },
    muscleLabel: {
        width: 90,
        marginRight: 10,
    },
    barContainer: {
        flex: 1,
        height: 14,
        borderRadius: 7,
        backgroundColor: colors.surfaceLight,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 7,
    },
    // ── Drill-down hint ──
    hintCard: {
        marginTop: 20,
        padding: 16,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        borderColor: colors.primary + '30',
        backgroundColor: colors.primary + '08',
        alignItems: 'center',
    },
    // ── Modal styles ──
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
