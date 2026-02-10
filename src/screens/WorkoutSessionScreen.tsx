import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { PlateCalculator } from '../components/PlateCalculator';
import { RestTimer } from '../components/RestTimer';
import { colors, borderRadius, spacing, shadows } from '../theme/colors';
import { ExerciseLog, Set } from '../types';
import { useTranslation } from 'react-i18next';

export const WorkoutSessionScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { currentWorkout, finishWorkout, cancelWorkout } = useWorkout();
    const [notes, setNotes] = useState('');
    const [elapsed, setElapsed] = useState(0);
    const [showRestTimer, setShowRestTimer] = useState(false);
    const [restDuration, setRestDuration] = useState(90); // default 90s
    const [restCountdown, setRestCountdown] = useState<number | null>(null); // header countdown

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

    const handleFinish = () => {
        if (currentWorkout.exercises.length === 0) {
            Alert.alert(
                t('workoutSession.emptyWorkoutTitle'),
                t('workoutSession.emptyWorkoutMessage'),
                [{ text: t('common.ok') }]
            );
            return;
        }
        Alert.alert(t('workoutSession.finishTitle'), t('workoutSession.finishMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('workoutSession.finishConfirm'),
                onPress: async () => {
                    await finishWorkout(notes);
                    navigation.goBack();
                },
            },
        ]);
    };

    const handleCancel = () => {
        Alert.alert(t('workoutSession.cancelTitle'), t('workoutSession.cancelMessage'), [
            { text: t('common.cancel'), style: 'cancel' },
            {
                text: t('workoutSession.discard'),
                style: 'destructive',
                onPress: async () => {
                    await cancelWorkout();
                    navigation.goBack();
                },
            },
        ]);
    };

    const totalSets = currentWorkout.exercises.reduce((acc, e) => acc + e.sets.length, 0);
    const totalVolume = currentWorkout.exercises.reduce(
        (acc, e) => acc + e.sets.reduce((a, s) => a + s.weight * s.reps, 0),
        0
    );

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
                    currentWorkout.exercises.map((log, index) => (
                        <ExerciseCard key={log.id} log={log} index={index} onSetLogged={handleSetLogged} />
                    ))
                )}

                <Button
                    title={t('workoutSession.addExercise')}
                    variant="secondary"
                    onPress={() => navigation.navigate('ExerciseList')}
                    fullWidth
                    style={{ marginTop: 20 }}
                />

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

            {/* Auto Rest Timer */}
            <RestTimer
                visible={showRestTimer}
                defaultDuration={restDuration}
                onDismiss={handleDismissRest}
                onTimeChange={(newRemaining) => setRestCountdown(newRemaining)}
            />
        </ScreenLayout>
    );
};

// RPE Color based on exertion level
const getRpeColor = (rpe: number): string => {
    if (rpe <= 5) return colors.success;
    if (rpe <= 7) return colors.warning;
    if (rpe <= 8) return '#FF9800';
    return colors.error;
};

const ExerciseCard = ({ log, index, onSetLogged }: { log: ExerciseLog; index: number; onSetLogged: () => void }) => {
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
            Alert.alert(t('workoutSession.invalidInput'), t('workoutSession.invalidInputMessage'));
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
        <Card style={styles.exerciseCard}>
            {/* Exercise Header */}
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Typography variant="h3">{log.exerciseName}</Typography>
                    {log.sets.length > 0 && (
                        <Typography variant="caption" style={{ marginTop: 2 }}>
                            {log.sets.length} {t('common.sets')} • {exerciseVolume} {t('common.kg')}
                        </Typography>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => removeExerciseFromWorkout(log.id)}
                    style={styles.removeBtn}
                >
                    <Typography variant="caption" color={colors.error} style={{ fontSize: 11 }}>
                        {t('workoutSession.remove')}
                    </Typography>
                </TouchableOpacity>
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
                    <Typography variant="bodySmall" style={{ fontSize: 16 }}>🏋️</Typography>
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
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 4,
    },
    colSet: {
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colVal: {
        width: 60,
        textAlign: 'center',
    },
    colRpe: {
        width: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rpeBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
    },
    setBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLight,
        marginRight: 8,
    },
    nextBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.border + '60',
        marginRight: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    input: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: 56,
        height: 40,
        borderRadius: borderRadius.s,
        paddingHorizontal: 6,
        marginRight: 6,
        textAlign: 'center',
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    rpeInputBtn: {
        height: 40,
        paddingHorizontal: 8,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    rpeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border + '40',
        flexWrap: 'wrap',
        gap: 4,
    },
    rpeChip: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    addSetBtn: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.s,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    plateCalcBtn: {
        width: 36,
        height: 40,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
        borderWidth: 1,
        borderColor: colors.border,
    },
    notesInput: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: '100%',
        minHeight: 64,
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
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
