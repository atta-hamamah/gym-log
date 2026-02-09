
import React from 'react';
import { FlatList, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { format } from 'date-fns';
import { WorkoutSession } from '../types';

export const HistoryScreen = ({ navigation }: any) => {
    const { workouts } = useWorkout();

    return (
        <ScreenLayout>
            <Typography variant="h1" style={{ marginBottom: 16 }}>History</Typography>
            {workouts.length === 0 ? (
                <Typography variant="body" style={{ opacity: 0.5 }}>No workouts logged yet.</Typography>
            ) : (
                <FlatList
                    data={workouts}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }: { item: WorkoutSession }) => (
                        <TouchableOpacity onPress={() => navigation.navigate('WorkoutDetails', { workoutId: item.id })}>
                            <Card>
                                <Typography variant="h3">{item.name}</Typography>
                                <Typography variant="caption" style={{ marginBottom: 4 }}>
                                    {format(item.startTime, 'MMM dd, yyyy - HH:mm')}
                                </Typography>
                                <Typography variant="body">{item.exercises.length} Exercises</Typography>
                                {item.notes && <Typography variant="caption" numberOfLines={1}>{item.notes}</Typography>}
                            </Card>
                        </TouchableOpacity>
                    )}
                />
            )}
        </ScreenLayout>
    );
};
