import React, { useState, useEffect } from 'react';
import { View, StyleSheet, TextInput, ScrollView, Share, TouchableOpacity, I18nManager, NativeModules, Modal } from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProFeatureGate } from '../components/ProFeatureGate';
import { useWorkout } from '../context/WorkoutContext';
import { borderRadius, ThemeColors } from '../theme/colors';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_LABELS, SupportedLanguage, isRTL, saveLanguagePreference } from '../i18n';
import * as Updates from 'expo-updates';
import { ConfirmationModal } from '../components/ConfirmationModal';
import { useSubscription, TRIAL_DURATION_DAYS } from '../context/SubscriptionContext';
import { useCloudSync, SUBSCRIPTION_NOT_VERIFIED } from '../context/CloudSyncContext';
import { BodyMeasurement, MeasurementKey, TrainingProfile } from '../types';
import { TrainingProfileForm, trainingProfileArgs, trainingProfileOf } from '../components/TrainingProfileForm';
import { generateId } from '../utils/generateId';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Crown, Sparkles, CreditCard, LogOut, LogIn, Sun, Moon, Target, Ruler, Cloud, CloudOff, RefreshCw, AlertTriangle, Dumbbell, Globe, Scale, Download, Trash2, UserX, ChevronDown, ChevronUp, ChevronRight } from 'lucide-react-native';
import { ListGroup, ListRow } from '../components/ListRow';
import { Chip } from '../components/Chip';
import { SegmentedControl } from '../components/SegmentedControl';
import { ScreenHeader } from '../components/ScreenHeader';
import { useTheme } from '../context/ThemeContext';
import { useUnits, UnitSystem } from '../context/UnitsContext';


