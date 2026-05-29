import React, { useState, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useWorkout } from '../context/WorkoutContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { borderRadius } from '../theme/colors';
import { AIGeneratedExercise, AIGeneratedWorkout } from '../types';
import { useTranslation } from 'react-i18next';
import { getExerciseName } from '../constants/exercises';
import { useTheme } from '../context/ThemeContext';
import { StorageService } from '../services/storage';
import { generateId } from '../utils/generateId';
import { PlayCircle, Sparkles, RefreshCw, Trash2, ChevronLeft, Zap } from 'lucide-react-native';
import { useAction, useQuery } from 'convex/react';
import { useAuth } from '@clerk/clerk-expo';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';

const AI_COLOR = '#8B5CF6';

export const AIWorkoutPreviewScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { currentWorkout, startWorkout, addExerciseToWorkout } = useWorkout();
    const { userId: clerkUserId } = useAuth();
    const generateWorkoutAction = useAction(api.aiWorkout.generateWorkout);

    const convexUser = useQuery(
        api.users.getUserByClerkId,
        clerkUserId ? { clerkId: clerkUserId } : "skip"
    );

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
        const comment = route.params?.userComment?.trim();
        try {
            const result = await generateWorkoutAction({
                userId: convexUser._id as Id<"users">,
                ...(comment ? { userComment: comment } : {}),
            });
            setWorkout(result as AIGeneratedWorkout);
        } catch (error) {
            showModal(
                t('aiWorkout.errorTitle'),
                t('aiWorkout.errorMessage'),
            );
        } finally {
            setRegenerating(false);
        }
    }, [convexUser, regenerating, generateWorkoutAction, t, route.params?.userComment]);

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

        // 1. Auto-create custom exercises for any "isNew" exercises
        for (const ex of workout.exercises) {
            if (ex.isNew) {
                const customExercise = {
                    id: `custom-ai-${generateId()}`,
                    name: ex.exerciseName,
                    category: (ex.category as 'strength' | 'cardio' | 'flexibility') || 'strength',
                    muscleGroup: ex.muscleGroup || 'Other',
                    isCustom: true,
                };
                await StorageService.addCustomExercise(customExercise);
                // Update the exercise in our local workout data with the new ID
                ex.exerciseId = customExercise.id;
                ex.isNew = false;
            }
        }

        // 2. Start the workout
        startWorkout(workout.workoutName);

        // 3. Add exercises (small delay to ensure workout is created)
        setTimeout(() => {
            workout.exercises.forEach(ex => {
                addExerciseToWorkout({
                    id: ex.exerciseId || `custom-ai-${generateId()}`,
                    name: ex.exerciseName,
                    category: (ex.category as 'strength' | 'cardio' | 'flexibility') || 'strength',
                    muscleGroup: ex.muscleGroup || '',
                    isCustom: !!ex.isNew,
                });
            });
            navigation.replace('WorkoutSession');
        }, 100);
    }, [currentWorkout, workout, startWorkout, addExerciseToWorkout, navigation, t]);

    const totalExercises = workout.exercises.length;
    const totalSets = workout.exercises.reduce((acc, ex) => acc + ex.sets, 0);

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Back Button */}
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <ChevronLeft color={colors.primary} size={18} />
                        <Typography variant="body" color={colors.primary}>{t('common.goBack')}</Typography>
                    </View>
                </TouchableOpacity>

                {/* Header Card */}
                <Card style={styles.headerCard}>
                    <View style={[styles.headerAccent, { backgroundColor: AI_COLOR }]} />
                    <View style={styles.headerContent}>
                        {/* AI Badge */}
                        <View style={styles.aiBadge}>
                            <Sparkles color={AI_COLOR} size={14} />
                            <Typography variant="caption" color={AI_COLOR} bold style={{ fontSize: 11 }}>
                                {t('aiWorkout.aiGenerated')}
                            </Typography>
                        </View>

                        {/* Icon */}
                        <View style={[styles.bigIcon, { backgroundColor: AI_COLOR + '20' }]}>
                            <Zap color={AI_COLOR} size={32} />
                        </View>

                        {/* Title */}
                        <Typography variant="h1" style={{ marginTop: 12, textAlign: 'center' }}>
                            {workout.workoutName}
                        </Typography>

                        {/* Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Typography variant="h2" color={AI_COLOR}>{totalExercises}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                                    {t('common.exercises')}
                                </Typography>
                            </View>
                            <View style={styles.statBox}>
                                <Typography variant="h2" color={AI_COLOR}>{totalSets}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>
                                    {t('common.sets')}
                                </Typography>
                            </View>
                        </View>

                        {/* Reasoning */}
                        <View style={styles.reasoningBox}>
                            <Typography variant="label" color={AI_COLOR} style={{ marginBottom: 6, fontSize: 11 }}>
                                💡 {t('aiWorkout.reasoning')}
                            </Typography>
                            <Typography variant="body" color={colors.textSecondary} style={{ lineHeight: 20, fontSize: 13 }}>
                                {workout.reasoning}
                            </Typography>
                        </View>
                    </View>
                </Card>

                {/* Exercise List */}
                <Typography variant="h3" style={styles.sectionTitle}>
                    {t('programs.schedule')}
                </Typography>

                <Card style={styles.exerciseCard}>
                    {/* Table Header */}
                    <View style={styles.tableHeader}>
                        <Typography variant="label" style={styles.colExercise}>{t('programs.exercise')}</Typography>
                        <Typography variant="label" style={styles.colSets}>{t('common.sets')}</Typography>
                        <Typography variant="label" style={styles.colReps}>{t('common.reps')}</Typography>
                        <Typography variant="label" style={styles.colRest}>{t('programs.rest')}</Typography>
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
                                            {ex.isNew && (
                                                <View style={styles.newBadge}>
                                                    <Typography variant="caption" color="#fff" bold style={{ fontSize: 8 }}>
                                                        {t('aiWorkout.newExercise')}
                                                    </Typography>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                    {!ex.isNew && ex.exerciseId && (
                                        <TouchableOpacity
                                            style={styles.infoBtn}
                                            onPress={() => {
                                                setSelectedExercise({
                                                    id: ex.exerciseId!,
                                                    name: getExerciseName(ex.exerciseId!, t, ex.exerciseName),
                                                });
                                                setInfoModalVisible(true);
                                            }}
                                        >
                                            <PlayCircle color={colors.primary} size={18} />
                                        </TouchableOpacity>
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
                                    <Trash2 color={colors.error} size={16} />
                                </TouchableOpacity>
                            </View>
                            {ex.notes && (
                                <View style={styles.noteRow}>
                                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10, fontStyle: 'italic' }}>
                                        💡 {ex.notes}
                                    </Typography>
                                </View>
                            )}
                        </View>
                    ))}
                </Card>

                {/* Action Buttons */}
                <View style={styles.actionsContainer}>
                    <Button
                        title={`${t('aiWorkout.startWorkout')} 🔥`}
                        onPress={handleStartWorkout}
                        size="large"
                        fullWidth
                        style={{ marginBottom: 12 }}
                    />

                    <TouchableOpacity
                        style={styles.regenerateBtn}
                        onPress={handleRegenerate}
                        disabled={regenerating}
                        activeOpacity={0.7}
                    >
                        {regenerating ? (
                            <ActivityIndicator size="small" color={AI_COLOR} />
                        ) : (
                            <RefreshCw color={AI_COLOR} size={18} />
                        )}
                        <Typography variant="body" color={AI_COLOR} bold style={{ marginLeft: 8 }}>
                            {regenerating ? t('aiWorkout.generating') : t('aiWorkout.regenerate')}
                        </Typography>
                    </TouchableOpacity>
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

