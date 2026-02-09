
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';

export const HomeScreen = ({ navigation }: any) => {
    const { currentWorkout, startWorkout } = useWorkout();

    return (
        <ScreenLayout>
            <Typography variant="h1" style={{ marginBottom: 24 }}>Gym Log</Typography>

            <Card>
                <Typography variant="h2" style={{ marginBottom: 8 }}>Ready to lift?</Typography>
                <Typography variant="body" style={{ marginBottom: 16 }}>
                    {currentWorkout ? 'Resume your active workout.' : 'Start a new session to track your progress.'}
                </Typography>
                <Button
                    title={currentWorkout ? "Resume Workout" : "Start Workout"}
                    onPress={() => {
                        if (!currentWorkout) startWorkout();
                        navigation.navigate('WorkoutSession');
                    }}
                />
            </Card>

            <Typography variant="h3" style={{ marginTop: 24, marginBottom: 12 }}>Recent Activity</Typography>
            {/* List recent workouts here */}
        </ScreenLayout>
    );
};
