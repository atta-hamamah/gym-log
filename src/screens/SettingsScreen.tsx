import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TextInput, ScrollView, Share } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkout } from '../context/WorkoutContext';
import { colors, spacing, borderRadius } from '../theme/colors';
import { format } from 'date-fns';

export const SettingsScreen = () => {
    const { updateUserStats, userStats, workouts, refreshData } = useWorkout();
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [height, setHeight] = useState('');

    useEffect(() => {
        if (userStats) {
            setWeight(userStats.weight?.toString() || '');
            setBodyFat(userStats.bodyFat?.toString() || '');
            setHeight(userStats.height?.toString() || '');
        }
    }, [userStats]);

    const handleSaveStats = async () => {
        const w = parseFloat(weight);

        if (isNaN(w) || w <= 0) {
            Alert.alert('Invalid Weight', 'Please enter a valid weight.');
            return;
        }

        const bf = parseFloat(bodyFat);
        const h = parseFloat(height);

        await updateUserStats({
            weight: w,
            bodyFat: isNaN(bf) ? undefined : bf,
            height: isNaN(h) ? undefined : h,
        });
        Alert.alert('✅ Saved', 'Body stats updated successfully.');
    };

    const handleExportCSV = async () => {
        if (workouts.length === 0) {
            Alert.alert('No Data', 'You have no workouts to export.');
            return;
        }

        const header = 'Date,Time,Workout Name,Exercise,Set #,Weight (kg),Reps,Volume (kg),Notes\n';
        const rows = workouts
            .flatMap(w =>
                w.exercises.flatMap(ex =>
                    ex.sets.map((s, index) =>
                        [
                            format(w.startTime, 'yyyy-MM-dd'),
                            format(w.startTime, 'HH:mm'),
                            `"${w.name}"`,
                            `"${ex.exerciseName}"`,
                            index + 1,
                            s.weight,
                            s.reps,
                            s.weight * s.reps,
                            `"${w.notes || ''}"`,
                        ].join(',')
                    )
                )
            )
            .join('\n');

        const csv = header + rows;

        try {
            await Share.share({
                message: csv,
                title: `GymLog_Export_${format(Date.now(), 'yyyy-MM-dd')}`,
            });
        } catch (error: any) {
            Alert.alert('Export Error', error.message);
        }
    };

    const handleReset = () => {
        Alert.alert(
            '⚠️ Reset All Data?',
            'This will permanently delete all workouts, custom exercises, and stats. This cannot be undone.',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete Everything',
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.clear();
                        await refreshData();
                        Alert.alert('Data Cleared', 'All data has been removed.');
                    },
                },
            ]
        );
    };

    // Calculate lifetime stats
    const totalWorkouts = workouts.length;
    const totalSets = workouts.reduce((acc, w) =>
        acc + w.exercises.reduce((a, e) => a + e.sets.length, 0), 0
    );
    const totalVolume = workouts.reduce((acc, w) =>
        acc + w.exercises.reduce((a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0), 0
    );

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Typography variant="h1" style={{ marginBottom: 24 }}>Settings</Typography>

                {/* Body Stats */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 16 }}>Body Stats</Typography>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={styles.inputLabel}>Weight (kg)</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 75"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={weight}
                            onChangeText={setWeight}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={styles.inputLabel}>Height (cm)</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 180"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={height}
                            onChangeText={setHeight}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={styles.inputLabel}>Body Fat %</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 15"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={bodyFat}
                            onChangeText={setBodyFat}
                        />
                    </View>

                    {userStats?.lastUpdated && (
                        <Typography variant="caption" style={{ marginBottom: 12 }}>
                            Last updated: {format(userStats.lastUpdated, 'MMM dd, yyyy')}
                        </Typography>
                    )}

                    <Button title="Save Stats" onPress={handleSaveStats} />
                </Card>

                {/* Lifetime Stats */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 12 }}>Lifetime Stats</Typography>
                    <View style={styles.lifetimeRow}>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" color={colors.primary}>{totalWorkouts}</Typography>
                            <Typography variant="caption">Workouts</Typography>
                        </View>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" color={colors.success}>{totalSets}</Typography>
                            <Typography variant="caption">Sets</Typography>
                        </View>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" color={colors.warning}>
                                {totalVolume > 9999 ? `${(totalVolume / 1000).toFixed(0)}k` : totalVolume}
                            </Typography>
                            <Typography variant="caption">kg Total</Typography>
                        </View>
                    </View>
                </Card>

                {/* Data Management */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 4 }}>Data Management</Typography>
                    <Typography variant="caption" style={{ marginBottom: 16 }}>
                        Export or reset your local data.
                    </Typography>

                    <Button
                        title="📤 Export Data (CSV)"
                        onPress={handleExportCSV}
                        variant="secondary"
                        style={{ marginBottom: 12 }}
                    />

                    <Button
                        title="🗑 Clear All Data"
                        onPress={handleReset}
                        variant="outline"
                        style={{ borderColor: colors.error }}
                    />
                </Card>

                <View style={styles.footer}>
                    <Typography variant="caption" style={{ textAlign: 'center' }}>
                        Gym Log v1.0.0
                    </Typography>
                    <Typography variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>
                        No ads • No subscriptions • Lifetime access
                    </Typography>
                </View>
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
    inputLabel: {
        width: 90,
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
        paddingHorizontal: 12,
        color: colors.text,
    },
    lifetimeRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    lifetimeStat: {
        alignItems: 'center',
    },
    footer: {
        marginTop: 24,
        paddingVertical: 16,
    },
});
