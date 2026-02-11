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
import { useTranslation } from 'react-i18next';
import { ConfirmationModal } from '../components/ConfirmationModal';

export const ExerciseListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { exercises, addExerciseToWorkout, refreshData } = useWorkout();
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('All');

    const [newExName, setNewExName] = useState('');
    const [newExMuscle, setNewExMuscle] = useState('My Exercises');
    const [newExCategory, setNewExCategory] = useState<'strength' | 'cardio'>('strength');

    const [alertVisible, setAlertVisible] = useState(false);
    const [alertConfig, setAlertConfig] = useState({
        title: '',
        message: '',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
        onCancel: undefined as (() => void) | undefined,
        variant: 'primary' as 'primary' | 'danger' | 'success',
    });

    const showAlert = (
        title: string,
        message: string,
        onConfirm: () => void = () => setAlertVisible(false),
        variant: 'primary' | 'danger' | 'success' = 'primary',
        confirmText: string = t('common.ok'),
        cancelText?: string,
        onCancel?: () => void
    ) => {
        setAlertConfig({
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setAlertVisible(false);
            },
            variant,
            confirmText,
            cancelText: cancelText || (onCancel ? t('common.cancel') : ''),
            onCancel: onCancel
                ? () => {
                    onCancel();
                    setAlertVisible(false);
                }
                : undefined,
        });
        setAlertVisible(true);
    };

    // Muscle groups available for selection (exclude 'All')
    const selectableMuscleGroups = useMemo(() =>
        MUSCLE_GROUPS.filter(g => g !== 'All'), []);

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
        if (!newExName.trim() || !newExMuscle) {
            showAlert(t('exerciseList.error'), t('exerciseList.errorMessage'), undefined, 'danger');
            return;
        }

        const newExercise: Exercise = {
            id: generateId(),
            name: newExName.trim(),
            category: newExCategory,
            muscleGroup: newExMuscle,
            isCustom: true,
        };

        await StorageService.addCustomExercise(newExercise);
        await refreshData();
        setModalVisible(false);
        setNewExName('');
        setNewExMuscle('My Exercises');
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
                        placeholder={t('exerciseList.searchPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        value={search}
                        onChangeText={setSearch}
                    />
                </View>
                <Button
                    title={t('exerciseList.new')}
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
                                            {t('common.cardio')}
                                        </Typography>
                                    </View>
                                )}
                                {item.isCustom && (
                                    <View style={[styles.badge, { borderColor: colors.accent }]}>
                                        <Typography variant="label" color={colors.accent} style={{ fontSize: 9 }}>
                                            {t('common.custom')}
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
                            {t('exerciseList.noResults', { query: search || selectedGroup })}
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
                        <Typography variant="h2" style={{ marginBottom: 4 }}>{t('exerciseList.customExercise')}</Typography>
                        <Typography variant="caption" style={{ marginBottom: 20 }}>
                            {t('exerciseList.addToLibrary')}
                        </Typography>

                        <TextInput
                            style={styles.input}
                            placeholder={t('exerciseList.exerciseName')}
                            placeholderTextColor={colors.textMuted}
                            value={newExName}
                            onChangeText={setNewExName}
                            autoFocus
                        />

                        {/* Muscle Group Selector */}
                        <Typography variant="label" style={{ marginBottom: 8 }}>
                            {t('exerciseList.muscleGroupPlaceholder')}
                        </Typography>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={{ maxHeight: 44, marginBottom: 12 }}
                            contentContainerStyle={{ gap: 6 }}
                        >
                            {selectableMuscleGroups.map(group => (
                                <TouchableOpacity
                                    key={group}
                                    style={[
                                        styles.muscleChip,
                                        newExMuscle === group && styles.muscleChipActive,
                                    ]}
                                    onPress={() => setNewExMuscle(group)}
                                    activeOpacity={0.7}
                                >
                                    <Typography
                                        variant="caption"
                                        color={newExMuscle === group ? colors.black : colors.textSecondary}
                                        style={{
                                            fontWeight: newExMuscle === group ? '700' : '500',
                                            fontSize: 12,
                                        }}
                                    >
                                        {group}
                                    </Typography>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

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
                                    🏋️ {t('common.strength')}
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
                                    🏃 {t('common.cardioType')}
                                </Typography>
                            </TouchableOpacity>
                        </View>

                        <View style={styles.modalButtons}>
                            <Button
                                title={t('common.cancel')}
                                variant="ghost"
                                onPress={() => setModalVisible(false)}
                                style={{ flex: 1, marginRight: 8 }}
                            />
                            <Button title={t('exerciseList.addAndSelect')} onPress={handleCreateExercise} style={{ flex: 1.5 }} />
                        </View>
                    </Card>
                </View>
            </Modal>

            <ConfirmationModal
                visible={alertVisible}
                title={alertConfig.title}
                message={alertConfig.message}
                confirmText={alertConfig.confirmText}
                cancelText={alertConfig.cancelText}
                onConfirm={alertConfig.onConfirm}
                onCancel={alertConfig.onCancel}
                variant={alertConfig.variant}
            />
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
    muscleChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
    },
    muscleChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
});
