
import React, { useState, useMemo } from 'react';
import { ScrollView, Dimensions, View, TouchableOpacity, Modal, Text } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { LineChart } from 'react-native-chart-kit';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { format } from 'date-fns';
import { Exercise, WorkoutSession, ExerciseLog, Set as WorkoutSet } from '../types';

export const ProgressScreen = () => {
    const { workouts, exercises } = useWorkout();
    const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
    const [modalVisible, setModalVisible] = useState(false);

    // Calculate data for the chart
    const chartData = useMemo(() => {
        if (!selectedExercise) return null;

        // Filter workouts that contain this exercise
        const relevantWorkouts = workouts
            .filter((w: WorkoutSession) => w.exercises.some((e: ExerciseLog) => e.exerciseId === selectedExercise.id))
            .sort((a, b) => a.startTime - b.startTime); // Oldest first

        if (relevantWorkouts.length === 0) return null;

        const dataPoints = relevantWorkouts.map((w: WorkoutSession) => {
            const exerciseLog = w.exercises.find((e: ExerciseLog) => e.exerciseId === selectedExercise.id);
            if (!exerciseLog) return { date: w.startTime, value: 0 };

            // Calculate max weight for this session
            const maxWeight = Math.max(...exerciseLog.sets.map((s: WorkoutSet) => s.weight), 0);
            return {
                date: w.startTime,
                value: maxWeight
            };
        });

        // Limit to last 10 sessions for readability if too many
        const limitedData = dataPoints.slice(-10);

        return {
            labels: limitedData.map((d: { date: number }) => format(d.date, 'MM/dd')),
            datasets: [{
                data: limitedData.map((d: { value: number }) => d.value)
            }]
        };
    }, [selectedExercise, workouts]);

    return (
        <ScreenLayout>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Typography variant="h1">Progress</Typography>
                <Button
                    title={selectedExercise ? "Change" : "Select Exercise"}
                    variant="secondary"
                    onPress={() => setModalVisible(true)}
                    style={{ height: 36, paddingHorizontal: 12 }}
                />
            </View>

            {selectedExercise ? (
                <View>
                    <Typography variant="h3" style={{ marginBottom: 8, color: colors.primary }}>
                        {selectedExercise.name} (Max Weight)
                    </Typography>

                    {chartData && chartData.datasets[0].data.length > 0 ? (
                        <LineChart
                            data={chartData}
                            width={Dimensions.get("window").width - 32}
                            height={220}
                            yAxisLabel=""
                            yAxisSuffix="kg"
                            chartConfig={{
                                backgroundColor: colors.surface,
                                backgroundGradientFrom: colors.surface,
                                backgroundGradientTo: colors.surface,
                                decimalPlaces: 0,
                                color: (opacity = 1) => `rgba(0, 209, 255, ${opacity})`, // Primary cyan
                                labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                                style: {
                                    borderRadius: borderRadius.m
                                },
                                propsForDots: {
                                    r: "4",
                                    strokeWidth: "2",
                                    stroke: colors.primary
                                }
                            }}
                            bezier
                            style={{
                                marginVertical: 8,
                                borderRadius: borderRadius.m
                            }}
                        />
                    ) : (
                        <Typography variant="body" style={{ marginTop: 20, textAlign: 'center' }}>
                            No data available for this exercise.
                        </Typography>
                    )}
                </View>
            ) : (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="body" color={colors.textSecondary}>
                        Select an exercise to view your progress over time.
                    </Typography>
                </View>
            )}

            <Modal
                visible={modalVisible}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setModalVisible(false)}
            >
                <ScreenLayout>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Typography variant="h2">Select Exercise</Typography>
                        <Button title="Close" variant="text" onPress={() => setModalVisible(false)} />
                    </View>
                    <ScrollView>
                        {exercises.map(ex => (
                            <TouchableOpacity
                                key={ex.id}
                                style={{
                                    padding: spacing.m,
                                    borderBottomWidth: 1,
                                    borderBottomColor: colors.border,
                                }}
                                onPress={() => {
                                    setSelectedExercise(ex);
                                    setModalVisible(false);
                                }}
                            >
                                <Typography variant="body">{ex.name}</Typography>
                                <Typography variant="caption">{ex.muscleGroup}</Typography>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </ScreenLayout>
            </Modal>
        </ScreenLayout>
    );
};
