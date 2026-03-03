import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollView, View, StyleSheet, TextInput, Alert, TouchableOpacity, Image, Animated } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PlateCalculator } from '../components/PlateCalculator';
import { RestTimer } from '../components/RestTimer';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { PRCelebration } from '../components/PRCelebration';
import { colors, borderRadius, spacing, shadows } from '../theme/colors';
import { ExerciseLog, Set } from '../types';
import { useTranslation } from 'react-i18next';
import {
    getSupersetType,
    getSupersetColor,
    getSupersetEmoji,
    getSupersetPositionLabel,
    getExerciseGroups,
} from '../utils/supersetUtils';

export const WorkoutSessionScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const {
        currentWorkout,
        finishWorkout,
        cancelWorkout,
        lastDetectedPRs,
        clearDetectedPRs,
        linkSuperset,
        unlinkSuperset,
    } = useWorkout();
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

    const handleSetLogged = useCallback(() => {
        setShowRestTimer(true);
        setRestCountdown(restDuration);
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

    if (!currentWorkout) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2" style={{ marginBottom: 16 }}>{t('workoutSession.noActiveWorkout')}</Typography>
                    <Button title={t('common.goBack')} variant="outline" onPress={() => navigation.goBack()} />
                </View>
            </ScreenLayout>
        );
    }

    // When finishWorkout completes, check for PRs
    useEffect(() => {
        if (pendingGoBack && lastDetectedPRs.length > 0) {
            setShowPRCelebration(true);
            setPendingGoBack(false);
        } else if (pendingGoBack && lastDetectedPRs.length === 0) {
            setPendingGoBack(false);
            navigation.goBack();
        }
    }, [pendingGoBack, lastDetectedPRs]);

    const handleDismissPR = () => {
        setShowPRCelebration(false);
        clearDetectedPRs();
        navigation.goBack();
    };

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
                await finishWorkout(notes);
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
                    <Typography variant="h2">{currentWorkout.name}</Typography>
                    <View style={styles.headerStats}>
                        <View style={styles.timerBadge}>
                            <Typography variant="bodySmall" color={colors.primary} bold>
                                ⏱ {formatTime(elapsed)}
                            </Typography>
                        </View>
                        <Typography variant="caption" style={{ marginLeft: 12 }}>
                            {totalSets} {t('common.sets')} • {totalVolume > 0 ? `${totalVolume.toLocaleString()} ${t('common.kg')}` : '—'}
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
                    <Typography
                        variant="bodySmall"
                        color={
                            restCountdown === null
                                ? colors.textSecondary
                                : restCountdown <= 0
                                    ? colors.success
                                    : colors.primary
                        }
                        bold
                        style={{ fontSize: 14 }}
                    >
                        {restCountdown === null
                            ? '💤'
                            : restCountdown <= 0
                                ? `✓ ${formatRestTime(restCountdown)}`
                                : `💤 ${formatRestTime(restCountdown)}`
                        }
                    </Typography>
                </TouchableOpacity>

                <Button
                    title={t('workoutSession.finish')}
                    size="small"
                    onPress={handleFinish}
                    style={{ marginLeft: 8 }}
                />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 160 }} showsVerticalScrollIndicator={false}>
                {currentWorkout.exercises.length === 0 ? (
                    <Card variant="outlined" style={{ marginTop: 20, paddingVertical: 40 }}>
                        <Typography variant="body" color={colors.textMuted} align="center">
                            {t('workoutSession.noExercises')}
                        </Typography>
                    </Card>
                ) : (
                    <>
                        {/* Link Mode Banner */}
                        {isLinkMode && (
                            <View style={styles.linkBanner}>
                                <View style={styles.linkBannerContent}>
                                    <Typography variant="bodySmall" color={colors.secondary} bold>
                                        🔗 {t('superset.selectExercises')}
                                    </Typography>
                                    <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                        {t('superset.selectHint')}
                                    </Typography>
                                </View>
                                <View style={styles.linkBannerActions}>
                                    <TouchableOpacity
                                        onPress={() => { setIsLinkMode(false); setSelectedForLink([]); }}
                                        style={styles.linkCancelBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Typography variant="bodySmall" color={colors.textSecondary}>
                                            {t('common.cancel')}
                                        </Typography>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={handleConfirmLink}
                                        style={[
                                            styles.linkConfirmBtn,
                                            selectedForLink.length < 2 && { opacity: 0.4 },
                                        ]}
                                        activeOpacity={0.7}
                                        disabled={selectedForLink.length < 2}
                                    >
                                        <Typography variant="bodySmall" color={colors.black} bold>
                                            {t('superset.link')} ({selectedForLink.length})
                                        </Typography>
                                    </TouchableOpacity>
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
                                                <Typography variant="bodySmall" color={selectedForLink.includes(log.id) ? colors.black : colors.textMuted}>
                                                    {selectedForLink.includes(log.id) ? '✓' : '○'}
                                                </Typography>
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
                                        />
                                    </View>
                                );
                            } else {
                                // Superset group
                                const groupExercises = item.exercises;
                                const groupSize = groupExercises.length;
                                const ssType = getSupersetType(groupSize);
                                const ssColor = getSupersetColor(ssType);
                                const ssEmoji = getSupersetEmoji(ssType);
                                const ssLabel = groupSize === 2
                                    ? t('superset.superset')
                                    : groupSize >= 3
                                        ? t('superset.circuit')
                                        : t('superset.superset');

                                return (
                                    <View key={item.groupId} style={styles.supersetContainer}>
                                        {/* Superset group header */}
                                        <View style={[styles.supersetHeader, { borderColor: ssColor + '50' }]}>
                                            <View style={[styles.supersetHeaderDot, { backgroundColor: ssColor }]} />
                                            <Typography variant="caption" color={ssColor} bold style={{ fontSize: 11 }}>
                                                {ssEmoji} {ssLabel.toUpperCase()} • {groupSize} {t('common.exercises')}
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
                                                                    <Typography variant="bodySmall" color={selectedForLink.includes(log.id) ? colors.black : colors.textMuted}>
                                                                        {selectedForLink.includes(log.id) ? '✓' : '○'}
                                                                    </Typography>
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
                        onPress={() => navigation.navigate('ExerciseList')}
                        style={{ flex: 1 }}
                    />
                    {currentWorkout.exercises.length >= 2 && !isLinkMode && (
                        <TouchableOpacity
                            onPress={handleToggleLinkMode}
                            style={styles.linkModeBtn}
                            activeOpacity={0.7}
                        >
                            <Typography variant="bodySmall" color={colors.secondary} bold>
                                🔗 {t('superset.linkExercises')}
                            </Typography>
                        </TouchableOpacity>
                    )}
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
                    style={{ marginTop: 12, alignSelf: 'center' }}
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

// RPE Color based on exertion level
const getRpeColor = (rpe: number): string => {
    if (rpe <= 5) return colors.success;
    if (rpe <= 7) return colors.warning;
    if (rpe <= 8) return '#FF9800';
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
}: {
    log: ExerciseLog;
    index: number;
    onSetLogged: () => void;
    showModal: (title: string, message: string, onConfirm?: () => void, variant?: any) => void;
    positionLabel: string | null;
    supersetColor: string | undefined;
    isLinkMode: boolean;
    isSelected: boolean;
    onUnlink: (() => void) | undefined;
    isLastInGroup?: boolean;
}) => {
    const { t } = useTranslation();
    const { logSet, deleteSet, removeExerciseFromWorkout } = useWorkout();
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');
    const [rpe, setRpe] = useState<number | null>(null);
    const [showRpeSelector, setShowRpeSelector] = useState(false);
    const [showPlateCalc, setShowPlateCalc] = useState(false);

    const handleAddSet = () => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);

        if (isNaN(w) || isNaN(r) || w < 0 || r <= 0) {
            showModal(t('workoutSession.invalidInput'), t('workoutSession.invalidInputMessage'), undefined, 'danger');
            return;
        }

        logSet(log.id, {
            weight: w,
            reps: r,
            type: 'normal',
            ...(rpe !== null ? { rpe } : {}),
        });
        setReps('');
        setRpe(null);
        onSetLogged(); // trigger rest timer
    };

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
                        <View style={[styles.positionBadge, { backgroundColor: supersetColor + '25', borderColor: supersetColor + '50' }]}>
                            <Typography variant="caption" color={supersetColor} bold style={{ fontSize: 11 }}>
                                {positionLabel}
                            </Typography>
                        </View>
                    )}
                    <View style={{ flex: 1 }}>
                        <Typography variant="h3">{log.exerciseName}</Typography>
                        {log.sets.length > 0 && (
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {log.sets.length} {t('common.sets')} • {exerciseVolume} {t('common.kg')}
                            </Typography>
                        )}
                    </View>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    {onUnlink && (
                        <TouchableOpacity
                            onPress={onUnlink}
                            style={styles.unlinkBtn}
                        >
                            <Typography variant="caption" color={colors.secondary} style={{ fontSize: 10 }}>
                                {t('superset.unlink')}
                            </Typography>
                        </TouchableOpacity>
                    )}
                    <TouchableOpacity
                        onPress={() => removeExerciseFromWorkout(log.id)}
                        style={styles.removeBtn}
                    >
                        <Typography variant="caption" color={colors.error} style={{ fontSize: 11 }}>
                            {t('workoutSession.remove')}
                        </Typography>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Table Header */}
            <View style={[styles.row, styles.tableHeader]}>
                <Typography variant="label" style={styles.colSet}>{t('common.set')}</Typography>
                <Typography variant="label" style={styles.colVal}>{t('common.kgLabel')}</Typography>
                <Typography variant="label" style={styles.colVal}>{t('common.repsLabel')}</Typography>
                <Typography variant="label" style={styles.colRpe}>{t('common.rpe')}</Typography>
                <View style={{ width: 36 }} />
            </View>

            {/* Logged Sets */}
            {log.sets.map((set: Set, i: number) => (
                <View key={set.id} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
                    <View style={[styles.colSet, styles.setBadge]}>
                        <Typography variant="bodySmall" color={colors.text} bold align="center">
                            {i + 1}
                        </Typography>
                    </View>
                    <Typography variant="body" style={styles.colVal} bold>{set.weight}</Typography>
                    <Typography variant="body" style={styles.colVal}>{set.reps}</Typography>
                    <View style={styles.colRpe}>
                        {set.rpe ? (
                            <View style={[styles.rpeBadge, { backgroundColor: getRpeColor(set.rpe) + '20', borderColor: getRpeColor(set.rpe) + '50' }]}>
                                <Typography variant="caption" color={getRpeColor(set.rpe)} bold style={{ fontSize: 11 }}>
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
                        <Typography variant="body" color={colors.error}>✕</Typography>
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

                <TextInput
                    style={styles.input}
                    placeholder={t('common.kg')}
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

                {/* RPE Button */}
                <TouchableOpacity
                    onPress={() => setShowRpeSelector(!showRpeSelector)}
                    style={[
                        styles.rpeInputBtn,
                        rpe !== null && { backgroundColor: getRpeColor(rpe) + '20', borderColor: getRpeColor(rpe) + '50' },
                    ]}
                    activeOpacity={0.7}
                >
                    <Typography
                        variant="caption"
                        color={rpe !== null ? getRpeColor(rpe) : colors.textMuted}
                        bold={rpe !== null}
                        style={{ fontSize: 11 }}
                    >
                        {rpe !== null ? rpe : 'RPE'}
                    </Typography>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={handleAddSet}
                    style={styles.addSetBtn}
                    activeOpacity={0.7}
                >
                    <Typography variant="body" color={colors.black} bold>✓</Typography>
                </TouchableOpacity>

                {/* Plate Calculator Button */}
                <TouchableOpacity
                    onPress={() => setShowPlateCalc(true)}
                    style={styles.plateCalcBtn}
                    activeOpacity={0.7}
                >
                    <Image source={require('../../assets/plate_calc.jpg')} style={{ width: 30, height: 30, borderRadius: 4 }} />
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
                                    backgroundColor: getRpeColor(val),
                                    borderColor: getRpeColor(val),
                                },
                            ]}
                            onPress={() => {
                                setRpe(rpe === val ? null : val);
                            }}
                            activeOpacity={0.7}
                        >
                            <Typography
                                variant="caption"
                                color={rpe === val ? '#FFF' : colors.textSecondary}
                                bold={rpe === val}
                                style={{ fontSize: 11 }}
                            >
                                {val}
                            </Typography>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            {/* Plate Calculator Modal */}
            <PlateCalculator
                visible={showPlateCalc}
                onClose={() => setShowPlateCalc(false)}
                weight={plateCalcWeight}
            />
        </Card>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    timerBadge: {
        backgroundColor: colors.primary + '18',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.s,
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    restBadge: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
        marginLeft: 8,
    },
    restBadgeActive: {
        backgroundColor: colors.primary + '15',
        borderColor: colors.primary + '40',
    },
    restBadgeComplete: {
        backgroundColor: colors.success + '15',
        borderColor: colors.success + '40',
    },
    exerciseCard: {
        padding: spacing.m,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    removeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.error + '40',
    },
    unlinkBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.secondary + '40',
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
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 4,
    },
    colSet: {
        width: 32,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
    },
    colVal: {
        flex: 1,
        textAlign: 'center',
    },
    colRpe: {
        width: 44,
        alignItems: 'center',
        justifyContent: 'center',
        marginHorizontal: 4,
    },
    // Badges
    setBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.border + '60',
        alignItems: 'center',
        justifyContent: 'center',
    },
    rpeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
    },

    // Input Row Container
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 8, // Use gap for consistent spacing
    },
    // Inputs expand to fill space
    input: {
        flex: 1,
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        height: 44, // Taller touch target
        borderRadius: borderRadius.s,
        paddingHorizontal: 6,
        textAlign: 'center',
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // RPE Button
    rpeInputBtn: {
        height: 44, // Match input height
        width: 44,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    // Add Button
    addSetBtn: {
        height: 44,
        width: 44,
        borderRadius: borderRadius.s,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Plate Calc Button
    plateCalcBtn: {
        height: 44,
        width: 40,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },

    // RPE Selector
    rpeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border + '40',
        flexWrap: 'wrap',
        gap: 6,
        justifyContent: 'center'
    },
    rpeChip: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },

    notesInput: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: '100%',
        minHeight: 80,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        paddingTop: 14,
        marginTop: 20,
        textAlignVertical: 'top',
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    deleteBtn: {
        width: 40,
        height: 40,
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
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderTopLeftRadius: borderRadius.m,
        borderTopRightRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight + '60',
    },
    supersetHeaderDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        marginRight: 8,
    },
    supersetBody: {
        flexDirection: 'row',
    },
    supersetSidebar: {
        width: 3,
        borderBottomLeftRadius: 3,
        marginBottom: 12,
    },
    supersetExercises: {
        flex: 1,
    },
    positionBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        marginRight: 10,
    },

    // ── Link mode styles ──────────────────────────────────
    linkBanner: {
        backgroundColor: colors.secondary + '12',
        borderWidth: 1,
        borderColor: colors.secondary + '30',
        borderRadius: borderRadius.m,
        padding: 14,
        marginBottom: 16,
    },
    linkBannerContent: {
        marginBottom: 10,
    },
    linkBannerActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
    },
    linkCancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    linkConfirmBtn: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: borderRadius.s,
        backgroundColor: colors.secondary,
    },
    linkCheckbox: {
        position: 'absolute',
        top: 10,
        left: -4,
        zIndex: 10,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLight,
        borderWidth: 2,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    linkCheckboxActive: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    linkModeBtn: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: borderRadius.s,
        backgroundColor: colors.secondary + '15',
        borderWidth: 1,
        borderColor: colors.secondary + '30',
        marginLeft: 8,
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 20,
    },
});
