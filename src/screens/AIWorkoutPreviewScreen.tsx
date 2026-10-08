import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useWorkout } from '../context/WorkoutContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { borderRadius, ThemeColors } from '../theme/colors';
import { AIGeneratedExercise, AIGeneratedWorkout } from '../types';
import { useTranslation } from 'react-i18next';
import { getExerciseName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';
import { StorageService } from '../services/storage';
import { generateId } from '../utils/generateId';
import { PlayCircle, Sparkles, RefreshCw, Trash2, Lightbulb, Flame, Target, Play, ListChecks, Layers, Clock } from 'lucide-react-native';
import { BackArrow } from '../components/DirectionalIcons';
import { IconButton } from '../components/IconButton';
import { StatTile } from '../components/StatTile';
import { useAction, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';

export const AIWorkoutPreviewScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { currentWorkout, startPlannedWorkout, refreshData } = useWorkout();
    const { weightUnit, displayWeight } = useUnits();
    const generateWorkoutAction = useAction(api.aiWorkout.generateWorkout);

    const convexUser = useQuery(api.users.me);

    const [workout, setWorkout] = useState<AIGeneratedWorkout>(route.params.workout);
    const [regenerating, setRegenerating] = useState(false);

    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<{ id: string; name: string } | null>(null);

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

    // ── Remove an exercise from the preview ──
    const handleRemoveExercise = useCallback((index: number) => {
        setWorkout(prev => ({
            ...prev,
            exercises: prev.exercises.filter((_, i) => i !== index),
        }));
    }, []);

    // ── Regenerate workout ──
    const handleRegenerate = useCallback(async () => {
        if (!convexUser?._id || regenerating) return;
        setRegenerating(true);
        try {
            const result = await generateWorkoutAction(route.params?.options ?? {});
            setWorkout(result as AIGeneratedWorkout);
        } catch (error) {
            showModal(
                t('aiWorkout.errorTitle'),
                t('aiWorkout.errorMessage'),
            );
        } finally {
            setRegenerating(false);
        }
    }, [convexUser, regenerating, generateWorkoutAction, t, route.params?.options]);

    // ── Start the workout ──
    const handleStartWorkout = useCallback(async () => {
        if (currentWorkout) {
            showModal(
                t('aiWorkout.workoutActiveTitle'),
                t('aiWorkout.workoutActiveMessage'),
            );
            return;
        }

        if (workout.exercises.length === 0) return;

        // 1. Save exercises the coach invented as custom exercises
        const resolved: { id: string; ex: AIGeneratedExercise }[] = [];
        let addedCustom = false;
        for (const ex of workout.exercises) {
            if (ex.isNew || !ex.exerciseId) {
                const customExercise = {
                    id: `custom-ai-${generateId()}`,
                    name: ex.exerciseName,
                    category: (ex.category as 'strength' | 'cardio' | 'flexibility') || 'strength',
                    muscleGroup: ex.muscleGroup || 'My Exercises',
                    isCustom: true,
                };
                await StorageService.addCustomExercise(customExercise);
                addedCustom = true;
                resolved.push({ id: customExercise.id, ex });
            } else {
                resolved.push({ id: ex.exerciseId, ex });
            }
        }
        if (addedCustom) await refreshData();

        // 2. Start the session with the plan attached, so the coach can compare plan vs. actual later
        startPlannedWorkout(
            workout.workoutName,
            { type: 'ai', reasoning: workout.reasoning },
            resolved.map(({ id, ex }) => ({
                exercise: { id, name: ex.exerciseName },
                supersetGroup: ex.supersetGroup,
                target: {
                    sets: ex.sets,
                    reps: ex.reps,
                    restSeconds: ex.restSeconds,
                    ...(ex.targetWeight ? { weight: ex.targetWeight } : {}),
                    ...(ex.notes ? { notes: ex.notes } : {}),
                },
            })),
        );
        navigation.replace('WorkoutSession');
    }, [currentWorkout, workout, startPlannedWorkout, refreshData, navigation, t]);

    const totalExercises = workout.exercises.length;
    const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets, 0);

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Back Button */}
                <View style={styles.topBar}>
                    <IconButton
                        icon={c => <BackArrow color={c} size={20} />}
                        onPress={() => navigation.goBack()}
                        accessibilityLabel={t('common.goBack')}
                    />
                </View>

                {/* Header Card */}
                <Card style={styles.headerCard}>
                    {/* AI Badge */}
                    <View style={styles.aiBadge}>
                        <Sparkles color={colors.secondary} size={13} />
                        <Typography variant="caption" color={colors.secondary} bold>
                            {t('aiWorkout.aiGenerated')}
                        </Typography>
                    </View>

                    {/* Title */}
                    <Typography variant="h1" align="center" style={{ marginTop: 10 }}>
                        {workout.workoutName}
                    </Typography>

                    {/* Reasoning */}
                    <View style={styles.reasoningBox}>
                        <View style={styles.boxTitle}>
                            <Lightbulb color={colors.secondary} size={14} />
                            <Typography variant="label" color={colors.secondary}>
                                {t('aiWorkout.reasoning')}
                            </Typography>
                        </View>
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>
                            {workout.reasoning}
                        </Typography>
                    </View>

                    {!!workout.warmup && (
                        <View style={[styles.reasoningBox, { marginTop: 8 }]}>
                            <View style={styles.boxTitle}>
                                <Flame color={colors.accent} size={14} />
                                <Typography variant="label" color={colors.accent}>
                                    {t('aiWorkout.warmup')}
                                </Typography>
                            </View>
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>
                                {workout.warmup}
                            </Typography>
                        </View>
                    )}
                </Card>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <StatTile compact value={totalExercises} label={t('common.exercises')} icon={c => <ListChecks color={c} size={14} />} tone="secondary" />
                    <StatTile compact value={totalSets} label={t('common.sets')} icon={c => <Layers color={c} size={14} />} tone="secondary" />
                    {!!workout.estimatedMinutes && (
                        <StatTile compact value={workout.estimatedMinutes} label={t('common.min')} icon={c => <Clock color={c} size={14} />} tone="secondary" />
                    )}
                </View>

                {/* Exercise List */}
                <Typography variant="h3" style={styles.sectionTitle}>
                    {t('programs.schedule')}
                </Typography>

                <Card style={styles.exerciseCard}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colExercise}>{t('programs.exercise')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colSets}>{t('common.sets')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colReps}>{t('common.reps')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colRest}>{t('programs.rest')}</Typography>
                        <View style={{ width: 36 }} />
                    </View>

                    {/* Exercise Rows */}
                    {workout.exercises.map((ex, index) => (
                        <View key={`${ex.exerciseName}-${index}`}>
                            <View style={[styles.exerciseRow, index % 2 === 0 && styles.rowAlt]}>
                                <View style={[styles.colExercise, { flexDirection: 'row', alignItems: 'center', paddingRight: 4 }]}>
                                    <View style={{ flex: 1 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                            <Typography variant="bodySmall" numberOfLines={2} style={{ flex: 1 }}>
                                                {ex.isNew ? ex.exerciseName : getExerciseName(ex.exerciseId || '', t, ex.exerciseName)}
                                            </Typography>
                                            {!!ex.supersetGroup && (
                                                <View style={[styles.newBadge, { backgroundColor: colors.primarySoft }]}>
                                                    <Typography variant="caption" color={colors.primary} bold style={styles.badgeText}>
                                                        {ex.supersetGroup}
                                                    </Typography>
                                                </View>
                                            )}
                                            {ex.isNew && (
                                                <View style={styles.newBadge}>
                                                    <Typography variant="caption" color={colors.secondary} bold style={styles.badgeText}>
                                                        {t('aiWorkout.newExercise')}
                                                    </Typography>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    {!ex.isNew && ex.exerciseId && (
                                        <IconButton
                                            icon={c => <PlayCircle color={c} size={17} />}
                                            variant="tonal"
                                            tone="primary"
                                            size={32}
                                            style={{ marginLeft: 4 }}
                                            onPress={() => {
                                                setSelectedExercise({
                                                    id: ex.exerciseId!,
                                                    name: getExerciseName(ex.exerciseId!, t, ex.exerciseName),
                                                });
                                                setInfoModalVisible(true);
                                            }}
                                            accessibilityLabel={getExerciseName(ex.exerciseId!, t, ex.exerciseName)}
                                        />
                                    )}
                                </View>
                                <Typography variant="bodySmall" style={styles.colSets} bold>{ex.sets}</Typography>
                                <Typography variant="bodySmall" style={styles.colReps} color={colors.primary}>{ex.reps}</Typography>
                                <Typography variant="caption" style={styles.colRest} color={colors.textMuted}>
                                    {ex.restSeconds >= 60 ? `${Math.floor(ex.restSeconds / 60)}m` : `${ex.restSeconds}s`}
                                    {ex.restSeconds >= 60 && ex.restSeconds % 60 > 0 ? `${ex.restSeconds % 60}s` : ''}
                                </Typography>
                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemoveExercise(index)}
                                    activeOpacity={0.7}
                                >
                                    <Trash2 color={colors.textMuted} size={16} />
                                </TouchableOpacity>
                            </View>
                            {(!!ex.notes || !!ex.targetWeight) && (
                                <View style={styles.noteRow}>
                                    {!!ex.targetWeight && (
                                        <View style={styles.noteLine}>
                                            <Target color={colors.primary} size={12} />
                                            <Typography variant="caption" color={colors.primary} bold style={{ fontSize: 11.5 }}>
                                                {t('aiWorkout.targetLoad', { weight: `${Math.round(displayWeight(ex.targetWeight) * 2) / 2} ${weightUnit}` })}
                                            </Typography>
                                        </View>
                                    )}
                                    {!!ex.notes && (
                                        <View style={styles.noteLine}>
                                            <Lightbulb color={colors.textMuted} size={12} />
                                            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11.5, flex: 1 }}>
                                                {ex.notes}
                                            </Typography>
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    ))}
                </Card>

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    <Button
                        title={t('aiWorkout.startWorkout')}
                        onPress={handleStartWorkout}
                        size="large"
                        fullWidth
                        icon={c => <Play color={c} size={18} fill={c} />}
                    />

                    <Button
                        title={regenerating ? t('aiWorkout.generating') : t('aiWorkout.regenerate')}
                        variant="ai"
                        onPress={handleRegenerate}
                        disabled={regenerating}
                        loading={regenerating}
                        fullWidth
                        icon={c => <RefreshCw color={c} size={17} />}
                    />
                </View>
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

            <ExerciseInfoModal
                visible={infoModalVisible}
                exerciseId={selectedExercise?.id || null}
                exerciseName={selectedExercise?.name || ''}
                onClose={() => setInfoModalVisible(false)}
            />
        </ScreenLayout>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        paddingTop: 4,
        paddingBottom: 12,
    },
    headerCard: {
        padding: 20,
        alignItems: 'center',
        marginBottom: 10,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.secondarySoft,
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    reasoningBox: {
        marginTop: 16,
        width: '100%',
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        padding: 14,
    },
    boxTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    sectionTitle: {
        marginTop: 24,
        marginBottom: 12,
    },
    exerciseCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 8,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '80',
    },
    noteRow: {
        paddingHorizontal: 14,
        paddingBottom: 8,
        marginTop: -4,
        gap: 3,
    },
    noteLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    colExercise: {
        flex: 3,
    },
    colSets: {
        width: 44,
        textAlign: 'center',
    },
    colReps: {
        width: 56,
        textAlign: 'center',
    },
    colRest: {
        width: 48,
        textAlign: 'center',
    },
    newBadge: {
        backgroundColor: colors.secondarySoft,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    badgeText: {
        fontSize: 10,
        lineHeight: 14,
    },
    removeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsContainer: {
        marginTop: 20,
        gap: 10,
    },
});
