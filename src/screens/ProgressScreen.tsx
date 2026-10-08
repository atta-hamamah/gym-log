import React, { useState, useMemo } from 'react';
import { ScrollView, Dimensions, View, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { ProgressChart } from '../components/ProgressChart';
import { StatTile } from '../components/StatTile';
import { ScreenHeader } from '../components/ScreenHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { Trophy, TrendingUp, ArrowUpRight, Percent, Dumbbell, Weight, Layers, Clock, BarChart3, Check, LineChart } from 'lucide-react-native';
import { ForwardChevron } from '../components/DirectionalIcons';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { borderRadius, spacing, ThemeColors } from '../theme/colors';
import { useWorkout } from '../context/WorkoutContext';
import { format, startOfWeek, subWeeks, isAfter } from 'date-fns';
import { Exercise, WorkoutSession, ExerciseLog, Set as WorkoutSet } from '../types';
import { useTranslation } from 'react-i18next';
import { getExerciseName, getMuscleGroupName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';

const screenWidth = Dimensions.get('window').width;

type Metric = 'maxWeight' | 'totalVolume' | 'bestSet';

export const ProgressScreen = () => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight } = useUnits();
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

    // Convert chart data values to display units
    const displayChartData = useMemo(() => {
        return chartData.map(d => ({ ...d, value: Math.round(displayWeight(d.value)) }));
    }, [chartData, displayWeight]);

    const stats = useMemo(() => {
        if (!selectedExercise || displayChartData.length === 0) return null;
        const values = displayChartData.map(d => d.value);
        const max = Math.max(...values);
        const latest = values[values.length - 1];
        const first = values[0];
        const improvement = latest - first;
        const improvementPct = first > 0 ? Math.round((improvement / first) * 100) : 0;
        return { max, latest, improvement, improvementPct, sessions: displayChartData.length };
    }, [selectedExercise, displayChartData]);

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

        return buckets.map(b => ({ label: b.label, value: Math.round(displayWeight(b.value)) }));
    }, [workouts, displayWeight]);

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
        maxWeight: weightUnit,
        totalVolume: weightUnit,
        bestSet: weightUnit,
    };

    const formatVolume = (v: number): string => {
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
        return v.toString();
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={t('progress.title')}
                right={
                    <Button
                        title={selectedExercise ? t('progress.change') : t('progress.selectExercise')}
                        variant={selectedExercise ? 'outline' : 'secondary'}
                        size="small"
                        onPress={() => setModalVisible(true)}
                    />
                }
            />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {selectedExercise ? (
                    <View>
                        {/* Exercise Title */}
                        <View style={styles.exerciseHeader}>
                            <Typography variant="h2">
                                {getExerciseName(selectedExercise.id, t, selectedExercise.name)}
                            </Typography>
                            <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                {getMuscleGroupName(selectedExercise.muscleGroup, t)} · {metricLabel[metric]}
                            </Typography>
                        </View>

                        {/* Metric Toggle */}
                        <SegmentedControl
                            value={metric}
                            onChange={setMetric}
                            options={(['maxWeight', 'totalVolume', 'bestSet'] as Metric[]).map(m => ({ value: m, label: metricLabel[m] }))}
                            style={styles.metricRow}
                        />

                        {/* Chart */}
                        <ProgressChart
                            data={displayChartData}
                            width={screenWidth - 40}
                            height={220}
                            unit={metricUnit[metric]}
                        />

                        {/* Stats Grid */}
                        {stats && (
                            <View style={styles.statsGrid}>
                                <View style={styles.statsRow}>
                                    <StatTile value={stats.max} label={t('progress.allTimePR')} icon={c => <Trophy color={c} size={16} />} tone="accent" />
                                    <StatTile value={stats.latest} label={t('progress.latest')} icon={c => <TrendingUp color={c} size={16} />} tone="primary" />
                                </View>
                                <View style={styles.statsRow}>
                                    <StatTile
                                        value={`${stats.improvement >= 0 ? '+' : ''}${stats.improvement}`}
                                        label={t('progress.changeLabel')}
                                        icon={c => <ArrowUpRight color={c} size={16} />}
                                        tone={stats.improvement >= 0 ? 'success' : 'danger'}
                                        valueColor={stats.improvement >= 0 ? colors.success : colors.error}
                                    />
                                    <StatTile
                                        value={`${stats.improvementPct >= 0 ? '+' : ''}${stats.improvementPct}%`}
                                        label={t('progress.growth')}
                                        icon={c => <Percent color={c} size={16} />}
                                        tone={stats.improvementPct >= 0 ? 'success' : 'danger'}
                                        valueColor={stats.improvementPct >= 0 ? colors.success : colors.error}
                                    />
                                </View>
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
                            <View style={styles.statsRow}>
                                <StatTile value={overviewStats.totalWorkouts} label={t('progress.totalWorkouts')} icon={c => <Dumbbell color={c} size={16} />} tone="primary" />
                                <StatTile value={formatVolume(Math.round(displayWeight(overviewStats.totalVolume)))} label={t('progress.totalVolumeAll')} icon={c => <Weight color={c} size={16} />} tone="success" />
                            </View>
                            <View style={styles.statsRow}>
                                <StatTile value={overviewStats.totalSets} label={t('progress.totalSets')} icon={c => <Layers color={c} size={16} />} tone="secondary" />
                                <StatTile value={overviewStats.avgDuration > 0 ? `${overviewStats.avgDuration}m` : '—'} label={t('progress.avgDuration')} icon={c => <Clock color={c} size={16} />} tone="accent" />
                            </View>
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
                                    unit={weightUnit}
                                    color={colors.primary}
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
                                                            backgroundColor: colors.primary,
                                                            opacity: 1 - Math.min(index, 6) * 0.1,
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
                            <View style={styles.hintIcon}>
                                <BarChart3 color={colors.primary} size={18} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Typography variant="body" bold>
                                    {t('progress.drillDown')}
                                </Typography>
                                <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                    {t('progress.drillDownHint')}
                                </Typography>
                            </View>
                            <ForwardChevron color={colors.textMuted} size={18} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIcon}>
                            <LineChart color={colors.primary} size={26} />
                        </View>
                        <Typography variant="h3" align="center" style={{ marginBottom: 6 }}>
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
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" bold color={selectedExercise?.id === ex.id ? colors.primary : colors.text}>{getExerciseName(ex.id, t, ex.name)}</Typography>
                                            <Typography variant="caption" color={colors.textSecondary} style={{ fontSize: 12 }}>{getMuscleGroupName(ex.muscleGroup, t)}</Typography>
                                        </View>
                                        {selectedExercise?.id === ex.id && (
                                            <Check color={colors.primary} size={18} />
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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    exerciseHeader: {
        marginBottom: 12,
    },
    metricRow: {
        marginBottom: 14,
    },
    statsGrid: {
        gap: 10,
        marginTop: 12,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 70,
        paddingHorizontal: 12,
    },
    emptyIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    // ── Muscle group breakdown bars ──
    muscleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 6,
    },
    muscleLabel: {
        width: 92,
        marginRight: 10,
    },
    barContainer: {
        flex: 1,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.surfaceLight,
        overflow: 'hidden',
    },
    bar: {
        height: '100%',
        borderRadius: 4,
    },
    // ── Drill-down hint ──
    hintCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 20,
        padding: 14,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    hintIcon: {
        width: 38,
        height: 38,
        borderRadius: 11,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
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
        width: 38,
        height: 4,
        borderRadius: 2,
        backgroundColor: colors.border,
        alignSelf: 'center',
        marginBottom: 14,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    exerciseItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    exerciseItemActive: {
        backgroundColor: colors.primarySoft,
        borderRadius: borderRadius.m,
        paddingHorizontal: 10,
    },
});
