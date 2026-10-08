import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Image } from 'react-native';
import { Sparkles, Dumbbell, Layers, Clock, Weight, ChevronRight, Play, Plus } from 'lucide-react-native';
import { ScreenHeader } from '../components/ScreenHeader';
import { StatTile } from '../components/StatTile';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { TrialBanner } from '../components/TrialBanner';
import { useWorkout } from '../context/WorkoutContext';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '@clerk/clerk-expo';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { format, isThisWeek } from 'date-fns';
import { borderRadius, ThemeColors } from '../theme/colors';
import { WorkoutSession } from '../types';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';

export const HomeScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight } = useUnits();
    const { currentWorkout, startWorkout, workouts } = useWorkout();
    const { tier, isAISubscriber } = useSubscription();
    const { isSignedIn } = useAuth();
    const [nameModalVisible, setNameModalVisible] = useState(false);
    const [workoutName, setWorkoutName] = useState('');

    const recentWorkouts = workouts.slice(0, 5);

    const weeklyStats = useMemo(() => {
        const thisWeekWorkouts = workouts.filter((w: WorkoutSession) =>
            isThisWeek(w.startTime, { weekStartsOn: 1 })
        );
        const totalSets = thisWeekWorkouts.reduce(
            (acc, w) => acc + w.exercises.reduce((a, e) => a + e.sets.length, 0),
            0
        );
        const totalDuration = thisWeekWorkouts.reduce((acc, w) => {
            if (w.endTime) return acc + Math.round((w.endTime - w.startTime) / 60000);
            return acc;
        }, 0);
        const totalVolume = thisWeekWorkouts.reduce(
            (acc, w) =>
                acc +
                w.exercises.reduce(
                    (a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0),
                    0
                ),
            0
        );

        return {
            sessions: thisWeekWorkouts.length,
            sets: totalSets,
            minutes: totalDuration,
            volume: totalVolume,
        };
    }, [workouts]);

    const handleStartWorkout = () => {
        if (currentWorkout) {
            navigation.navigate('WorkoutSession');
        } else {
            setNameModalVisible(true);
        }
    };

    const handleConfirmStart = () => {
        const name = workoutName.trim() || 'Workout';
        startWorkout(name);
        setWorkoutName('');
        setNameModalVisible(false);
        navigation.navigate('WorkoutSession');
    };

    const aiAvailable = isAISubscriber && isSignedIn;
    const formatVolume = (kg: number) => {
        const v = displayWeight(kg);
        return v > 999 ? `${(v / 1000).toFixed(1)}k` : `${Math.round(v)}`;
    };

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                <ScreenHeader title={t('home.title')} subtitle={t('home.subtitle')} />

                {/* Trial / Upgrade Banner */}
                {(tier === 'pro_trial' || tier === 'free') && (
                    <TrialBanner onPress={() => navigation.navigate('Paywall')} />
                )}

                {/* Hero Card */}
                <Card style={styles.heroCard}>
                    <View style={styles.heroContent}>
                        <View style={{ flex: 1 }}>
                            {currentWorkout && (
                                <View style={styles.liveChip}>
                                    <View style={styles.liveDot} />
                                    <Typography variant="caption" color={colors.success} bold>
                                        {t('home.workoutActive')}
                                    </Typography>
                                </View>
                            )}
                            <Typography variant="h2" numberOfLines={2} style={{ marginBottom: 4 }}>
                                {currentWorkout ? currentWorkout.name : t('home.readyToLift')}
                            </Typography>
                            <Typography variant="bodySmall" color={colors.textSecondary}>
                                {currentWorkout
                                    ? `${currentWorkout.exercises.length} ${t('common.exercises')} · ${currentWorkout.exercises.reduce((n, e) => n + e.sets.length, 0)} ${t('common.sets')}`
                                    : t('home.inactiveDescription')
                                }
                            </Typography>
                        </View>
                        <Image
                            source={currentWorkout ? require('../../assets/resume.jpg') : require('../../assets/ready_to_lift_icon.jpg')}
                            style={styles.heroImage}
                        />
                    </View>
                    <Button
                        title={currentWorkout ? t('home.resumeWorkout') : t('home.startWorkout')}
                        onPress={handleStartWorkout}
                        size="large"
                        fullWidth
                        icon={c => (currentWorkout ? <Play color={c} size={18} fill={c} /> : <Plus color={c} size={20} />)}
                        style={{ marginTop: 18 }}
                    />
                </Card>

                {/* Weekly Stats */}
                <Typography variant="h3" style={styles.sectionTitle}>{t('home.thisWeek')}</Typography>
                <View style={styles.statsGrid}>
                    <View style={styles.statsRow}>
                        <StatTile value={weeklyStats.sessions} label={t('home.workouts')} icon={c => <Dumbbell color={c} size={16} />} tone="primary" />
                        <StatTile value={weeklyStats.sets} label={t('common.sets')} icon={c => <Layers color={c} size={16} />} tone="secondary" />
                    </View>
                    <View style={styles.statsRow}>
                        <StatTile value={weeklyStats.minutes} label={t('home.minutes')} icon={c => <Clock color={c} size={16} />} tone="accent" />
                        <StatTile value={formatVolume(weeklyStats.volume)} label={`${weightUnit} ${t('home.volume')}`} icon={c => <Weight color={c} size={16} />} tone="success" />
                    </View>
                </View>

                {/* Recent Activity */}
                <Typography variant="h3" style={styles.sectionTitle}>{t('home.recentActivity')}</Typography>
                {recentWorkouts.length === 0 ? (
                    <Card variant="outlined" style={styles.emptyCard}>
                        <Dumbbell color={colors.textMuted} size={22} />
                        <Typography variant="body" color={colors.textMuted} align="center">
                            {t('home.noWorkoutsYet')}
                        </Typography>
                    </Card>
                ) : (
                    <View style={styles.recentList}>
                        {recentWorkouts.map((workout: WorkoutSession, i: number) => {
                            const duration = workout.endTime
                                ? Math.round((workout.endTime - workout.startTime) / 60000)
                                : 0;
                            const volume = workout.exercises.reduce(
                                (a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0),
                                0
                            );
                            return (
                                <TouchableOpacity
                                    key={workout.id}
                                    style={[styles.recentRow, i > 0 && styles.recentRowBorder]}
                                    onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
                                    activeOpacity={0.6}
                                >
                                    <View style={styles.dateTile}>
                                        <Typography variant="caption" color={colors.primary} bold style={styles.dateDay}>
                                            {format(workout.startTime, 'EEE')}
                                        </Typography>
                                        <Typography variant="body" bold style={styles.dateNum}>
                                            {format(workout.startTime, 'dd')}
                                        </Typography>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Typography variant="body" bold numberOfLines={1}>
                                            {workout.name}
                                        </Typography>
                                        <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }} numberOfLines={1}>
                                            {workout.exercises.length} {t('common.exercises')} · {duration} {t('common.min')}
                                            {volume > 0 ? ` · ${formatVolume(volume)} ${weightUnit}` : ''}
                                        </Typography>
                                    </View>
                                    <ChevronRight color={colors.textMuted} size={18} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </ScrollView>

            {/* Workout Name Modal */}
            <Modal
                visible={nameModalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setNameModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Typography variant="h2" style={{ marginBottom: 4 }}>{t('home.newWorkout')}</Typography>
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginBottom: 18 }}>
                            {t('home.giveSessionName')}
                        </Typography>

                        <TextInput
                            style={styles.nameInput}
                            placeholder={t('home.namePlaceholder')}
                            placeholderTextColor={colors.textMuted}
                            value={workoutName}
                            onChangeText={setWorkoutName}
                            autoFocus
                            onSubmitEditing={handleConfirmStart}
                            returnKeyType="go"
                        />

                        <View style={styles.modalButtons}>
                            <Button
                                title={t('common.cancel')}
                                variant="outline"
                                onPress={() => { setNameModalVisible(false); setWorkoutName(''); }}
                                style={{ flex: 1 }}
                            />
                            <Button
                                title={t('home.letsGo')}
                                onPress={handleConfirmStart}
                                style={{ flex: 1.5 }}
                            />
                        </View>

                        {/* AI Generate — AI subscribers only */}
                        <TouchableOpacity
                            style={[styles.aiGenerateBtn, !aiAvailable && styles.aiGenerateBtnDisabled]}
                            onPress={() => {
                                if (aiAvailable) {
                                    setNameModalVisible(false);
                                    setWorkoutName('');
                                    navigation.navigate('Main', { screen: 'AI' });
                                }
                            }}
                            activeOpacity={aiAvailable ? 0.7 : 1}
                            disabled={!aiAvailable}
                        >
                            <View style={styles.aiGenerateIconWrap}>
                                <Sparkles color={aiAvailable ? colors.secondary : colors.textMuted} size={18} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Typography variant="body" color={aiAvailable ? colors.text : colors.textMuted} bold>
                                    {t('home.generateWithAI')}
                                </Typography>
                                {!aiAvailable && (
                                    <Typography variant="caption" color={colors.textMuted} style={{ marginTop: 1 }}>
                                        {t('home.aiSubscriptionOnly')}
                                    </Typography>
                                )}
                            </View>
                            {aiAvailable && <ChevronRight color={colors.secondary} size={18} />}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    heroCard: {
        padding: 20,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    heroImage: {
        width: 64,
        height: 64,
        borderRadius: 16,
    },
    liveChip: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.full,
        backgroundColor: colors.successSoft,
        marginBottom: 8,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: colors.success,
    },
    sectionTitle: {
        marginTop: 26,
        marginBottom: 12,
    },
    statsGrid: {
        gap: 10,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    emptyCard: {
        alignItems: 'center',
        gap: 10,
        paddingVertical: 28,
    },
    recentList: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.l,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    recentRowBorder: {
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    dateTile: {
        width: 44,
        height: 46,
        borderRadius: 12,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dateDay: {
        fontSize: 10.5,
        lineHeight: 13,
        textTransform: 'uppercase',
    },
    dateNum: {
        fontSize: 16,
        lineHeight: 20,
        fontVariant: ['tabular-nums'],
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 22,
    },
    modalCard: {
        padding: 22,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    nameInput: {
        height: 52,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        color: colors.text,
        fontSize: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 18,
    },
    aiGenerateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 14,
        padding: 12,
        borderRadius: borderRadius.m,
        backgroundColor: colors.secondarySoft,
    },
    aiGenerateBtnDisabled: {
        backgroundColor: colors.surfaceLight,
        opacity: 0.7,
    },
    aiGenerateIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
