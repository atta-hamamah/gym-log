import React, { useState, useEffect } from 'react';
import { ScrollView, View, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, borderRadius, spacing } from '../theme/colors';
import { ExerciseLog, Set } from '../types';

export const WorkoutSessionScreen = ({ navigation }: any) => {
    const { currentWorkout, finishWorkout, cancelWorkout, addExerciseToWorkout } = useWorkout();
    const [notes, setNotes] = useState('');
    const [elapsed, setElapsed] = useState(0);

    // Timer
    useEffect(() => {
        if (!currentWorkout) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [currentWorkout]);

    const formatTime = (seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    if (!currentWorkout) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2" style={{ marginBottom: 16 }}>No active workout</Typography>
                    <Button title="Go Back" onPress={() => navigation.goBack()} />
                </View>
            </ScreenLayout>
        );
    }

    const handleFinish = () => {
        Alert.alert(
            'Finish Workout?',
            'Are you sure you want to finish this workout?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Finish',
                    onPress: async () => {
                        await finishWorkout(notes);
                        navigation.goBack();
                    },
                },
            ]
        );
    };

    const handleCancel = () => {
        Alert.alert('Cancel Workout?', 'Progress will be lost.', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes',
                style: 'destructive',
                onPress: async () => {
                    await cancelWorkout();
                    navigation.goBack();
                },
            },
        ]);
    };

    const totalSets = currentWorkout.exercises.reduce((acc, e) => acc + e.sets.length, 0);
    const totalVolume = currentWorkout.exercises.reduce(
        (acc, e) => acc + e.sets.reduce((a, s) => a + s.weight * s.reps, 0),
        0
    );

    return (
        <ScreenLayout>
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Typography variant="h2">{currentWorkout.name}</Typography>
                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 4 }}>
                        <Typography variant="caption" color={colors.primary}>
                            ⏱ {formatTime(elapsed)}
                        </Typography>
                        <Typography variant="caption">
                            {totalSets} sets
                        </Typography>
                        <Typography variant="caption">
                            {totalVolume.toLocaleString()} kg vol
                        </Typography>
                    </View>
                </View>
                <Button
                    title="Finish"
                    variant="primary"
                    onPress={handleFinish}
                    style={{ width: 90, height: 40 }}
                />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {currentWorkout.exercises.length === 0 ? (
                    <View style={{ alignItems: 'center', padding: 40 }}>
                        <Typography variant="body" color={colors.textSecondary}>
                            Tap "+ Add Exercise" to get started.
                        </Typography>
                    </View>
                ) : (
                    currentWorkout.exercises.map((log) => (
                        <ExerciseCard key={log.id} log={log} />
                    ))
                )}

                <Button
                    title="+ Add Exercise"
                    variant="secondary"
                    onPress={() => navigation.navigate('ExerciseList')}
                    style={{ marginTop: 20 }}
                />

                <TextInput
                    style={[styles.notesInput]}
                    placeholder="Workout Notes..."
                    placeholderTextColor={colors.textSecondary}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                />

                <Button
                    title="Cancel Workout"
                    variant="text"
                    onPress={handleCancel}
                    style={{ marginTop: 20 }}
                />
            </ScrollView>
        </ScreenLayout>
    );
};

const ExerciseCard = ({ log }: { log: ExerciseLog }) => {
    const { logSet, deleteSet, removeExerciseFromWorkout } = useWorkout();
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');

    const handleAddSet = () => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);

        if (isNaN(w) || isNaN(r)) {
            Alert.alert('Invalid Input', 'Enter valid weight and reps.');
            return;
        }

        logSet(log.id, {
            weight: w,
            reps: r,
            type: 'normal',
        });
        // Keep weight for convenience, clear reps
        setReps('');
    };

    const handleDeleteSet = (setId: string) => {
        deleteSet(log.id, setId);
    };

    return (
        <Card style={styles.card}>
            <View style={styles.cardHeader}>
                <Typography variant="h3">{log.exerciseName}</Typography>
                <TouchableOpacity onPress={() => removeExerciseFromWorkout(log.id)}>
                    <Typography variant="caption" color={colors.error}>Remove</Typography>
                </TouchableOpacity>
            </View>

            {/* Header for sets */}
            <View style={[styles.row, styles.tableHeader]}>
                <Typography variant="label" style={styles.colSet}>Set</Typography>
                <Typography variant="label" style={styles.colData}>kg</Typography>
                <Typography variant="label" style={styles.colData}>Reps</Typography>
                <View style={{ width: 40 }} />
            </View>

            {log.sets.map((set: Set, index: number) => (
                <View key={set.id} style={styles.row}>
                    <Typography variant="body" style={styles.colSet}>{index + 1}</Typography>
                    <Typography variant="body" style={styles.colData}>{set.weight}</Typography>
                    <Typography variant="body" style={styles.colData}>{set.reps}</Typography>
                    <TouchableOpacity onPress={() => handleDeleteSet(set.id)} style={{ width: 40, alignItems: 'center' }}>
                        <Typography variant="body" color={colors.error}>×</Typography>
                    </TouchableOpacity>
                </View>
            ))}

            {/* Input Row */}
            <View style={styles.inputRow}>
                <Typography variant="body" style={[styles.colSet, { color: colors.textSecondary }]}>
                    {log.sets.length + 1}
                </Typography>

                <TextInput
                    style={styles.input}
                    placeholder="kg"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                    value={weight}
                    onChangeText={setWeight}
                />

                <TextInput
                    style={styles.input}
                    placeholder="reps"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textSecondary}
                    value={reps}
                    onChangeText={setReps}
                />

                <Button
                    title="✓"
                    onPress={handleAddSet}
                    style={{ height: 36, minWidth: 44, paddingHorizontal: 10, borderRadius: 8 }}
                />
            </View>
        </Card>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 16,
    },
    card: {
        padding: spacing.m,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-start',
        marginBottom: 8,
        height: 32,
    },
    tableHeader: {
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceLight,
        marginBottom: 8,
    },
    colSet: {
        width: 40,
        textAlign: 'center',
    },
    colData: {
        width: 80,
        textAlign: 'center',
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.surfaceLight,
    },
    input: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: 70,
        height: 36,
        borderRadius: 8,
        paddingHorizontal: 8,
        marginRight: 16,
        textAlign: 'center',
    },
    notesInput: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: '100%',
        height: 60,
        borderRadius: borderRadius.s,
        paddingHorizontal: 16,
        paddingTop: 12,
        marginTop: 20,
        textAlignVertical: 'top',
    },
});
