import React, { useState, useMemo } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, View, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { colors, spacing, borderRadius } from '../theme/colors';
import { StorageService } from '../services/storage';
import { Button } from '../components/Button';
import { generateId } from '../utils/generateId';
import { Exercise } from '../types';
import { MUSCLE_GROUPS } from '../constants/exercises';

export const ExerciseListScreen = ({ navigation }: any) => {
    const { exercises, addExerciseToWorkout, refreshData } = useWorkout();
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('All');

    // Custom Exercise Form
    const [newExName, setNewExName] = useState('');
    const [newExMuscle, setNewExMuscle] = useState('');
    const [newExCategory, setNewExCategory] = useState<'strength' | 'cardio'>('strength');

    const filtered = useMemo(() => {
        return exercises.filter((e: Exercise) => {
            const matchesSearch =
                e.name.toLowerCase().includes(search.toLowerCase()) ||
                e.muscleGroup.toLowerCase().includes(search.toLowerCase());
            const matchesGroup = selectedGroup === 'All' || e.muscleGroup === selectedGroup;
            return matchesSearch && matchesGroup;
        });
    }, [exercises, search, selectedGroup]);

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
            id: generateId(),
            name: newExName.trim(),
            category: newExCategory,
            muscleGroup: newExMuscle.trim(),
            isCustom: true,
        };

        await StorageService.addCustomExercise(newExercise);
        await refreshData();
        setModalVisible(false);
        setNewExName('');
        setNewExMuscle('');
        setNewExCategory('strength');
        handleSelect(newExercise);
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

            {/* Muscle Group Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                contentContainerStyle={styles.filterContent}
            >
                {MUSCLE_GROUPS.map(group => (
                    <TouchableOpacity
                        key={group}
                        style={[
                            styles.filterChip,
                            selectedGroup === group && styles.filterChipActive,
                        ]}
                        onPress={() => setSelectedGroup(group)}
                    >
                        <Typography
                            variant="caption"
                            color={selectedGroup === group ? colors.black : colors.textSecondary}
                            style={{ fontWeight: selectedGroup === group ? '700' : '400' }}
                        >
                            {group}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                    <TouchableOpacity
                        style={styles.item}
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.7}
                    >
                        <View style={{ flex: 1 }}>
                            <Typography variant="body">{item.name}</Typography>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                <Typography variant="caption">{item.muscleGroup}</Typography>
                                {item.category === 'cardio' && (
                                    <View style={styles.cardioBadge}>
                                        <Typography variant="caption" color={colors.primary} style={{ fontSize: 10 }}>
                                            CARDIO
                                        </Typography>
                                    </View>
                                )}
                                {item.isCustom && (
                                    <View style={styles.customBadge}>
                                        <Typography variant="caption" color={colors.accent} style={{ fontSize: 10 }}>
                                            CUSTOM
                                        </Typography>
                                    </View>
                                )}
                            </View>
                        </View>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Typography variant="body" color={colors.textSecondary}>
                            No exercises found.
                        </Typography>
                    </View>
                }
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

                        <View style={styles.categoryRow}>
                            <TouchableOpacity
                                style={[styles.categoryChip, newExCategory === 'strength' && styles.categoryChipActive]}
                                onPress={() => setNewExCategory('strength')}
                            >
                                <Typography
                                    variant="caption"
                                    color={newExCategory === 'strength' ? colors.black : colors.textSecondary}
                                >
                                    Strength
                                </Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.categoryChip, newExCategory === 'cardio' && styles.categoryChipActive]}
                                onPress={() => setNewExCategory('cardio')}
                            >
                                <Typography
                                    variant="caption"
                                    color={newExCategory === 'cardio' ? colors.black : colors.textSecondary}
                                >
                                    Cardio
                                </Typography>
                            </TouchableOpacity>
                        </View>

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
        marginBottom: 8,
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
    filterRow: {
        maxHeight: 44,
        marginBottom: 8,
    },
    filterContent: {
        paddingVertical: 4,
        gap: 8,
    },
    filterChip: {
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surfaceLight,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
        marginBottom: 1,
    },
    cardioBadge: {
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.primary,
    },
    customBadge: {
        marginLeft: 8,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: colors.accent,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
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
    categoryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 16,
    },
    categoryChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
    },
    categoryChipActive: {
        backgroundColor: colors.primary,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 8,
    },
});
