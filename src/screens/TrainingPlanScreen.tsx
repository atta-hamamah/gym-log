import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useAction, useMutation } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { CalendarCheck, CalendarDays, Leaf, Play, Plus, Sparkles, Target, TrendingUp, Trophy, XCircle } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { IconButton } from '../components/IconButton';
import { StatTile } from '../components/StatTile';
import { ListGroup, ListRow } from '../components/ListRow';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { BackArrow } from '../components/DirectionalIcons';
import { PhaseBar, PlanSessionRow, SessionList, WeekStrip, phaseTone, sessionDayLabel } from '../components/PlanVisuals';
import { usePlan } from '../context/PlanContext';
import { useWorkout } from '../context/WorkoutContext';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, ThemeColors } from '../theme/colors';
import { toneColors } from '../theme/tones';
import { aiLimitMessage } from '../utils/aiErrors';
import { formatDate } from '../utils/dates';
import { checkInFor, fromDateKey, needsCheckIn, phaseOf, sessionKey, sessionStatus, weekSchedule } from '../utils/trainingPlan';

export const TrainingPlanScreen = ({ navigation }: any) => {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { plan, progress, today, activeSessionKey, startSession } = usePlan();
    const { currentWorkout } = useWorkout();
    const runCheckIn = useAction(api.planAI.checkIn);
    const endPlan = useMutation(api.plans.end);

    const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [checkingIn, setCheckingIn] = useState(false);
    const [modal, setModal] = useState<{ title: string; message: string; confirm?: () => void; danger?: boolean } | null>(null);

    const week = selectedWeek ?? progress?.currentWeek ?? 1;
    const schedule = useMemo(() => (plan ? weekSchedule(plan, week) : []), [plan, week]);

    if (plan === undefined) {
        return (
            <ScreenLayout>
                <View style={styles.center}><ActivityIndicator color={colors.secondary} /></View>
            </ScreenLayout>
        );
    }

    if (!plan || !progress) {
        return (
            <ScreenLayout>
                <View style={styles.topBar}>
                    <IconButton icon={c => <BackArrow color={c} size={20} />} onPress={() => navigation.goBack()} accessibilityLabel={t('common.goBack')} />
                </View>
                <View style={styles.center}>
                    <View style={styles.bigIcon}><CalendarDays color={colors.secondary} size={30} /></View>
                    <Typography variant="h2" align="center" style={{ marginTop: 16 }}>{t('aiPlan.noPlan')}</Typography>
                    <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 6 }}>{t('aiPlan.promoDesc')}</Typography>
                    <Button title={t('aiPlan.promoButton')} icon={c => <Sparkles color={c} size={17} />} size="large" fullWidth style={{ marginTop: 22 }} onPress={() => navigation.replace('PlanBuilder')} />
                </View>
            </ScreenLayout>
        );
    }

    const currentPhase = phaseOf(plan, progress.currentWeek);
    const phase = phaseOf(plan, week);
    const phaseColors = toneColors(colors, phaseTone(plan, phase));
    const checkIn = checkInFor(plan, week);
    const showCheckIn = progress.started && !progress.finished && needsCheckIn(plan, progress.currentWeek);
    const weeksLeft = progress.finished ? 0 : progress.started ? plan.weeks - progress.currentWeek + 1 : plan.weeks;
    const next = progress.next;
    const weekDone = next && next.week > progress.currentWeek;

    const openSession = (w: number, sessionId: string) => navigation.navigate('PlanSession', { week: w, sessionId });

    const start = (w: number, sessionId: string) => {
        if (activeSessionKey === sessionKey(w, sessionId)) {
            navigation.navigate('WorkoutSession');
            return;
        }
        if (currentWorkout) {
            setModal({ title: t('programs.workoutActiveTitle'), message: t('programs.workoutActiveMessage') });
            return;
        }
        if (startSession(w, sessionId)) navigation.navigate('WorkoutSession');
    };

    const handleCheckIn = async () => {
        setCheckingIn(true);
        try {
            await runCheckIn({
                planId: plan.id as Id<'trainingPlans'>,
                week: progress.currentWeek,
                ...(note.trim() ? { comment: note.trim() } : {}),
                language: i18n.language,
            });
            setNote('');
            setSelectedWeek(progress.currentWeek);
        } catch (e) {
            setModal({ title: t('aiPlan.checkInTitle', { week: progress.currentWeek }), message: aiLimitMessage(e, t) ?? t('aiPlan.checkInError') });
        } finally {
            setCheckingIn(false);
        }
    };

    const confirmEnd = () =>
        setModal({
            title: t('aiPlan.endPlanTitle'),
            message: t('aiPlan.endPlanMessage'),
            danger: true,
            confirm: async () => {
                await endPlan({ planId: plan.id as Id<'trainingPlans'> });
                navigation.goBack();
            },
        });

    const nextLabel = next ? sessionDayLabel(next, sessionStatus(next, progress.completions, today), today, t) : '';
    const nextActive = next ? activeSessionKey === sessionKey(next.week, next.session.id) : false;

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                <View style={styles.topBar}>
                    <IconButton icon={c => <BackArrow color={c} size={20} />} onPress={() => navigation.goBack()} accessibilityLabel={t('common.goBack')} />
                </View>

                {/* ── Hero ── */}
                <Card style={styles.heroCard}>
                    <View style={styles.heroTop}>
                        <View style={styles.aiBadge}>
                            <Sparkles color={colors.secondary} size={13} />
                            <Typography variant="caption" color={colors.secondary} bold>{t('aiPlan.aiPlan')}</Typography>
                        </View>
                        <Typography variant="caption" color={colors.textSecondary} bold>
                            {progress.finished
                                ? t('aiPlan.complete')
                                : progress.started
                                    ? t('aiPlan.weekOf', { week: progress.currentWeek, total: plan.weeks })
                                    : t('aiPlan.startsOn', { date: formatDate(fromDateKey(plan.startDate), 'EEE, MMM d') })}
                        </Typography>
                    </View>
                    <Typography variant="h2" style={{ marginTop: 12 }}>{plan.name}</Typography>
                    {!!plan.goal && (
                        <View style={styles.goalRow}>
                            <Target color={colors.textMuted} size={14} />
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ flex: 1 }}>{plan.goal}</Typography>
                        </View>
                    )}
                    <View style={{ marginTop: 18 }}>
                        <PhaseBar plan={plan} weeks={progress.weeks} currentWeek={progress.currentWeek} started={progress.started} showLabels />
                    </View>
                    {progress.started && !progress.finished && currentPhase && (
                        <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 10 }}>
                            <Typography variant="caption" color={toneColors(colors, phaseTone(plan, currentPhase)).fg} bold>{currentPhase.name}</Typography>
                            {currentPhase.focus ? ` · ${currentPhase.focus}` : ''}
                        </Typography>
                    )}
                </Card>

                <View style={styles.statsRow}>
                    <StatTile compact value={`${progress.done}/${progress.total}`} label={t('aiPlan.sessionsDone')} icon={c => <CalendarCheck color={c} size={14} />} tone="success" />
                    <StatTile compact value={progress.adherence === null ? '—' : `${Math.round(progress.adherence * 100)}%`} label={t('aiPlan.onTrack')} icon={c => <TrendingUp color={c} size={14} />} tone="primary" />
                    <StatTile compact value={weeksLeft} label={t('aiPlan.weeksLeft')} icon={c => <CalendarDays color={c} size={14} />} tone="secondary" />
                </View>

                {/* ── Finished ── */}
                {progress.finished && (
                    <Card style={styles.finishedCard}>
                        <View style={[styles.bigIcon, { backgroundColor: colors.accentSoft }]}><Trophy color={colors.accent} size={28} /></View>
                        <Typography variant="h2" align="center" style={{ marginTop: 12 }}>{t('aiPlan.finishedTitle')}</Typography>
                        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
                            {t('aiPlan.finishedDesc', { done: progress.done, total: progress.total })}
                        </Typography>
                        <Button title={t('aiPlan.buildNext')} icon={c => <Sparkles color={c} size={17} />} size="large" fullWidth style={{ marginTop: 18 }} onPress={() => navigation.navigate('PlanBuilder')} />
                    </Card>
                )}

                {/* ── Up next ── */}
                {next && (
                    <>
                        <Typography variant="label" style={styles.sectionLabel}>
                            {weekDone ? t('aiPlan.weekComplete', { week: progress.currentWeek }) : t('aiPlan.upNext')}
                        </Typography>
                        <TouchableOpacity activeOpacity={0.85} onPress={() => openSession(next.week, next.session.id)}>
                            <Card style={styles.nextCard}>
                                <Typography variant="caption" color={nextLabel === t('aiPlan.today') ? colors.primary : colors.textSecondary} bold style={styles.nextDay}>
                                    {nextActive ? t('aiPlan.inProgress') : weekDone ? `${t('aiPlan.weekN', { n: next.week })} · ${nextLabel}` : nextLabel}
                                </Typography>
                                <Typography variant="h2" style={{ marginTop: 2 }}>{next.session.name}</Typography>
                                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                    {[next.session.focus, `${next.session.exercises.length} ${t('common.exercises')}`, next.session.estimatedMinutes ? `~${next.session.estimatedMinutes} ${t('common.min')}` : null].filter(Boolean).join(' · ')}
                                </Typography>
                                <Button
                                    title={nextActive ? t('aiPlan.resumeSession') : t('aiPlan.startSession')}
                                    size="large"
                                    fullWidth
                                    icon={c => <Play color={c} size={17} fill={c} />}
                                    style={{ marginTop: 16 }}
                                    onPress={() => start(next.week, next.session.id)}
                                />
                            </Card>
                        </TouchableOpacity>
                    </>
                )}

                {/* ── Weekly check-in ── */}
                {showCheckIn && (
                    <Card style={styles.checkInCard}>
                        <View style={styles.checkInHeader}>
                            <View style={styles.checkInIcon}><Sparkles color={colors.secondary} size={18} /></View>
                            <View style={{ flex: 1 }}>
                                <Typography variant="h3">{t('aiPlan.checkInTitle', { week: progress.currentWeek })}</Typography>
                                <Typography variant="caption" color={colors.textSecondary}>{t('aiPlan.checkInDesc')}</Typography>
                            </View>
                        </View>
                        <TextInput
                            style={styles.noteInput}
                            value={note}
                            onChangeText={setNote}
                            placeholder={t('aiPlan.checkInPlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            multiline
                            maxLength={300}
                            editable={!checkingIn}
                        />
                        <Button
                            title={checkingIn ? t('aiPlan.checkingIn') : t('aiPlan.checkInButton', { week: progress.currentWeek })}
                            variant="ai"
                            fullWidth
                            loading={checkingIn}
                            disabled={checkingIn}
                            icon={c => <Sparkles color={c} size={16} />}
                            onPress={handleCheckIn}
                        />
                    </Card>
                )}

                {/* ── Week ── */}
                <View style={styles.weekHeader}>
                    <Typography variant="h3">{t('aiPlan.weekN', { n: week })}</Typography>
                    {phase && (
                        <View style={[styles.pill, { backgroundColor: phaseColors.soft }]}>
                            {phase.deload && <Leaf color={phaseColors.fg} size={12} />}
                            <Typography variant="caption" color={phaseColors.fg} bold style={styles.pillText} numberOfLines={1}>
                                {phase.deload ? t('aiPlan.deload') : phase.name}
                            </Typography>
                        </View>
                    )}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekPills} style={{ flexGrow: 0 }}>
                    {progress.weeks.map(w => {
                        const selected = w.week === week;
                        const current = progress.started && w.week === progress.currentWeek;
                        const complete = w.total > 0 && w.done === w.total;
                        const tone = toneColors(colors, phaseTone(plan, phaseOf(plan, w.week)));
                        return (
                            <TouchableOpacity
                                key={w.week}
                                onPress={() => setSelectedWeek(w.week)}
                                activeOpacity={0.7}
                                style={[
                                    styles.weekPill,
                                    { backgroundColor: selected ? tone.soft : colors.surface, borderColor: selected ? tone.fg : colors.border },
                                ]}
                                accessibilityRole="button"
                                accessibilityState={{ selected }}
                                accessibilityLabel={t('aiPlan.weekN', { n: w.week })}
                            >
                                <Typography variant="caption" bold color={selected || current ? tone.fg : colors.textSecondary} style={styles.weekPillText}>
                                    {w.week}
                                </Typography>
                                <View style={[styles.weekPillTrack, { backgroundColor: colors.surfaceLight }]}>
                                    <View style={[styles.weekPillFill, { width: `${w.total ? (w.done / w.total) * 100 : 0}%`, backgroundColor: complete ? colors.success : tone.fill }]} />
                                </View>
                                {current && <View style={[styles.currentDot, { backgroundColor: tone.fill }]} />}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                <WeekStrip plan={plan} week={week} completions={progress.completions} today={today} />

                {!!checkIn && (
                    <View style={styles.coachNote}>
                        <View style={styles.boxTitle}>
                            <Sparkles color={colors.secondary} size={14} />
                            <Typography variant="label" color={colors.secondary}>{t('aiPlan.coachNote')}</Typography>
                        </View>
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>{checkIn.summary}</Typography>
                    </View>
                )}
                {phase?.deload && (
                    <View style={[styles.coachNote, { backgroundColor: colors.successSoft }]}>
                        <View style={styles.boxTitle}>
                            <Leaf color={colors.success} size={14} />
                            <Typography variant="label" color={colors.success}>{t('aiPlan.deload')}</Typography>
                        </View>
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>{t('aiPlan.deloadHint')}</Typography>
                    </View>
                )}

                <View style={{ marginTop: 12 }}>
                    <SessionList>
                        {schedule.map(s => (
                            <PlanSessionRow
                                key={s.session.id}
                                s={s}
                                status={sessionStatus(s, progress.completions, today)}
                                today={today}
                                active={activeSessionKey === sessionKey(s.week, s.session.id)}
                                onPress={() => openSession(s.week, s.session.id)}
                            />
                        ))}
                    </SessionList>
                </View>

                {/* ── Strategy ── */}
                <Typography variant="h3" style={styles.sectionTitle}>{t('aiPlan.strategy')}</Typography>
                <Card style={styles.strategyCard}>
                    {!!plan.overview && (
                        <Typography variant="body" color={colors.textSecondary} style={{ lineHeight: 22 }}>{plan.overview}</Typography>
                    )}
                    {!!plan.progression && (
                        <View style={[styles.coachNote, { marginTop: 14, marginBottom: 0 }]}>
                            <View style={styles.boxTitle}>
                                <TrendingUp color={colors.primary} size={14} />
                                <Typography variant="label" color={colors.primary}>{t('aiPlan.progression')}</Typography>
                            </View>
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ lineHeight: 19 }}>{plan.progression}</Typography>
                        </View>
                    )}
                </Card>

                <Typography variant="h3" style={styles.sectionTitle}>{t('aiPlan.roadmap')}</Typography>
                <View style={styles.roadmap}>
                    {plan.phases.map((p, i) => {
                        const tone = toneColors(colors, phaseTone(plan, p));
                        const now = progress.started && !progress.finished && progress.currentWeek >= p.startWeek && progress.currentWeek <= p.endWeek;
                        const last = i === plan.phases.length - 1;
                        return (
                            <TouchableOpacity key={p.startWeek} style={styles.phaseRow} activeOpacity={0.7} onPress={() => setSelectedWeek(p.startWeek)}>
                                <View style={styles.phaseRail}>
                                    <View style={[styles.phaseDot, { backgroundColor: now ? tone.fill : tone.soft, borderColor: tone.fill }]}>
                                        {p.deload && <Leaf color={now ? colors.white : tone.fg} size={11} />}
                                    </View>
                                    {!last && <View style={[styles.phaseLine, { backgroundColor: colors.border }]} />}
                                </View>
                                <View style={[styles.phaseBody, !last && { paddingBottom: 18 }]}>
                                    <View style={styles.phaseTitleRow}>
                                        <Typography variant="body" bold style={{ flexShrink: 1 }}>{p.name}</Typography>
                                        {now && (
                                            <View style={[styles.pill, { backgroundColor: tone.soft }]}>
                                                <Typography variant="caption" color={tone.fg} bold style={styles.pillText}>{t('aiPlan.now')}</Typography>
                                            </View>
                                        )}
                                    </View>
                                    <Typography variant="caption" color={tone.fg} bold style={{ marginTop: 1 }}>
                                        {p.startWeek === p.endWeek ? t('aiPlan.weekN', { n: p.startWeek }) : t('aiPlan.weeksRange', { from: p.startWeek, to: p.endWeek })}
                                    </Typography>
                                    {!!p.focus && (
                                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 3 }}>{p.focus}</Typography>
                                    )}
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* ── Manage ── */}
                <ListGroup title={t('aiPlan.manage')} style={{ marginTop: 24 }}>
                    <ListRow
                        title={t('aiPlan.newPlan')}
                        subtitle={t('aiPlan.newPlanDesc')}
                        icon={c => <Plus color={c} size={18} />}
                        iconTone="secondary"
                        onPress={() => navigation.navigate('PlanBuilder')}
                    />
                    <ListRow title={t('aiPlan.endPlan')} icon={c => <XCircle color={c} size={18} />} destructive onPress={confirmEnd} />
                </ListGroup>
            </ScrollView>

            <ConfirmationModal
                visible={!!modal}
                title={modal?.title ?? ''}
                message={modal?.message ?? ''}
                confirmText={modal?.confirm ? (modal.danger ? t('aiPlan.endPlan') : t('common.ok')) : t('common.ok')}
                cancelText={modal?.confirm ? t('common.cancel') : ''}
                variant={modal?.danger ? 'danger' : 'primary'}
                onConfirm={() => {
                    const action = modal?.confirm;
                    setModal(null);
                    action?.();
                }}
                onCancel={modal?.confirm ? () => setModal(null) : undefined}
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
        paddingHorizontal: 12,
    },
    bigIcon: {
        width: 64,
        height: 64,
        borderRadius: 20,
        backgroundColor: colors.secondarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroCard: {
        padding: 18,
        marginBottom: 10,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    aiBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: colors.secondarySoft,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
    },
    goalRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 4,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    finishedCard: {
        alignItems: 'center',
        padding: 22,
        marginTop: 16,
    },
    sectionLabel: {
        marginTop: 24,
        marginBottom: 8,
        marginLeft: 4,
    },
    sectionTitle: {
        marginTop: 26,
        marginBottom: 12,
    },
    nextCard: {
        padding: 18,
        marginBottom: 0,
        borderColor: colors.primary + '55',
    },
    nextDay: {
        fontSize: 11.5,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    checkInCard: {
        marginTop: 14,
        marginBottom: 0,
        padding: 16,
        backgroundColor: colors.secondarySoft,
        borderColor: colors.secondary + '40',
    },
    checkInHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    checkInIcon: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
    },
    noteInput: {
        minHeight: 44,
        maxHeight: 100,
        marginTop: 14,
        marginBottom: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surface,
        color: colors.text,
        fontSize: 14.5,
        textAlignVertical: 'top',
    },
    weekHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 28,
        marginBottom: 10,
    },
    pill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        flexShrink: 1,
    },
    pillText: {
        fontSize: 11.5,
        lineHeight: 16,
    },
    weekPills: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 12,
        paddingRight: 8,
    },
    weekPill: {
        width: 44,
        height: 50,
        borderRadius: 14,
        borderWidth: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    weekPillText: {
        fontSize: 15,
        lineHeight: 18,
        fontVariant: ['tabular-nums'],
    },
    weekPillTrack: {
        width: 22,
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    weekPillFill: {
        height: 4,
        borderRadius: 2,
    },
    currentDot: {
        position: 'absolute',
        top: 5,
        right: 5,
        width: 5,
        height: 5,
        borderRadius: 3,
    },
    coachNote: {
        marginTop: 12,
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
    strategyCard: {
        padding: 16,
        marginBottom: 0,
    },
    roadmap: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
    },
    phaseRow: {
        flexDirection: 'row',
        gap: 12,
    },
    phaseRail: {
        alignItems: 'center',
        width: 20,
    },
    phaseDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    phaseLine: {
        flex: 1,
        width: 2,
        marginVertical: 3,
        borderRadius: 1,
    },
    phaseBody: {
        flex: 1,
    },
    phaseTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});
