import React, { useState, useMemo, useCallback, memo } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, View, TextInput, Modal, ScrollView } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { borderRadius, spacing, ThemeColors } from '../theme/colors';
import { StorageService } from '../services/storage';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { generateId } from '../utils/generateId';
import { Equipment, Exercise } from '../types';
import { MUSCLE_GROUPS, getExerciseName, getMuscleGroupName } from '../constants/exercises';
import { ALL_EQUIPMENT, EXERCISE_CATALOG } from '../constants/exerciseCatalog';
import { useTranslation } from 'react-i18next';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { Dumbbell, PlayCircle } from 'lucide-react-native';
import { ExerciseInfoModal } from '../components/ExerciseInfoModal';
import { ExerciseAnimation } from '../components/ExerciseAnimation';
import { getAnimation } from '../animations';
import { useTheme } from '../context/ThemeContext';

type EquipmentFilter = 'all' | 'bodyweight' | Equipment;

/** Equipment chips: only items that at least one built-in exercise needs. */
const EQUIPMENT_FILTERS: EquipmentFilter[] = [
    'all',
    'bodyweight',
    ...ALL_EQUIPMENT.filter(item => EXERCISE_CATALOG.some(e => e.equipment?.includes(item))),
];

function matchesEquipment(e: Exercise, filter: EquipmentFilter): boolean {
    if (filter === 'all') return true;
    // Custom exercises have no equipment data, so they only show up unfiltered.
    if (!e.equipment) return false;
    return filter === 'bodyweight' ? e.equipment.length === 0 : e.equipment.includes(filter);
}

function equipmentLabel(item: EquipmentFilter, t: (key: string) => string): string {
    if (item === 'all') return t('exerciseList.allEquipment');
    if (item === 'bodyweight') return t('exerciseList.bodyweight');
    return t(`equipment.${item}`);
}

const THUMB_SIZE = 52;

