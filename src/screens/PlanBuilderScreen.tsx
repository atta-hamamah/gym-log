import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useAction, useQuery } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, BicepsFlexed, CalendarDays, Dumbbell, Flame, Info, Sparkles, UserRound, Zap } from 'lucide-react-native';
import { api } from '../../convex/_generated/api';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { Chip } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { SegmentedControl } from '../components/SegmentedControl';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { BackArrow } from '../components/DirectionalIcons';
import { usePlan } from '../context/PlanContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';
import { getMuscleGroupName } from '../constants/exercises';
import { borderRadius, ThemeColors } from '../theme/colors';
import { aiLimitMessage } from '../utils/aiErrors';
import { formatDate } from '../utils/dates';
import { isProfileComplete } from '../utils/profile';
import { addDays, dateKey, defaultTrainingDays, nextMonday, WEEKDAYS_MON_FIRST } from '../utils/trainingPlan';

const WEEK_OPTIONS = [4, 6, 8, 12] as const;
const MINUTES = [30, 45, 60, 75, 90];
const FOCUS = ['Chest', 'Back', 'Legs', 'Glutes', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio'];
type Goal = 'muscle' | 'strength' | 'fat_loss' | 'fitness';
const GOALS: { key: Goal; icon: typeof Dumbbell }[] = [
    { key: 'muscle', icon: BicepsFlexed },
    { key: 'strength', icon: Dumbbell },
    { key: 'fat_loss', icon: Flame },
    { key: 'fitness', icon: Zap },
];
/** What the coach reads for each goal (it writes the plan in the app language). */
const GOAL_TEXT: Record<Goal, string> = {
    muscle: 'Build muscle',
    strength: 'Get stronger',
    fat_loss: 'Lose fat while keeping muscle',
    fitness: 'Improve general fitness',
};
const STEPS = ['history', 'week', 'exercises', 'progression'] as const;
/** A Monday, to label weekdays in the app language. */
const MONDAY = new Date(2024, 0, 1);

export const PlanBuilderScreen = ({ navigation }: any) => {
    const { t, i18n } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { isAISubscriber } = useSubscription();
    const { plan } = usePlan();
    const profile = useQuery(api.users.me, isAISubscriber ? {} : 'skip');
    const generate = useAction(api.planAI.generate);

    const [goal, setGoal] = useState<Goal | null>(null);
    const [goalDetail, setGoalDetail] = useState('');
    const [weeks, setWeeks] = useState<number>(8);
    const [days, setDays] = useState<number[]>(defaultTrainingDays(3));
    const [minutes, setMinutes] = useState(60);
    const [focus, setFocus] = useState<string[]>([]);
    const [startMode, setStartMode] = useState<'today' | 'monday'>('today');
    const [note, setNote] = useState('');
    const [building, setBuilding] = useState(false);
    const [step, setStep] = useState(0);
    const [error, setError] = useState<string | null>(null);

    // Start from the training profile once it loads.
    const initialized = useRef(false);
    useEffect(() => {
        if (initialized.current || !profile) return;
        initialized.current = true;
        if (profile.trainingDays) setDays(defaultTrainingDays(Math.min(6, Math.max(2, profile.trainingDays))));
        if (profile.sessionMinutes) {
            setMinutes(MINUTES.reduce((best, m) => (Math.abs(m - profile.sessionMinutes!) < Math.abs(best - profile.sessionMinutes!) ? m : best), 60));
        }
    }, [profile]);

    // Rotate the "what the coach is doing" line while building.
    useEffect(() => {
        if (!building) return;
        setStep(0);
        const id = setInterval(() => setStep(s => (s + 1) % STEPS.length), 2800);
        return () => clearInterval(id);
    }, [building]);

    const today = new Date();
    const startDate = startMode === 'today' ? today : nextMonday(today);
    const profileReady = isAISubscriber && profile !== undefined && isProfileComplete(profile);

    const toggleDay = (d: number) => setDays(prev => (prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]));
    const toggleFocus = (g: string) => setFocus(prev => (prev.includes(g) ? prev.filter(x => x !== g) : [...prev, g]));

    const handleBuild = async () => {
        if (days.length < 2 || days.length > 6) {
            setError(t('aiPlan.daysError'));
            return;
        }
        const goalText = [goal ? GOAL_TEXT[goal] : null, goalDetail.trim() || null].filter(Boolean).join(' — ');
        setBuilding(true);
        try {
            await generate({
                weeks,
                trainingDays: days,
                sessionMinutes: minutes,
                startDate: dateKey(startDate),
                ...(goalText ? { goal: goalText } : {}),
                ...(focus.length ? { focus } : {}),
                ...(note.trim() ? { comment: note.trim() } : {}),
                language: i18n.language,
            });
            navigation.replace('TrainingPlan');
        } catch (e) {
            setError(aiLimitMessage(e, t) ?? t('aiPlan.buildError'));
        } finally {
            setBuilding(false);
        }
    };

    const sectionTitle = (title: string, hint?: string) => (
        <View style={styles.sectionHead}>
            <Typography variant="label">{title}</Typography>
            {hint ? <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 12 }}>{hint}</Typography> : null}
        </View>
    );

    return (
        <ScreenLayout>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.topBar}>
                        <IconButton icon={c => <BackArrow color={c} size={20} />} onPress={() => navigation.goBack()} accessibilityLabel={t('common.goBack')} />
                    </View>

                    <View style={styles.header}>
                        <View style={styles.headerIcon}><CalendarDays color={colors.secondary} size={26} /></View>
                        <Typography variant="h1" align="center" style={{ marginTop: 14 }}>{t('aiPlan.builderTitle')}</Typography>
                        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 6, lineHeight: 22 }}>
                            {t('aiPlan.builderSubtitle')}
                        </Typography>
                    </View>

                    {isAISubscriber && profile !== undefined && !profileReady ? (
                        <Card style={styles.section}>
                            <View style={styles.infoRow}>
                                <UserRound color={colors.secondary} size={18} />
                                <Typography variant="body" style={{ flex: 1 }}>{t('aiPlan.completeProfile')}</Typography>
                            </View>
                            <Button title={t('aiPlan.completeProfileButton')} variant="ai" fullWidth style={{ marginTop: 14 }} onPress={() => navigation.navigate('Main', { screen: 'AI' })} />
                        </Card>
                    ) : (
                        <>
                            {/* Goal */}
                            <Card style={styles.section}>
                                {sectionTitle(t('aiPlan.goal'))}
                                <View style={styles.goalGrid}>
                                    {GOALS.map(({ key, icon: Icon }) => {
                                        const selected = goal === key;
                                        return (
                                            <TouchableOpacity
                                                key={key}
                                                style={[styles.goalTile, selected && styles.goalTileSelected]}
                                                onPress={() => setGoal(selected ? null : key)}
                                                activeOpacity={0.7}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected }}
                                            >
                                                <Icon color={selected ? colors.secondary : colors.textSecondary} size={18} />
                                                <Typography variant="bodySmall" bold={selected} color={selected ? colors.text : colors.textSecondary} numberOfLines={1} style={{ flexShrink: 1 }}>
                                                    {t(`aiPlan.goals.${key}`)}
                                                </Typography>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>
                                <TextInput
                                    style={styles.input}
                                    value={goalDetail}
                                    onChangeText={setGoalDetail}
                                    placeholder={t('aiPlan.goalDetailPlaceholder')}
                                    placeholderTextColor={colors.textMuted}
                                    maxLength={150}
                                />
                            </Card>

                            {/* Schedule */}
                            <Card style={styles.section}>
                                {sectionTitle(t('aiPlan.length'), t('programs.durationWeeks', { count: weeks }))}
                                <SegmentedControl
                                    options={WEEK_OPTIONS.map(w => ({ value: String(w), label: String(w) }))}
                                    value={String(weeks)}
                                    onChange={v => setWeeks(Number(v))}
                                />

                                {sectionTitle(t('aiPlan.trainingDays'), `${days.length} ${t('programs.daysPerWeek')}`)}
                                <View style={styles.daysRow}>
                                    {WEEKDAYS_MON_FIRST.map(d => {
                                        const selected = days.includes(d);
                                        const date = addDays(MONDAY, (d + 6) % 7);
                                        return (
                                            <TouchableOpacity
                                                key={d}
                                                style={[styles.dayButton, selected && styles.dayButtonSelected]}
                                                onPress={() => toggleDay(d)}
                                                activeOpacity={0.7}
                                                accessibilityRole="button"
                                                accessibilityState={{ selected }}
                                                accessibilityLabel={formatDate(date, 'EEEE')}
                                            >
                                                <Typography variant="bodySmall" bold color={selected ? colors.onSecondary : colors.textSecondary}>
                                                    {formatDate(date, 'EEEEE')}
                                                </Typography>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {sectionTitle(t('aiPlan.sessionLength'))}
                                <View style={styles.chips}>
                                    {MINUTES.map(m => (
                                        <Chip key={m} size="small" tone="secondary" label={`${m} ${t('common.min')}`} selected={minutes === m} onPress={() => setMinutes(m)} />
                                    ))}
                                </View>

                                {sectionTitle(t('aiPlan.startWhen'), formatDate(startDate, 'EEEE, MMM d'))}
                                <SegmentedControl
                                    options={[
                                        { value: 'today', label: t('aiPlan.startToday') },
                                        { value: 'monday', label: t('aiPlan.startMonday') },
                                    ]}
                                    value={startMode}
                                    onChange={setStartMode}
                                />
                            </Card>

                            {/* Focus & note */}
                            <Card style={styles.section}>
                                {sectionTitle(t('aiPlan.focus'))}
                                <View style={styles.chips}>
                                    {FOCUS.map(g => (
                                        <Chip key={g} size="small" tone="secondary" label={getMuscleGroupName(g, t)} selected={focus.includes(g)} onPress={() => toggleFocus(g)} />
                                    ))}
                                </View>

                                {sectionTitle(t('aiPlan.note'))}
                                <TextInput
                                    style={[styles.input, styles.noteInput]}
                                    value={note}
                                    onChangeText={setNote}
                                    placeholder={t('aiPlan.notePlaceholder')}
                                    placeholderTextColor={colors.textMuted}
                                    multiline
                                    maxLength={400}
                                />
                                <View style={[styles.infoRow, { marginTop: 12 }]}>
                                    <Info color={colors.textMuted} size={14} />
                                    <Typography variant="caption" color={colors.textMuted} style={{ flex: 1, fontSize: 12 }}>{t('aiPlan.usesProfile')}</Typography>
                                </View>
                            </Card>

                            {!!plan && (
                                <View style={styles.warning}>
                                    <AlertTriangle color={colors.warning} size={16} />
                                    <Typography variant="bodySmall" color={colors.textSecondary} style={{ flex: 1 }}>
                                        {t('aiPlan.replaceWarning', { name: plan.name })}
                                    </Typography>
                                </View>
                            )}

                            <Button
                                title={t('aiPlan.build')}
                                size="large"
                                fullWidth
                                icon={c => <Sparkles color={c} size={18} />}
                                onPress={handleBuild}
                                disabled={building || !profileReady}
                                style={{ marginTop: 6 }}
                            />
                        </>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* Building */}
            <Modal visible={building} transparent animationType="fade">
                <View style={styles.overlay}>
                    <View style={styles.buildingCard}>
                        <View style={styles.headerIcon}><Sparkles color={colors.secondary} size={26} /></View>
                        <Typography variant="h3" align="center" style={{ marginTop: 16 }}>{t('aiPlan.building')}</Typography>
                        <Typography variant="bodySmall" color={colors.textSecondary} align="center" style={{ marginTop: 6, minHeight: 36 }}>
                            {t(`aiPlan.buildingSteps.${STEPS[step]}`)}
                        </Typography>
                        <ActivityIndicator color={colors.secondary} style={{ marginTop: 12 }} />
                    </View>
                </View>
            </Modal>

            <ConfirmationModal
                visible={!!error}
                title={t('aiPlan.builderTitle')}
                message={error ?? ''}
                confirmText={t('common.ok')}
                onConfirm={() => setError(null)}
            />
        </ScreenLayout>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        paddingTop: 4,
        paddingBottom: 4,
    },
    header: {
        alignItems: 'center',
        paddingHorizontal: 8,
        marginBottom: 22,
    },
    headerIcon: {
        width: 60,
        height: 60,
        borderRadius: 18,
        backgroundColor: colors.secondarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    section: {
        padding: 16,
        paddingTop: 4,
    },
    sectionHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
        marginTop: 14,
        marginBottom: 10,
    },
    goalGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    goalTile: {
        flexBasis: '48%',
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: borderRadius.m,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
    },
    goalTileSelected: {
        borderColor: colors.secondary,
        backgroundColor: colors.secondarySoft,
    },
    input: {
        marginTop: 10,
        minHeight: 46,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        fontSize: 14.5,
    },
    noteInput: {
        marginTop: 0,
        minHeight: 72,
        textAlignVertical: 'top',
    },
    daysRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 4,
    },
    dayButton: {
        flex: 1,
        maxWidth: 44,
        aspectRatio: 1,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.surfaceLight,
    },
    dayButtonSelected: {
        backgroundColor: colors.secondary,
    },
    chips: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    warning: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        padding: 14,
        marginBottom: 12,
        borderRadius: borderRadius.m,
        backgroundColor: colors.warningSoft,
    },
    overlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 32,
    },
    buildingCard: {
        alignItems: 'center',
        padding: 26,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
});
