import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Clock, Layers, Leaf, Lightbulb, ListChecks, Play, PlayCircle, Repeat, Sparkles, Target } from 'lucide-react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { StatTile } from '../components/StatTile';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { BackArrow } from '../components/DirectionalIcons';
import { phaseTone, sessionDayLabel } from '../components/PlanVisuals';
import { usePlan } from '../context/PlanContext';
import { useWorkout } from '../context/WorkoutContext';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';
import { getExerciseName } from '../constants/exercises';
import { borderRadius, ThemeColors } from '../theme/colors';
import { toneColors } from '../theme/tones';
import { formatDate } from '../utils/dates';
import { resolveSession, sessionKey, sessionStatus, weekSchedule } from '../utils/trainingPlan';

const restText = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m${s % 60 ? `${s % 60}s` : ''}` : `${s}s`);

export const PlanSessionScreen = ({ route, navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight } = useUnits();
    const { plan, progress, today, activeSessionKey, startSession } = usePlan();
    const { currentWorkout } = useWorkout();
    const { week, sessionId } = route.params as { week: number; sessionId: string };

    const [busyModal, setBusyModal] = useState(false);
    const [info, setInfo] = useState<{ id: string; name: string } | null>(null);

    const resolved = plan ? resolveSession(plan, week, sessionId) : null;
    const scheduled = plan ? weekSchedule(plan, week).find(s => s.session.id === sessionId) : undefined;

    if (!plan || !progress || !resolved || !scheduled) {
        return (
            <ScreenLayout>
                <View style={styles.center}>
                    <Typography variant="h2">{t('aiPlan.noPlan')}</Typography>
                    <Button title={t('common.goBack')} variant="outline" onPress={() => navigation.goBack()} style={{ marginTop: 16 }} />
                </View>
            </ScreenLayout>
        );
    }

    const key = sessionKey(week, sessionId);
    const status = sessionStatus(scheduled, progress.completions, today);
    const doneWorkout = progress.completions.get(key);
    const active = activeSessionKey === key;
    const tone = toneColors(colors, phaseTone(plan, resolved.phase));
    const totalSets = resolved.exercises.reduce((a, e) => a + e.sets, 0);
    const formatLoad = (kg: number) => `${Math.round(displayWeight(kg) * 2) / 2} ${weightUnit}`;

    const handleStart = () => {
        if (active) {
            navigation.navigate('WorkoutSession');
            return;
        }
        if (currentWorkout) {
            setBusyModal(true);
            return;
        }
        if (startSession(week, sessionId)) navigation.navigate('WorkoutSession');
    };

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <View style={styles.topBar}>
                    <IconButton icon={c => <BackArrow color={c} size={20} />} onPress={() => navigation.goBack()} accessibilityLabel={t('common.goBack')} />
                </View>

                <Card style={styles.headerCard}>
                    <View style={styles.badges}>
                        <View style={[styles.badge, { backgroundColor: tone.soft }]}>
                            <Typography variant="caption" color={tone.fg} bold style={styles.badgeText} numberOfLines={1}>
                                {t('aiPlan.weekN', { n: week })}{resolved.phase ? ` · ${resolved.phase.name}` : ''}
                            </Typography>
                        </View>
                        {resolved.deload && (
                            <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
                                <Leaf color={colors.success} size={12} />
                                <Typography variant="caption" color={colors.success} bold style={styles.badgeText}>{t('aiPlan.deload')}</Typography>
                            </View>
                        )}
                    </View>
                    <Typography variant="h1" align="center" style={{ marginTop: 10 }}>{resolved.session.name}</Typography>
                    <Typography variant="bodySmall" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
                        {[sessionDayLabel(scheduled, status, today, t), resolved.session.focus].filter(Boolean).join(' · ')}
                    </Typography>

                    {!!resolved.checkIn && (
                        <View style={styles.noteBox}>
                            <View style={styles.boxTitle}>
                                <Sparkles color={colors.secondary} size={14} />
                                <Typography variant="label" color={colors.secondary}>{t('aiPlan.coachNote')}</Typography>
                            </View>
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>{resolved.checkIn.summary}</Typography>
                        </View>
                    )}
                    {resolved.deload && (
                        <View style={[styles.noteBox, { backgroundColor: colors.successSoft }]}>
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>{t('aiPlan.deloadHint')}</Typography>
                        </View>
                    )}
                </Card>

                <View style={styles.statsRow}>
                    <StatTile compact value={resolved.exercises.length} label={t('common.exercises')} icon={c => <ListChecks color={c} size={14} />} tone={phaseTone(plan, resolved.phase)} />
                    <StatTile compact value={totalSets} label={t('common.sets')} icon={c => <Layers color={c} size={14} />} tone={phaseTone(plan, resolved.phase)} />
                    {!!resolved.session.estimatedMinutes && (
                        <StatTile compact value={resolved.session.estimatedMinutes} label={t('common.min')} icon={c => <Clock color={c} size={14} />} tone={phaseTone(plan, resolved.phase)} />
                    )}
                </View>

                <Typography variant="h3" style={styles.sectionTitle}>{t('common.exercises')}</Typography>
                <Card style={styles.exerciseCard}>
                    <View style={styles.tableHeader}>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colExercise}>{t('programs.exercise')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colSets}>{t('common.sets')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colReps}>{t('common.reps')}</Typography>
                        <Typography variant="label" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.colRest}>{t('programs.rest')}</Typography>
                    </View>
                    {resolved.exercises.map((ex, i) => {
                        const name = getExerciseName(ex.exerciseId, t, ex.exerciseName);
                        return (
                            <View key={`${ex.exerciseId}-${i}`}>
                                <View style={[styles.exerciseRow, i % 2 === 0 && styles.rowAlt]}>
                                    <View style={[styles.colExercise, styles.nameCell]}>
                                        <Typography variant="bodySmall" numberOfLines={2} style={{ flex: 1 }}>{name}</Typography>
                                        {!!ex.supersetGroup && (
                                            <View style={[styles.miniBadge, { backgroundColor: colors.primarySoft }]}>
                                                <Typography variant="caption" color={colors.primary} bold style={styles.miniBadgeText}>{ex.supersetGroup}</Typography>
                                            </View>
                                        )}
                                        <IconButton
                                            icon={c => <PlayCircle color={c} size={17} />}
                                            variant="tonal"
                                            tone="primary"
                                            size={32}
                                            onPress={() => setInfo({ id: ex.exerciseId, name })}
                                            accessibilityLabel={name}
                                        />
                                    </View>
                                    <Typography variant="bodySmall" style={styles.colSets} bold>{ex.sets}</Typography>
                                    <Typography variant="bodySmall" style={styles.colReps} color={colors.primary}>{ex.reps}</Typography>
                                    <Typography variant="caption" style={styles.colRest} color={colors.textMuted}>{restText(ex.restSeconds)}</Typography>
                                </View>
                                {(!!ex.targetWeight || ex.changed || !!ex.replacedName || !!ex.notes) && (
                                    <View style={styles.noteRow}>
                                        {(!!ex.targetWeight || ex.changed) && (
                                            <View style={styles.noteLine}>
                                                {!!ex.targetWeight && (
                                                    <>
                                                        <Target color={colors.primary} size={12} />
                                                        <Typography variant="caption" color={colors.primary} bold style={styles.noteText}>
                                                            {t('aiWorkout.targetLoad', { weight: formatLoad(ex.targetWeight) })}
                                                        </Typography>
                                                    </>
                                                )}
                                                {ex.changed && (
                                                    <View style={[styles.miniBadge, { backgroundColor: colors.secondarySoft }]}>
                                                        <Typography variant="caption" color={colors.secondary} bold style={styles.miniBadgeText}>{t('aiPlan.updated')}</Typography>
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                        {!!ex.replacedName && (
                                            <View style={styles.noteLine}>
                                                <Repeat color={colors.secondary} size={12} />
                                                <Typography variant="caption" color={colors.secondary} style={styles.noteText}>
                                                    {t('aiPlan.replaced', { name: getExerciseName(ex.replacedId ?? '', t, ex.replacedName) })}
                                                </Typography>
                                            </View>
                                        )}
                                        {!!ex.notes && (
                                            <View style={styles.noteLine}>
                                                <Lightbulb color={colors.textMuted} size={12} />
                                                <Typography variant="caption" color={colors.textMuted} style={[styles.noteText, { flex: 1 }]}>{ex.notes}</Typography>
                                            </View>
                                        )}
                                    </View>
                                )}
                            </View>
                        );
                    })}
                </Card>

                <View style={styles.actions}>
                    {doneWorkout ? (
                        <>
                            <View style={styles.doneBox}>
                                <CheckCircle2 color={colors.success} size={18} />
                                <Typography variant="body" color={colors.success} bold style={{ flex: 1 }}>
                                    {t('aiPlan.completedOn', { date: formatDate(doneWorkout.startTime, 'EEE, MMM d') })}
                                </Typography>
                            </View>
                            <Button title={t('aiPlan.viewWorkout')} variant="outline" fullWidth onPress={() => navigation.navigate('WorkoutDetails', { workoutId: doneWorkout.id })} />
                        </>
                    ) : (
                        <Button
                            title={active ? t('aiPlan.resumeSession') : t('aiPlan.startSession')}
                            size="large"
                            fullWidth
                            icon={c => <Play color={c} size={18} fill={c} />}
                            onPress={handleStart}
                        />
                    )}
                </View>
            </ScrollView>

            <ConfirmationModal
                visible={busyModal}
                title={t('programs.workoutActiveTitle')}
                message={t('programs.workoutActiveMessage')}
                confirmText={t('common.ok')}
                onConfirm={() => setBusyModal(false)}
            />
            <ExerciseInfoModal
                visible={!!info}
                exerciseId={info?.id ?? null}
                exerciseName={info?.name ?? ''}
                onClose={() => setInfo(null)}
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCard: {
        padding: 20,
        alignItems: 'center',
        marginBottom: 10,
    },
    badges: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 6,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
    },
    badgeText: {
        fontSize: 12,
        lineHeight: 16,
    },
    noteBox: {
        alignSelf: 'stretch',
        marginTop: 14,
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
    statsRow: {
        flexDirection: 'row',
        gap: 10,
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
    nameCell: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingRight: 6,
    },
    noteRow: {
        paddingHorizontal: 14,
        paddingBottom: 8,
        marginTop: -4,
        gap: 4,
    },
    noteLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    noteText: {
        fontSize: 11.5,
    },
    miniBadge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    miniBadgeText: {
        fontSize: 10,
        lineHeight: 14,
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
    actions: {
        marginTop: 20,
        gap: 10,
    },
    doneBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 14,
        borderRadius: borderRadius.m,
        backgroundColor: colors.successSoft,
    },
});
