import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { useWorkout } from '../context/WorkoutContext';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { borderRadius, ThemeColors } from '../theme/colors';
import { PROGRAMS } from '../constants/programs';
import { ProgramDay, ProgramExercise, WorkoutProgram } from '../types';
import { programDayName, programDescription, programDuration, programName } from '../utils/programText';
import { useTranslation } from 'react-i18next';
import { getExerciseName } from '../constants/exercises';
import { PlayCircle, ChevronDown, Lightbulb, Play, CalendarDays, ListChecks, Clock } from 'lucide-react-native';
import { BackArrow } from '../components/DirectionalIcons';
import { IconButton } from '../components/IconButton';
import { StatTile } from '../components/StatTile';
import { GoalIcon, LevelDots, goalTone } from '../components/ProgramVisuals';
import { toneColors } from '../theme/tones';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { useTheme } from '../context/ThemeContext';

export const ProgramDetailScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { programId } = route.params;
    const program = PROGRAMS.find(p => p.id === programId);
    const { currentWorkout, startPlannedWorkout } = useWorkout();
    const [expandedDay, setExpandedDay] = useState<number>(0);

    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [selectedExercise, setSelectedExercise] = useState<{id: string, name: string} | null>(null);

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

        const workoutName = `${programName(program, t)} — ${programDayName(program, program.days.indexOf(day), t)}`;
        startPlannedWorkout(
            workoutName,
            { type: 'program', programId: program.id, dayName: day.name },
            day.exercises.map(ex => ({
                exercise: { id: ex.exerciseId, name: ex.exerciseName },
                target: {
                    sets: ex.sets,
                    reps: ex.reps,
                    restSeconds: ex.restSeconds,
                    ...(ex.notes ? { notes: ex.notes } : {}),
                },
            })),
        );
        navigation.navigate('WorkoutSession');
    };

    const totalExercises = program.days.reduce((acc, d) => acc + d.exercises.length, 0);
    const tone = toneColors(colors, goalTone(program.goal));

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

                {/* Program Header Card */}
                <Card style={styles.headerCard}>
                    <View style={[styles.bigIcon, { backgroundColor: tone.soft }]}>
                        <GoalIcon goal={program.goal} color={tone.fg} size={30} />
                    </View>
                    <Typography variant="h1" align="center" style={{ marginTop: 14 }}>{programName(program, t)}</Typography>

                    {/* Tags */}
                    <View style={styles.tagRow}>
                        <View style={styles.tag}>
                            <LevelDots level={program.level} />
                            <Typography variant="caption" color={colors.textSecondary}>
                                {t(`programs.levels.${program.level}`)}
                            </Typography>
                        </View>
                        <View style={styles.tag}>
                            <Typography variant="caption" color={colors.textSecondary}>
                                {t(`programs.goals.${program.goal}`)}
                            </Typography>
                        </View>
                    </View>

                    {/* Description */}
                    <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 14, lineHeight: 22 }}>
                        {programDescription(program, t)}
                    </Typography>
                </Card>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <StatTile compact value={program.daysPerWeek} label={t('programs.daysPerWeek')} icon={c => <CalendarDays color={c} size={14} />} tone={goalTone(program.goal)} />
                    <StatTile compact value={totalExercises} label={t('common.exercises')} icon={c => <ListChecks color={c} size={14} />} tone={goalTone(program.goal)} />
                    <StatTile compact valueLines={2} value={programDuration(program.duration, t)} label={t('programs.duration')} icon={c => <Clock color={c} size={14} />} tone={goalTone(program.goal)} />
                </View>

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
                                <View style={[styles.dayBadge, { backgroundColor: tone.soft }]}>
                                    <Typography variant="caption" color={tone.fg} bold style={{ fontSize: 11 }}>
                                        {t('programs.dayN', { n: dayIndex + 1, defaultValue: day.dayLabel })}
                                    </Typography>
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Typography variant="body" bold>{programDayName(program, dayIndex, t)}</Typography>
                                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11, marginTop: 1 }}>
                                        {day.exercises.length} {t('common.exercises')}
                                    </Typography>
                                </View>
                                <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}>
                                    <ChevronDown color={colors.textMuted} size={18} />
                                </View>
                            </TouchableOpacity>

                            {/* Expanded Exercise List */}
                            {isExpanded && (
                                <View style={styles.exerciseList}>
                                    {/* Table Header */}
                                    <View style={styles.tableHeader}>
                                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colExercise}>{t('programs.exercise')}</Typography>
                                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colSets}>{t('common.sets')}</Typography>
                                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colReps}>{t('common.reps')}</Typography>
                                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colRest}>{t('programs.rest')}</Typography>
                                    </View>

                                    {/* Exercise Rows */}
                                    {day.exercises.map((ex, exIndex) => (
                                        <View key={exIndex}>
                                            <View style={[styles.exerciseRow, exIndex % 2 === 0 && styles.rowAlt]}>
                                                <View style={[styles.colExercise, { flexDirection: 'row', alignItems: 'center', paddingRight: 8 }]}>
                                                    <Typography variant="bodySmall" style={{ flex: 1 }} numberOfLines={2}>{getExerciseName(ex.exerciseId, t, ex.exerciseName)}</Typography>
                                                    <IconButton
                                                        icon={c => <PlayCircle color={c} size={17} />}
                                                        variant="tonal"
                                                        tone="primary"
                                                        size={32}
                                                        onPress={() => {
                                                            setSelectedExercise({ id: ex.exerciseId, name: getExerciseName(ex.exerciseId, t, ex.exerciseName) });
                                                            setInfoModalVisible(true);
                                                        }}
                                                        accessibilityLabel={getExerciseName(ex.exerciseId, t, ex.exerciseName)}
                                                    />
                                                </View>
                                                <Typography variant="bodySmall" style={styles.colSets} bold>{ex.sets}</Typography>
                                                <Typography variant="bodySmall" style={styles.colReps} color={colors.primary}>{ex.reps}</Typography>
                                                <Typography variant="caption" style={styles.colRest} color={colors.textMuted}>
                                                    {ex.restSeconds >= 60 ? `${Math.floor(ex.restSeconds / 60)}m` : `${ex.restSeconds}s`}
                                                    {ex.restSeconds >= 60 && ex.restSeconds % 60 > 0 ? `${ex.restSeconds % 60}s` : ''}
                                                </Typography>
                                            </View>
                                            {ex.notes && (
                                                <View style={styles.noteRow}>
                                                    <Lightbulb color={colors.textMuted} size={12} />
                                                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11.5, flex: 1 }}>
                                                        {ex.notes}
                                                    </Typography>
                                                </View>
                                            )}
                                        </View>
                                    ))}

                                    {/* Start This Workout Button */}
                                    <Button
                                        title={`${t('programs.startDay')} — ${programDayName(program, dayIndex, t)}`}
                                        onPress={() => handleStartDay(day)}
                                        size="medium"
                                        icon={c => <Play color={c} size={16} fill={c} />}
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
        padding: 22,
        alignItems: 'center',
        marginBottom: 10,
    },
    bigIcon: {
        width: 68,
        height: 68,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    sectionTitle: {
        marginTop: 24,
        marginBottom: 12,
    },
    dayCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 10,
    },
    dayHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    dayBadge: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: borderRadius.s,
    },
    exerciseList: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    tableHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    exerciseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: borderRadius.s,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '80',
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        paddingHorizontal: 4,
        paddingBottom: 6,
        marginTop: -2,
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
});
