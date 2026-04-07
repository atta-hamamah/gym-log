import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { FlatList, TouchableOpacity, View, Alert, StyleSheet, ActivityIndicator } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { useWorkout } from '../context/WorkoutContext';
import { Card } from '../components/Card';
import { StatBadge } from '../components/StatBadge';
import { format } from 'date-fns';
import { colors, spacing, borderRadius } from '../theme/colors';
import { WorkoutSession } from '../types';
import { useTranslation } from 'react-i18next';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { usePaginatedQuery, useQuery, useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { StorageService } from '../services/storage';

const PAGE_SIZE = 10;

export const HistoryScreen = ({ navigation }: any) => {
    const { t } = useTranslation();
    const { workouts: localWorkouts, deleteWorkout } = useWorkout();
    const [isLive, setIsLive] = useState(false);
    const { isAuthenticated } = useConvexAuth();

    // Only use Convex queries when both live AND Convex has a valid auth token
    const useCloud = isLive && isAuthenticated;

    useEffect(() => {
        StorageService.getIsLive().then(setIsLive);
    }, []);

    // ── Convex paginated query (only active when authenticated) ──
    const {
        results: cloudWorkouts,
        status: cloudStatus,
        loadMore: cloudLoadMore,
    } = usePaginatedQuery(
        api.paginatedWorkouts.list,
        useCloud ? {} : "skip",
        { initialNumItems: PAGE_SIZE }
    );
    const cloudCount = useQuery(api.paginatedWorkouts.count, useCloud ? {} : "skip");

    // ── Local pagination state (for non-subscribers) ──
    const [localVisibleCount, setLocalVisibleCount] = useState(PAGE_SIZE);
    const localVisible = useMemo(
        () => localWorkouts.slice(0, localVisibleCount),
        [localWorkouts, localVisibleCount]
    );
    const localHasMore = localVisibleCount < localWorkouts.length;

    // ── Unified data ──
    const workouts = useCloud ? (cloudWorkouts as any[] ?? []) : localVisible;
    const totalCount = useCloud ? (cloudCount ?? 0) : localWorkouts.length;
    const hasMore = useCloud ? cloudStatus === "CanLoadMore" : localHasMore;
    const isLoadingMore = useCloud ? cloudStatus === "LoadingMore" : false;

    const handleLoadMore = useCallback(() => {
        if (useCloud) {
            if (cloudStatus === "CanLoadMore") {
                cloudLoadMore(PAGE_SIZE);
            }
        } else {
            if (localHasMore) {
                setLocalVisibleCount(prev => Math.min(prev + PAGE_SIZE, localWorkouts.length));
            }
        }
    }, [useCloud, cloudStatus, cloudLoadMore, localHasMore, localWorkouts.length]);

    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({
        title: '',
        message: '',
        confirmText: 'OK',
        cancelText: '',
        onConfirm: () => { },
        onCancel: undefined as (() => void) | undefined,
        variant: 'primary' as 'primary' | 'danger' | 'success',
    });

    const showModal = (
        title: string,
        message: string,
        onConfirm: () => void = () => setModalVisible(false),
        variant: 'primary' | 'danger' | 'success' = 'primary',
        confirmText: string = t('common.ok'),
        cancelText?: string,
        onCancel?: () => void
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
                            <Typography variant="label" color={colors.primary} style={{ fontSize: 10 }}>
                                {format(item.startTime, 'EEE').toUpperCase()}
                            </Typography>
                            <Typography variant="h3" color={colors.text} style={{ lineHeight: 22 }}>
                                {format(item.startTime, 'dd')}
                            </Typography>
                        </View>
                        <View style={{ flex: 1, marginLeft: 14 }}>
                            <Typography variant="body" bold>{item.name}</Typography>
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {format(item.startTime, 'MMM yyyy • HH:mm')}
                            </Typography>
                        </View>
                        <Typography variant="body" color={colors.textMuted} style={{ fontSize: 20 }}>›</Typography>
                    </View>

                    {/* Stats Row */}
                    <View style={styles.statsRow}>
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.primary} bold>
                                {item.exercises.length}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>{t('common.exercises')}</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.secondary} bold>
                                {totalSets}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>{t('common.sets')}</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.warning} bold>
                                {duration}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>{t('common.min')}</Typography>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.stat}>
                            <Typography variant="bodySmall" color={colors.accent} bold>
                                {totalVolume > 999 ? `${(totalVolume / 1000).toFixed(1)}k` : totalVolume}
                            </Typography>
                            <Typography variant="caption" style={{ fontSize: 11 }}>{t('common.kg')}</Typography>
                        </View>
                    </View>

                    {/* Notes preview */}
                    {item.notes ? (
                        <View style={styles.noteRow}>
                            <Typography variant="caption" numberOfLines={1} style={{ fontStyle: 'italic' }}>
                                📝 {item.notes}
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
            <View style={styles.headerRow}>
                <Typography variant="h1">{t('history.title')}</Typography>
                {totalCount > 0 && (
                    <Typography variant="caption" color={colors.textMuted}>
                        {t('history.workoutCount', { count: totalCount })}
                    </Typography>
                )}
            </View>

            {workouts.length === 0 && !isLoadingMore ? (
                <View style={styles.emptyState}>
                    <Typography variant="number" style={{ fontSize: 48, marginBottom: 12 }}>📋</Typography>
                    <Typography variant="h3" color={colors.textMuted} align="center" style={{ marginBottom: 8 }}>
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
            />
        </ScreenLayout>
    );
};

const styles = StyleSheet.create({
    headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'baseline',
        marginBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    dayBadge: {
        width: 44,
        height: 50,
        borderRadius: borderRadius.s,
        backgroundColor: colors.surfaceLight,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: colors.border,
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    stat: {
        flex: 1,
        alignItems: 'center',
    },
    divider: {
        width: 1,
        height: 24,
        backgroundColor: colors.border,
    },
    noteRow: {
        marginTop: 10,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: colors.border,
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingTop: 80,
    },
    footerLoader: {
        paddingVertical: 16,
        alignItems: 'center',
    },
});
