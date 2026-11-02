import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Check, Play } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Typography } from './Typography';
import { ForwardChevron } from './DirectionalIcons';
import { useTheme } from '../context/ThemeContext';
import { borderRadius } from '../theme/colors';
import { Tone, toneColors } from '../theme/tones';
import { formatDate } from '../utils/dates';
import { PlanPhase, TrainingPlan } from '../types';
import {
    ScheduledSession,
    addDays,
    SessionStatus,
    WeekProgress,
    dateKey,
    daysBetween,
    phaseOf,
    sessionStatus,
    weekRange,
    weekSchedule,
} from '../utils/trainingPlan';

/** Phase colors: training phases cycle through the brand tones, deload weeks are green (recovery). */
export function phaseTone(plan: TrainingPlan, phase?: PlanPhase): Tone {
    if (!phase) return 'primary';
    if (phase.deload) return 'success';
    const index = plan.phases.filter(p => !p.deload).findIndex(p => p.startWeek === phase.startWeek);
    return (['primary', 'secondary', 'accent'] as Tone[])[Math.max(0, index) % 3];
}

// ── Phase bar ────────────────────────────────────────────

interface PhaseBarProps {
    plan: TrainingPlan;
    weeks: WeekProgress[];
    currentWeek: number;
    started: boolean;
    showLabels?: boolean;
}

/** One segment per week, colored by phase: past weeks solid, this week marked, future weeks tinted. */
export const PhaseBar: React.FC<PhaseBarProps> = ({ plan, weeks, currentWeek, started, showLabels }) => {
    const { colors } = useTheme();
    return (
        <View>
            <View style={styles.barRow}>
                {weeks.map(w => {
                    const tone = toneColors(colors, phaseTone(plan, phaseOf(plan, w.week)));
                    const current = started && w.week === currentWeek;
                    const past = started && w.week < currentWeek;
                    return (
                        <View
                            key={w.week}
                            style={[
                                styles.barSegment,
                                { backgroundColor: past || current ? tone.fill : tone.soft },
                                current && styles.barCurrent,
                                current && { borderColor: tone.fill },
                            ]}
                        />
                    );
                })}
            </View>
            {showLabels && (
                <View style={styles.labelRow}>
                    {plan.phases.map(p => {
                        const tone = toneColors(colors, phaseTone(plan, p));
                        const now = started && currentWeek >= p.startWeek && currentWeek <= p.endWeek;
                        return (
                            <Text
                                key={p.startWeek}
                                numberOfLines={1}
                                style={[styles.phaseLabel, { flex: p.endWeek - p.startWeek + 1, color: now ? tone.fg : colors.textMuted, fontWeight: now ? '700' : '500' }]}
                            >
                                {p.name}
                            </Text>
                        );
                    })}
                </View>
            )}
        </View>
    );
};

// ── Session status ───────────────────────────────────────

export const SessionStatusIcon: React.FC<{ status: SessionStatus; number: number; size?: number }> = ({ status, number, size = 36 }) => {
    const { colors } = useTheme();
    const box = { width: size, height: size, borderRadius: size / 2 };
    if (status === 'done') {
        return (
            <View style={[styles.statusIcon, box, { backgroundColor: colors.successSoft }]}>
                <Check color={colors.success} size={size * 0.48} strokeWidth={2.8} />
            </View>
        );
    }
    if (status === 'today') {
        return (
            <View style={[styles.statusIcon, box, { backgroundColor: colors.primary }]}>
                <Play color={colors.onPrimary} fill={colors.onPrimary} size={size * 0.38} />
            </View>
        );
    }
    const missed = status === 'missed';
    return (
        <View style={[styles.statusIcon, box, { backgroundColor: missed ? colors.warningSoft : colors.surfaceLight }]}>
            <Text style={[styles.statusNumber, { color: missed ? colors.warning : colors.textSecondary }]}>{number}</Text>
        </View>
    );
};

/** "Today", "Missed · Mon", or the weekday and date. */
export function sessionDayLabel(s: ScheduledSession, status: SessionStatus, today: Date, t: (key: string, opts?: any) => string): string {
    if (status === 'today') return t('aiPlan.today');
    const day = formatDate(s.date, 'EEE, MMM d');
    if (status === 'missed') return t('aiPlan.missedOn', { day });
    if (status === 'upcoming' && daysBetween(today, s.date) === 1) return t('aiPlan.tomorrow');
    return day;
}

// ── Week strip ───────────────────────────────────────────

interface WeekStripProps {
    plan: TrainingPlan;
    week: number;
    completions: Map<string, unknown>;
    today: Date;
}

