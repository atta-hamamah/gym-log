
import React, { useState } from 'react';
import { View, StyleSheet, Alert, TextInput, ScrollView, Share } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkout } from '../context/WorkoutContext';
import { colors, spacing, borderRadius } from '../theme/colors';

export const SettingsScreen = () => {
    const { updateUserStats, userStats, workouts } = useWorkout();
    const [weight, setWeight] = useState(userStats?.weight?.toString() || '');
    const [bodyFat, setBodyFat] = useState(userStats?.bodyFat?.toString() || '');

    const handleSaveStats = async () => {
        const w = parseFloat(weight);
        const bf = parseFloat(bodyFat);

        if (isNaN(w)) {
            Alert.alert('Invalid Weight', 'Please enter a valid weight.');
            return;
        }

        await updateUserStats({
            weight: w,
            bodyFat: isNaN(bf) ? undefined : bf
        });
        Alert.alert('Success', 'Stats updated.');
    };

    const handleExport = async () => {
        if (workouts.length === 0) {
            Alert.alert('No Data', 'You have no workouts to export.');
            return;
        }

        // Simple CSV generation
        const header = 'Date,Workout Name,Exercise,Set,Weight,Reps\n';
        const rows = workouts.flatMap(w =>
            w.exercises.flatMap(ex =>
                ex.sets.map((s, index) =>
                    `${new Date(w.startTime).toISOString()},"${w.name}","${ex.exerciseName}",${index + 1},${s.weight},${s.reps}`
                )
            )
        ).join('\n');

        const csv = header + rows;

        try {
            await Share.share({
                message: csv,
                title: 'Gym Log Export'
            });
        } catch (error: any) {
            Alert.alert(error.message);
        }
    };

    const handleReset = async () => {
        Alert.alert('Reset Data', 'This will delete all workouts and custom exercises.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await AsyncStorage.clear();
                    Alert.alert('Data cleared', 'Please restart the app.');
                }
            }
        ]);
    };

    return (
        <ScreenLayout>
            <ScrollView>
                <Typography variant="h1" style={{ marginBottom: 24 }}>Settings</Typography>

                <Card>
                    <Typography variant="h3" style={{ marginBottom: 16 }}>Body Stats</Typography>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={{ width: 80 }}>Weight (kg)</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={weight}
                            onChangeText={setWeight}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={{ width: 80 }}>Body Fat %</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="0"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={bodyFat}
                            onChangeText={setBodyFat}
                        />
                    </View>

                    <Button title="Save Stats" onPress={handleSaveStats} />
                </Card>

                <Card>
                    <Typography variant="h3">Data Management</Typography>
                    <Typography variant="body" style={{ marginBottom: 16 }}>
                        Manage your local data.
                    </Typography>

                    <Button title="Export Data (CSV)" onPress={handleExport} variant="secondary" style={{ marginBottom: 12 }} />

                    <Button title="Clear All Data" onPress={handleReset} variant="outline" style={{ borderColor: '#FF4444' }} />
                </Card>

                <Typography variant="caption" style={{ marginTop: 20, textAlign: 'center' }}>Gym Log v1.0.0</Typography>
            </ScrollView>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
        paddingHorizontal: 12,
        color: colors.text,
    },
});
