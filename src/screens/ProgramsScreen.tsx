import React, { useState, useMemo } from 'react';
import { FlatList, TouchableOpacity, View, StyleSheet, ScrollView } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { colors, spacing, borderRadius, shadows } from '../theme/colors';
import { PROGRAMS, PROGRAM_LEVELS, PROGRAM_GOALS } from '../constants/programs';
import { WorkoutProgram } from '../types';
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

export const ProgramsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const [selectedLevel, setSelectedLevel] = useState<string>('all');
    const [selectedGoal, setSelectedGoal] = useState<string>('all');

    const filteredPrograms = useMemo(() => {
        return PROGRAMS.filter(p => {
            if (selectedLevel !== 'all' && p.level !== selectedLevel) return false;
            if (selectedGoal !== 'all' && p.goal !== selectedGoal) return false;
            return true;
        });
    }, [selectedLevel, selectedGoal]);

    const renderProgramCard = ({ item }: { item: WorkoutProgram }) => {
        const totalExercises = item.days.reduce((acc, d) => acc + d.exercises.length, 0);

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ProgramDetail', { programId: item.id })}
            >
                <Card style={styles.programCard}>
                    {/* Color accent strip */}
                    <View style={[styles.accentStrip, { backgroundColor: item.color }]} />

                    <View style={styles.cardContent}>
                        {/* Header row */}
                        <View style={styles.cardHeader}>
                            <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                                <Typography variant="h2" style={{ fontSize: 24 }}>{item.icon}</Typography>
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Typography variant="h3" style={{ marginBottom: 2 }}>{item.name}</Typography>
                                <View style={styles.tagRow}>
                                    <View style={[styles.levelBadge, { backgroundColor: item.color + '20' }]}>
                                        <Typography variant="caption" color={item.color} bold style={{ fontSize: 10 }}>
                                            {LEVEL_ICONS[item.level]} {t(`programs.levels.${item.level}`)}
                                        </Typography>
                                    </View>
                                    <View style={styles.goalBadge}>
                                        <Typography variant="caption" color={colors.textSecondary} style={{ fontSize: 10 }}>
                                            {GOAL_ICONS[item.goal] || '🎯'} {t(`programs.goals.${item.goal}`)}
                                        </Typography>
                                    </View>
                                </View>
                            </View>
                            <Typography variant="body" color={item.color} style={{ fontSize: 18, fontWeight: '700' }}>›</Typography>
                        </View>

                        {/* Description */}
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 10, lineHeight: 18 }}>
                            {item.description}
                        </Typography>

                        {/* Stats row */}
                        <View style={styles.statsRow}>
                            <View style={styles.statItem}>
                                <Typography variant="label" color={colors.text} style={{ fontSize: 14 }}>{item.daysPerWeek}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t('programs.daysPerWeek')}</Typography>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="label" color={colors.text} style={{ fontSize: 14 }}>{totalExercises}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t('common.exercises')}</Typography>
                            </View>
                            <View style={styles.statDivider} />
                            <View style={styles.statItem}>
                                <Typography variant="label" color={colors.text} style={{ fontSize: 14 }}>{item.duration}</Typography>
                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10 }}>{t('programs.duration')}</Typography>
                            </View>
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout>
            {/* Header */}
            <View style={styles.headerRow}>
                <View>
                    <Typography variant="h1">{t('programs.title')}</Typography>
                    <Typography variant="caption" style={{ marginTop: 2 }}>
                        {t('programs.subtitle')}
                    </Typography>
                </View>
            </View>

            {/* Level Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={{ flexGrow: 0, marginBottom: 6 }}
            >
                {PROGRAM_LEVELS.map(level => (
                    <TouchableOpacity
                        key={level}
                        style={[
                            styles.filterChip,
                            selectedLevel === level && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedLevel(level)}
                        activeOpacity={0.7}
                    >
                        <Typography
                            variant="caption"
                            color={selectedLevel === level ? colors.black : colors.textSecondary}
                            bold={selectedLevel === level}
                            style={{ fontSize: 12 }}
                        >
                            {level === 'all' ? t('common.all') : `${LEVEL_ICONS[level] || ''} ${t(`programs.levels.${level}`)}`}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Goal Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterRow}
                style={{ flexGrow: 0, marginBottom: 12 }}
            >
                {PROGRAM_GOALS.map(goal => (
                    <TouchableOpacity
                        key={goal}
                        style={[
                            styles.filterChip,
                            selectedGoal === goal && styles.filterChipActiveSecondary,
                        ]}
                        onPress={() => setSelectedGoal(goal)}
                        activeOpacity={0.7}
                    >
                        <Typography
                            variant="caption"
                            color={selectedGoal === goal ? colors.black : colors.textSecondary}
                            bold={selectedGoal === goal}
                            style={{ fontSize: 12 }}
                        >
                            {goal === 'all' ? t('common.all') : `${GOAL_ICONS[goal] || ''} ${t(`programs.goals.${goal}`)}`}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Program List */}
            <FlatList
                data={filteredPrograms}
                renderItem={renderProgramCard}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                ListEmptyComponent={
                    <Card variant="outlined" style={{ marginTop: 20, paddingVertical: 40 }}>
                        <Typography variant="body" color={colors.textMuted} align="center">
                            {t('programs.noResults')}
                        </Typography>
                    </Card>
                }
            />
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
        marginTop: 8,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 16,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    filterChipActiveSecondary: {
        backgroundColor: colors.secondary,
        borderColor: colors.secondary,
    },
    programCard: {
        padding: 0,
        overflow: 'hidden',
        marginBottom: 12,
    },
    accentStrip: {
        height: 3,
        width: '100%',
    },
    cardContent: {
        padding: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    levelBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
    },
    goalBadge: {
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statDivider: {
        width: 1,
        height: 24,
        backgroundColor: colors.border,
    },
});
