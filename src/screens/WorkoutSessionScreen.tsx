
import React, { useState } from 'react';
import { ScrollView, View, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, borderRadius, spacing } from '../theme/colors';
import { ExerciseLog, Set } from '../types';
import { Trash2 } from 'lucide-react-native'; // Assuming lucide-react-native is installed

export const WorkoutSessionScreen = ({ navigation }: any) => {
    const { currentWorkout, finishWorkout, cancelWorkout, addExerciseToWorkout } = useWorkout();
    const [notes, setNotes] = useState('');

    if (!currentWorkout) {
        return (
            <ScreenLayout>
                <Typography variant="h2">No active workout</Typography>
                <Button title="Go Back" onPress={() => navigation.goBack()} />
            </ScreenLayout>
        );
    }

    const handleFinish = async () => {
        Alert.alert(
            "Finish Workout?",
            "Are you sure you want to finish this workout?",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Finish",
                    onPress: async () => {
                        await finishWorkout(notes);
                        navigation.goBack();
                    }
                }
            ]
        );
    };

    const handleCancel = () => {
        Alert.alert('Cancel Workout?', 'Progress will be lost.', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Yes', style: 'destructive', onPress: async () => {
                    await cancelWorkout();
                    navigation.goBack();
                }
            }
        ]);
    };

    return (
        <ScreenLayout>
            <View style={styles.header}>
                <View>
                    <Typography variant="h2">{currentWorkout.name}</Typography>
                    <Typography variant="caption" style={{ marginTop: 4 }}>
                        {new Date(currentWorkout.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                </View>
                <Button
                    title="Finish"
                    variant="primary"
                    onPress={handleFinish}
                    style={{ width: 100, height: 40 }}
                />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
                {currentWorkout.exercises.length === 0 ? (
                    <View style={{ alignItems: 'center', padding: 40 }}>
                        <Typography variant="body" color={colors.textSecondary}>No exercises yet.</Typography>
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
                    style={[styles.input, { width: '100%', height: 60, textAlign: 'left', marginTop: 20, marginBottom: 20 }]}
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

        if (isNaN(w) || isNaN(r)) return;

        logSet(log.id, {
            weight: w,
            reps: r,
            type: 'normal'
        });
        // Keep weight for next set usually convenient, reset reps?
        // setReps(''); 
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
            <View style={[styles.row, { paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: colors.surfaceLight, marginBottom: 8 }]}>
                <Typography variant="label" style={{ width: 40, textAlign: 'center' }}>Set</Typography>
                <Typography variant="label" style={{ width: 80, textAlign: 'center' }}>kg</Typography>
                <Typography variant="label" style={{ width: 80, textAlign: 'center' }}>Reps</Typography>
                <View style={{ width: 40 }} />
            </View>

            {log.sets.map((set: Set, index: number) => (
                <View key={set.id} style={styles.row}>
                    <Typography variant="body" style={styles.colCenter}>{index + 1}</Typography>
                    <Typography variant="body" style={styles.colCenter}>{set.weight}</Typography>
                    <Typography variant="body" style={styles.colCenter}>{set.reps}</Typography>
                    <TouchableOpacity onPress={() => handleDeleteSet(set.id)} style={[styles.colCenter, { width: 40 }]}>
                        <Typography variant="body" color={colors.error}>×</Typography>
                    </TouchableOpacity>
                </View>
            ))}

            {/* Input Row */}
            <View style={[styles.inputRow]}>
                <Typography variant="body" style={[styles.colCenter, { color: colors.textSecondary }]}>{log.sets.length + 1}</Typography>

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
                    title="Add"
                    onPress={handleAddSet}
                    style={{ height: 36, minWidth: 50, paddingHorizontal: 10, borderRadius: 4 }}
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
    colCenter: {
        width: 40,
        textAlign: 'center',
        marginRight: 20,
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
        borderRadius: 4,
        paddingHorizontal: 8,
        marginRight: 16,
        textAlign: 'center',
    }
});
