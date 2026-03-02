import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useWorkout } from '../context/WorkoutContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { PROGRAMS } from '../constants/programs';
import { ProgramDay, ProgramExercise, WorkoutProgram } from '../types';
import { useTranslation } from 'react-i18next';

const LEVEL_ICONS: Record<string, string> = {
    beginner: '🟢',
    intermediate: '🟡',
    advanced: '🔴',
};

const GOAL_ICONS: Record<string, string> = {
    strength: '🏋️',
    hypertrophy: '💪',
    general: '⚡',
    fat_loss: '🔥',
};

export const ProgramDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { programId } = route.params;
    const program = PROGRAMS.find(p => p.id === programId);
    const { currentWorkout, startWorkout, addExerciseToWorkout } = useWorkout();
    const [expandedDay, setExpandedDay] = useState<number>(0);

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

    if (!program) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2">{t('programs.notFound')}</Typography>
                    <Button title={t('common.goBack')} variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
                </View>
            </ScreenLayout>
        );
    }

    const handleStartDay = (day: ProgramDay) => {
        if (currentWorkout) {
            showModal(
                t('programs.workoutActiveTitle'),
                t('programs.workoutActiveMessage'),
                undefined,
                'primary'
            );
            return;
        }

        const workoutName = `${program.name} — ${day.name}`;
        startWorkout(workoutName);

        // Small delay to ensure workout is created before adding exercises
        setTimeout(() => {
            day.exercises.forEach(ex => {
                addExerciseToWorkout({
                    id: ex.exerciseId,
                    name: ex.exerciseName,
                    category: 'strength',
                    muscleGroup: '',
                    isCustom: false,
                });
            });
            navigation.navigate('WorkoutSession');
        }, 100);
    };

    const totalExercises = program.days.reduce((acc, d) => acc + d.exercises.length, 0);

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Back Button */}
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} activeOpacity={0.7}>
                    <Typography variant="body" color={colors.primary}>← {t('common.goBack')}</Typography>
                </TouchableOpacity>

                {/* Program Header Card */}
                <Card style={styles.headerCard}>
                    <View style={[styles.headerAccent, { backgroundColor: program.color }]} />
                    <View style={styles.headerContent}>
                        <View style={[styles.bigIcon, { backgroundColor: program.color + '20' }]}>
                            <Typography variant="h1" style={{ fontSize: 36 }}>{program.icon}</Typography>
                        </View>
                        <Typography variant="h1" style={{ marginTop: 12 }}>{program.name}</Typography>

                        {/* Tags */}
                        <View style={styles.tagRow}>
                            <View style={[styles.tag, { backgroundColor: program.color + '20' }]}>
                                <Typography variant="caption" color={program.color} bold style={{ fontSize: 11 }}>
                                    {LEVEL_ICONS[program.level]} {t(`programs.levels.${program.level}`)}
                                </Typography>
                            </View>
                            <View style={[styles.tag, { backgroundColor: colors.surfaceLight }]}>
                                <Typography variant="caption" color={colors.textSecondary} style={{ fontSize: 11 }}>
                                    {GOAL_ICONS[program.goal] || '🎯'} {t(`programs.goals.${program.goal}`)}
                                </Typography>
                            </View>
                        </View>

                        {/* Description */}
                        <Typography variant="body" color={colors.textSecondary} style={{ marginTop: 14, lineHeight: 22 }}>
                            {program.description}
                        </Typography>

                        {/* Stats */}
                        <View style={styles.statsRow}>
                            <View style={styles.statBox}>
                                <Typography variant="h2" color={program.color}>{program.daysPerWeek}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t('programs.daysPerWeek')}</Typography>
                            </View>
                            <View style={styles.statBox}>
                                <Typography variant="h2" color={program.color}>{totalExercises}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t('common.exercises')}</Typography>
                            </View>
                            <View style={styles.statBox}>
                                <Typography variant="h2" color={program.color} style={{ fontSize: 16 }}>{program.duration}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t('programs.duration')}</Typography>
                            </View>
                        </View>
                    </View>
                </Card>

                {/* Day Cards */}
                <Typography variant="h3" style={styles.sectionTitle}>{t('programs.schedule')}</Typography>

                {program.days.map((day, dayIndex) => {
                    const isExpanded = expandedDay === dayIndex;

                    return (
                        <Card key={dayIndex} style={styles.dayCard}>
                            {/* Day Header (Touchable to expand) */}
                            <TouchableOpacity
                                onPress={() => setExpandedDay(isExpanded ? -1 : dayIndex)}
                                activeOpacity={0.8}
                                style={styles.dayHeader}
                            >
                                <View style={[styles.dayBadge, { backgroundColor: program.color + '20' }]}>
                                    <Typography variant="caption" color={program.color} bold style={{ fontSize: 10 }}>
                                        {day.dayLabel}
                                    </Typography>
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Typography variant="body" bold>{day.name}</Typography>
                                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11, marginTop: 1 }}>
                                        {day.exercises.length} {t('common.exercises')}
                                    </Typography>
                                </View>
                                <Typography variant="h3" color={colors.textMuted} style={{ fontSize: 18, transform: [{ rotate: isExpanded ? '90deg' : '0deg' }] }}>
                                    ›
                                </Typography>
                            </TouchableOpacity>

                            {/* Expanded Exercise List */}
                            {isExpanded && (
                                <View style={styles.exerciseList}>
                                    {/* Table Header */}
                                    <View style={styles.tableHeader}>
                                        <Typography variant="label" style={styles.colExercise}>{t('programs.exercise')}</Typography>
                                        <Typography variant="label" style={styles.colSets}>{t('common.sets')}</Typography>
                                        <Typography variant="label" style={styles.colReps}>{t('common.reps')}</Typography>
                                        <Typography variant="label" style={styles.colRest}>{t('programs.rest')}</Typography>
                                    </View>

                                    {/* Exercise Rows */}
                                    {day.exercises.map((ex, exIndex) => (
                                        <View key={exIndex}>
                                            <View style={[styles.exerciseRow, exIndex % 2 === 0 && styles.rowAlt]}>
                                                <Typography variant="bodySmall" style={styles.colExercise} numberOfLines={1}>{ex.exerciseName}</Typography>
                                                <Typography variant="bodySmall" style={styles.colSets} bold>{ex.sets}</Typography>
                                                <Typography variant="bodySmall" style={styles.colReps} color={colors.primary}>{ex.reps}</Typography>
                                                <Typography variant="caption" style={styles.colRest} color={colors.textMuted}>
                                                    {ex.restSeconds >= 60 ? `${Math.floor(ex.restSeconds / 60)}m` : `${ex.restSeconds}s`}
                                                    {ex.restSeconds >= 60 && ex.restSeconds % 60 > 0 ? `${ex.restSeconds % 60}s` : ''}
                                                </Typography>
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

                                    {/* Start This Workout Button */}
                                    <Button
                                        title={`${t('programs.startDay')} — ${day.name}`}
                                        onPress={() => handleStartDay(day)}
                                        size="medium"
                                        fullWidth
                                        style={{ marginTop: 16 }}
                                    />
                                </View>
                            )}
                        </Card>
                    );
                })}
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

const styles = StyleSheet.create({
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
    bigIcon: {
        width: 72,
        height: 72,
        borderRadius: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    tag: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: borderRadius.full,
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
    sectionTitle: {
        marginTop: 20,
        marginBottom: 12,
    },
    dayCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 8,
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    dayBadge: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.s,
    },
    exerciseList: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: borderRadius.xs,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '40',
    },
    noteRow: {
        paddingHorizontal: 4,
        paddingBottom: 4,
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
});
