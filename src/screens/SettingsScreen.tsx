import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert, TextInput, ScrollView, Share, TouchableOpacity, I18nManager, NativeModules } from 'react-native';
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

export const SettingsScreen = () => {
    const { t, i18n } = useTranslation();
    const { updateUserStats, userStats, workouts, refreshData } = useWorkout();
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [height, setHeight] = useState('');

    useEffect(() => {
        if (userStats) {
            setWeight(userStats.weight?.toString() || '');
            setBodyFat(userStats.bodyFat?.toString() || '');
            setHeight(userStats.height?.toString() || '');
        }
    }, [userStats]);

    const handleSaveStats = async () => {
        const w = parseFloat(weight);

        if (isNaN(w) || w <= 0) {
            Alert.alert(t('settings.invalidWeight'), t('settings.invalidWeightMessage'));
            return;
        }

        const bf = parseFloat(bodyFat);
        const h = parseFloat(height);

        await updateUserStats({
            weight: w,
            bodyFat: isNaN(bf) ? undefined : bf,
            height: isNaN(h) ? undefined : h,
        });
        Alert.alert(t('settings.saved'), t('settings.savedMessage'));
    };

    const handleExportCSV = async () => {
        if (workouts.length === 0) {
            Alert.alert(t('settings.noData'), t('settings.noDataMessage'));
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
            Alert.alert(t('settings.exportError'), error.message);
        }
    };

    const handleReset = () => {
        Alert.alert(
            t('settings.resetTitle'),
            t('settings.resetMessage'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('settings.deleteEverything'),
                    style: 'destructive',
                    onPress: async () => {
                        await AsyncStorage.clear();
                        await refreshData();
                        Alert.alert(t('settings.dataCleared'), t('settings.dataClearedMessage'));
                    },
                },
            ]
        );
    };

    const handleChangeLanguage = (lang: SupportedLanguage) => {
        const currentIsRTL = isRTL(currentLang);
        const newIsRTL = isRTL(lang);

        if (currentIsRTL !== newIsRTL) {
            Alert.alert(
                t('settings.restartRequired'),
                t('settings.restartMessage'),
                [
                    {
                        text: t('common.cancel'),
                        style: 'cancel',
                    },
                    {
                        text: t('common.ok'),
                        onPress: async () => {
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
                                    Alert.alert('Restart Required', 'Please close and reopen the app manually.');
                                }
                            }
                        },
                    },
                ]
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

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Typography variant="h1" style={{ marginBottom: 24 }}>{t('settings.title')}</Typography>

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
                        {t('settings.tagline')}
                    </Typography>
                </View>
            </ScrollView>
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
});
