import React, { useState, useMemo } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, View, TextInput, Modal, Alert, ScrollView } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { colors, spacing, borderRadius } from '../theme/colors';
import { StorageService } from '../services/storage';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { generateId } from '../utils/generateId';
import { Exercise } from '../types';
import { MUSCLE_GROUPS } from '../constants/exercises';

export const ExerciseListScreen = ({ navigation }: any) => {
    const { exercises, addExerciseToWorkout, refreshData } = useWorkout();
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('All');

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
            {/* Search + New */}
            <View style={styles.header}>
                <View style={styles.searchContainer}>
                    <Typography variant="bodySmall" color={colors.textMuted} style={{ position: 'absolute', left: 12, zIndex: 1 }}>
                        🔍
                    </Typography>
                    <TextInput
                        style={styles.search}
                        placeholder="Search exercises..."
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <Button
                    title="+ New"
                    variant="secondary"
                    size="small"
                    onPress={() => setModalVisible(true)}
                    style={{ marginLeft: 8 }}
                />
            </View>

            {/* Muscle Group Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterScroll}
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
                        activeOpacity={0.7}
                    >
                        <Typography
                            variant="caption"
                            color={selectedGroup === group ? colors.black : colors.textSecondary}
                            style={{
                                fontWeight: selectedGroup === group ? '700' : '500',
                                fontSize: 12,
                            }}
                        >
                            {group}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Exercise List */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={({ item, index }) => (
                    <TouchableOpacity
                        style={[styles.item, index === 0 && { borderTopLeftRadius: borderRadius.m, borderTopRightRadius: borderRadius.m }]}
                        onPress={() => handleSelect(item)}
                        activeOpacity={0.6}
                    >
                        <View style={{ flex: 1 }}>
                            <Typography variant="body" bold>{item.name}</Typography>
                            <View style={styles.tagRow}>
                                <Typography variant="caption" style={{ fontSize: 12 }}>{item.muscleGroup}</Typography>
                                {item.category === 'cardio' && (
                                    <View style={[styles.badge, { borderColor: colors.primary }]}>
                                        <Typography variant="label" color={colors.primary} style={{ fontSize: 9 }}>
                                            CARDIO
                                        </Typography>
                                    </View>
                                )}
                                {item.isCustom && (
                                    <View style={[styles.badge, { borderColor: colors.accent }]}>
                                        <Typography variant="label" color={colors.accent} style={{ fontSize: 9 }}>
                                            CUSTOM
                                        </Typography>
                                    </View>
                                )}
                            </View>
                        </View>
                        <Typography variant="body" color={colors.textMuted}>+</Typography>
                    </TouchableOpacity>
                )}
                ListEmptyComponent={
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Typography variant="body" color={colors.textMuted} align="center">
                            No exercises found for "{search || selectedGroup}".
                        </Typography>
                    </View>
                }
            />

            {/* Custom Exercise Modal */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={styles.modalOverlay}>
                    <Card variant="elevated" style={styles.modalCard}>
                        <Typography variant="h2" style={{ marginBottom: 4 }}>Custom Exercise</Typography>
                        <Typography variant="caption" style={{ marginBottom: 20 }}>
                            Add your own exercise to the library
                        </Typography>

                        <TextInput
                            style={styles.input}
                            placeholder="Exercise Name"
                            placeholderTextColor={colors.textMuted}
                            value={newExName}
                            onChangeText={setNewExName}
                            autoFocus
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Muscle Group (e.g. Chest, Back)"
                            placeholderTextColor={colors.textMuted}
                            value={newExMuscle}
                            onChangeText={setNewExMuscle}
                        />

                        <View style={styles.categoryRow}>
                            <TouchableOpacity
                                style={[styles.categoryChip, newExCategory === 'strength' && styles.categoryChipActive]}
                                onPress={() => setNewExCategory('strength')}
                            >
                                <Typography
                                    variant="bodySmall"
                                    color={newExCategory === 'strength' ? colors.black : colors.textSecondary}
                                    bold={newExCategory === 'strength'}
                                >
                                    🏋️ Strength
                                </Typography>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.categoryChip, newExCategory === 'cardio' && styles.categoryChipActive]}
                                onPress={() => setNewExCategory('cardio')}
                            >
                                <Typography
                                    variant="bodySmall"
                                    color={newExCategory === 'cardio' ? colors.black : colors.textSecondary}
                                    bold={newExCategory === 'cardio'}
                                >
                                    🏃 Cardio
                                </Typography>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalButtons}>
                            <Button
                                title="Cancel"
                                variant="ghost"
                                onPress={() => setModalVisible(false)}
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button title="Add & Select" onPress={handleCreateExercise} style={{ flex: 1.5 }} />
                        </View>
                    </Card>
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
    searchContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    search: {
        height: 42,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingLeft: 36,
        paddingRight: 12,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterScroll: {
        maxHeight: 44,
        marginBottom: 12,
    },
    filterContent: {
        paddingVertical: 4,
        gap: 6,
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.m,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    tagRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 3,
        gap: 6,
    },
    badge: {
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4,
        borderWidth: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 24,
    },
    modalCard: {
        padding: 24,
        marginBottom: 0,
    },
    input: {
        height: 48,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        color: colors.text,
        marginBottom: 12,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    categoryChip: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    categoryChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    modalButtons: {
        flexDirection: 'row',
        marginTop: 12,
    },
});
