import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, TouchableOpacity, View, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { Trash2, NotebookPen, History as HistoryIcon } from 'lucide-react-native';
import { ForwardChevron } from '../components/DirectionalIcons';
import { IconButton } from '../components/IconButton';
import { ScreenHeader } from '../components/ScreenHeader';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { formatDate } from '../utils/dates';
import { borderRadius, ThemeColors } from '../theme/colors';
import { WorkoutSession } from '../types';
import { useTranslation } from 'react-i18next';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useCloudSync } from '../context/CloudSyncContext';
import { useTheme } from '../context/ThemeContext';
import { useUnits } from '../context/UnitsContext';

const PAGE_SIZE = 10;

export const HistoryScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { colors } = useTheme();
    const styles = createStyles(colors);
    const { weightUnit, displayWeight } = useUnits();
    // Local storage holds the full history; for AI subscribers it is kept in
    // sync with the cloud, so this list always matches Workout Details/Progress.
    const { workouts: localWorkouts, deleteWorkout, clearAllWorkouts } = useWorkout();
    const { accountLinked } = useCloudSync();

    const [localVisibleCount, setLocalVisibleCount] = useState(PAGE_SIZE);
    const workouts = useMemo(
        () => localWorkouts.slice(0, localVisibleCount),
        [localWorkouts, localVisibleCount]
    );
    const totalCount = localWorkouts.length;
    const hasMore = localVisibleCount < localWorkouts.length;
    const isLoadingMore = false;

    const handleLoadMore = useCallback(() => {
        if (hasMore) {
            setLocalVisibleCount(prev => Math.min(prev + PAGE_SIZE, localWorkouts.length));
        }
    }, [hasMore, localWorkouts.length]);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        title: '',
        message: '',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
        onCancel: undefined as (() => void) | undefined,
        variant: 'primary' as 'primary' | 'danger' | 'success',
        requireCheckbox: false,
        checkboxLabel: '',
    });

    const showModal = (
        title: string,
        message: string,
        onConfirm: () => void = () => setModalVisible(false),
        variant: 'primary' | 'danger' | 'success' = 'primary',
        confirmText: string = t('common.ok'),
        cancelText?: string,
        onCancel?: () => void,
        requireCheckbox: boolean = false,
        checkboxLabel: string = ''
    ) => {
        setModalConfig({
            title,
            message,
            onConfirm: () => {
                onConfirm();
                setModalVisible(false);
            },
            variant,
            confirmText,
            cancelText: cancelText || (onCancel ? t('common.cancel') : ''),
            onCancel: onCancel
                ? () => {
                    onCancel();
                    setModalVisible(false);
                }
                : undefined,
            requireCheckbox,
            checkboxLabel,
        });
        setModalVisible(true);
    };

    const handleDelete = (id: string) => {
        showModal(
            t('history.deleteTitle'),
            t('history.deleteMessage'),
            () => deleteWorkout(id),
            'danger',
            t('common.delete'),
            t('common.cancel'),
            () => { }
        );
    };

    const handleClearAllHistory = () => {
        showModal(
            t('history.clearAllTitle'),
            accountLinked ? t('history.clearAllCloudMessage') : t('history.clearAllMessage'),
            async () => {
                await clearAllWorkouts();
                showModal(t('history.cleared'), t('history.clearedMessage'), undefined, 'success');
            },
            'danger',
            t('common.delete'),
            t('common.cancel'),
            () => { },
            true,
            t('history.clearAllConfirm')
        );
    };

    const renderItem = ({ item, index }: { item: any; index: number }) => {
        const duration = item.endTime
            ? Math.round((item.endTime - item.startTime) / 60000)
            : 0;
        const totalSets = item.exercises.reduce((acc: number, e: any) => acc + e.sets.length, 0);
        const totalVolume = item.exercises.reduce(
            (acc: number, e: any) => acc + e.sets.reduce((a: number, s: any) => a + s.weight * s.reps, 0),
            0
        );

        return (
            <TouchableOpacity
                onPress={() => navigation.navigate('WorkoutDetails', { workoutId: item.id })}
                onLongPress={() => handleDelete(item.id)}
                activeOpacity={0.7}
            >
                <Card style={{ marginBottom: 10 }}>
                    {/* Title Row */}
                    <View style={styles.titleRow}>
                        <View style={styles.dayBadge}>
                            <Typography variant="caption" color={colors.primary} bold style={styles.dayName}>
                                {formatDate(item.startTime, 'EEE')}
                            </Typography>
                            <Typography variant="body" bold style={styles.dayNum}>
                                {formatDate(item.startTime, 'dd')}
                            </Typography>
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Typography variant="body" bold>{item.name}</Typography>
                            <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 2 }}>
                                {formatDate(item.startTime, 'MMM yyyy · HH:mm')}
                            </Typography>
                        </View>
                        <ForwardChevron color={colors.textMuted} size={18} />
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" bold style={styles.statValue}>
                                {item.exercises.length}
                            </Typography>
                            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{t('common.exercises')}</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" bold style={styles.statValue}>
                                {totalSets}
                            </Typography>
                            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{t('common.sets')}</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" bold style={styles.statValue}>
                                {duration}
                            </Typography>
                            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{t('common.min')}</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" bold style={styles.statValue}>
                                {Math.round(displayWeight(totalVolume)) > 999 ? `${(displayWeight(totalVolume) / 1000).toFixed(1)}k` : Math.round(displayWeight(totalVolume))}
                            </Typography>
                            <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 11 }}>{weightUnit}</Typography>
                        </View>
                    </View>

                    {/* Notes preview */}
                    {item.notes ? (
                        <View style={styles.noteRow}>
                            <NotebookPen color={colors.textMuted} size={13} />
                            <Typography variant="caption" color={colors.textSecondary} numberOfLines={1} style={{ flex: 1 }}>
                                {item.notes}
                            </Typography>
                        </View>
                    ) : null}
                </Card>
            </TouchableOpacity>
        );
    };

    const renderFooter = () => {
        if (!hasMore && !isLoadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={colors.primary} />
            </View>
        );
    };

    return (
        <ScreenLayout>
            <ScreenHeader
                title={t('history.title')}
                subtitle={totalCount > 0 ? t('history.workoutCount', { count: totalCount }) : undefined}
                right={totalCount > 0 ? (
                    <IconButton
                        icon={c => <Trash2 color={c} size={18} />}
                        variant="tonal"
                        tone="danger"
                        onPress={handleClearAllHistory}
                        accessibilityLabel={t('history.clearAllButton')}
                    />
                ) : undefined}
            />

            {workouts.length === 0 && !isLoadingMore ? (
                <View style={styles.emptyState}>
                    <View style={styles.emptyIcon}>
                        <HistoryIcon color={colors.primary} size={26} />
                    </View>
                    <Typography variant="h3" align="center" style={{ marginBottom: 6 }}>
                        {t('history.noWorkoutsYet')}
                    </Typography>
                    <Typography variant="body" color={colors.textMuted} align="center">
                        {t('history.noWorkoutsDescription')}
                    </Typography>
                </View>
            ) : (
                <FlatList
                    data={workouts}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.3}
                    ListFooterComponent={renderFooter}
                />
            )}
            <ConfirmationModal
                visible={modalVisible}
                title={modalConfig.title}
                message={modalConfig.message}
                confirmText={modalConfig.confirmText}
                cancelText={modalConfig.cancelText}
                onConfirm={modalConfig.onConfirm}
                onCancel={modalConfig.onCancel}
                variant={modalConfig.variant}
                requireCheckbox={modalConfig.requireCheckbox}
                checkboxLabel={modalConfig.checkboxLabel}
            />
        </ScreenLayout>
    );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dayBadge: {
        width: 44,
        height: 48,
        borderRadius: 12,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
    },
    dayName: {
        fontSize: 10.5,
        lineHeight: 13,
        textTransform: 'uppercase',
    },
    dayNum: {
        fontSize: 17,
        lineHeight: 21,
        fontVariant: ['tabular-nums'],
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 15,
        fontVariant: ['tabular-nums'],
    },
    divider: {
        width: StyleSheet.hairlineWidth,
        height: 24,
        backgroundColor: colors.border,
    },
    noteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingBottom: 60,
    },
    emptyIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    footerLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },
});
