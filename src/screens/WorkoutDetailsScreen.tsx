import React, { useState, useMemo } from 'react';
import { ScrollView, View, StyleSheet, Alert } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { StatTile } from '../components/StatTile';
import { Clock, Layers, Repeat, Weight, Trophy, Link2, NotebookPen, Trash2 } from 'lucide-react-native';
import { Button } from '../components/Button';
import { formatDate } from '../utils/dates';
import { borderRadius, ThemeColors } from '../theme/colors';
import { WorkoutSession, ExerciseLog, Set as WorkoutSet } from '../types';
import { useTranslation } from 'react-i18next';
import { ConfirmationModal } from '../components/ConfirmationModal';
import {
    getSupersetType,
    getSupersetColor,
    getSupersetPositionLabel,
} from '../utils/supersetUtils';
import { getExerciseName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';

// ── Build groupable render list ──────────────────────────
interface RenderItem {
    type: 'single' | 'group';
    groupId?: string;
    exercises: ExerciseLog[];
}

function buildRenderList(exercises: ExerciseLog[]): RenderItem[] {
    const result: RenderItem[] = [];
    const processedGroupIds = new Set<string>();

    exercises.forEach((ex) => {
        if (ex.supersetGroupId) {
            if (processedGroupIds.has(ex.supersetGroupId)) return;
            processedGroupIds.add(ex.supersetGroupId);
            const groupExercises = exercises.filter(
                e => e.supersetGroupId === ex.supersetGroupId
            );
            result.push({ type: 'group', groupId: ex.supersetGroupId, exercises: groupExercises });
        } else {
            result.push({ type: 'single', exercises: [ex] });
        }
    });

    return result;
}

const MOOD_EMOJIS = ['😴', '😕', '😐', '💪', '🔥'];

export const WorkoutDetailsScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight } = useUnits();
    const { workoutId } = route.params as { workoutId: string };
    const { workouts, deleteWorkout } = useWorkout();

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        title: '',
        message: '',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
        onCancel: undefined as (() => void) | undefined,
        variant: 'primary' as 'primary' | 'danger' | 'success',
    });

    const showModal = (
        title: string,
        message: string,
        onConfirm: () => void = () => setModalVisible(false),
        variant: 'primary' | 'danger' | 'success' = 'primary',
        confirmText: string = t('common.ok'),
        cancelText?: string,
        onCancel?: () => void
    ) => {
        setModalConfig({
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setModalVisible(false);
            },
            variant,
            confirmText,
            cancelText: cancelText || (onCancel ? t('common.cancel') : ''),
            onCancel: onCancel
                ? () => {
                    onCancel();
                    setModalVisible(false);
                }
                : undefined,
        });
        setModalVisible(true);
    };

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
        showModal(
            t('workoutDetails.deleteTitle'),
            t('workoutDetails.deleteMessage'),
            async () => {
                await deleteWorkout(workoutId);
                navigation.goBack();
            },
            'danger',
            t('common.delete'),
            t('common.cancel'),
            () => { }
        );
    };

    const renderList = buildRenderList(workout.exercises);

    const renderExerciseCard = (log: ExerciseLog, posLabel: string | null, ssColor: string | undefined, isLastInGroup?: boolean) => {
        const exVolume = log.sets.reduce((a, s) => a + s.weight * s.reps, 0);
        const bestWeight = log.sets.length > 0 ? Math.max(...log.sets.map(s => s.weight)) : 0;

        return (
            <Card
                key={log.id}
                style={[
                    { marginBottom: posLabel && !isLastInGroup ? 4 : 12 },
                    posLabel && { borderLeftWidth: 0, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
                    posLabel && isLastInGroup && { marginBottom: 12 },
                ]}
            >
                <View style={styles.exHeader}>
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                        {posLabel && (
                            <View style={[styles.positionBadge, { backgroundColor: (ssColor || colors.secondary) + '22' }]}>
                                <Typography variant="caption" color={ssColor || colors.secondary} bold style={{ fontSize: 11 }}>
                                    {posLabel}
                                </Typography>
                            </View>
                        )}
                        <Typography variant="h3" style={{ flex: 1 }}>{getExerciseName(log.exerciseId, t, log.exerciseName)}</Typography>
                    </View>
                    {bestWeight > 0 && (
                        <View style={styles.prBadge}>
                            <Trophy color={colors.accent} size={12} />
                            <Typography variant="caption" color={colors.accent} bold style={{ fontSize: 11.5 }}>
                                {displayWeight(bestWeight)} {weightUnit}
                            </Typography>
                        </View>
                    )}
                </View>

                {/* Table */}
                <View style={styles.tableHeader}>
                    <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colSet}>{t('common.set')}</Typography>
                    <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colData}>{weightUnit}</Typography>
                    <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colData}>{t('common.repsLabel')}</Typography>
                    <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colData}>{t('common.rpe')}</Typography>
                    <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.colData, { textAlign: 'right' }]}>{t('common.vol')}</Typography>
                </View>

                {log.sets.map((set: WorkoutSet, index: number) => (
                    <View key={set.id} style={[styles.row, index % 2 === 0 && styles.rowAlt]}>
                        <View style={styles.setBadge}>
                            <Typography variant="bodySmall" bold align="center" color={colors.primary}>{index + 1}</Typography>
                        </View>
                        {set.durationSec ? (
                            // Timed hold or cardio: show time (and distance / added load)
                            <Typography variant="body" style={[styles.colData, { flex: 2 }]} bold>
                                {`${Math.floor(set.durationSec / 60)}:${String(Math.round(set.durationSec % 60)).padStart(2, '0')}`}
                                {set.distance ? ` · ${Math.round((weightUnit === 'lbs' ? set.distance * 0.621371 : set.distance) * 100) / 100} ${weightUnit === 'lbs' ? 'mi' : 'km'}` : ''}
                                {set.weight > 0 ? ` · +${displayWeight(set.weight)}` : ''}
                            </Typography>
                        ) : (
                            <>
                                <Typography variant="body" style={styles.colData} bold>{displayWeight(set.weight)}</Typography>
                                <Typography variant="body" style={styles.colData}>{set.reps}</Typography>
                            </>
                        )}
                        <Typography variant="body" style={styles.colData} color={set.rpe ? (set.rpe <= 5 ? colors.success : set.rpe <= 7 ? colors.warning : set.rpe <= 8 ? colors.accent : colors.error) : colors.textMuted}>
                            {set.rpe || '—'}
                        </Typography>
                        <Typography variant="bodySmall" color={colors.textMuted} style={[styles.colData, { textAlign: 'right' }]}>
                            {Math.round(displayWeight(set.weight * set.reps))}
                        </Typography>
                    </View>
                ))}

                {/* Exercise totals */}
                <View style={styles.exFooter}>
                    <Typography variant="caption" color={colors.textSecondary}>
                        {log.sets.length} {t('common.sets')} · {Math.round(displayWeight(exVolume)).toLocaleString()} {weightUnit}
                    </Typography>
                </View>

                {/* Exercise notes */}
                {log.notes ? (
                    <View style={styles.exNotes}>
                        <NotebookPen color={colors.textMuted} size={13} />
                        <Typography variant="caption" color={colors.textSecondary} style={{ flex: 1 }}>
                            {log.notes}
                        </Typography>
                    </View>
                ) : null}
            </Card>
        );
    };

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Title */}
                <Typography variant="h1" style={{ marginBottom: 4 }}>{workout.name}</Typography>
                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginBottom: 12 }}>
                    {formatDate(workout.startTime, 'EEEE, MMM dd, yyyy · HH:mm')}
                </Typography>

                {/* Mood Badge */}
                {workout.mood ? (
                    <View style={styles.moodBadge}>
                        <Typography variant="caption" style={{ fontSize: 15 }}>
                            {MOOD_EMOJIS[workout.mood - 1] || ''}
                        </Typography>
                        <Typography variant="caption" color={colors.textSecondary} style={{ marginLeft: 6 }}>
                            {t('workoutDetails.energy')}: {workout.mood}/5
                        </Typography>
                    </View>
                ) : null}

                {/* Summary Stats */}
                <View style={styles.summaryRow}>
                    <StatTile compact value={duration} label={t('common.min')} icon={c => <Clock color={c} size={14} />} tone="accent" />
                    <StatTile compact value={totalSets} label={t('common.sets')} icon={c => <Layers color={c} size={14} />} tone="secondary" />
                    <StatTile compact value={totalReps} label={t('common.reps')} icon={c => <Repeat color={c} size={14} />} tone="primary" />
                    <StatTile
                        compact
                        value={displayWeight(totalVolume) > 999 ? `${(displayWeight(totalVolume) / 1000).toFixed(1)}k` : Math.round(displayWeight(totalVolume))}
                        label={weightUnit}
                        icon={c => <Weight color={c} size={14} />}
                        tone="success"
                    />
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

                {renderList.map((item) => {
                    if (item.type === 'single') {
                        return renderExerciseCard(item.exercises[0], null, undefined);
                    } else {
                        const groupExercises = item.exercises;
                        const groupSize = groupExercises.length;
                        const ssType = getSupersetType(groupSize);
                        const ssColor = getSupersetColor(ssType);
                        const ssLabel = groupSize === 2
                            ? t('superset.superset')
                            : t('superset.circuit');

                        return (
                            <View key={item.groupId} style={styles.supersetContainer}>
                                {/* Superset group header */}
                                <View style={[styles.supersetHeader, { borderColor: ssColor + '50' }]}>
                                    <Link2 color={ssColor} size={14} />
                                    <Typography variant="label" color={ssColor}>
                                        {ssLabel} · {groupSize} {t('common.exercises')}
                                    </Typography>
                                </View>

                                {/* Colored side bar + exercises */}
                                <View style={styles.supersetBody}>
                                    <View style={[styles.supersetSidebar, { backgroundColor: ssColor }]} />
                                    <View style={styles.supersetExercises}>
                                        {groupExercises.map((log, i) => {
                                            const posLabel = getSupersetPositionLabel(log, workout.exercises);
                                            return renderExerciseCard(log, posLabel, ssColor, i === groupExercises.length - 1);
                                        })}
                                    </View>
                                </View>
                            </View>
                        );
                    }
                })}

                {/* Delete */}
                <Button
                    title={t('workoutDetails.deleteWorkout')}
                    variant="danger"
                    size="medium"
                    onPress={handleDelete}
                    icon={c => <Trash2 color={c} size={17} />}
                    fullWidth
                    style={{ marginTop: 16 }}
                />
            </ScrollView>
            <ConfirmationModal
                visible={modalVisible}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmText={modalConfig.confirmText}
                cancelText={modalConfig.cancelText}
                onConfirm={modalConfig.onConfirm}
                onCancel={modalConfig.onCancel}
                variant={modalConfig.variant}
            />
        </ScreenLayout>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    summaryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    exHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    prBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        backgroundColor: colors.accentSoft,
    },
    positionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.s,
        marginRight: 10,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        marginBottom: 4,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 5,
        paddingHorizontal: 4,
        borderRadius: borderRadius.s,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '80',
    },
    colSet: {
        width: 40,
        textAlign: 'center',
    },
    colData: {
        flex: 1,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
    },
    setBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    exFooter: {
        marginTop: 8,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    // ── Superset styles ──────────────────────────────────
    supersetContainer: {
        marginBottom: 4,
    },
    supersetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 4,
        paddingBottom: 8,
    },
    supersetBody: {
        flexDirection: 'row',
        gap: 8,
    },
    supersetSidebar: {
        width: 3,
        borderRadius: 2,
        marginBottom: 12,
    },
    supersetExercises: {
        flex: 1,
    },
    // ── Mood & notes styles ─────────────────────────────
    moodBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.full,
        alignSelf: 'flex-start',
    },
    exNotes: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
});