export const SettingsScreen = ({ navigation }: any) => {
    const { t, i18n } = useTranslation();
    const { colors, themeMode, setThemeMode } = useTheme();
    const styles = createStyles(colors);
    const { unitSystem, setUnitSystem, weightUnit, lengthUnit, displayWeight, displayLength, toMetricWeight, toMetricLength } = useUnits();
    const { updateUserStats, userStats, workouts, bodyMeasurements, addBodyMeasurement, clearAllData, cancelWorkout } = useWorkout();
    const {
        tier,
        isPro,
        isAISubscriber,
        hasLifetimePro,
        hasEverSubscribedAI,
        needsAccount,
        aiExpiresAt,
        aiWillRenew,
        aiBillingIssue,
        trialDaysRemaining,
        purchasePro,
        openManageSubscription,
        restorePurchases,
    } = useSubscription();
    const {
        cloudSyncActive,
        status: syncStatus,
        lastSyncedAt,
        pendingChanges,
        lastError: lastSyncError,
        accountLinked,
        ownership,
        syncNow,
        resolveOwnership,
        signOut,
        deleteAccount,
    } = useCloudSync();
    const { isSignedIn } = useAuth();
    const { user } = useUser();
    const updateProfile = useMutation(api.users.updateProfile);
    const convexUser = useQuery(api.users.me, isSignedIn ? {} : 'skip');
    const [restoring, setRestoring] = useState(false);
    const [weight, setWeight] = useState('');
    const [bodyFat, setBodyFat] = useState('');
    const [height, setHeight] = useState('');
    const [fitnessGoal, setFitnessGoal] = useState<string | null>(null);
    const [trainingDraft, setTrainingDraft] = useState<TrainingProfile | null>(null);
    const [savingTraining, setSavingTraining] = useState(false);

    // Body measurements state
    const [showMeasurements, setShowMeasurements] = useState(false);
    const [showLanguage, setShowLanguage] = useState(false);
    const [showBodyStats, setShowBodyStats] = useState(false);
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
            setWeight(userStats.weight ? displayWeight(userStats.weight).toString() : '');
            setBodyFat(userStats.bodyFat?.toString() || '');
            setHeight(userStats.height ? displayLength(userStats.height).toString() : '');
        }
    }, [userStats, unitSystem]);

    const handleSaveStats = async () => {
        const w = parseFloat(weight);

        if (isNaN(w) || w <= 0) {
            showModal(t('settings.invalidWeight'), t('settings.invalidWeightMessage'), undefined, 'danger');
            return;
        }

        const bf = parseFloat(bodyFat);
        const h = parseFloat(height);

        // Always store in metric (kg / cm)
        const stats = {
            weight: toMetricWeight(w),
            bodyFat: isNaN(bf) ? undefined : bf,
            height: isNaN(h) ? undefined : toMetricLength(h),
        };
        await updateUserStats(stats);
        // The AI coach reads body stats from the cloud profile.
        if (convexUser) {
            updateProfile(stats).catch(e => console.warn('[Settings] Profile stats sync failed:', e));
        }
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
            accountLinked ? t('settings.resetCloudMessage') : t('settings.resetMessage'),
            async () => {
                // Preferences, language and trial date are kept; cloud copy is
                // cleared on the next sync when this device is linked to an account.
                await clearAllData();
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

    const handleDeleteAccount = () => {
        showModal(
            t('settings.deleteAccountTitle', 'Delete Account'),
            t('account.deleteAccountMessage'),
            async () => {
                try {
                    await deleteAccount();
                    await cancelWorkout();
                    showModal(t('settings.deleteAccountTitle', 'Delete Account'), t('account.deleteSuccess'), undefined, 'success');
                } catch (error: any) {
                    console.error("Error deleting account:", error);
                    showModal(
                        t('common.error', 'Error'),
                        `${t('settings.deleteError', 'Failed to delete account.')}\n${error?.message ?? ''}`,
                        undefined,
                        'danger'
                    );
                }
            },
            'danger',
            t('settings.confirmDeleteAccount', 'Delete Account'),
            t('common.cancel'),
            () => { },
            true,
            t('settings.understandDelete', 'I understand this is permanent')
        );
    };

    const handleSignOut = () => {
        const unsynced = !cloudSyncActive && accountLinked && pendingChanges > 0;
        showModal(
            t('account.signOutTitle'),
            unsynced
                ? `${t('account.signOutMessage')}\n\n${t('account.signOutPending', { count: pendingChanges })}`
                : t('account.signOutMessage'),
            async () => {
                try {
                    await signOut();
                } catch (error: any) {
                    showModal(t('common.error', 'Error'), error?.message ?? '', undefined, 'danger');
                }
            },
            'primary',
            t('account.signOut'),
            t('common.cancel'),
            () => { }
        );
    };

    const handleRestore = async () => {
        setRestoring(true);
        const result = await restorePurchases();
        setRestoring(false);
        if (!result.success || (!result.restoredPro && !result.restoredAI)) {
            showModal(t('subscription.noRestoreFound'), t('subscription.noRestoreFoundMessage'), undefined, 'primary');
        } else {
            showModal(t('subscription.restored'), t('subscription.restoredMessage'), undefined, 'success');
        }
    };

    const handleResolveConflict = (choice: 'merge' | 'replace') => {
        if (choice === 'merge') {
            resolveOwnership('merge');
            return;
        }
        showModal(
            t('account.conflictTitle'),
            t('account.conflictReplaceConfirm'),
            () => { resolveOwnership('replace'); },
            'danger',
            t('account.conflictReplace'),
            t('common.cancel'),
            () => { }
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
                    await saveLanguagePreference(lang);
                    I18nManager.allowRTL(newIsRTL);
                    I18nManager.forceRTL(newIsRTL);
                    try {
                        await Updates.reloadAsync();
                    } catch (e) {
                        if (__DEV__ && NativeModules.DevSettings) {
                            NativeModules.DevSettings.reload();
                        } else {
                            showModal('Restart Required', 'Please close and reopen the app manually.', undefined, 'danger');
                        }
                    }
                },
                'primary',
                t('common.ok'),
                t('common.cancel'),
                () => { }
            );
        } else {
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
        const parse = (v: string) => {
            const n = parseFloat(v);
            return isNaN(n) ? undefined : n;
        };

        const raw = {
            neck: parse(mNeck),
            chest: parse(mChest),
            waist: parse(mWaist),
            hips: parse(mHips),
            biceps: parse(mBiceps),
            thighs: parse(mThighs),
            calves: parse(mCalves),
        };

        const hasAny = Object.values(raw).some(v => v !== undefined);
        if (!hasAny) {
            showModal(t('measurements.error'), t('measurements.errorEmpty'), undefined, 'danger');
            return;
        }

        // Convert to metric (cm) for storage
        const vals: Record<string, number | undefined> = {};
        for (const [key, v] of Object.entries(raw)) {
            vals[key] = v !== undefined ? toMetricLength(v) : undefined;
        }

        const measurement: BodyMeasurement = {
            id: generateId(),
            date: Date.now(),
            ...vals,
        };

        await addBodyMeasurement(measurement);
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

    const handlePurchasePro = async () => {
        const result = await purchasePro();
        if (!result.success && !result.cancelled) {
            showModal(t('subscription.purchaseError'), result.error || '', undefined, 'danger');
        }
    };

    const formatDate = (ms: number) => format(ms, 'MMM d, yyyy');
    const aiStatusLine = aiBillingIssue
        ? t('plan.aiBillingIssue')
        : aiExpiresAt
            ? (aiWillRenew
                ? t('plan.aiRenews', { date: formatDate(aiExpiresAt) })
                : t('plan.aiEnds', { date: formatDate(aiExpiresAt) }))
            : null;

    const restoreRow = (
        <ListRow
            title={restoring ? t('subscription.processing') : t('account.restorePurchases')}
            icon={c => <RefreshCw color={c} size={17} />}
            iconTone="neutral"
            onPress={handleRestore}
            disabled={restoring}
            showChevron={false}
        />
    );

    const planBadge = (tone: 'primary' | 'success' | 'secondary', icon: React.ReactNode, label: string) => {
        const toneColor = tone === 'success' ? colors.success : tone === 'secondary' ? colors.secondary : colors.primary;
        const toneSoft = tone === 'success' ? colors.successSoft : tone === 'secondary' ? colors.secondarySoft : colors.primarySoft;
        return (
            <View style={[styles.planBadge, { backgroundColor: toneSoft }]}>
                {icon}
                <Typography variant="bodySmall" bold color={toneColor}>{label}</Typography>
            </View>
        );
    };

    // ── Plan card: what the user has paid for ──
    const renderSubscriptionCard = () => {
        if (needsAccount) {
            // ── Paid for AI, no account yet ──
            return (
                <Card style={styles.planCard}>
                    {planBadge('secondary', <Sparkles color={colors.secondary} size={15} />, t('settings.aiActive'))}
                    <Typography variant="h3" style={{ marginTop: 14 }}>
                        {t('account.needsAccountTitle')}
                    </Typography>
                    <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 4 }}>
                        {t('account.needsAccountMessage')}
                    </Typography>
                    <Button
                        title={t('account.createAccount')}
                        onPress={() => navigation.navigate('AIOnboarding', { mode: 'signup' })}
                        style={{ marginTop: 16 }}
                    />
                    <Button
                        title={t('aiGate.haveAccountSignIn')}
                        variant="ghost"
                        onPress={() => navigation.navigate('AIOnboarding', { mode: 'signin' })}
                        style={{ marginTop: 4 }}
                    />
                </Card>
            );
        }

        if (isAISubscriber) {
            // ── AI Subscriber ──
            const goalValue = fitnessGoal !== null ? fitnessGoal : (convexUser?.goal || '');
            const goalChanged = fitnessGoal !== null && fitnessGoal !== (convexUser?.goal || '');
            return (
                <>
                    <Card style={styles.planCard}>
                        {planBadge('secondary', <Sparkles color={colors.secondary} size={15} />, t('settings.aiActive'))}
                        <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 12 }}>
                            {t('settings.aiActiveDesc')}
                        </Typography>
                        {aiStatusLine && (
                            <View style={styles.statusLine}>
                                {aiBillingIssue && <AlertTriangle color={colors.warning} size={14} />}
                                <Typography variant="caption" color={aiBillingIssue ? colors.warning : colors.textMuted} style={{ flex: 1 }}>
                                    {aiStatusLine}
                                </Typography>
                            </View>
                        )}

                        {/* Fitness goal editor */}
                        <View style={styles.goalSection}>
                            <View style={styles.goalLabelRow}>
                                <Target color={colors.textMuted} size={14} />
                                <Typography variant="label">{t('settings.fitnessGoal', 'Fitness Goal')}</Typography>
                            </View>
                            <TextInput
                                style={styles.goalInput}
                                value={goalValue}
                                onChangeText={setFitnessGoal}
                                placeholder={t('aiOnboarding.goalPlaceholder', 'e.g. Build muscle, lose fat, get stronger...')}
                                placeholderTextColor={colors.textMuted}
                                multiline
                                numberOfLines={2}
                                maxLength={200}
                                textAlignVertical="top"
                            />
                            {goalChanged && (
                                <Button
                                    title={t('settings.saveGoal', 'Save Goal')}
                                    variant="secondary"
                                    size="small"
                                    style={{ alignSelf: 'flex-end', marginTop: 10 }}
                                    onPress={async () => {
                                        if (convexUser?._id) {
                                            await updateProfile({ goal: fitnessGoal!.trim() });
                                            setFitnessGoal(null);
                                            showModal(
                                                t('settings.saved'),
                                                t('settings.goalSaved', 'Your fitness goal has been updated. RepAI will tailor advice to this goal.'),
                                                undefined,
                                                'success'
                                            );
                                        }
                                    }}
                                />
                            )}
                        </View>
                    </Card>

                    <ListGroup>
                        <ListRow
                            title={t('trainingProfile.title')}
                            subtitle={t('trainingProfile.subtitle')}
                            icon={c => <Dumbbell color={c} size={17} />}
                            iconTone="secondary"
                            onPress={() => setTrainingDraft(trainingProfileOf(convexUser))}
                        />
                        <ListRow
                            title={t('settings.manageSubscription')}
                            icon={c => <CreditCard color={c} size={17} />}
                            iconTone="neutral"
                            onPress={openManageSubscription}
                        />
                    </ListGroup>
                </>
            );
        }

        if (hasLifetimePro) {
            // ── Pro forever: one-time purchase, or included with a past AI subscription ──
            return (
                <>
                    <Card style={styles.planCard}>
                        {planBadge('success', <Crown color={colors.success} size={15} />, t('subscription.premiumActive'))}
                        {hasEverSubscribedAI && (
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 12 }}>
                                {t('plan.proFromAI')}
                            </Typography>
                        )}
                        {/* Upsell to AI */}
                        <TouchableOpacity style={styles.upgradeRow} onPress={() => navigation.navigate('AI')} activeOpacity={0.75}>
                            <View style={styles.upgradeIcon}>
                                <Sparkles color={colors.secondary} size={18} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Typography variant="body" bold>
                                    {hasEverSubscribedAI ? t('plan.resubscribeAI') : t('settings.upgradeToAI')}
                                </Typography>
                                <Typography variant="caption" color={colors.textSecondary}>
                                    {t('settings.upgradeToAIDesc')}
                                </Typography>
                            </View>
                            <ChevronRight color={colors.secondary} size={18} />
                        </TouchableOpacity>
                    </Card>
                    <ListGroup>{restoreRow}</ListGroup>
                </>
            );
        }

        // ── Pro Trial / Free ──
        return (
            <>
                <Card style={styles.planCard}>
                    <Typography variant="h3">{t('subscription.statusTitle')}</Typography>
                    {tier === 'pro_trial' ? (
                        <View>
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 4, marginBottom: 12 }}>
                                {t('subscription.proTrialBanner', { days: trialDaysRemaining, defaultValue: '{{days}} days of Pro remaining' })}
                            </Typography>
                            <View style={styles.trialProgressBar}>
                                <View style={[styles.trialProgressFill, { width: `${(trialDaysRemaining / TRIAL_DURATION_DAYS) * 100}%` }]} />
                            </View>
                        </View>
                    ) : (
                        <Typography variant="bodySmall" color={colors.error} style={{ marginTop: 4 }}>
                            {t('subscription.trialExpired')}
                        </Typography>
                    )}
                    <Button
                        title={t('subscription.unlockForever')}
                        onPress={handlePurchasePro}
                        icon={c => <Crown color={c} size={17} />}
                        style={{ marginTop: 16 }}
                    />
                </Card>
                <ListGroup>{restoreRow}</ListGroup>
            </>
        );
    };

    // ── Account: who is signed in and how the data syncs ──
    const renderAccountCard = () => {
        if (!isSignedIn) {
            // The plan card already asks AI subscribers without an account to create one.
            if (needsAccount) return null;
            return (
                <ListGroup title={t('account.title')}>
                    <ListRow
                        title={t('aiGate.alreadyHaveAccount')}
                        icon={c => <LogIn color={c} size={17} />}
                        onPress={() => navigation.navigate('AIOnboarding', { mode: 'signin' })}
                    />
                </ListGroup>
            );
        }

        const conflict = ownership?.status === 'otherAccount';
        let SyncIcon = Cloud;
        let syncColor: string = colors.success;
        let syncText: string;
        if (conflict) {
            SyncIcon = AlertTriangle;
            syncColor = colors.warning;
            syncText = t('account.conflictMessage', { email: ownership.ownerEmail || '—' });
        } else if (!cloudSyncActive) {
            SyncIcon = CloudOff;
            syncColor = colors.textMuted;
            syncText = isAISubscriber ? t('aiGate.connecting') : t('account.syncPaused');
        } else if (syncStatus === 'syncing') {
            SyncIcon = RefreshCw;
            syncColor = colors.primary;
            syncText = t('account.syncing');
        } else if (syncStatus === 'error') {
            SyncIcon = AlertTriangle;
            syncColor = colors.warning;
            syncText = lastSyncError === SUBSCRIPTION_NOT_VERIFIED
                ? t('account.syncNotVerified')
                : t('account.syncError');
        } else {
            syncText = lastSyncedAt
                ? t('account.syncedAt', { time: format(lastSyncedAt, 'MMM d, HH:mm') })
                : t('account.syncWaiting');
        }

        const email = user?.primaryEmailAddress?.emailAddress ?? '';
        return (
            <ListGroup title={t('account.title')}>
                <View style={styles.accountRow}>
                    <View style={styles.avatar}>
                        <Typography variant="body" bold color={colors.primary}>
                            {(user?.firstName || email || '?').charAt(0).toUpperCase()}
                        </Typography>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Typography variant="body" bold numberOfLines={1}>
                            {user?.fullName || email}
                        </Typography>
                        {!!user?.fullName && (
                            <Typography variant="caption" color={colors.textSecondary} numberOfLines={1}>{email}</Typography>
                        )}
                        <View style={[styles.statusLine, { marginTop: 6 }]}>
                            <SyncIcon color={syncColor} size={13} />
                            <Typography variant="caption" color={syncColor} style={{ flex: 1 }}>
                                {syncText}
                            </Typography>
                        </View>
                        {pendingChanges > 0 && !conflict && (
                            <Typography variant="caption" color={colors.textMuted} style={{ marginTop: 2 }}>
                                {t('account.pendingChanges', { count: pendingChanges })}
                            </Typography>
                        )}
                        {conflict && (
                            <View style={{ marginTop: 12, gap: 8 }}>
                                <Button title={t('account.conflictMerge')} onPress={() => handleResolveConflict('merge')} size="small" />
                                <Button title={t('account.conflictReplace')} variant="outline" onPress={() => handleResolveConflict('replace')} size="small" />
                            </View>
                        )}
                    </View>
                </View>
                {cloudSyncActive && !conflict && syncStatus !== 'syncing' && (
                    <ListRow
                        title={t('account.syncNow')}
                        icon={c => <RefreshCw color={c} size={17} />}
                        iconTone="neutral"
                        onPress={() => syncNow()}
                        showChevron={false}
                    />
                )}
                <ListRow
                    title={t('account.signOut')}
                    icon={c => <LogOut color={c} size={17} />}
                    onPress={handleSignOut}
                    destructive
                />
            </ListGroup>
        );
    };

    const expandIcon = (open: boolean) =>
        open ? <ChevronUp color={colors.textMuted} size={18} /> : <ChevronDown color={colors.textMuted} size={18} />;

    const formatVolume = (kg: number) => {
        const v = displayWeight(kg);
        return v > 9999 ? `${(v / 1000).toFixed(0)}k` : `${Math.round(v)}`;
    };

    return (
        <ScreenLayout>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <ScreenHeader title={t('settings.title')} />

                {/* Subscription / Plan Status */}
                {renderSubscriptionCard()}

                {/* Account & Cloud Sync */}
                {renderAccountCard()}

                {/* Preferences */}
                <ListGroup title={t('settings.preferences', 'Preferences')}>
                    <ListRow
                        title={t('settings.language')}
                        icon={c => <Globe color={c} size={17} />}
                        value={LANGUAGE_LABELS[currentLang] ?? currentLang}
                        onPress={() => setShowLanguage(!showLanguage)}
                        right={
                            <View style={styles.trailing}>
                                <Typography variant="bodySmall" color={colors.textSecondary}>
                                    {LANGUAGE_LABELS[currentLang] ?? currentLang}
                                </Typography>
                                {expandIcon(showLanguage)}
                            </View>
                        }
                    />
                    {showLanguage && (
                        <View style={styles.rowBody}>
                            <View style={styles.chipWrap}>
                                {(Object.keys(LANGUAGE_LABELS) as SupportedLanguage[]).map(lang => (
                                    <Chip
                                        key={lang}
                                        label={LANGUAGE_LABELS[lang]}
                                        selected={currentLang === lang}
                                        onPress={() => handleChangeLanguage(lang)}
                                    />
                                ))}
                            </View>
                        </View>
                    )}
                    <View style={styles.rowBody}>
                        <View style={styles.segmentLabel}>
                            <Typography variant="body">{t('settings.theme')}</Typography>
                        </View>
                        <SegmentedControl
                            value={themeMode}
                            onChange={setThemeMode}
                            options={[
                                { value: 'dark', label: t('settings.darkMode'), icon: c => <Moon color={c} size={15} /> },
                                { value: 'light', label: t('settings.lightMode'), icon: c => <Sun color={c} size={15} /> },
                            ]}
                        />
                    </View>
                    <View style={styles.rowBody}>
                        <View style={styles.segmentLabel}>
                            <Typography variant="body">{t('settings.units')}</Typography>
                        </View>
                        <SegmentedControl
                            value={unitSystem}
                            onChange={async (system: UnitSystem) => {
                                await setUnitSystem(system);
                                if (convexUser?._id) {
                                    await updateProfile({ unitPreference: system });
                                }
                            }}
                            options={[
                                { value: 'metric', label: t('settings.metric') },
                                { value: 'imperial', label: t('settings.imperial') },
                            ]}
                        />
                    </View>
                </ListGroup>

                {/* Body */}
                <ListGroup title={t('settings.body', 'Body')}>
                    <ListRow
                        title={t('settings.bodyStats')}
                        icon={c => <Scale color={c} size={17} />}
                        iconTone="accent"
                        onPress={() => setShowBodyStats(!showBodyStats)}
                        right={
                            <View style={styles.trailing}>
                                <Typography variant="bodySmall" color={colors.textSecondary}>
                                    {userStats?.weight ? `${displayWeight(userStats.weight)} ${weightUnit}` : ''}
                                </Typography>
                                {expandIcon(showBodyStats)}
                            </View>
                        }
                    />
                    {showBodyStats && (
                        <View style={styles.rowBody}>
                            <View style={styles.fieldRow}>
                                <View style={styles.field}>
                                    <Typography variant="label" style={styles.fieldLabel}>
                                        {t('settings.weight')} ({weightUnit})
                                    </Typography>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={unitSystem === 'metric' ? '75' : '165'}
                                        keyboardType="numeric"
                                        placeholderTextColor={colors.textMuted}
                                        value={weight}
                                        onChangeText={setWeight}
                                    />
                                </View>
                                <View style={styles.field}>
                                    <Typography variant="label" style={styles.fieldLabel}>
                                        {t('settings.height')} ({lengthUnit})
                                    </Typography>
                                    <TextInput
                                        style={styles.input}
                                        placeholder={unitSystem === 'metric' ? '180' : '71'}
                                        keyboardType="numeric"
                                        placeholderTextColor={colors.textMuted}
                                        value={height}
                                        onChangeText={setHeight}
                                    />
                                </View>
                                <View style={styles.field}>
                                    <Typography variant="label" style={styles.fieldLabel}>{t('settings.bodyFatPercent')}</Typography>
                                    <TextInput
                                        style={styles.input}
                                        placeholder="15"
                                        keyboardType="numeric"
                                        placeholderTextColor={colors.textMuted}
                                        value={bodyFat}
                                        onChangeText={setBodyFat}
                                    />
                                </View>
                            </View>
                            {userStats?.lastUpdated && (
                                <Typography variant="caption" color={colors.textMuted} style={{ marginTop: 10 }}>
                                    {t('settings.lastUpdated', { date: format(userStats.lastUpdated, 'MMM dd, yyyy') })}
                                </Typography>
                            )}
                            <Button title={t('settings.saveStats')} onPress={handleSaveStats} variant="secondary" style={{ marginTop: 12 }} />
                        </View>
                    )}
                    <ProFeatureGate feature="bodyMeasurements">
                        <ListRow
                            title={t('measurements.title')}
                            subtitle={t('measurements.subtitle')}
                            icon={c => <Ruler color={c} size={17} />}
                            iconTone="accent"
                            onPress={() => setShowMeasurements(!showMeasurements)}
                            right={expandIcon(showMeasurements)}
                        />
                        {showMeasurements && (
                            <View style={styles.rowBody}>
                                <View style={styles.measureGrid}>
                                    {MEASUREMENT_FIELDS.map(field => (
                                        <View key={field.key} style={styles.measureItem}>
                                            <Typography variant="label" style={styles.fieldLabel}>
                                                {field.label}
                                            </Typography>
                                            <TextInput
                                                style={[styles.input, { textAlign: 'center' }]}
                                                placeholder={lengthUnit}
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
                                    variant="secondary"
                                    style={{ marginTop: 12 }}
                                />

                                {/* Mini history */}
                                {bodyMeasurements.length > 0 && (
                                    <View style={{ marginTop: 18 }}>
                                        <Typography variant="label" style={{ marginBottom: 6 }}>
                                            {t('measurements.history')}
                                        </Typography>
                                        {bodyMeasurements.slice(0, 5).map((m, i) => {
                                            const prev = bodyMeasurements[i + 1];
                                            return (
                                                <View key={m.id} style={styles.measureHistoryRow}>
                                                    <Typography variant="caption" color={colors.textSecondary} style={{ width: 56 }}>
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
                                                                    <Typography variant="caption" color={colors.textMuted} style={{ fontSize: 10, lineHeight: 13 }}>
                                                                        {f.label}
                                                                    </Typography>
                                                                    <Typography variant="caption" bold color={colors.text} style={{ fontSize: 12, lineHeight: 16 }}>
                                                                        {displayLength(val)}
                                                                        {diff !== 0 && (
                                                                            <Typography
                                                                                variant="caption"
                                                                                color={diff > 0 ? colors.warning : colors.success}
                                                                                style={{ fontSize: 10 }}
                                                                            >
                                                                                {' '}{diff > 0 ? '↑' : '↓'}{Math.abs(displayLength(diff)).toFixed(1)}
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
                    </ProFeatureGate>
                </ListGroup>

                {/* Lifetime Stats */}
                <ListGroup title={t('settings.lifetimeStats')}>
                    <View style={styles.lifetimeRow}>
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" style={styles.statValue}>{totalWorkouts}</Typography>
                            <Typography variant="caption" color={colors.textMuted}>{t('home.workouts')}</Typography>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" style={styles.statValue}>{totalSets}</Typography>
                            <Typography variant="caption" color={colors.textMuted}>{t('common.sets')}</Typography>
                        </View>
                        <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
                        <View style={styles.lifetimeStat}>
                            <Typography variant="h2" style={styles.statValue}>{formatVolume(totalVolume)}</Typography>
                            <Typography variant="caption" color={colors.textMuted}>{weightUnit} {t('settings.totalLabel')}</Typography>
                        </View>
                    </View>
                </ListGroup>

                {/* Data Management */}
                <ListGroup title={t('settings.dataManagement')} footer={t('settings.dataManagementDescription')}>
                    <ProFeatureGate feature="csvExport" inline>
                        <ListRow
                            title={t('settings.exportCSV')}
                            icon={c => <Download color={c} size={17} />}
                            onPress={handleExportCSV}
                            showChevron={false}
                        />
                    </ProFeatureGate>
                    <ListRow
                        title={t('settings.clearAllData')}
                        icon={c => <Trash2 color={c} size={17} />}
                        onPress={handleReset}
                        destructive
                    />
                    {isSignedIn && (
                        <ListRow
                            title={t('settings.deleteAccount', 'Delete Account')}
                            icon={c => <UserX color={c} size={17} />}
                            onPress={handleDeleteAccount}
                            destructive
                        />
                    )}
                </ListGroup>

                <View style={styles.footer}>
                    <Typography variant="caption" color={colors.textMuted} align="center">
                        {t('settings.version')}
                    </Typography>
                    <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 2 }}>
                        {isAISubscriber
                            ? t('settings.aiTagline')
                            : isPro
                                ? t('subscription.premiumTagline')
                                : t('settings.tagline')
                        }
                    </Typography>
                </View>
            </ScrollView>

            {/* Training profile editor */}
            <Modal
                visible={trainingDraft !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setTrainingDraft(null)}
            >
                <View style={styles.trainingOverlay}>
                    <View style={styles.trainingCard}>
                        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                            <Typography variant="h2">{t('trainingProfile.title')}</Typography>
                            <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginTop: 4 }}>
                                {t('trainingProfile.description')}
                            </Typography>
                            {trainingDraft && (
                                <TrainingProfileForm value={trainingDraft} onChange={setTrainingDraft} />
                            )}
                            <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                                <Button
                                    title={t('common.cancel')}
                                    variant="outline"
                                    onPress={() => setTrainingDraft(null)}
                                    style={{ flex: 1 }}
                                />
                                <Button
                                    title={savingTraining ? t('subscription.processing') : t('common.save')}
                                    disabled={savingTraining}
                                    onPress={async () => {
                                        if (!trainingDraft) return;
                                        setSavingTraining(true);
                                        try {
                                            await updateProfile(trainingProfileArgs(trainingDraft));
                                            setTrainingDraft(null);
                                            showModal(t('settings.saved'), t('trainingProfile.saved'), undefined, 'success');
                                        } catch (e: any) {
                                            showModal(t('trainingProfile.saveFailed'), e?.message ?? '', undefined, 'danger');
                                        } finally {
                                            setSavingTraining(false);
                                        }
                                    }}
                                    style={{ flex: 1.5 }}
                                />
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

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
    planCard: {
        padding: 18,
        marginBottom: 12,
    },
    planBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: borderRadius.full,
    },
    statusLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    goalSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: colors.border,
    },
    goalLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    goalInput: {
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: colors.text,
        minHeight: 64,
    },
    upgradeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 16,
        padding: 12,
        backgroundColor: colors.secondarySoft,
        borderRadius: borderRadius.m,
    },
    upgradeIcon: {
        width: 38,
        height: 38,
        borderRadius: 11,
        backgroundColor: colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
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
    accountRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        padding: 14,
    },
    avatar: {
        width: 42,
        height: 42,
        borderRadius: 21,
        backgroundColor: colors.primarySoft,
        alignItems: 'center',
        justifyContent: 'center',
    },
    trailing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    rowBody: {
        paddingHorizontal: 14,
        paddingVertical: 14,
    },
    segmentLabel: {
        marginBottom: 10,
    },
    chipWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: 10,
    },
    field: {
        flex: 1,
    },
    fieldLabel: {
        marginBottom: 6,
    },
    input: {
        height: 44,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.m,
        paddingHorizontal: 12,
        color: colors.text,
        fontSize: 15,
    },
    lifetimeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 18,
    },
    lifetimeStat: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontVariant: ['tabular-nums'],
    },
    statDivider: {
        width: StyleSheet.hairlineWidth,
        alignSelf: 'stretch',
    },
    footer: {
        marginTop: 8,
        paddingVertical: 16,
    },
    trainingOverlay: {
        flex: 1,
        backgroundColor: colors.overlay,
        justifyContent: 'center',
        paddingHorizontal: 16,
    },
    trainingCard: {
        maxHeight: '90%',
        backgroundColor: colors.surface,
        borderRadius: borderRadius.xl,
        padding: 20,
        borderWidth: 1,
        borderColor: colors.border,
    },
    // ── Measurement styles ────────────────────────────────
    measureGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    measureItem: {
        width: '30%',
        flexGrow: 1,
    },
    measureHistoryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.border,
    },
    measureHistoryValues: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    measureHistoryChip: {
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        backgroundColor: colors.surfaceLight,
        borderRadius: borderRadius.s,
    },
});
