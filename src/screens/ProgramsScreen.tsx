import React, { useState, useMemo } from 'react';
import { FlatList, TouchableOpacity, View, StyleSheet, ScrollView } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { borderRadius, ThemeColors } from '../theme/colors';

import { ForwardChevron } from '../components/DirectionalIcons';
import { ScreenHeader } from '../components/ScreenHeader';
import { Chip } from '../components/Chip';
import { GoalIcon, LevelDots, goalTone } from '../components/ProgramVisuals';
import { toneColors } from '../theme/tones';
import { PROGRAMS, PROGRAM_LEVELS, PROGRAM_GOALS } from '../constants/programs';
import { WorkoutProgram } from '../types';
import { programDescription, programDuration, programName } from '../utils/programText';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext';

export const ProgramsScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
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
        const tone = toneColors(colors, goalTone(item.goal));

        return (
            <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => navigation.navigate('ProgramDetail', { programId: item.id })}
            >
                <Card style={styles.programCard}>
                    {/* Header row */}
                    <View style={styles.cardHeader}>
                        <View style={[styles.iconTile, { backgroundColor: tone.soft }]}>
                            <GoalIcon goal={item.goal} color={tone.fg} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Typography variant="h3" numberOfLines={2}>{programName(item, t)}</Typography>
                            <View style={styles.tagRow}>
                                <View style={styles.tag}>
                                    <LevelDots level={item.level} />
                                    <Typography variant="caption" color={colors.textSecondary} style={styles.tagText}>
                                        {t(`programs.levels.${item.level}`)}
                                    </Typography>
                                </View>
                                <View style={styles.tag}>
                                    <Typography variant="caption" color={colors.textSecondary} style={styles.tagText}>
                                        {t(`programs.goals.${item.goal}`)}
                                    </Typography>
                                </View>
                            </View>
                        </View>
                        <ForwardChevron color={colors.textMuted} size={18} />
                    </View>

                    {/* Description */}
                    <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 12, lineHeight: 19 }}>
                        {programDescription(item, t)}
                    </Typography>

                    {/* Stats row */}
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Typography variant="body" bold style={styles.statValue}>{item.daysPerWeek}</Typography>
                            <Typography variant="caption" color={colors.textMuted} style={styles.statLabel}>{t('programs.daysPerWeek')}</Typography>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Typography variant="body" bold style={styles.statValue}>{totalExercises}</Typography>
                            <Typography variant="caption" color={colors.textMuted} style={styles.statLabel}>{t('common.exercises')}</Typography>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Typography variant="body" bold style={[styles.statValue, styles.statValueWrap]} numberOfLines={2}>{programDuration(item.duration, t)}</Typography>
                            <Typography variant="caption" color={colors.textMuted} style={styles.statLabel}>{t('programs.duration')}</Typography>
                        </View>
                    </View>
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout>
            {/* Fixed filter header */}
            <View style={styles.filterContainer}>
                <ScreenHeader title={t('programs.title')} subtitle={t('programs.subtitle')} />

                {/* Level Filter */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                    style={styles.filterScroll}
                >
                    {PROGRAM_LEVELS.map(level => (
                        <Chip
                            key={level}
                            size="small"
                            label={level === 'all' ? t('common.all') : t(`programs.levels.${level}`)}
                            selected={selectedLevel === level}
                            onPress={() => setSelectedLevel(level)}
                        />
                    ))}
                </ScrollView>

                {/* Goal Filter */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.filterRow}
                    style={styles.filterScroll}
                >
                    {PROGRAM_GOALS.map(goal => (
                        <Chip
                            key={goal}
                            size="small"
                            label={goal === 'all' ? t('common.all') : t(`programs.goals.${goal}`)}
                            icon={goal === 'all' ? undefined : c => <GoalIcon goal={goal as WorkoutProgram['goal']} color={c} size={13} />}
                            selected={selectedGoal === goal}
                            onPress={() => setSelectedGoal(goal)}
                        />
                    ))}
                </ScrollView>
            </View>

            {/* Program List */}
            <FlatList
                data={filteredPrograms}
                renderItem={renderProgramCard}
                keyExtractor={item => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
                style={{ flex: 1 }}
                ListEmptyComponent={
                    <Card variant="outlined" style={{ paddingVertical: 40 }}>
                        <Typography variant="body" color={colors.textMuted} align="center">
                            {t('programs.noResults')}
                        </Typography>
                    </Card>
                }
            />
        </ScreenLayout>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    filterContainer: {
        flexShrink: 0,
        marginBottom: 10,
    },
    filterScroll: {
        flexGrow: 0,
        flexShrink: 0,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 6,
        paddingRight: 16,
        paddingVertical: 4,
    },
    programCard: {
        padding: 16,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconTile: {
        width: 46,
        height: 46,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tagRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 5,
    },
    tag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
    },
    tagText: {
        fontSize: 11.5,
        lineHeight: 16,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontVariant: ['tabular-nums'],
    },
    // Durations such as "Ciclos de 4 semanas" wrap onto a second line instead of being cut off.
    statValueWrap: {
        textAlign: 'center',
        lineHeight: 19,
    },
    statLabel: {
        fontSize: 11,
    },
    statDivider: {
        width: StyleSheet.hairlineWidth,
        height: 24,
        backgroundColor: colors.border,
    },
});
