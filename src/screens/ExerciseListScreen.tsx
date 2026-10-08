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
import { Dumbbell, PlayCircle, Search, Plus, Footprints } from 'lucide-react-native';
import { Chip } from '../components/Chip';
import { IconButton } from '../components/IconButton';
import { SegmentedControl } from '../components/SegmentedControl';
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
                    <View style={styles.searchIcon} pointerEvents="none">
                        <Search color={colors.textMuted} size={17} />
                    </View>
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
                    size="medium"
                    icon={c => <Plus color={c} size={17} />}
                    onPress={() => setModalVisible(true)}
                    style={{ marginLeft: 8, height: 44, paddingHorizontal: 14 }}
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
                    <Chip
                        key={group}
                        size="small"
                        label={getMuscleGroupName(group, t)}
                        selected={selectedGroup === group}
                        onPress={() => setSelectedGroup(group)}
                    />
                ))}
            </ScrollView>

            {/* Equipment Filter */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.equipScroll}
                contentContainerStyle={styles.filterContent}
            >
                {EQUIPMENT_FILTERS.map(item => (
                    <Chip
                        key={item}
                        size="small"
                        tone="secondary"
                        label={equipmentLabel(item, t)}
                        selected={selectedEquipment === item}
                        onPress={() => setSelectedEquipment(item)}
                    />
                ))}
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
                    <View style={styles.modalCard}>
                        <Typography variant="h2" style={{ marginBottom: 4 }}>{t('exerciseList.customExercise')}</Typography>
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginBottom: 18 }}>
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
                            style={styles.modalChips}
                            contentContainerStyle={{ gap: 6, paddingVertical: 2 }}
                        >
                            {selectableMuscleGroups.map(group => (
                                <Chip
                                    key={group}
                                    size="small"
                                    label={getMuscleGroupName(group, t)}
                                    selected={newExMuscle === group}
                                    onPress={() => setNewExMuscle(group)}
                                />
                            ))}
                        </ScrollView>

                        <SegmentedControl
                            value={newExCategory}
                            onChange={setNewExCategory}
                            options={[
                                { value: 'strength', label: t('common.strength'), icon: c => <Dumbbell color={c} size={15} /> },
                                { value: 'cardio', label: t('common.cardioType'), icon: c => <Footprints color={c} size={15} /> },
                            ]}
                        />

                        <View style={styles.modalButtons}>
                            <Button
                                title={t('common.cancel')}
                                variant="outline"
                                onPress={() => setModalVisible(false)}
                                style={{ flex: 1 }}
                            />
                            <Button title={t('exerciseList.addAndSelect')} onPress={handleCreateExercise} style={{ flex: 1.5 }} />
                        </View>
                    </View>
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
                    <IconButton
                        icon={c => <PlayCircle color={c} size={17} />}
                        variant="tonal"
                        tone="primary"
                        size={32}
                        onPress={() => onInfo(item)}
                        accessibilityLabel={name}
                    />
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
            <View style={styles.addIcon}>
                <Plus color={colors.primary} size={18} />
            </View>
        </TouchableOpacity>
    );
});

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    header: {
        flexDirection: 'row',
        marginTop: 8,
        marginBottom: 10,
        alignItems: 'center',
    },
    searchContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    searchIcon: {
        position: 'absolute',
        left: 13,
        zIndex: 1,
    },
    search: {
        height: 44,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.m,
        paddingLeft: 38,
        paddingRight: 12,
        color: colors.text,
        fontSize: 15,
        borderWidth: 1,
        borderColor: colors.border,
    },
    filterScroll: {
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: 4,
    },
    equipScroll: {
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: 10,
    },
    filterContent: {
        paddingVertical: 3,
        gap: 6,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: spacing.m,
        paddingLeft: spacing.s + 4,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
        backgroundColor: colors.surface,
    },
    itemFirst: {
        borderTopLeftRadius: borderRadius.l,
        borderTopRightRadius: borderRadius.l,
    },
    thumb: {
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: spacing.s + 4,
    },
    addIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 6,
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
        borderRadius: 6,
        borderWidth: 1,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 22,
    },
    modalCard: {
        padding: 22,
        borderRadius: borderRadius.xl,
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: colors.border,
    },
    modalChips: {
        flexGrow: 0,
        flexShrink: 0,
        marginBottom: 14,
    },
    input: {
        height: 48,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 16,
        color: colors.text,
        marginBottom: 16,
        fontSize: 15,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
    },
});
