import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Share, TouchableOpacity, I18nManager, NativeModules } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkout } from '../context/WorkoutContext';
import { colors, spacing, borderRadius } from '../theme/colors';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LABELS, SupportedLanguage, isRTL, saveLanguagePreference } from '../i18n';
import * as Updates from 'expo-updates';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useSubscription } from '../context/SubscriptionContext';
import { StorageService } from '../services/storage';
import { BodyMeasurement, MeasurementKey } from '../types';
import { generateId } from '../utils/generateId';
import { useAuth } from '@clerk/clerk-expo';
import { Rocket } from 'lucide-react-native';

export const SettingsScreen = ({ navigation }: any) => {
    const { t, i18n } = useTranslation();
    const { updateUserStats, userStats, workouts, refreshData, bodyMeasurements, addBodyMeasurement } = useWorkout();
    const { tier, trialDaysRemaining, purchaseLocalPremium, restorePurchases } = useSubscription();
    const { isSignedIn, signOut } = useAuth();
    const [isLive, setIsLive] = useState(false);
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [height, setHeight] = useState('');

    // Body measurements state
    const [showMeasurements, setShowMeasurements] = useState(false);
    const [mNeck, setMNeck] = useState('');
    const [mChest, setMChest] = useState('');
    const [mWaist, setMWaist] = useState('');
    const [mHips, setMHips] = useState('');
    const [mBiceps, setMBiceps] = useState('');
    const [mThighs, setMThighs] = useState('');
    const [mCalves, setMCalves] = useState('');

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

    useEffect(() => {
        if (userStats) {
            setWeight(userStats.weight?.toString() || '');
            setBodyFat(userStats.bodyFat?.toString() || '');
            setHeight(userStats.height?.toString() || '');
        }
    }, [userStats]);

    useEffect(() => {
        StorageService.getIsLive().then(setIsLive);
    }, []);

    const handleSaveStats = async () => {
        const w = parseFloat(weight);

        if (isNaN(w) || w <= 0) {
            showModal(t('settings.invalidWeight'), t('settings.invalidWeightMessage'), undefined, 'danger');
            return;
        }

        const bf = parseFloat(bodyFat);
        const h = parseFloat(height);

        await updateUserStats({
            weight: w,
            bodyFat: isNaN(bf) ? undefined : bf,
            height: isNaN(h) ? undefined : h,
        });
        showModal(t('settings.saved'), t('settings.savedMessage'), undefined, 'success');
    };

    const handleExportCSV = async () => {
        if (workouts.length === 0) {
            showModal(t('settings.noData'), t('settings.noDataMessage'), undefined, 'primary');
            return;
        }

        const header = 'Date,Time,Workout Name,Exercise,Set #,Weight (kg),Reps,Volume (kg),Notes\n';
        const rows = workouts
            .flatMap(w =>
                w.exercises.flatMap(ex =>
                    ex.sets.map((s, index) =>
                        [
                            format(w.startTime, 'yyyy-MM-dd'),
                            format(w.startTime, 'HH:mm'),
                            `"${w.name}"`,
                            `"${ex.exerciseName}"`,
                            index + 1,
                            s.weight,
                            s.reps,
                            s.weight * s.reps,
                            `"${w.notes || ''}"`,
                        ].join(',')
                    )
                )
            )
            .join('\n');

        const csv = header + rows;

        try {
            await Share.share({
                message: csv,
                title: `GymLog_Export_${format(Date.now(), 'yyyy-MM-dd')}`,
            });
        } catch (error: any) {
            showModal(t('settings.exportError'), error.message, undefined, 'danger');
        }
    };

    const handleReset = () => {
        showModal(
            t('settings.resetTitle'),
            t('settings.resetMessage'),
            async () => {
                await AsyncStorage.clear();
                await refreshData();
                showModal(t('settings.dataCleared'), t('settings.dataClearedMessage'), undefined, 'success');
            },
            'danger',
            t('settings.deleteEverything'),
            t('common.cancel'),
            () => { },
            true,
            t('settings.confirmDelete')
        );
    };

    const handleChangeLanguage = (lang: SupportedLanguage) => {
        const currentIsRTL = isRTL(currentLang);
        const newIsRTL = isRTL(lang);

        if (currentIsRTL !== newIsRTL) {
            showModal(
                t('settings.restartRequired'),
                t('settings.restartMessage'),
                async () => {
                    // 1. Save preference first
                    await saveLanguagePreference(lang);

                    // 2. Enforce new RTL setting (DO NOT change i18n instance yet to avoid flicker)
                    I18nManager.allowRTL(newIsRTL);
                    I18nManager.forceRTL(newIsRTL);

                    // 3. Reload app
                    try {
                        await Updates.reloadAsync();
                    } catch (e) {
                        // Fallback for dev mode
                        if (__DEV__ && NativeModules.DevSettings) {
                            NativeModules.DevSettings.reload();
                        } else {
                            showModal('Restart Required', 'Please close and reopen the app manually.', undefined, 'danger');
                        }
                    }
                },
                'primary', // Restart is a primary action here, or arguably danger/warning. Primary is fine.
                t('common.ok'),
                t('common.cancel'),
                () => { }
            );
        } else {
            // No RTL change needed, just update immediately
            i18n.changeLanguage(lang);
            saveLanguagePreference(lang);
        }
    };

    // Calculate lifetime stats
    const totalWorkouts = workouts.length;
    const totalSets = workouts.reduce((acc, w) =>
        acc + w.exercises.reduce((a, e) => a + e.sets.length, 0), 0
    );
    const totalVolume = workouts.reduce((acc, w) =>
        acc + w.exercises.reduce((a, e) => a + e.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0), 0
    );

    const currentLang = i18n.language as SupportedLanguage;

    const handleSaveMeasurements = async () => {
        const vals = {
            neck: parseFloat(mNeck) || undefined,
            chest: parseFloat(mChest) || undefined,
            waist: parseFloat(mWaist) || undefined,
            hips: parseFloat(mHips) || undefined,
            biceps: parseFloat(mBiceps) || undefined,
            thighs: parseFloat(mThighs) || undefined,
            calves: parseFloat(mCalves) || undefined,
        };

        const hasAny = Object.values(vals).some(v => v !== undefined);
        if (!hasAny) {
            showModal(t('measurements.error'), t('measurements.errorEmpty'), undefined, 'danger');
            return;
        }

        const measurement: BodyMeasurement = {
            id: generateId(),
            date: Date.now(),
            ...vals,
        };

        await addBodyMeasurement(measurement);
        // Clear fields
        setMNeck(''); setMChest(''); setMWaist(''); setMHips('');
        setMBiceps(''); setMThighs(''); setMCalves('');
        showModal(t('measurements.saved'), t('measurements.savedMessage'), undefined, 'success');
    };

    const MEASUREMENT_FIELDS: { key: MeasurementKey; label: string; state: string; setter: (v: string) => void }[] = [
        { key: 'neck', label: t('measurements.neck'), state: mNeck, setter: setMNeck },
        { key: 'chest', label: t('measurements.chest'), state: mChest, setter: setMChest },
        { key: 'waist', label: t('measurements.waist'), state: mWaist, setter: setMWaist },
        { key: 'hips', label: t('measurements.hips'), state: mHips, setter: setMHips },
        { key: 'biceps', label: t('measurements.biceps'), state: mBiceps, setter: setMBiceps },
        { key: 'thighs', label: t('measurements.thighs'), state: mThighs, setter: setMThighs },
        { key: 'calves', label: t('measurements.calves'), state: mCalves, setter: setMCalves },
    ];

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Typography variant="h1" style={{ marginBottom: 24 }}>{t('settings.title')}</Typography>

                {/* Subscription Status */}
                <Card style={tier === 'local_premium' ? styles.premiumCard : undefined}>
                    <Typography variant="h3" style={{ marginBottom: 4 }}>{t('subscription.statusTitle')}</Typography>

                    {tier === 'local_premium' ? (
                        <View style={styles.premiumBadge}>
                            <Typography variant="body" bold color={colors.success}>
                                {t('subscription.premiumActive')}
                            </Typography>
                        </View>
                    ) : tier === 'trial' ? (
                        <View>
                            <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 12 }}>
                                {t('subscription.trialBanner', { days: trialDaysRemaining })}
                            </Typography>
                            <View style={styles.trialProgressBar}>
                                <View style={[styles.trialProgressFill, { width: `${(trialDaysRemaining / 5) * 100}%` }]} />
                            </View>
                            <Button
                                title={t('subscription.unlockForever')}
                                onPress={async () => {
                                    const result = await purchaseLocalPremium();
                                    if (!result.success) {
                                        showModal(t('subscription.purchaseError'), result.error || '', undefined, 'danger');
                                    }
                                }}
                                size="medium"
                                style={{ marginTop: 12 }}
                            />
                        </View>
                    ) : (
                        <View>
                            <Typography variant="caption" color={colors.error} style={{ marginBottom: 12 }}>
                                {t('subscription.trialExpired')}
                            </Typography>
                            <Button
                                title={t('subscription.unlockForever')}
                                onPress={async () => {
                                    const result = await purchaseLocalPremium();
                                    if (!result.success) {
                                        showModal(t('subscription.purchaseError'), result.error || '', undefined, 'danger');
                                    }
                                }}
                                size="medium"
                            />
                        </View>
                    )}

                    {tier !== 'local_premium' && (
                        <Button
                            title={t('subscription.restorePurchase')}
                            variant="ghost"
                            size="small"
                            onPress={async () => {
                                const result = await restorePurchases();
                                if (result.restored) {
                                    showModal(t('subscription.restored'), t('subscription.restoredMessage'), undefined, 'success');
                                } else {
                                    showModal(t('subscription.noRestoreFound'), t('subscription.noRestoreFoundMessage'), undefined, 'primary');
                                }
                            }}
                            style={{ marginTop: 8 }}
                        />
                    )}
                </Card>

                {/* Go Live */}
                <Card style={isLive ? styles.liveCard : styles.goLiveCard}>
                    {isLive ? (
                        <View>
                            <View style={styles.liveBadge}>
                                <Typography variant="body" bold color={colors.success}>
                                    ✅ {t('goLive.youAreLive')}
                                </Typography>
                            </View>
                            {isSignedIn && (
                                <Button
                                    title={t('goLive.signOut')}
                                    variant="ghost"
                                    size="small"
                                    onPress={async () => {
                                        await signOut();
                                        await StorageService.setIsLive(false);
                                        setIsLive(false);
                                    }}
                                    style={{ marginTop: 8 }}
                                />
                            )}
                        </View>
                    ) : (
                        <TouchableOpacity
                            style={styles.goLiveButton}
                            onPress={() => navigation.navigate('GoLive')}
                            activeOpacity={0.8}
                        >
                            <View style={styles.goLiveIconContainer}>
                                <Rocket color={colors.primary} size={28} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Typography variant="h3">{t('goLive.goLive')}</Typography>
                                <Typography variant="caption" color={colors.textSecondary}>
                                    {t('goLive.goLiveDesc')}
                                </Typography>
                            </View>
                        </TouchableOpacity>
                    )}
                </Card>

                {/* Language Selector */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 4 }}>{t('settings.language')}</Typography>
                    <Typography variant="caption" style={{ marginBottom: 16 }}>
                        {t('settings.languageDescription')}
                    </Typography>

                    <View style={styles.languageGrid}>
                        {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map(lang => (
                            <TouchableOpacity
                                key={lang}
                                style={[
                                    styles.languageChip,
                                    currentLang === lang && styles.languageChipActive,
                                ]}
                                onPress={() => handleChangeLanguage(lang)}
                                activeOpacity={0.7}
                            >
                                <Typography
                                    variant="bodySmall"
                                    color={currentLang === lang ? colors.black : colors.textSecondary}
                                    bold={currentLang === lang}
                                >
                                    {LANGUAGE_LABELS[lang]}
                                </Typography>
                            </TouchableOpacity>
                        ))}
                    </View>
                </Card>

                {/* Body Stats */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 16 }}>{t('settings.bodyStats')}</Typography>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={styles.inputLabel}>{t('settings.weightKg')}</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 75"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={weight}
                            onChangeText={setWeight}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={styles.inputLabel}>{t('settings.heightCm')}</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 180"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={height}
                            onChangeText={setHeight}
                        />
                    </View>

                    <View style={styles.inputContainer}>
                        <Typography variant="label" style={styles.inputLabel}>{t('settings.bodyFatPercent')}</Typography>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. 15"
                            keyboardType="numeric"
                            placeholderTextColor={colors.textSecondary}
                            value={bodyFat}
                            onChangeText={setBodyFat}
                        />
                    </View>

                    {userStats?.lastUpdated && (
                        <Typography variant="caption" style={{ marginBottom: 12 }}>
                            {t('settings.lastUpdated', { date: format(userStats.lastUpdated, 'MMM dd, yyyy') })}
                        </Typography>
                    )}

                    <Button title={t('settings.saveStats')} onPress={handleSaveStats} />
                </Card>

                {/* Lifetime Stats */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 12 }}>{t('settings.lifetimeStats')}</Typography>
                    <View style={styles.lifetimeRow}>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" color={colors.primary}>{totalWorkouts}</Typography>
                            <Typography variant="caption">{t('home.workouts')}</Typography>
                        </View>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" color={colors.success}>{totalSets}</Typography>
                            <Typography variant="caption">{t('common.sets')}</Typography>
                        </View>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" color={colors.warning}>
                                {totalVolume > 9999 ? `${(totalVolume / 1000).toFixed(0)}k` : totalVolume}
                            </Typography>
                            <Typography variant="caption">{t('settings.kgTotal')}</Typography>
                        </View>
                    </View>
                </Card>

                {/* Body Measurements */}
                <Card>
                    <TouchableOpacity
                        onPress={() => setShowMeasurements(!showMeasurements)}
                        activeOpacity={0.7}
                        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
                    >
                        <View>
                            <Typography variant="h3">{t('measurements.title')}</Typography>
                            <Typography variant="caption" style={{ marginTop: 2 }}>
                                {t('measurements.subtitle')}
                            </Typography>
                        </View>
                        <Typography variant="body" color={colors.textMuted}>
                            {showMeasurements ? '▲' : '▼'}
                        </Typography>
                    </TouchableOpacity>

                    {showMeasurements && (
                        <View style={{ marginTop: 16 }}>
                            <View style={styles.measureGrid}>
                                {MEASUREMENT_FIELDS.map(field => (
                                    <View key={field.key} style={styles.measureItem}>
                                        <Typography variant="caption" style={{ marginBottom: 4, fontSize: 10 }}>
                                            {field.label}
                                        </Typography>
                                        <TextInput
                                            style={styles.measureInput}
                                            placeholder="cm"
                                            keyboardType="numeric"
                                            placeholderTextColor={colors.textMuted}
                                            value={field.state}
                                            onChangeText={field.setter}
                                        />
                                    </View>
                                ))}
                            </View>

                            <Button
                                title={t('measurements.save')}
                                onPress={handleSaveMeasurements}
                                size="small"
                                style={{ marginTop: 12 }}
                            />

                            {/* Mini History */}
                            {bodyMeasurements.length > 0 && (
                                <View style={{ marginTop: 16 }}>
                                    <Typography variant="label" style={{ marginBottom: 8 }}>
                                        {t('measurements.history')}
                                    </Typography>
                                    {bodyMeasurements.slice(0, 5).map((m, i) => {
                                        const prev = bodyMeasurements[i + 1];
                                        return (
                                            <View key={m.id} style={styles.measureHistoryRow}>
                                                <Typography variant="caption" color={colors.textSecondary} style={{ width: 72, fontSize: 10 }}>
                                                    {format(m.date, 'MMM dd')}
                                                </Typography>
                                                <View style={styles.measureHistoryValues}>
                                                    {MEASUREMENT_FIELDS.map(f => {
                                                        const val = m[f.key];
                                                        const prevVal = prev?.[f.key];
                                                        if (!val) return null;
                                                        const diff = prevVal ? val - prevVal : 0;
                                                        return (
                                                            <View key={f.key} style={styles.measureHistoryChip}>
                                                                <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 8 }}>
                                                                    {f.label}
                                                                </Typography>
                                                                <Typography variant="caption" bold style={{ fontSize: 11 }}>
                                                                    {val}
                                                                    {diff !== 0 && (
                                                                        <Typography
                                                                            variant="caption"
                                                                            color={diff > 0 ? colors.error : colors.success}
                                                                            style={{ fontSize: 9 }}
                                                                        >
                                                                            {' '}{diff > 0 ? '↑' : '↓'}{Math.abs(diff).toFixed(1)}
                                                                        </Typography>
                                                                    )}
                                                                </Typography>
                                                            </View>
                                                        );
                                                    })}
                                                </View>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    )}
                </Card>

                {/* Data Management */}
                <Card>
                    <Typography variant="h3" style={{ marginBottom: 4 }}>{t('settings.dataManagement')}</Typography>
                    <Typography variant="caption" style={{ marginBottom: 16 }}>
                        {t('settings.dataManagementDescription')}
                    </Typography>

                    <Button
                        title={t('settings.exportCSV')}
                        onPress={handleExportCSV}
                        variant="secondary"
                        style={{ marginBottom: 12 }}
                    />

                    <Button
                        title={t('settings.clearAllData')}
                        onPress={handleReset}
                        variant="outline"
                        style={{ borderColor: colors.error }}
                    />
                </Card>

                <View style={styles.footer}>
                    <Typography variant="caption" style={{ textAlign: 'center' }}>
                        {t('settings.version')}
                    </Typography>
                    <Typography variant="caption" style={{ textAlign: 'center', marginTop: 4 }}>
                        {tier === 'local_premium'
                            ? t('subscription.premiumTagline')
                            : t('settings.tagline')
                        }
                    </Typography>
                </View>
            </ScrollView>

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

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    inputLabel: {
        width: 90,
    },
    input: {
        flex: 1,
        height: 40,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
        paddingHorizontal: 12,
        color: colors.text,
    },
    lifetimeRow: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    lifetimeStat: {
        alignItems: 'center',
    },
    languageGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    languageChip: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: borderRadius.m,
        backgroundColor: colors.surfaceLight,
        borderWidth: 1,
        borderColor: colors.border,
        minWidth: '45%',
        alignItems: 'center',
    },
    languageChipActive: {
        backgroundColor: colors.primary,
        borderColor: colors.primary,
    },
    footer: {
        marginTop: 24,
        paddingVertical: 16,
    },
    premiumCard: {
        borderWidth: 1,
        borderColor: colors.success + '40',
    },
    premiumBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.success + '12',
        borderRadius: borderRadius.m,
    },
    trialProgressBar: {
        height: 6,
        backgroundColor: colors.surfaceLight,
        borderRadius: 3,
        overflow: 'hidden',
    },
    trialProgressFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: 3,
    },
    // ── Measurement styles ────────────────────────────────
    measureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    measureItem: {
        width: '30%',
        flexGrow: 1,
    },
    measureInput: {
        height: 38,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
        paddingHorizontal: 10,
        color: colors.text,
        textAlign: 'center',
        fontSize: 14,
        borderWidth: 1,
        borderColor: colors.border,
    },
    measureHistoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: colors.border + '30',
    },
    measureHistoryValues: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    measureHistoryChip: {
        alignItems: 'center',
        paddingHorizontal: 6,
        paddingVertical: 2,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.xs,
    },
    // ── Go Live styles ────────────────────────────────────
    goLiveCard: {
        borderWidth: 1,
        borderColor: colors.primary + '30',
    },
    liveCard: {
        borderWidth: 1,
        borderColor: colors.success + '40',
    },
    goLiveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    goLiveIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: colors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 16,
        backgroundColor: colors.success + '12',
        borderRadius: borderRadius.m,
    },
});
