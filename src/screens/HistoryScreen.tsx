import React from 'react';
import { FlatList, TouchableOpacity, View, Alert, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { StatBadge } from '../components/StatBadge';
import { format } from 'date-fns';
import { colors, spacing, borderRadius } from '../theme/colors';
import { WorkoutSession } from '../types';

export const HistoryScreen = ({ navigation }: any) => {
    const { workouts, deleteWorkout } = useWorkout();

    const handleDelete = (id: string) => {
        Alert.alert('Delete Workout?', 'This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: () => deleteWorkout(id),
            },
        ]);
    };

    const renderItem = ({ item, index }: { item: WorkoutSession; index: number }) => {
        const duration = item.endTime
            ? Math.round((item.endTime - item.startTime) / 60000)
            : 0;
        const totalSets = item.exercises.reduce((acc, e) => acc + e.sets.length, 0);
        const totalVolume = item.exercises.reduce(
            (acc, e) => acc + e.sets.reduce((a, s) => a + s.weight * s.reps, 0),
            0
        );

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: item.id })}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.7}
            >
                <Card style={{ marginBottom: 10 }}>
                    {/* Title Row */}
                    <View style={styles.titleRow}>
                        <View style={styles.dayBadge}>
                            <Typography variant="label" color={colors.primary} style={{ fontSize: 10 }}>
                                {format(item.startTime, 'EEE').toUpperCase()}
                            </Typography>
                            <Typography variant="h3" color={colors.text} style={{ lineHeight: 22 }}>
                                {format(item.startTime, 'dd')}
                            </Typography>
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Typography variant="body" bold>{item.name}</Typography>
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {format(item.startTime, 'MMM yyyy • HH:mm')}
                            </Typography>
                        </View>
                        <Typography variant="body" color={colors.textMuted} style={{ fontSize: 20 }}>›</Typography>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.primary} bold>
                                {item.exercises.length}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>exercises</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.secondary} bold>
                                {totalSets}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>sets</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.warning} bold>
                                {duration}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>min</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.accent} bold>
                                {totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>kg</Typography>
                        </View>
                    </View>

                    {/* Notes preview */}
                    {item.notes ? (
                        <View style={styles.noteRow}>
                            <Typography variant="caption" numberOfLines={1} style={{ fontStyle: 'italic' }}>
                                📝 {item.notes}
                            </Typography>
                        </View>
                    ) : null}
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout>
            <View style={styles.headerRow}>
                <Typography variant="h1">History</Typography>
                {workouts.length > 0 && (
                    <Typography variant="caption" color={colors.textMuted}>
                        {workouts.length} workout{workouts.length !== 1 ? 's' : ''}
                    </Typography>
                )}
            </View>

            {workouts.length === 0 ? (
                <View style={styles.emptyState}>
                    <Typography variant="number" style={{ fontSize: 48, marginBottom: 12 }}>📋</Typography>
                    <Typography variant="h3" color={colors.textMuted} align="center" style={{ marginBottom: 8 }}>
                        No workouts yet
                    </Typography>
                    <Typography variant="body" color={colors.textMuted} align="center">
                        Complete a session to see{'\n'}your history here.
                    </Typography>
                </View>
            ) : (
                <FlatList
                    data={workouts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                />
            )}
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dayBadge: {
        width: 44,
        height: 50,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: colors.border,
    },
    noteRow: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
    },
});
