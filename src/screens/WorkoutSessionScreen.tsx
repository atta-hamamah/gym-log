import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, View, StyleSheet, TextInput, Alert, TouchableOpacity } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { colors, borderRadius, spacing, shadows } from '../theme/colors';
import { ExerciseLog, Set } from '../types';

export const WorkoutSessionScreen = ({ navigation }: any) => {
    const { currentWorkout, finishWorkout, cancelWorkout } = useWorkout();
    const [notes, setNotes] = useState('');
    const [elapsed, setElapsed] = useState(0);

    useEffect(() => {
        if (!currentWorkout) return;
        const interval = setInterval(() => {
            setElapsed(Math.floor((Date.now() - currentWorkout.startTime) / 1000));
        }, 1000);
        return () => clearInterval(interval);
    }, [currentWorkout]);

    const formatTime = useCallback((seconds: number) => {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = seconds % 60;
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }, []);

    if (!currentWorkout) {
        return (
            <ScreenLayout>
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <Typography variant="h2" style={{ marginBottom: 16 }}>No active workout</Typography>
                    <Button title="Go Back" variant="outline" onPress={() => navigation.goBack()} />
                </View>
            </ScreenLayout>
        );
    }

    const handleFinish = () => {
        if (currentWorkout.exercises.length === 0) {
            Alert.alert(
                'Empty Workout',
                'Add at least one exercise before finishing.',
                [{ text: 'OK' }]
            );
            return;
        }
        Alert.alert('Finish Workout?', 'Save this session to your history.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Finish ✓',
                onPress: async () => {
                    await finishWorkout(notes);
                    navigation.goBack();
                },
            },
        ]);
    };

    const handleCancel = () => {
        Alert.alert('Cancel Workout?', 'All progress will be lost.', [
            { text: 'No', style: 'cancel' },
            {
                text: 'Discard',
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
            {/* Header */}
            <View style={styles.header}>
                <View style={{ flex: 1 }}>
                    <Typography variant="h2">{currentWorkout.name}</Typography>
                    <View style={styles.headerStats}>
                        <View style={styles.timerBadge}>
                            <Typography variant="bodySmall" color={colors.primary} bold>
                                ⏱ {formatTime(elapsed)}
                            </Typography>
                        </View>
                        <Typography variant="caption" style={{ marginLeft: 12 }}>
                            {totalSets} sets • {totalVolume > 0 ? `${totalVolume.toLocaleString()} kg` : '—'}
                        </Typography>
                    </View>
                </View>
                <Button
                    title="Finish"
                    size="small"
                    onPress={handleFinish}
                    style={{ marginLeft: 12 }}
                />
            </View>

            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
                {currentWorkout.exercises.length === 0 ? (
                    <Card variant="outlined" style={{ marginTop: 20, paddingVertical: 40 }}>
                        <Typography variant="body" color={colors.textMuted} align="center">
                            No exercises added yet.{'\n'}Tap the button below to get started.
                        </Typography>
                    </Card>
                ) : (
                    currentWorkout.exercises.map((log, index) => (
                        <ExerciseCard key={log.id} log={log} index={index} />
                    ))
                )}

                <Button
                    title="+ Add Exercise"
                    variant="secondary"
                    onPress={() => navigation.navigate('ExerciseList')}
                    fullWidth
                    style={{ marginTop: 20 }}
                />

                <TextInput
                    style={styles.notesInput}
                    placeholder="Session notes..."
                    placeholderTextColor={colors.textMuted}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                />

                <Button
                    title="Cancel Workout"
                    variant="ghost"
                    onPress={handleCancel}
                    size="small"
                    style={{ marginTop: 12, alignSelf: 'center' }}
                />
            </ScrollView>
        </ScreenLayout>
    );
};

const ExerciseCard = ({ log, index }: { log: ExerciseLog; index: number }) => {
    const { logSet, deleteSet, removeExerciseFromWorkout } = useWorkout();
    const [weight, setWeight] = useState('');
    const [reps, setReps] = useState('');

    const handleAddSet = () => {
        const w = parseFloat(weight);
        const r = parseFloat(reps);

        if (isNaN(w) || isNaN(r) || w < 0 || r <= 0) {
            Alert.alert('Invalid Input', 'Enter valid weight and reps.');
            return;
        }

        logSet(log.id, { weight: w, reps: r, type: 'normal' });
        setReps('');
    };

    const exerciseVolume = log.sets.reduce((a, s) => a + s.weight * s.reps, 0);

    return (
        <Card style={styles.exerciseCard}>
            {/* Exercise Header */}
            <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                    <Typography variant="h3">{log.exerciseName}</Typography>
                    {log.sets.length > 0 && (
                        <Typography variant="caption" style={{ marginTop: 2 }}>
                            {log.sets.length} sets • {exerciseVolume} kg
                        </Typography>
                    )}
                </View>
                <TouchableOpacity
                    onPress={() => removeExerciseFromWorkout(log.id)}
                    style={styles.removeBtn}
                >
                    <Typography variant="caption" color={colors.error} style={{ fontSize: 11 }}>
                        REMOVE
                    </Typography>
                </TouchableOpacity>
            </View>

            {/* Table Header */}
            <View style={[styles.row, styles.tableHeader]}>
                <Typography variant="label" style={styles.colSet}>SET</Typography>
                <Typography variant="label" style={styles.colVal}>KG</Typography>
                <Typography variant="label" style={styles.colVal}>REPS</Typography>
                <View style={{ width: 36 }} />
            </View>

            {/* Logged Sets */}
            {log.sets.map((set: Set, i: number) => (
                <View key={set.id} style={[styles.row, i % 2 === 0 && styles.rowAlt]}>
                    <View style={[styles.colSet, styles.setBadge]}>
                        <Typography variant="bodySmall" color={colors.text} bold align="center">
                            {i + 1}
                        </Typography>
                    </View>
                    <Typography variant="body" style={styles.colVal} bold>{set.weight}</Typography>
                    <Typography variant="body" style={styles.colVal}>{set.reps}</Typography>
                    <TouchableOpacity
                        onPress={() => deleteSet(log.id, set.id)}
                        style={styles.deleteBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Typography variant="body" color={colors.error}>✕</Typography>
                    </TouchableOpacity>
                </View>
            ))}

            {/* Input Row */}
            <View style={styles.inputRow}>
                <View style={[styles.colSet, styles.nextBadge]}>
                    <Typography variant="bodySmall" color={colors.textMuted} align="center">
                        {log.sets.length + 1}
                    </Typography>
                </View>

                <TextInput
                    style={styles.input}
                    placeholder="kg"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                    value={weight}
                    onChangeText={setWeight}
                />

                <TextInput
                    style={styles.input}
                    placeholder="reps"
                    keyboardType="numeric"
                    placeholderTextColor={colors.textMuted}
                    value={reps}
                    onChangeText={setReps}
                    onSubmitEditing={handleAddSet}
                    returnKeyType="done"
                />

                <TouchableOpacity
                    onPress={handleAddSet}
                    style={styles.addSetBtn}
                    activeOpacity={0.7}
                >
                    <Typography variant="body" color={colors.black} bold>✓</Typography>
                </TouchableOpacity>
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
    headerStats: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 6,
    },
    timerBadge: {
        backgroundColor: colors.primary + '18',
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: borderRadius.s,
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    exerciseCard: {
        padding: spacing.m,
        marginBottom: 12,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 14,
    },
    removeBtn: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: borderRadius.xs,
        borderWidth: 1,
        borderColor: colors.error + '40',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 4,
        borderRadius: borderRadius.xs,
    },
    rowAlt: {
        backgroundColor: colors.surfaceLight + '40',
    },
    tableHeader: {
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        marginBottom: 4,
    },
    colSet: {
        width: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
    colVal: {
        width: 72,
        textAlign: 'center',
    },
    setBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.surfaceLight,
        marginRight: 8,
    },
    nextBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: colors.border + '60',
        marginRight: 8,
    },
    inputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    input: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: 64,
        height: 40,
        borderRadius: borderRadius.s,
        paddingHorizontal: 8,
        marginRight: 12,
        textAlign: 'center',
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    addSetBtn: {
        width: 40,
        height: 40,
        borderRadius: borderRadius.s,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    notesInput: {
        backgroundColor: colors.surfaceLight,
        color: colors.text,
        width: '100%',
        minHeight: 64,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        paddingTop: 14,
        marginTop: 20,
        textAlignVertical: 'top',
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    deleteBtn: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
