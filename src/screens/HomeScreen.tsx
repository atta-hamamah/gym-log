import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, TextInput, Modal, Alert, Image } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { StatBadge } from '../components/StatBadge';
import { format, isThisWeek } from 'date-fns';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { WorkoutSession } from '../types';
import { useTranslation } from 'react-i18next';

export const HomeScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { currentWorkout, startWorkout, workouts } = useWorkout();
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

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                {/* Header */}
                <View style={styles.headerRow}>
                    <View>
                        <Typography variant="h1">{t('home.title')}</Typography>
                        <Typography variant="caption" style={{ marginTop: 2 }}>
                            {t('home.subtitle')}
                        </Typography>
                    </View>
                </View>

                {/* Hero Card */}
                <Card
                    variant={currentWorkout ? 'glass' : 'default'}
                    glowColor={currentWorkout ? colors.primary : undefined}
                    style={styles.heroCard}
                >
                    <View style={styles.heroContent}>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h2" style={{ marginBottom: 6 }}>
                                {currentWorkout ? t('home.workoutActive') : t('home.readyToLift')}
                            </Typography>
                            <Typography variant="bodySmall" color={colors.textSecondary}>
                                {currentWorkout
                                    ? t('home.activeDescription', { name: currentWorkout.name, count: currentWorkout.exercises.length })
                                    : t('home.inactiveDescription')
                                }
                            </Typography>
                        </View>
                        <Image
                            source={currentWorkout ? require('../../assets/resume.jpg') : require('../../assets/ready_to_lift_icon.jpg')}
                            style={{ width: 60, height: 60, borderRadius: 8 }}
                        />
                    </View>
                    <Button
                        title={currentWorkout ? t('home.resumeWorkout') : t('home.startWorkout')}
                        onPress={handleStartWorkout}
                        size="large"
                        fullWidth
                        style={{ marginTop: 16 }}
                    />
                </Card>

                {/* Weekly Stats */}
                <Typography variant="h3" style={styles.sectionTitle}>{t('home.thisWeek')}</Typography>
                <View style={styles.statsGrid}>
                    <Card style={styles.statCell}>
                        <StatBadge value={weeklyStats.sessions} label={t('home.workouts')} color={colors.primary} />
                    </Card>
                    <Card style={styles.statCell}>
                        <StatBadge value={weeklyStats.sets} label={t('common.sets')} color={colors.secondary} />
                    </Card>
                    <Card style={styles.statCell}>
                        <StatBadge value={weeklyStats.minutes} label={t('home.minutes')} color={colors.warning} />
                    </Card>
                    <Card style={styles.statCell}>
                        <StatBadge
                            value={weeklyStats.volume > 999 ? `${(weeklyStats.volume / 1000).toFixed(1)}k` : weeklyStats.volume}
                            label={t('home.kgVolume')}
                            color={colors.accent}
                        />
                    </Card>
                </View>

                {/* Recent Activity */}
                <Typography variant="h3" style={styles.sectionTitle}>{t('home.recentActivity')}</Typography>
                {recentWorkouts.length === 0 ? (
                    <Card variant="outlined">
                        <Typography variant="body" color={colors.textMuted} align="center" style={{ paddingVertical: 20 }}>
                            {t('home.noWorkoutsYet')}
                        </Typography>
                    </Card>
                ) : (
                    recentWorkouts.map((workout: WorkoutSession) => {
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
                                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: workout.id })}
                                activeOpacity={0.7}
                            >
                                <Card style={{ marginBottom: 8 }}>
                                    <View style={styles.recentRow}>
                                        <View style={styles.recentDot} />
                                        <View style={{ flex: 1 }}>
                                            <Typography variant="body" bold>
                                                {workout.name}
                                            </Typography>
                                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                                {format(workout.startTime, 'EEE, MMM dd')} • {workout.exercises.length} {t('common.exercises')} • {duration} {t('common.min')}
                                                {volume > 0 ? ` • ${volume > 999 ? `${(volume / 1000).toFixed(1)}k` : volume} ${t('common.kg')}` : ''}
                                            </Typography>
                                        </View>
                                        <Typography variant="body" color={colors.primary} style={{ fontSize: 18 }}>›</Typography>
                                    </View>
                                </Card>
                            </TouchableOpacity>
                        );
                    })
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
                    <Card variant="elevated" style={styles.modalCard}>
                        <Typography variant="h2" style={{ marginBottom: 4 }}>{t('home.newWorkout')}</Typography>
                        <Typography variant="caption" style={{ marginBottom: 20 }}>
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
                                variant="ghost"
                                size="medium"
                                onPress={() => { setNameModalVisible(false); setWorkoutName(''); }}
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button
                                title={t('home.letsGo')}
                                onPress={handleConfirmStart}
                                size="medium"
                                style={{ flex: 1.5 }}
                            />
                        </View>
                    </Card>
                </View>
            </Modal>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        marginTop: 8,
    },
    heroCard: {
        paddingVertical: 24,
        paddingHorizontal: 20,
    },
    heroContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    sectionTitle: {
        marginTop: 28,
        marginBottom: 12,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statCell: {
        flex: 1,
        minWidth: '45%',
        alignItems: 'center',
        paddingVertical: 18,
        marginBottom: 0,
    },
    recentRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    recentDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: colors.primary,
        marginRight: 12,
        opacity: 0.7,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        padding: 24,
        marginBottom: 0,
    },
    nameInput: {
        height: 52,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        color: colors.text,
        fontSize: 16,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 20,
    },
});
