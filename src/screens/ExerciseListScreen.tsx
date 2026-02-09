
import React, { useState } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, View, TextInput, Modal, Alert } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { colors, spacing, borderRadius } from '../theme/colors';
import { StorageService } from '../services/storage';
import { Button } from '../components/Button';
import { v4 as uuidv4 } from 'uuid';
import { Exercise } from '../types';

export const ExerciseListScreen = ({ navigation }: any) => {
    const { exercises, addExerciseToWorkout, refreshData } = useWorkout();
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);

    // Custom Exercise Form
    const [newExName, setNewExName] = useState('');
    const [newExMuscle, setNewExMuscle] = useState('');

    const filtered = exercises.filter((e: Exercise) =>
        e.name.toLowerCase().includes(search.toLowerCase()) ||
        e.muscleGroup.toLowerCase().includes(search.toLowerCase())
    );

    const handleSelect = (exercise: Exercise) => {
        addExerciseToWorkout(exercise);
        navigation.goBack();
    };

    const handleCreateExercise = async () => {
        if (!newExName.trim() || !newExMuscle.trim()) {
            Alert.alert('Error', 'Please enter name and muscle group');
            return;
        }

        const newExercise: Exercise = {
            id: uuidv4(),
            name: newExName,
            category: 'strength',
            muscleGroup: newExMuscle,
            isCustom: true
        };

        await StorageService.addCustomExercise(newExercise);
        await refreshData();
        setModalVisible(false);
        setNewExName('');
        setNewExMuscle('');
        handleSelect(newExercise); // Select filtering won't work immediately unless we wait for refresh, but local state might lag.
        // Actually refreshData updates context, but it's async. 
        // We can pass the object directly to handleSelect which works.
    };

    return (
        <ScreenLayout>
            <View style={styles.header}>
                <TextInput
                    style={styles.search}
                    placeholder="Search exercises..."
                    placeholderTextColor={colors.textSecondary}
                    value={search}
                    onChangeText={setSearch}
                />
                <Button
                    title="New"
                    variant="secondary"
                    onPress={() => setModalVisible(true)}
                    style={{ width: 60, height: 40, marginLeft: 8 }}
                />
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => handleSelect(item)}
                    >
                        <Typography variant="body">{item.name}</Typography>
                        <Typography variant="caption">{item.muscleGroup}</Typography>
                    </TouchableOpacity>
                )}
            />

            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Typography variant="h3" style={{ marginBottom: 16 }}>Add Custom Exercise</Typography>

                        <TextInput
                            style={styles.input}
                            placeholder="Exercise Name"
                            placeholderTextColor={colors.textSecondary}
                            value={newExName}
                            onChangeText={setNewExName}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Muscle Group (e.g. Chest)"
                            placeholderTextColor={colors.textSecondary}
                            value={newExMuscle}
                            onChangeText={setNewExMuscle}
                        />

                        <View style={styles.modalButtons}>
                            <Button title="Cancel" variant="outline" onPress={() => setModalVisible(false)} style={{ flex: 1, marginRight: 8 }} />
                            <Button title="Save" onPress={handleCreateExercise} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            </Modal>
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'center',
    },
    search: {
        flex: 1,
        height: 40,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
        paddingHorizontal: 12,
        color: colors.text,
    },
    item: {
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    modalContent: {
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        padding: 20,
    },
    input: {
        height: 48,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
        paddingHorizontal: 16,
        color: colors.text,
        marginBottom: 16,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 8,
    }
});
