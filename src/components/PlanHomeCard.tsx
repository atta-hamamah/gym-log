import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import { CalendarDays, Lock, Play, Sparkles, Trophy } from 'lucide-react-native';
import { Card } from './Card';
import { Typography } from './Typography';
import { Button } from './Button';
import { ForwardChevron } from './DirectionalIcons';
import { PhaseBar, SessionStatusIcon, phaseTone, sessionDayLabel } from './PlanVisuals';
import { usePlan } from '../context/PlanContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useWorkout } from '../context/WorkoutContext';
import { useTheme } from '../context/ThemeContext';
import { borderRadius, ThemeColors } from '../theme/colors';
import { toneColors } from '../theme/tones';
import { formatDate } from '../utils/dates';
import { fromDateKey, phaseOf, sessionKey, sessionStatus } from '../utils/trainingPlan';

/** Where "plan" entry points go: the AI gate, the builder, or the plan itself. */
export function usePlanNavigation() {
    const navigation = useNavigation<any>();
    const { isAISubscriber } = useSubscription();
    const { plan } = usePlan();
    return () => {
        if (!isAISubscriber) navigation.navigate('Main', { screen: 'AI' });
        else navigation.navigate(plan ? 'TrainingPlan' : 'PlanBuilder');
    };
}

/**
 * The training plan on the Home screen: the next session with a Start button
 * and the plan's progress, or an invitation to build one.
 */
export const PlanHomeCard: React.FC = () => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const navigation = useNavigation<any>();
    const { isAISubscriber } = useSubscription();
    const { plan, progress, today, activeSessionKey, startSession } = usePlan();
    const { currentWorkout } = useWorkout();
    const openPlan = usePlanNavigation();

    if (plan === undefined) return null;

    // ── No plan: invitation ──
    if (!plan || !progress) {
        return (
            <TouchableOpacity activeOpacity={0.85} onPress={openPlan}>
                <Card style={styles.card}>
                    <View style={styles.headRow}>
                        <View style={styles.iconTile}><CalendarDays color={colors.secondary} size={20} /></View>
                        <View style={{ flex: 1 }}>
                            <Typography variant="body" bold>{t('aiPlan.promoTitle')}</Typography>
                            <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 1 }}>{t('aiPlan.promoDesc')}</Typography>
                        </View>
                    </View>
                    <Button
                        title={isAISubscriber ? t('aiPlan.promoButton') : t('aiPlan.unlock')}
                        variant="ai"
                        fullWidth
                        style={{ marginTop: 14 }}
                        icon={c => (isAISubscriber ? <Sparkles color={c} size={16} /> : <Lock color={c} size={15} />)}
                        onPress={openPlan}
                    />
                </Card>
            </TouchableOpacity>
        );
    }

    const phase = phaseOf(plan, progress.currentWeek);
    const tone = toneColors(colors, phaseTone(plan, phase));
    const next = progress.next;
    const nextStatus = next ? sessionStatus(next, progress.completions, today) : null;
    const nextActive = next ? activeSessionKey === sessionKey(next.week, next.session.id) : false;

    const subtitle = progress.finished
        ? t('aiPlan.complete')
        : !progress.started
            ? t('aiPlan.startsOn', { date: formatDate(fromDateKey(plan.startDate), 'EEE, MMM d') })
            : `${t('aiPlan.weekOf', { week: progress.currentWeek, total: plan.weeks })}${phase ? ` · ${phase.name}` : ''}`;

    const handleStart = () => {
        if (!next) return;
        if (nextActive) {
            navigation.navigate('WorkoutSession');
            return;
        }
        if (currentWorkout) {
            navigation.navigate('PlanSession', { week: next.week, sessionId: next.session.id });
            return;
        }
        if (startSession(next.week, next.session.id)) navigation.navigate('WorkoutSession');
    };

    return (
        <TouchableOpacity activeOpacity={0.85} onPress={() => navigation.navigate('TrainingPlan')}>
            <Card style={styles.card}>
                <View style={styles.headRow}>
                    <View style={styles.iconTile}><CalendarDays color={colors.secondary} size={20} /></View>
                    <View style={{ flex: 1 }}>
                        <Typography variant="caption" color={progress.finished ? colors.accent : tone.fg} bold numberOfLines={1}>{subtitle}</Typography>
                        <Typography variant="body" bold numberOfLines={1}>{plan.name}</Typography>
                    </View>
                    <ForwardChevron color={colors.textMuted} size={18} />
                </View>

                <View style={{ marginTop: 14 }}>
                    <PhaseBar plan={plan} weeks={progress.weeks} currentWeek={progress.currentWeek} started={progress.started} />
                </View>

                {progress.finished ? (
                    <View style={styles.nextRow}>
                        <View style={[styles.trophy, { backgroundColor: colors.accentSoft }]}><Trophy color={colors.accent} size={18} /></View>
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ flex: 1 }}>
                            {t('aiPlan.finishedDesc', { done: progress.done, total: progress.total })}
                        </Typography>
                        <Button title={t('aiPlan.buildNextShort')} size="small" variant="ai" onPress={() => navigation.navigate('PlanBuilder')} />
                    </View>
                ) : next && nextStatus ? (
                    <View style={styles.nextRow}>
                        <SessionStatusIcon status={nextStatus} number={next.index + 1} size={34} />
                        <View style={{ flex: 1 }}>
                            <Typography variant="caption" color={nextStatus === 'today' ? colors.primary : nextStatus === 'missed' ? colors.warning : colors.textSecondary} bold numberOfLines={1} style={styles.nextDay}>
                                {nextActive
                                    ? t('aiPlan.inProgress')
                                    : next.week > progress.currentWeek
                                        ? `${t('aiPlan.weekN', { n: next.week })} · ${sessionDayLabel(next, nextStatus, today, t)}`
                                        : sessionDayLabel(next, nextStatus, today, t)}
                            </Typography>
                            <Typography variant="body" bold numberOfLines={1}>{next.session.name}</Typography>
                        </View>
                        <Button
                            title={nextActive ? t('aiPlan.resume') : t('aiPlan.start')}
                            size="small"
                            icon={c => <Play color={c} size={13} fill={c} />}
                            onPress={handleStart}
                        />
                    </View>
                ) : null}
            </Card>
        </TouchableOpacity>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    card: {
        padding: 16,
        marginTop: 2,
        marginBottom: 0,
    },
    headRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconTile: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: colors.secondarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    nextRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 14,
        paddingTop: 14,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    nextDay: {
        fontSize: 11,
        lineHeight: 15,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    trophy: {
        width: 34,
        height: 34,
        borderRadius: borderRadius.full,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