const createStyles = (colors: any) => StyleSheet.create({
    backBtn: {
        paddingVertical: 8,
        marginBottom: 4,
    },
    headerCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 8,
    },
    headerAccent: {
        height: 4,
        width: '100%',
    },
    headerContent: {
        padding: 20,
        alignItems: 'center',
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: AI_COLOR + '15',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 20,
        marginBottom: 8,
    },
    bigIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    statsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
        width: '100%',
    },
    statBox: {
        flex: 1,
        alignItems: 'center',
        backgroundColor: colors.surfaceLight,
        paddingVertical: 12,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
    },
    reasoningBox: {
        marginTop: 16,
        width: '100%',
        backgroundColor: AI_COLOR + '08',
        borderRadius: borderRadius.m,
        padding: 14,
        borderWidth: 1,
        borderColor: AI_COLOR + '20',
    },
    sectionTitle: {
        marginTop: 20,
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
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: borderRadius.xs,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '40',
    },
    noteRow: {
        paddingHorizontal: 14,
        paddingBottom: 6,
        marginTop: -4,
    },
    colExercise: {
        flex: 3,
    },
    colSets: {
        width: 36,
        textAlign: 'center',
    },
    colReps: {
        width: 56,
        textAlign: 'center',
    },
    colRest: {
        width: 40,
        textAlign: 'center',
    },
    newBadge: {
        backgroundColor: AI_COLOR,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    infoBtn: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: borderRadius.s,
        borderWidth: 1,
        borderColor: colors.border,
        marginLeft: 4,
    },
    removeBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    actionsContainer: {
        marginTop: 20,
        alignItems: 'center',
    },
    regenerateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: borderRadius.m,
        backgroundColor: AI_COLOR + '10',
        borderWidth: 1,
        borderColor: AI_COLOR + '25',
    },
});