/** The 7 days of a plan week: training days show their session's status, today is ringed. */
export const WeekStrip: React.FC<WeekStripProps> = ({ plan, week, completions, today }) => {
    const { colors } = useTheme();
    const { start } = weekRange(plan, week);
    const byDate = new Map(weekSchedule(plan, week).map(s => [s.dateKey, s]));
    return (
        <View style={[styles.strip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {Array.from({ length: 7 }, (_, d) => {
                const date = addDays(start, d);
                const s = byDate.get(dateKey(date));
                const isToday = daysBetween(today, date) === 0;
                const status = s ? sessionStatus(s, completions, today) : null;
                let bg = 'transparent';
                let fg = colors.textMuted;
                if (status === 'done') { bg = colors.success; fg = colors.white; }
                else if (status === 'today' || (s && isToday)) { bg = colors.primary; fg = colors.onPrimary; }
                else if (status === 'missed') { bg = colors.warningSoft; fg = colors.warning; }
                else if (status === 'upcoming') { bg = colors.primarySoft; fg = colors.primary; }
                return (
                    <View key={d} style={styles.stripDay}>
                        <Text style={[styles.stripWeekday, { color: isToday ? colors.primary : colors.textMuted }]}>
                            {formatDate(date, 'EEEEE')}
                        </Text>
                        <View
                            style={[
                                styles.stripCircle,
                                { backgroundColor: bg },
                                isToday && !s && { borderWidth: 1.5, borderColor: colors.primary },
                            ]}
                        >
                            {status === 'done' ? (
                                <Check color={fg} size={14} strokeWidth={3} />
                            ) : (
                                <Text style={[styles.stripDate, { color: fg, fontWeight: s ? '700' : '500' }]}>{date.getDate()}</Text>
                            )}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

// ── Session row ──────────────────────────────────────────

interface SessionRowProps {
    s: ScheduledSession;
    status: SessionStatus;
    today: Date;
    active?: boolean;
    onPress: () => void;
}

/** A plan session in a list: status, day, name and size. */
export const PlanSessionRow: React.FC<SessionRowProps> = ({ s, status, today, active, onPress }) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const minutes = s.session.estimatedMinutes;
    const dayColor = status === 'today' ? colors.primary : status === 'missed' ? colors.warning : status === 'done' ? colors.success : colors.textSecondary;
    return (
        <TouchableOpacity style={styles.sessionRow} onPress={onPress} activeOpacity={0.6} accessibilityRole="button">
            <SessionStatusIcon status={status} number={s.index + 1} />
            <View style={{ flex: 1 }}>
                <Typography variant="caption" color={dayColor} bold style={styles.sessionDay} numberOfLines={1}>
                    {active ? t('aiPlan.inProgress') : sessionDayLabel(s, status, today, t)}
                </Typography>
                <Typography variant="body" bold numberOfLines={1}>{s.session.name}</Typography>
                <Typography variant="caption" color={colors.textMuted} numberOfLines={1} style={{ fontSize: 12 }}>
                    {[s.session.focus, `${s.session.exercises.length} ${t('common.exercises')}`, minutes ? `~${minutes} ${t('common.min')}` : null]
                        .filter(Boolean)
                        .join(' · ')}
                </Typography>
            </View>
            <ForwardChevron color={colors.textMuted} size={18} />
        </TouchableOpacity>
    );
};

/** Rounded list holding session rows separated by hairlines. */
export const SessionList: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { colors } = useTheme();
    const rows = React.Children.toArray(children).filter(Boolean);
    return (
        <View style={[styles.list, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            {rows.map((row, i) => (
                <React.Fragment key={i}>
                    {i > 0 && <View style={[styles.separator, { backgroundColor: colors.border }]} />}
                    {row}
                </React.Fragment>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    barRow: {
        flexDirection: 'row',
        gap: 3,
        alignItems: 'center',
    },
    barSegment: {
        flex: 1,
        height: 8,
        borderRadius: 4,
    },
    barCurrent: {
        height: 14,
        borderRadius: 5,
        borderWidth: 2,
    },
    labelRow: {
        flexDirection: 'row',
        gap: 3,
        marginTop: 6,
    },
    phaseLabel: {
        fontSize: 11,
        lineHeight: 14,
    },
    statusIcon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    statusNumber: {
        fontSize: 14,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    strip: {
        flexDirection: 'row',
        borderRadius: borderRadius.l,
        borderWidth: 1,
        paddingVertical: 10,
        paddingHorizontal: 6,
    },
    stripDay: {
        flex: 1,
        alignItems: 'center',
        gap: 6,
    },
    stripWeekday: {
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    stripCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    stripDate: {
        fontSize: 13,
        fontVariant: ['tabular-nums'],
    },
    sessionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    sessionDay: {
        fontSize: 11.5,
        lineHeight: 15,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    list: {
        borderRadius: borderRadius.l,
        borderWidth: 1,
        overflow: 'hidden',
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 62,
    },
});