export const ExerciseListScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = useMemo(() => createStyles(colors), [colors]);
    const { exercises, addExerciseToWorkout, refreshData } = useWorkout();
    const [search, setSearch] = useState('');
    const [modalVisible, setModalVisible] = useState(false);
    const [selectedGroup, setSelectedGroup] = useState('All');
    const [selectedEquipment, setSelectedEquipment] = useState<EquipmentFilter>('all');

    const [newExName, setNewExName] = useState('');
    const [newExMuscle, setNewExMuscle] = useState('My Exercises');
    const [newExCategory, setNewExCategory] = useState<'strength' | 'cardio'>('strength');

    const [infoModalVisible, setInfoModalVisible] = useState(false);
    const [selectedExerciseInfo, setSelectedExerciseInfo] = useState<{ id: string, name: string } | null>(null);

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
            const translatedName = getExerciseName(e.id, t, e.name);
            const translatedGroup = getMuscleGroupName(e.muscleGroup, t);
            const matchesSearch =
                translatedName.toLowerCase().includes(search.toLowerCase()) ||
                translatedGroup.toLowerCase().includes(search.toLowerCase());
            const matchesGroup = selectedGroup === 'All' || e.muscleGroup === selectedGroup;
            return matchesSearch && matchesGroup && matchesEquipment(e, selectedEquipment);
        });
    }, [exercises, search, selectedGroup, selectedEquipment, t]);

    const handleSelect = useCallback((exercise: Exercise) => {
        addExerciseToWorkout(exercise);
        navigation.goBack();
    }, [addExerciseToWorkout, navigation]);

    const openInfo = useCallback((exercise: Exercise) => {
        setSelectedExerciseInfo({ id: exercise.id, name: getExerciseName(exercise.id, t, exercise.name) });
        setInfoModalVisible(true);
    }, [t]);

    const renderItem = useCallback(({ item, index }: { item: Exercise; index: number }) => (
        <ExerciseRow
            item={item}
            first={index === 0}
            name={getExerciseName(item.id, t, item.name)}
            groupName={getMuscleGroupName(item.muscleGroup, t)}
            cardioLabel={t('common.cardio')}
            customLabel={t('common.custom')}
            onSelect={handleSelect}
            onInfo={openInfo}
            colors={colors}
            styles={styles}
        />
    ), [t, handleSelect, openInfo, colors, styles]);

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
                            {getMuscleGroupName(group, t)}
                        </Typography>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Equipment Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.equipScroll}
                contentContainerStyle={styles.filterContent}
            >
                {EQUIPMENT_FILTERS.map(item => {
                    const active = selectedEquipment === item;
                    return (
                        <TouchableOpacity
                            key={item}
                            style={[styles.equipChip, active && styles.equipChipActive]}
                            onPress={() => setSelectedEquipment(item)}
                            activeOpacity={0.7}
                        >
                            <Typography
                                variant="caption"
                                color={active ? colors.primary : colors.textSecondary}
                                style={{ fontWeight: active ? '700' : '500', fontSize: 12 }}
                            >
                                {equipmentLabel(item, t)}
                            </Typography>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {/* Exercise List */}
            <FlatList
                data={filtered}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 20 }}
                renderItem={renderItem}
                initialNumToRender={10}
                maxToRenderPerBatch={8}
                windowSize={7}
                removeClippedSubviews
                ListEmptyComponent={
                    <View style={{ padding: 40, alignItems: 'center' }}>
                        <Typography variant="body" color={colors.textMuted} align="center">
                            {t('exerciseList.noResults', {
                                query: search
                                    || (selectedEquipment !== 'all' ? equipmentLabel(selectedEquipment, t) : getMuscleGroupName(selectedGroup, t)),
                            })}
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
                                        {getMuscleGroupName(group, t)}
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

            <ExerciseInfoModal
                visible={infoModalVisible}
                exerciseId={selectedExerciseInfo?.id || null}
                exerciseName={selectedExerciseInfo?.name || ''}
                onClose={() => setInfoModalVisible(false)}
            />
        </ScreenLayout>
    );
};

interface ExerciseRowProps {
    item: Exercise;
    first: boolean;
    name: string;
    groupName: string;
    cardioLabel: string;
    customLabel: string;
    onSelect: (exercise: Exercise) => void;
    onInfo: (exercise: Exercise) => void;
    colors: ThemeColors;
    styles: ReturnType<typeof createStyles>;
}

const ExerciseRow = memo(function ExerciseRow({
    item, first, name, groupName, cardioLabel, customLabel, onSelect, onInfo, colors, styles,
}: ExerciseRowProps) {
    const hasAnimation = !!getAnimation(item.id);
    return (
        <TouchableOpacity
            style={[styles.item, first && styles.itemFirst]}
            onPress={() => onSelect(item)}
            activeOpacity={0.6}
        >
            <TouchableOpacity style={styles.thumb} onPress={() => onInfo(item)} activeOpacity={0.7}>
                {hasAnimation
                    ? <ExerciseAnimation exerciseId={item.id} thumbnail size={THUMB_SIZE} />
                    : <Dumbbell color={colors.textMuted} size={20} />}
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Typography variant="body" bold style={{ flexShrink: 1 }}>{name}</Typography>
                    <TouchableOpacity style={styles.infoBtn} onPress={() => onInfo(item)}>
                        <PlayCircle color={colors.primary} size={20} />
                    </TouchableOpacity>
                </View>
                <View style={styles.tagRow}>
                    <Typography variant="caption" style={{ fontSize: 12 }}>{groupName}</Typography>
                    {item.category === 'cardio' && (
                        <View style={[styles.badge, { borderColor: colors.primary }]}>
                            <Typography variant="label" color={colors.primary} style={{ fontSize: 9 }}>
                                {cardioLabel}
                            </Typography>
                        </View>
                    )}
                    {item.isCustom && (
                        <View style={[styles.badge, { borderColor: colors.accent }]}>
                            <Typography variant="label" color={colors.accent} style={{ fontSize: 9 }}>
                                {customLabel}
                            </Typography>
                        </View>
                    )}
                </View>
            </View>
            <Typography variant="body" color={colors.textMuted}>+</Typography>
        </TouchableOpacity>
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
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
    equipScroll: {
        maxHeight: 40,
        marginTop: -6,
        marginBottom: 12,
    },
    equipChip: {
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: borderRadius.full,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    equipChipActive: {
        borderColor: colors.primary,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.m,
        paddingLeft: spacing.s + 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    itemFirst: {
        borderTopLeftRadius: borderRadius.m,
        borderTopRightRadius: borderRadius.m,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.s + 4,
    },
    infoBtn: {
        backgroundColor: colors.surfaceLight,
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: borderRadius.s,
        borderWidth: 1,
        borderColor: colors.border,
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
