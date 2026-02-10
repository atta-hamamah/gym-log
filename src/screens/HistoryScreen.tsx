import React from 'react';
import { FlatList, TouchableOpacity, View, Alert, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { format } from 'date-fns';
import { colors, spacing } from '../theme/colors';
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

    const renderItem = ({ item }: { item: WorkoutSession }) => {
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
                <Card>
                    <View style={styles.cardRow}>
                        <View style={{ flex: 1 }}>
                            <Typography variant="h3">{item.name}</Typography>
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {format(item.startTime, 'EEE, MMM dd, yyyy • HH:mm')}
                            </Typography>
                        </View>
                    </View>

                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Typography variant="body" color={colors.primary} style={{ fontWeight: '700' }}>
                                {item.exercises.length}
                            </Typography>
                            <Typography variant="caption">exercises</Typography>
                        </View>
                        <View style={styles.stat}>
                            <Typography variant="body" color={colors.primary} style={{ fontWeight: '700' }}>
                                {totalSets}
                            </Typography>
                            <Typography variant="caption">sets</Typography>
                        </View>
                        <View style={styles.stat}>
                            <Typography variant="body" color={colors.primary} style={{ fontWeight: '700' }}>
                                {duration}
                            </Typography>
                            <Typography variant="caption">min</Typography>
                        </View>
                        <View style={styles.stat}>
                            <Typography variant="body" color={colors.warning} style={{ fontWeight: '700' }}>
                                {totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                            </Typography>
                            <Typography variant="caption">kg vol</Typography>
                        </View>
                    </View>

                    {item.notes ? (
                        <Typography variant="caption" numberOfLines={1} style={{ marginTop: 8, fontStyle: 'italic' }}>
                            "{item.notes}"
                        </Typography>
                    ) : null}
                </Card>
            </TouchableOpacity>
        );
    };

    return (
        <ScreenLayout>
            <Typography variant="h1" style={{ marginBottom: 16 }}>History</Typography>

            {workouts.length === 0 ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 }}>
                    <Typography variant="h3" color={colors.textSecondary} style={{ marginBottom: 8 }}>
                        📋
                    </Typography>
                    <Typography variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
                        No workouts logged yet.{'\n'}Complete a session to see it here.
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
    cardRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        gap: 16,
    },
    stat: {
        alignItems: 'center',
    },
});
