import React from 'react';
import { ScrollView, View, StyleSheet, Alert } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { StatBadge } from '../components/StatBadge';
import { Button } from '../components/Button';
import { format } from 'date-fns';
import { colors, spacing, borderRadius } from '../theme/colors';
import { WorkoutSession, ExerciseLog, Set } from '../types';
import { useTranslation } from 'react-i18next';

export const WorkoutDetailsScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { workoutId } = route.params as { workoutId: string };
    const { workouts, deleteWorkout } = useWorkout();

    const workout = workouts.find((w: WorkoutSession) => w.id === workoutId);

    if (!workout) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2" color={colors.textMuted}>{t('workoutDetails.workoutNotFound')}</Typography>
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
    const totalReps = workout.exercises.reduce(
        (acc, e) => acc + e.sets.reduce((a, s) => a + s.reps, 0),
        0
    );

    const handleDelete = () => {
        Alert.alert(t('workoutDetails.deleteTitle'), t('workoutDetails.deleteMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('common.delete'),
                style: 'destructive',
                onPress: async () => {
                    await deleteWorkout(workoutId);
                    navigation.goBack();
                },
            },
        ]);
    };

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Title */}
                <Typography variant="h1" style={{ marginBottom: 4 }}>{workout.name}</Typography>
                <Typography variant="caption" style={{ marginBottom: 20 }}>
                    {format(workout.startTime, 'EEEE, MMM dd, yyyy • HH:mm')}
                </Typography>

                {/* Summary Stats */}
                <View style={styles.summaryRow}>
                    <Card style={styles.summaryCard} variant="glass">
                        <StatBadge value={duration} label={t('common.min')} color={colors.primary} />
                    </Card>
                    <Card style={styles.summaryCard} variant="glass">
                        <StatBadge value={totalSets} label={t('common.sets')} color={colors.secondary} />
                    </Card>
                    <Card style={styles.summaryCard} variant="glass">
                        <StatBadge value={totalReps} label={t('common.reps')} color={colors.warning} />
                    </Card>
                    <Card style={styles.summaryCard} variant="glass">
                        <StatBadge
                            value={totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                            label={t('common.kg')}
                            color={colors.accent}
                        />
                    </Card>
                </View>

                {/* Notes */}
                {workout.notes ? (
                    <Card variant="outlined" style={{ marginBottom: 20 }}>
                        <Typography variant="label" style={{ marginBottom: 6 }}>{t('workoutDetails.sessionNotes')}</Typography>
                        <Typography variant="body" color={colors.textSecondary}>
                            {workout.notes}
                        </Typography>
                    </Card>
                ) : null}

                {/* Exercises */}
                <Typography variant="h3" style={{ marginBottom: 12 }}>{t('workoutDetails.exercises')}</Typography>
                {workout.exercises.map((log: ExerciseLog) => {
                    const exVolume = log.sets.reduce((a, s) => a + s.weight * s.reps, 0);
                    const bestWeight = log.sets.length > 0 ? Math.max(...log.sets.map(s => s.weight)) : 0;

                    return (
                        <Card key={log.id} style={{ marginBottom: 12 }}>
                            <View style={styles.exHeader}>
                                <Typography variant="h3" style={{ flex: 1 }}>{log.exerciseName}</Typography>
                                {bestWeight > 0 && (
                                    <View style={styles.prBadge}>
                                        <Typography variant="label" color={colors.primary} style={{ fontSize: 10 }}>
                                            {t('workoutDetails.best')} {bestWeight}{t('common.kg')}
                                        </Typography>
                                    </View>
                                )}
                            </View>

                            {/* Table */}
                            <View style={styles.tableHeader}>
                                <Typography variant="label" style={styles.colSet}>{t('common.set')}</Typography>
                                <Typography variant="label" style={styles.colData}>{t('common.kgLabel')}</Typography>
                                <Typography variant="label" style={styles.colData}>{t('common.repsLabel')}</Typography>
                                <Typography variant="label" style={styles.colData}>{t('common.rpe')}</Typography>
                                <Typography variant="label" style={[styles.colData, { textAlign: 'right' }]}>{t('common.vol')}</Typography>
                            </View>

                            {log.sets.map((set: Set, index: number) => (
                                <View key={set.id} style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
                                    <View style={styles.setBadge}>
                                        <Typography variant="bodySmall" bold align="center">{index + 1}</Typography>
                                    </View>
                                    <Typography variant="body" style={styles.colData} bold>{set.weight}</Typography>
                                    <Typography variant="body" style={styles.colData}>{set.reps}</Typography>
                                    <Typography variant="body" style={styles.colData} color={set.rpe ? (set.rpe <= 5 ? colors.success : set.rpe <= 7 ? colors.warning : set.rpe <= 8 ? '#FF9800' : colors.error) : colors.textMuted}>
                                        {set.rpe || '—'}
                                    </Typography>
                                    <Typography variant="bodySmall" color={colors.textMuted} style={[styles.colData, { textAlign: 'right' }]}>
                                        {set.weight * set.reps}
                                    </Typography>
                                </View>
                            ))}

                            {/* Exercise totals */}
                            <View style={styles.exFooter}>
                                <Typography variant="caption" color={colors.textSecondary}>
                                    {log.sets.length} {t('common.sets')} • {exVolume.toLocaleString()} {t('workoutDetails.kgTotal')}
                                </Typography>
                            </View>
                        </Card>
                    );
                })}

                {/* Delete */}
                <Button
                    title={t('workoutDetails.deleteWorkout')}
                    variant="danger"
                    size="medium"
                    onPress={handleDelete}
                    fullWidth
                    style={{ marginTop: 16 }}
                />
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
        paddingVertical: 14,
        marginBottom: 0,
    },
    exHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    prBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.primary + '40',
        backgroundColor: colors.primary + '10',
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: borderRadius.xs,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '40',
    },
    colSet: {
        width: 36,
        textAlign: 'center',
    },
    colData: {
        flex: 1,
        textAlign: 'center',
    },
    setBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    exFooter: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
});
