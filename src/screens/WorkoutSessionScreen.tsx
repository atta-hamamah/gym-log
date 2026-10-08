import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PlateCalculator } from '../components/PlateCalculator';
import { RestTimer } from '../components/RestTimer';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PRCelebration } from '../components/PRCelebration';
import { borderRadius, spacing, ThemeColors } from '../theme/colors';
import { Exercise, ExerciseLog, Set as WorkoutSet, TrackingType, WorkoutSession } from '../types';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { PlayCircle, Timer, Check, X, Trash2, Target, Lightbulb, History, Link2, Lock, Plus, Calculator, NotebookPen, Unlink } from 'lucide-react-native';
import { IconButton } from '../components/IconButton';
import { useTranslation } from 'react-i18next';
import {
    getSupersetType,
    getSupersetColor,
    getSupersetPositionLabel,
    getExerciseGroups,
} from '../utils/supersetUtils';
import { getExerciseName, EXERCISE_BY_ID } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

export const WorkoutSessionScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight, toMetricWeight } = useUnits();
    const { canAccess } = useFeatureAccess();
    const canAccessSupersets = canAccess('supersets');
    const canAccessRpe = canAccess('rpeTracking');
    const {
        currentWorkout,
        finishWorkout,
        cancelWorkout,
        lastDetectedPRs,
        clearDetectedPRs,
        linkSuperset,
        unlinkSuperset,
        updateExerciseNotes,
        setWorkoutMood,
    } = useWorkout();
    const [mood, setMood] = useState<number>(0);
    const [showPRCelebration, setShowPRCelebration] = useState(false);
    const [pendingGoBack, setPendingGoBack] = useState(false);
    const [notes, setNotes] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [showRestTimer, setShowRestTimer] = useState(false);
    const [restDuration, setRestDuration] = useState(90); // default 90s
    const [restCountdown, setRestCountdown] = useState<number | null>(null); // header countdown

    // ── Superset linking state ──
    const [isLinkMode, setIsLinkMode] = useState(false);
    const [selectedForLink, setSelectedForLink] = useState<string[]>([]);

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

    useEffect(() => {
        if (!currentWorkout) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [currentWorkout]);

    // Header rest countdown
    useEffect(() => {
        if (restCountdown === null || restCountdown < -30) return; // stop after 30s overtime
        const timer = setTimeout(() => {
            setRestCountdown(prev => (prev !== null ? prev - 1 : null));
        }, 1000);
        return () => clearTimeout(timer);
    }, [restCountdown]);

    const formatTime = useCallback((seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, []);

    const formatRestTime = useCallback((seconds: number) => {
        const abs = Math.abs(seconds);
        const m = Math.floor(abs / 60);
        const s = abs % 60;
        const sign = seconds < 0 ? '+' : '';
        return `${sign}${m}:${s.toString().padStart(2, '0')}`;
    }, []);

    // Rest after a set: the plan's rest for that exercise, otherwise the last chosen duration.
    const handleSetLogged = useCallback((plannedRest?: number) => {
        const duration = plannedRest && plannedRest > 0 ? plannedRest : restDuration;
        if (plannedRest && plannedRest > 0) setRestDuration(plannedRest);
        setShowRestTimer(true);
        setRestCountdown(duration);
    }, [restDuration]);

    const handleDismissRest = useCallback(() => {
        setShowRestTimer(false);
        setRestCountdown(null);
    }, []);

    // ── Superset linking handlers ──
    const handleToggleLinkMode = () => {
        if (isLinkMode) {
            // Cancel link mode
            setIsLinkMode(false);
            setSelectedForLink([]);
        } else {
            setIsLinkMode(true);
            setSelectedForLink([]);
        }
    };

    const handleSelectForLink = (exerciseLogId: string) => {
        setSelectedForLink(prev => {
            if (prev.includes(exerciseLogId)) {
                return prev.filter(id => id !== exerciseLogId);
            }
            return [...prev, exerciseLogId];
        });
    };

    const handleConfirmLink = () => {
        if (selectedForLink.length >= 2) {
            linkSuperset(selectedForLink);
        }
        setIsLinkMode(false);
        setSelectedForLink([]);
    };

    const handleUnlink = (exerciseLogId: string) => {
        unlinkSuperset(exerciseLogId);
    };

    // ── Grouping logic for rendering ──
    const exerciseGroups = useMemo(() => {
        if (!currentWorkout) return [];
        return getExerciseGroups(currentWorkout.exercises);
    }, [currentWorkout?.exercises]);

    // Store the Convex workout ID returned by finishWorkout (needed for Aura)
    const [convexWorkoutId, setConvexWorkoutId] = useState<string | null>(null);
    const [localStatsForAura, setLocalStatsForAura] = useState<any>(null);

    // Helper: compute local stats from a completed workout session
    const computeLocalStats = (session: any) => {
        const exercises = session.exercises.map((ex: any) => {
            const validSets = ex.sets.filter((s: any) => s.type === 'normal' && s.completed);
            const bestSet = validSets.reduce(
                (best: any, s: any) => (s.weight > (best?.weight || 0) ? s : best),
                validSets[0]
            );
            return {
                name: ex.exerciseName,
                bestWeight: bestSet?.weight || 0,
                bestReps: bestSet?.reps || 0,
            };
        }).filter((ex: any) => ex.bestWeight > 0);

        const totalSets = session.exercises.reduce(
            (acc: number, ex: any) => acc + ex.sets.filter((s: any) => s.type === 'normal' && s.completed).length, 0
        );
        const totalVolume = Math.round(session.exercises.reduce(
            (acc: number, ex: any) => acc + ex.sets
                .filter((s: any) => s.type === 'normal' && s.completed)
                .reduce((a: number, s: any) => a + s.weight * s.reps, 0), 0
        ));
        const durationMin = session.endTime
            ? Math.round((session.endTime - session.startTime) / 60000)
            : null;

        return {
            name: session.name,
            durationMin,
            totalSets,
            totalVolume,
            exerciseCount: session.exercises.length,
            exercises,
        };
    };

    // When finishWorkout completes, check for PRs
    useEffect(() => {
        if (pendingGoBack && lastDetectedPRs.length > 0) {
            setShowPRCelebration(true);
            setPendingGoBack(false);
        } else if (pendingGoBack && lastDetectedPRs.length === 0) {
            setPendingGoBack(false);
            navigation.replace('WorkoutAura', {
                ...(convexWorkoutId ? { workoutId: convexWorkoutId } : {}),
                ...(localStatsForAura ? { localStats: localStatsForAura } : {}),
            });
        }
    }, [pendingGoBack, lastDetectedPRs, convexWorkoutId, localStatsForAura, navigation]);

    const handleDismissPR = () => {
        setShowPRCelebration(false);
        clearDetectedPRs();
        navigation.replace('WorkoutAura', {
            ...(convexWorkoutId ? { workoutId: convexWorkoutId } : {}),
            ...(localStatsForAura ? { localStats: localStatsForAura } : {}),
        });
    };

    if (!currentWorkout) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2" style={{ marginBottom: 16 }}>{t('workoutSession.noActiveWorkout')}</Typography>
                    <Button title={t('common.goBack')} variant="outline" onPress={() => navigation.goBack()} />
                </View>
                <PRCelebration
                    visible={showPRCelebration}
                    prs={lastDetectedPRs}
                    onDismiss={handleDismissPR}
                />
            </ScreenLayout>
        );
    }

    const handleFinish = () => {
        if (currentWorkout.exercises.length === 0) {
            showModal(
                t('workoutSession.emptyWorkoutTitle'),
                t('workoutSession.emptyWorkoutMessage'),
                undefined,
                'primary'
            );
            return;
        }
        showModal(
            t('workoutSession.finishTitle'),
            t('workoutSession.finishMessage'),
            async () => {
                // Compute local stats before finishing (currentWorkout gets cleared)
                if (currentWorkout) {
                    const completed = { ...currentWorkout, endTime: Date.now() };
                    setLocalStatsForAura(computeLocalStats(completed));
                }
                const cloudId = await finishWorkout(notes, mood || undefined);
                setConvexWorkoutId(cloudId);
                setPendingGoBack(true);
            },
            'success',
            t('workoutSession.finishConfirm'),
            t('common.cancel'),
            () => { }
        );
    };

    const handleCancel = () => {
        showModal(
            t('workoutSession.cancelTitle'),
            t('workoutSession.cancelMessage'),
            async () => {
                await cancelWorkout();
                navigation.goBack();
            },
            'danger',
            t('workoutSession.discard'),
            t('common.cancel'),
            () => { }
        );
    };

    const totalSets = currentWorkout.exercises.reduce((acc, e) => acc + e.sets.length, 0);
    const totalVolume = currentWorkout.exercises.reduce(
        (acc, e) => acc + e.sets.reduce((a, s) => a + s.weight * s.reps, 0),
        0
    );

    // Build grouped render list: consecutive exercises with same groupId are rendered together
    const renderList = buildRenderList(currentWorkout.exercises);

    return (
        <ScreenLayout>
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Typography variant="h2" numberOfLines={1}>{currentWorkout.name}</Typography>
                    <View style={styles.headerStats}>
                        <View style={styles.timerBadge}>
                            <View style={styles.liveDot} />
                            <Typography variant="bodySmall" color={colors.text} bold style={styles.tabular}>
                                {formatTime(elapsed)}
                            </Typography>
                        </View>
                        <Typography variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ marginLeft: 10, flexShrink: 1 }}>
                            {totalSets} {t('common.sets')} · {totalVolume > 0 ? `${Math.round(displayWeight(totalVolume)).toLocaleString()} ${weightUnit}` : '—'}
                        </Typography>
                    </View>
                </View>

                {/* Rest Timer Header Badge - always visible */}
                <TouchableOpacity
                    style={[
                        styles.restBadge,
                        restCountdown !== null && restCountdown > 0 && styles.restBadgeActive,
                        restCountdown !== null && restCountdown <= 0 && styles.restBadgeComplete,
                    ]}
                    onPress={() => {
                        if (restCountdown === null) {
                            // Start a new rest timer
                            setShowRestTimer(true);
                            setRestCountdown(restDuration);
                        } else {
                            // Toggle the panel visibility
                            setShowRestTimer(!showRestTimer);
                        }
                    }}
                    activeOpacity={0.7}
                >
                    {(() => {
                        const restColor = restCountdown === null
                            ? colors.textSecondary
                            : restCountdown <= 0
                                ? colors.success
                                : colors.primary;
                        return (
                            <>
                                {restCountdown !== null && restCountdown <= 0
                                    ? <Check color={restColor} size={16} strokeWidth={2.4} />
                                    : <Timer color={restColor} size={17} />}
                                {restCountdown !== null && (
                                    <Typography variant="bodySmall" color={restColor} bold style={styles.tabular}>
                                        {formatRestTime(restCountdown)}
                                    </Typography>
                                )}
                            </>
                        );
                    })()}
                </TouchableOpacity>

                <Button
                    title={t('workoutSession.finish')}
                    size="small"
                    onPress={handleFinish}
                    icon={c => <Check color={c} size={16} strokeWidth={2.4} />}
                    style={{ marginLeft: 8 }}
                />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
                {currentWorkout.exercises.length === 0 ? (
                    <Card variant="outlined" style={styles.emptyCard}>
                        <View style={styles.emptyIcon}>
                            <Plus color={colors.primary} size={22} />
                        </View>
                        <Typography variant="body" color={colors.textSecondary} align="center">
                            {t('workoutSession.noExercises')}
                        </Typography>
                    </Card>
                ) : (
                    <>
                        {/* Link Mode Banner */}
                        {isLinkMode && (
                            <View style={styles.linkBanner}>
                                <View style={styles.linkBannerContent}>
                                    <View style={styles.inlineRow}>
                                        <Link2 color={colors.secondary} size={15} />
                                        <Typography variant="bodySmall" color={colors.secondary} bold>
                                            {t('superset.selectExercises')}
                                        </Typography>
                                    </View>
                                    <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                        {t('superset.selectHint')}
                                    </Typography>
                                </View>
                                <View style={styles.linkBannerActions}>
                                    <Button
                                        title={t('common.cancel')}
                                        variant="ghost"
                                        size="small"
                                        onPress={() => { setIsLinkMode(false); setSelectedForLink([]); }}
                                    />
                                    <Button
                                        title={`${t('superset.link')} (${selectedForLink.length})`}
                                        variant="ai"
                                        size="small"
                                        icon={c => <Link2 color={c} size={15} />}
                                        onPress={handleConfirmLink}
                                        disabled={selectedForLink.length < 2}
                                    />
                                </View>
                            </View>
                        )}

                        {renderList.map((item) => {
                            if (item.type === 'single') {
                                const log = item.exercises[0];
                                const globalIndex = currentWorkout.exercises.findIndex(e => e.id === log.id);
                                return (
                                    <View key={log.id}>
                                        {/* Link mode checkbox overlay */}
                                        {isLinkMode && (
                                            <TouchableOpacity
                                                style={[
                                                    styles.linkCheckbox,
                                                    selectedForLink.includes(log.id) && styles.linkCheckboxActive,
                                                ]}
                                                onPress={() => handleSelectForLink(log.id)}
                                                activeOpacity={0.7}
                                            >
                                                {selectedForLink.includes(log.id) && <Check color={colors.onSecondary} size={15} strokeWidth={3} />}
                                            </TouchableOpacity>
                                        )}
                                        <ExerciseCard
                                            log={log}
                                            index={globalIndex}
                                            onSetLogged={handleSetLogged}
                                            showModal={showModal}
                                            positionLabel={null}
                                            supersetColor={undefined}
                                            isLinkMode={isLinkMode}
                                            isSelected={selectedForLink.includes(log.id)}
                                            onUnlink={undefined}
                                            canAccessRpe={canAccessRpe}
                                        />
                                    </View>
                                );
                            } else {
                                // Superset group
                                const groupExercises = item.exercises;
                                const groupSize = groupExercises.length;
                                const ssType = getSupersetType(groupSize);
                                const ssColor = getSupersetColor(ssType);
                                const ssLabel = groupSize === 2
                                    ? t('superset.superset')
                                    : groupSize >= 3
                                        ? t('superset.circuit')
                                        : t('superset.superset');

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
                                                    const globalIndex = currentWorkout.exercises.findIndex(e => e.id === log.id);
                                                    const posLabel = getSupersetPositionLabel(log, currentWorkout.exercises);

                                                    return (
                                                        <View key={log.id}>
                                                            {isLinkMode && (
                                                                <TouchableOpacity
                                                                    style={[
                                                                        styles.linkCheckbox,
                                                                        selectedForLink.includes(log.id) && styles.linkCheckboxActive,
                                                                    ]}
                                                                    onPress={() => handleSelectForLink(log.id)}
                                                                    activeOpacity={0.7}
                                                                >
                                                                    {selectedForLink.includes(log.id) && <Check color={colors.onSecondary} size={15} strokeWidth={3} />}
                                                                </TouchableOpacity>
                                                            )}
                                                            <ExerciseCard
                                                                log={log}
                                                                index={globalIndex}
                                                                onSetLogged={handleSetLogged}
                                                                showModal={showModal}
                                                                positionLabel={posLabel}
                                                                supersetColor={ssColor}
                                                                isLinkMode={isLinkMode}
                                                                isSelected={selectedForLink.includes(log.id)}
                                                                onUnlink={() => handleUnlink(log.id)}
                                                                isLastInGroup={i === groupExercises.length - 1}
                                                                canAccessRpe={canAccessRpe}
                                                            />
                                                        </View>
                                                    );
                                                })}
                                            </View>
                                        </View>
                                    </View>
                                );
                            }
                        })}
                    </>
                )}

                {/* Action buttons below exercises */}
                <View style={styles.actionRow}>
                    <Button
                        title={t('workoutSession.addExercise')}
                        variant="secondary"
                        icon={c => <Plus color={c} size={18} />}
                        onPress={() => navigation.navigate('ExerciseList')}
                        style={{ flex: 1 }}
                    />
                    {currentWorkout.exercises.length >= 2 && !isLinkMode && (
                        <Button
                            title={t('superset.linkExercises')}
                            variant="outline"
                            icon={c => (canAccessSupersets ? <Link2 color={c} size={16} /> : <Lock color={c} size={15} />)}
                            onPress={() => {
                                if (!canAccessSupersets) {
                                    navigation.navigate('Paywall');
                                    return;
                                }
                                handleToggleLinkMode();
                            }}
                        />
                    )}
                </View>

                {/* Mood/Energy Selector */}
                <View style={styles.moodSection}>
                    <Typography variant="label" style={{ marginBottom: 8 }}>
                        {t('workoutSession.howFeeling')}
                    </Typography>
                    <View style={styles.moodRow}>
                        {MOOD_OPTIONS.map(opt => (
                            <TouchableOpacity
                                key={opt.value}
                                style={[
                                    styles.moodChip,
                                    mood === opt.value && styles.moodChipActive,
                                ]}
                                onPress={() => {
                                    const newMood = mood === opt.value ? 0 : opt.value;
                                    setMood(newMood);
                                    if (newMood > 0) setWorkoutMood(newMood);
                                }}
                                activeOpacity={0.7}
                            >
                                <Typography variant="body" style={{ fontSize: 20 }}>{opt.emoji}</Typography>
                                <Typography variant="caption" color={mood === opt.value ? colors.primary : colors.textMuted} bold={mood === opt.value} style={{ fontSize: 10.5, marginTop: 2 }}>
                                    {opt.label}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <TextInput
                    style={styles.notesInput}
                    placeholder={t('workoutSession.sessionNotes')}
                    placeholderTextColor={colors.textMuted}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                />

                <Button
                    title={t('workoutSession.cancelWorkout')}
                    variant="ghost"
                    onPress={handleCancel}
                    size="small"
                    icon={c => <X color={c} size={15} />}
                    style={{ marginTop: 16, alignSelf: 'center' }}
                />
            </ScrollView>

            <RestTimer
                visible={showRestTimer}
                defaultDuration={restDuration}
                onDismiss={handleDismissRest}
                onTimeChange={(newRemaining) => setRestCountdown(newRemaining)}
            />

            <PRCelebration
                visible={showPRCelebration}
                prs={lastDetectedPRs}
                onDismiss={handleDismissPR}
            />

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

/** How sets of this exercise are logged (custom cardio exercises log time + distance). */
function getTracking(exerciseId: string, exercises: Exercise[]): TrackingType {
    const known = EXERCISE_BY_ID[exerciseId];
    if (known?.tracking) return known.tracking;
    const custom = exercises.find(e => e.id === exerciseId);
    if (custom?.tracking) return custom.tracking;
    return custom?.category === 'cardio' ? 'cardio' : 'weight_reps';
}

/** Working sets from the most recent finished workout that included this exercise. */
function findLastSets(exerciseId: string, workouts: WorkoutSession[]): WorkoutSet[] | null {
    for (const w of workouts) {
        const log = w.exercises.find(e => e.exerciseId === exerciseId && e.sets.some(s => s.type !== 'warmup'));
        if (log) return log.sets.filter(s => s.type !== 'warmup');
    }
    return null;
}

function formatClock(totalSeconds: number): string {
    const s = Math.round(totalSeconds);
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m > 0 ? `${m}:${r.toString().padStart(2, '0')}` : `${r}s`;
}

// RPE Color based on exertion level
const getRpeColor = (rpe: number, colors: any): string => {
    if (rpe <= 5) return colors.success;
    if (rpe <= 7) return colors.warning;
    if (rpe <= 8) return colors.accent;
    return colors.error;
};

const ExerciseCard = ({
    log,
    index,
    onSetLogged,
    showModal,
    positionLabel,
    supersetColor,
    isLinkMode,
    isSelected,
    onUnlink,
    isLastInGroup,
    canAccessRpe = true,
}: {
    log: ExerciseLog;
    index: number;
    onSetLogged: (plannedRest?: number) => void;
    showModal: (title: string, message: string, onConfirm?: () => void, variant?: any) => void;
    positionLabel: string | null;
    supersetColor: string | undefined;
    isLinkMode: boolean;
    isSelected: boolean;
    onUnlink: (() => void) | undefined;
    isLastInGroup?: boolean;
    canAccessRpe?: boolean;
}) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight, toMetricWeight } = useUnits();
    const { logSet, deleteSet, removeExerciseFromWorkout, updateExerciseNotes, workouts, exercises } = useWorkout();
    const tracking = useMemo(() => getTracking(log.exerciseId, exercises), [log.exerciseId, exercises]);
    const lastSets = useMemo(() => findLastSets(log.exerciseId, workouts), [log.exerciseId, workouts]);
    const target = log.target;

    // Start from the plan's load, otherwise last time's top set.
    const initialWeight = (() => {
        const kg = target?.weight ?? lastSets?.reduce((m, s) => Math.max(m, s.weight), 0);
        return kg && kg > 0 ? String(Math.round(displayWeight(kg) * 2) / 2) : '';
    })();
    const [weight, setWeight] = useState(initialWeight);
    const [reps, setReps] = useState('');
    const [duration, setDuration] = useState('');   // seconds (time) or minutes (cardio)
    const [distance, setDistance] = useState('');
    const [rpe, setRpe] = useState<number | null>(null);
    const [showRpeSelector, setShowRpeSelector] = useState(false);
    const [showPlateCalc, setShowPlateCalc] = useState(false);
    const [showInfo, setShowInfo] = useState(false);
    const [showNotes, setShowNotes] = useState(!!log.notes);
    const [exerciseNotes, setExerciseNotes] = useState(log.notes || '');

    const invalid = () =>
        showModal(t('workoutSession.invalidInput'), t('workoutSession.invalidInputMessage'), undefined, 'danger');

    const handleAddSet = () => {
        const w = weight.trim() === '' ? 0 : parseFloat(weight);
        const extra = rpe !== null ? { rpe } : {};

        if (tracking === 'cardio') {
            const minutes = parseFloat(duration);
            const km = distance.trim() === '' ? undefined : parseFloat(distance);
            if (isNaN(minutes) || minutes <= 0 || (km !== undefined && (isNaN(km) || km < 0))) return invalid();
            logSet(log.id, {
                weight: 0,
                reps: 0,
                type: 'normal',
                durationSec: Math.round(minutes * 60),
                ...(km ? { distance: toMetricDistance(km) } : {}),
                ...extra,
            });
            setDuration('');
            setDistance('');
            setRpe(null);
            return; // no rest timer after cardio
        }

        if (tracking === 'time') {
            const seconds = parseFloat(duration);
            if (isNaN(seconds) || seconds <= 0 || isNaN(w) || w < 0) return invalid();
            logSet(log.id, { weight: toMetricWeight(w), reps: 0, type: 'normal', durationSec: Math.round(seconds), ...extra });
            setDuration('');
        } else {
            const r = parseFloat(reps);
            // Weight is required for loaded lifts; bodyweight exercises allow 0 / empty.
            if (isNaN(w) || isNaN(r) || w < 0 || r <= 0 || (tracking === 'weight_reps' && weight.trim() === '')) return invalid();
            logSet(log.id, { weight: toMetricWeight(w), reps: r, type: 'normal', ...extra });
            setReps('');
        }
        setRpe(null);
        onSetLogged(target?.restSeconds); // trigger rest timer
    };

    const toMetricDistance = (value: number) => (weightUnit === 'lbs' ? value / 0.621371 : value);
    const distanceUnit = weightUnit === 'lbs' ? 'mi' : 'km';

    const formatSetValue = (set: WorkoutSet) => {
        if (set.durationSec && tracking === 'cardio') {
            const km = set.distance ? ` · ${Math.round((weightUnit === 'lbs' ? set.distance * 0.621371 : set.distance) * 100) / 100} ${distanceUnit}` : '';
            return `${formatClock(set.durationSec)}${km}`;
        }
        if (set.durationSec) return `${formatClock(set.durationSec)}${set.weight > 0 ? ` +${displayWeight(set.weight)}` : ''}`;
        return null;
    };

    const planText = target
        ? [
            `${target.sets} × ${target.reps}`,
            target.weight ? `${Math.round(displayWeight(target.weight) * 2) / 2} ${weightUnit}` : null,
            `${t('workoutSession.restShort')} ${formatClock(target.restSeconds)}`,
        ].filter(Boolean).join(' · ')
        : null;
    const lastText = lastSets && lastSets.length
        ? lastSets.slice(0, 4).map(s => s.durationSec
            ? formatClock(s.durationSec)
            : `${s.weight > 0 ? displayWeight(s.weight) : 'BW'}×${s.reps}`).join(', ')
        : null;

    const plateCalcWeight = parseFloat(weight) || (log.sets.length > 0 ? log.sets[log.sets.length - 1].weight : 0);

    const exerciseVolume = log.sets.reduce((a, s) => a + s.weight * s.reps, 0);

    return (
        <Card
            style={[
                styles.exerciseCard,
                isLinkMode && isSelected && { borderColor: colors.secondary, borderWidth: 2 },
                positionLabel && !isLastInGroup && { marginBottom: 4, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
                positionLabel && isLastInGroup && { marginBottom: 12 },
                positionLabel && { borderLeftWidth: 0 },
            ]}
        >
            {/* Exercise Header */}
            <View style={styles.cardHeader}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    {positionLabel && (
                        <View style={[styles.positionBadge, { backgroundColor: supersetColor + '22' }]}>
                            <Typography variant="caption" color={supersetColor} bold style={{ fontSize: 12 }}>
                                {positionLabel}
                            </Typography>
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Typography variant="h3">{getExerciseName(log.exerciseId, t, log.exerciseName)}</Typography>
                        {log.sets.length > 0 && (
                            <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                {log.sets.length}{target ? `/${target.sets}` : ''} {t('common.sets')}
                                {exerciseVolume > 0 ? ` · ${Math.round(displayWeight(exerciseVolume))} ${weightUnit}` : ''}
                            </Typography>
                        )}
                    </View>
                </View>
                <View style={styles.cardActions}>
                    <IconButton
                        icon={c => <PlayCircle color={c} size={18} />}
                        variant="tonal"
                        tone="primary"
                        size={34}
                        onPress={() => setShowInfo(true)}
                        accessibilityLabel={getExerciseName(log.exerciseId, t, log.exerciseName)}
                    />
                    {onUnlink && (
                        <IconButton
                            icon={c => <Unlink color={c} size={16} />}
                            variant="tonal"
                            tone="secondary"
                            size={34}
                            onPress={onUnlink}
                            accessibilityLabel={t('superset.unlink')}
                        />
                    )}
                    <IconButton
                        icon={c => <Trash2 color={c} size={16} />}
                        variant="ghost"
                        tone="neutral"
                        size={34}
                        onPress={() => removeExerciseFromWorkout(log.id)}
                        accessibilityLabel={t('workoutSession.remove')}
                    />
                </View>
            </View>

            {/* Plan and last time */}
            {(planText || lastText) && (
                <View style={styles.planBox}>
                    {planText && (
                        <View style={styles.planLine}>
                            <Target color={colors.primary} size={13} />
                            <Typography variant="caption" color={colors.primary} bold style={styles.planText}>
                                {t('workoutSession.plan')}: {planText}
                            </Typography>
                        </View>
                    )}
                    {target?.notes ? (
                        <View style={styles.planLine}>
                            <Lightbulb color={colors.textSecondary} size={13} />
                            <Typography variant="caption" color={colors.textSecondary} style={styles.planText}>
                                {target.notes}
                            </Typography>
                        </View>
                    ) : null}
                    {lastText && (
                        <View style={styles.planLine}>
                            <History color={colors.textMuted} size={13} />
                            <Typography variant="caption" color={colors.textMuted} style={styles.planText}>
                                {t('workoutSession.lastTime')}: {lastText}
                            </Typography>
                        </View>
                    )}
                </View>
            )}

            {/* Table Header */}
            <View style={[styles.row, styles.tableHeader]}>
                <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colSet}>{t('common.set')}</Typography>
                {tracking === 'cardio' ? (
                    <>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colVal}>{t('common.min')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colVal}>{distanceUnit}</Typography>
                    </>
                ) : tracking === 'time' ? (
                    <>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colVal}>{t('workoutSession.time')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colVal}>+{weightUnit}</Typography>
                    </>
                ) : (
                    <>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colVal}>{tracking === 'reps' ? `+${weightUnit}` : weightUnit}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colVal}>{t('common.repsLabel')}</Typography>
                    </>
                )}
                <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colRpe}>{t('common.rpe')}</Typography>
                <View style={{ width: 36 }} />
            </View>

            {/* Logged Sets */}
            {log.sets.map((set: WorkoutSet, i: number) => (
                <View key={set.id} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
                    <View style={[styles.colSet, styles.setBadge]}>
                        <Typography variant="bodySmall" color={colors.primary} bold align="center">
                            {i + 1}
                        </Typography>
                    </View>
                    {formatSetValue(set) !== null ? (
                        <Typography variant="body" style={[styles.colVal, { flex: 2 }]} bold>{formatSetValue(set)}</Typography>
                    ) : (
                        <>
                            <Typography variant="body" style={styles.colVal} bold>{set.weight > 0 ? displayWeight(set.weight) : (tracking === 'weight_reps' ? 0 : 'BW')}</Typography>
                            <Typography variant="body" style={styles.colVal}>{set.reps}</Typography>
                        </>
                    )}
                    <View style={styles.colRpe}>
                        {set.rpe ? (
                            <View style={[styles.rpeBadge, { backgroundColor: getRpeColor(set.rpe, colors) + '20', borderColor: getRpeColor(set.rpe, colors) + '50' }]}>
                                <Typography variant="caption" color={getRpeColor(set.rpe, colors)} bold style={{ fontSize: 11 }}>
                                    {set.rpe}
                                </Typography>
                            </View>
                        ) : (
                            <Typography variant="caption" color={colors.textMuted}>—</Typography>
                        )}
                    </View>
                    <TouchableOpacity
                        onPress={() => deleteSet(log.id, set.id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <X color={colors.textMuted} size={16} />
                    </TouchableOpacity>
                </View>
            ))}

            {/* Input Row */}
            <View style={styles.inputRow}>
                <View style={[styles.colSet, styles.nextBadge]}>
                    <Typography variant="bodySmall" color={colors.textMuted} align="center">
                        {log.sets.length + 1}
                    </Typography>
                </View>

                {tracking === 'cardio' ? (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder={t('common.min')}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textMuted}
                            value={duration}
                            onChangeText={setDuration}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder={distanceUnit}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textMuted}
                            value={distance}
                            onChangeText={setDistance}
                            onSubmitEditing={handleAddSet}
                            returnKeyType="done"
                        />
                    </>
                ) : tracking === 'time' ? (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder={t('workoutSession.seconds')}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textMuted}
                            value={duration}
                            onChangeText={setDuration}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder={`+${weightUnit}`}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textMuted}
                            value={weight}
                            onChangeText={setWeight}
                            onSubmitEditing={handleAddSet}
                            returnKeyType="done"
                        />
                    </>
                ) : (
                    <>
                        <TextInput
                            style={styles.input}
                            placeholder={tracking === 'reps' ? `+${weightUnit}` : weightUnit}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textMuted}
                            value={weight}
                            onChangeText={setWeight}
                        />
                        <TextInput
                            style={styles.input}
                            placeholder={t('common.reps')}
                            keyboardType="numeric"
                            placeholderTextColor={colors.textMuted}
                            value={reps}
                            onChangeText={setReps}
                            onSubmitEditing={handleAddSet}
                            returnKeyType="done"
                        />
                    </>
                )}

                {/* RPE Button */}
                {canAccessRpe ? (
                <TouchableOpacity
                    onPress={() => setShowRpeSelector(!showRpeSelector)}
                    style={[
                        styles.rpeInputBtn,
                        rpe !== null && { backgroundColor: getRpeColor(rpe, colors) + '20', borderColor: getRpeColor(rpe, colors) + '50' },
                    ]}
                    activeOpacity={0.7}
                >
                    <Typography
                        variant="caption"
                        color={rpe !== null ? getRpeColor(rpe, colors) : colors.textMuted}
                        bold={rpe !== null}
                        style={{ fontSize: 11 }}
                    >
                        {rpe !== null ? rpe : 'RPE'}
                    </Typography>
                </TouchableOpacity>
                ) : (
                <View style={[styles.rpeInputBtn, { opacity: 0.5 }]}>
                    <Lock color={colors.textMuted} size={14} />
                </View>
                )}

                <TouchableOpacity
                    onPress={handleAddSet}
                    style={styles.addSetBtn}
                    activeOpacity={0.7}
                >
                    <Check color={colors.onPrimary} size={20} strokeWidth={2.6} />
                </TouchableOpacity>
            </View>

            {/* RPE Selector Row */}
            {showRpeSelector && (
                <View style={styles.rpeRow}>
                    <Typography variant="caption" color={colors.textMuted} style={{ marginRight: 6, fontSize: 10 }}>
                        RPE:
                    </Typography>
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(val => (
                        <TouchableOpacity
                            key={val}
                            style={[
                                styles.rpeChip,
                                rpe === val && {
                                    backgroundColor: getRpeColor(val, colors),
                                    borderColor: getRpeColor(val, colors),
                                },
                            ]}
                            onPress={() => {
                                setRpe(rpe === val ? null : val);
                            }}
                            activeOpacity={0.7}
                        >
                            <Typography
                                variant="caption"
                                color={rpe === val ? colors.white : colors.textSecondary}
                                bold={rpe === val}
                                style={{ fontSize: 11 }}
                            >
                                {val}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Tools: plate calculator and per-exercise notes */}
            <View style={styles.toolRow}>
                {tracking === 'weight_reps' && (
                    <TouchableOpacity onPress={() => setShowPlateCalc(true)} style={styles.toolBtn} activeOpacity={0.7}>
                        <Calculator color={colors.textSecondary} size={15} />
                        <Typography variant="caption" color={colors.textSecondary}>
                            {t('plateCalculator.title')}
                        </Typography>
                    </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotes(!showNotes)} style={[styles.toolBtn, { flexShrink: 1 }]} activeOpacity={0.7}>
                    <NotebookPen color={colors.textSecondary} size={15} />
                    <Typography variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
                        {showNotes ? t('workoutSession.hideNotes') : (log.notes || t('workoutSession.addNote'))}
                    </Typography>
                </TouchableOpacity>
            </View>
            {showNotes && (
                <TextInput
                    style={styles.exerciseNotesInput}
                    placeholder={t('workoutSession.exerciseNotePlaceholder')}
                    placeholderTextColor={colors.textMuted}
                    value={exerciseNotes}
                    onChangeText={(text) => {
                        setExerciseNotes(text);
                        updateExerciseNotes(log.id, text);
                    }}
                    multiline
                    numberOfLines={2}
                />
            )}

            {/* Plate Calculator Modal */}
            <PlateCalculator
                visible={showPlateCalc}
                onClose={() => setShowPlateCalc(false)}
                weight={plateCalcWeight}
            />

            <ExerciseInfoModal
                visible={showInfo}
                exerciseId={log.exerciseId}
                exerciseName={getExerciseName(log.exerciseId, t, log.exerciseName)}
                onClose={() => setShowInfo(false)}
            />
        </Card>
    );
};

// ── Mood options ────────────────────────────────────────
const MOOD_OPTIONS = [
    { value: 1, emoji: '😴', label: 'Low' },
    { value: 2, emoji: '😕', label: 'Meh' },
    { value: 3, emoji: '😐', label: 'OK' },
    { value: 4, emoji: '💪', label: 'Good' },
    { value: 5, emoji: '🔥', label: 'Great' },
];

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 14,
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    timerBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: colors.success,
    },
    tabular: {
        fontVariant: ['tabular-nums'],
    },
    inlineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    restBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        height: 36,
        minWidth: 36,
        paddingHorizontal: 10,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        marginLeft: 8,
    },
    restBadgeActive: {
        backgroundColor: colors.primarySoft,
    },
    restBadgeComplete: {
        backgroundColor: colors.successSoft,
    },
    emptyCard: {
        marginTop: 20,
        paddingVertical: 36,
        alignItems: 'center',
        gap: 12,
        borderStyle: 'dashed',
    },
    emptyIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    exerciseCard: {
        padding: spacing.m,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    cardActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
    },
    planBox: {
        marginBottom: 10,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        gap: 4,
    },
    planLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
    },
    planText: {
        flex: 1,
        fontSize: 12.5,
        lineHeight: 17,
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
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        marginBottom: 4,
    },
    colSet: {
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    colVal: {
        flex: 1,
        textAlign: 'center',
        fontVariant: ['tabular-nums'],
    },
    colRpe: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    // Badges
    setBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: colors.textMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rpeBadge: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: borderRadius.s,
        borderWidth: 1,
    },

    // Input row
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
        gap: 8,
    },
    input: {
        flex: 1,
        minWidth: 0,
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        height: 44,
        borderRadius: borderRadius.m,
        paddingHorizontal: 6,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: '600',
    },
    rpeInputBtn: {
        height: 44,
        width: 44,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    addSetBtn: {
        height: 44,
        width: 44,
        borderRadius: borderRadius.m,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // RPE selector
    rpeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'center',
    },
    rpeChip: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
    },

    // Tools row (plate calculator, notes)
    toolRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 12,
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        height: 32,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
    },

    notesInput: {
        backgroundColor: colors.surface,
        color: colors.text,
        width: '100%',
        minHeight: 84,
        borderRadius: borderRadius.l,
        paddingHorizontal: 16,
        paddingTop: 14,
        marginTop: 16,
        textAlignVertical: 'top',
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    deleteBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 4,
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
    positionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.s,
        marginRight: 10,
    },

    // ── Link mode styles ──────────────────────────────────
    linkBanner: {
        backgroundColor: colors.secondarySoft,
        borderRadius: borderRadius.l,
        padding: 14,
        marginBottom: 14,
    },
    linkBannerContent: {
        marginBottom: 8,
    },
    linkBannerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    linkCheckbox: {
        position: 'absolute',
        top: 16,
        left: -6,
        zIndex: 10,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: colors.surface,
        borderWidth: 1.5,
        borderColor: colors.textMuted,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkCheckboxActive: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 8,
    },

    // ── Mood styles ──────────────────────────────────────
    moodSection: {
        marginTop: 22,
        marginBottom: 4,
    },
    moodRow: {
        flexDirection: 'row',
        gap: 8,
    },
    moodChip: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    moodChipActive: {
        backgroundColor: colors.primarySoft,
        borderColor: colors.primary,
    },

    // ── Exercise notes styles ────────────────────────────
    exerciseNotesInput: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: '100%',
        minHeight: 48,
        borderRadius: borderRadius.m,
        paddingHorizontal: 12,
        paddingTop: 10,
        marginTop: 8,
        textAlignVertical: 'top',
        fontSize: 13.5,
    },
});
