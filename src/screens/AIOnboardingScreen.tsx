import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Platform,
} from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { borderRadius } from '../theme/colors';
import { authClient, authErrorMessage, useAccount } from '../services/auth';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useTranslation } from 'react-i18next';
import { Check, Brain, Calendar, Users, Sparkles, X, Target, CloudOff, UserCheck } from 'lucide-react-native';
import { useSubscription } from '../context/SubscriptionContext';
import { useCloudSync } from '../context/CloudSyncContext';
import { useTheme } from '../context/ThemeContext';
import { useWorkout } from '../context/WorkoutContext';
import { isProfileComplete } from '../utils/profile';
import { TrainingProfileForm, trainingProfileArgs, trainingProfileOf } from '../components/TrainingProfileForm';
import type { TrainingProfile } from '../types';
import type { SyncProgress, SyncReport } from '../services/cloudSync';

/**
 * Account flow for AI Coach. Each step waits for real state instead of timers:
 *
 *   auth ──► linking ──► (conflict) ──► inactive            (signed in, no active AI)
 *                                  └──► preparing ──► profile ──► syncing ──► complete
 *
 * - auth:      email → 6-digit code; the first sign-in creates the account
 *              (sign-up, with a name, is offered after paying for AI)
 * - linking:   wait for the account + RevenueCat to point at the same user, then
 *              link this device's data to the account
 * - conflict:  data on this device belongs to another account → user chooses
 * - preparing: create the cloud profile, check whether it's complete
 * - syncing:   upload local data, download the cloud history
 */
type OnboardingStep =
  | 'auth'
  | 'linking'
  | 'linkError'
  | 'conflict'
  | 'inactive'
  | 'preparing'
  | 'profile'
  | 'syncing'
  | 'syncError'
  | 'complete';

/** How long to wait for the subscription / server before offering a retry. */
const LINK_TIMEOUT_MS = 20000;

export const AIOnboardingScreen = ({ navigation, route }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { workouts, bodyMeasurements } = useWorkout();

  // ── Auth State ──
  const { isSignedIn, user } = useAccount();
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();

  // ── Subscription & sync ──
  const {
    hasAIEntitlement,
    hasLifetimePro,
    identityReady,
    purchaseAISubscription,
    refreshSubscriptionState,
  } = useSubscription();
  const { cloudSyncActive, ownership, claimLocalData, resolveOwnership, syncNow } = useCloudSync();

  // ── Convex ──
  const profile = useQuery(api.users.me, isSignedIn && convexAuthenticated ? {} : 'skip');
  const ensureUser = useMutation(api.users.ensureUser);
  const updateProfile = useMutation(api.users.updateProfile);

  // Registration is only offered after paying for AI; signing in is always possible.
  const canSignUp = hasAIEntitlement;
  const requestedMode: 'signup' | 'signin' | undefined = route?.params?.mode;

  const [step, setStep] = useState<OnboardingStep>(isSignedIn ? 'linking' : 'auth');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>(
    requestedMode === 'signin' || !canSignUp ? 'signin' : 'signup'
  );
  const effectiveAuthMode = authMode === 'signup' && !canSignUp ? 'signin' : authMode;

  // ── Sign-in Fields (email → code) ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);

  // ── Profile Fields ──
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [goal, setGoal] = useState('');
  const [training, setTraining] = useState<TrainingProfile>({});

  // ── Sync State ──
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReport | null>(null);
  const [syncAttempt, setSyncAttempt] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Values read inside async steps without re-triggering them.
  const latest = useRef({ hasAIEntitlement, hasLocalData: false });
  latest.current = {
    hasAIEntitlement,
    hasLocalData: workouts.length > 0 || bodyMeasurements.length > 0,
  };

  const normalizedEmail = email.trim().toLowerCase();

  /** Translated message for a failed send / verify. */
  const codeError = (err: unknown, fallbackKey: string) => {
    const e = err as { code?: string; status?: number } | null;
    if (e?.code === 'INVALID_OTP') return t('aiOnboarding.codeInvalid');
    if (e?.code === 'OTP_EXPIRED') return t('aiOnboarding.codeExpired');
    if (e?.code === 'TOO_MANY_ATTEMPTS') return t('aiOnboarding.codeTooManyAttempts');
    if (e?.status === 429) return t('aiOnboarding.tooManyRequests');
    return authErrorMessage(err, t(fallbackKey));
  };

  // ══════════════════════════════════════════════════════
  // AUTH: email → 6-digit code. The first sign-in with a new email creates
  // the account (named with the name given when signing up).
  // ══════════════════════════════════════════════════════
  const handleSendCode = useCallback(async () => {
    if (!normalizedEmail) return;
    setLoading(true);
    setError('');
    try {
      const { error: sendError } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: 'sign-in',
      });
      if (sendError) {
        setError(codeError(sendError, 'aiOnboarding.sendCodeFailed'));
        return;
      }
      setCode('');
      setCodeSent(true);
    } catch (err) {
      setError(codeError(err, 'aiOnboarding.sendCodeFailed'));
    } finally {
      setLoading(false);
    }
  }, [normalizedEmail, t]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVerifyCode = useCallback(async () => {
    const otp = code.trim();
    if (!normalizedEmail || !otp) return;
    setLoading(true);
    setError('');
    try {
      const trimmedName = name.trim();
      const { error: verifyError } = await authClient.signIn.emailOtp({
        email: normalizedEmail,
        otp,
        // Only used when this email has no account yet.
        ...(effectiveAuthMode === 'signup' && trimmedName ? { name: trimmedName } : {}),
      });
      if (verifyError) {
        setError(codeError(verifyError, 'aiOnboarding.verifyCodeFailed'));
        return;
      }
      // RevenueCat follows the signed-in user automatically, which moves a
      // purchase made before sign-up onto this account.
      setStep('linking');
    } catch (err) {
      setError(codeError(err, 'aiOnboarding.verifyCodeFailed'));
    } finally {
      setLoading(false);
    }
  }, [normalizedEmail, code, name, effectiveAuthMode, t]); // eslint-disable-line react-hooks/exhaustive-deps

  // The stored session finished loading after this screen opened.
  useEffect(() => {
    if (step === 'auth' && isSignedIn) setStep('linking');
  }, [step, isSignedIn]);

  // ══════════════════════════════════════════════════════
  // LINKING: the account + RevenueCat agree on the user → link device data
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    if (step !== 'linking') return;
    if (!isSignedIn || !identityReady) {
      const timer = setTimeout(() => setStep('linkError'), LINK_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    (async () => {
      try {
        const result = await claimLocalData();
        if (cancelled) return;
        if (result?.status === 'otherAccount') {
          if (latest.current.hasLocalData) {
            setStep('conflict');
            return;
          }
          // Nothing on this device worth asking about.
          await resolveOwnership('replace');
          if (cancelled) return;
        }
        setStep(latest.current.hasAIEntitlement ? 'preparing' : 'inactive');
      } catch (e) {
        console.warn('[AIOnboarding] Linking failed:', e);
        if (!cancelled) setStep('linkError');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [step, isSignedIn, identityReady, claimLocalData, resolveOwnership]);

  // ══════════════════════════════════════════════════════
  // PREPARING: make sure the cloud profile exists
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    if (step !== 'preparing') return;
    if (!convexAuthenticated) {
      const timer = setTimeout(() => setStep('linkError'), LINK_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    ensureUser({
      name: user?.name || undefined,
      email: user?.email || undefined,
    }).catch(e => {
      console.warn('[AIOnboarding] Could not create profile:', e);
      if (!cancelled) setStep('linkError');
    });
    return () => {
      cancelled = true;
    };
  }, [step, convexAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (step !== 'preparing' || !profile) return;
    setStep(isProfileComplete(profile) ? 'syncing' : 'profile');
  }, [step, profile]);

  // Prefill the profile form with anything already saved.
  useEffect(() => {
    if (step !== 'profile' || !profile) return;
    if (profile.dateOfBirth && !dateOfBirth) {
      setDateOfBirth(profile.dateOfBirth);
      setSelectedDate(new Date(profile.dateOfBirth));
    }
    if (profile.gender && !gender) setGender(profile.gender);
    if (profile.goal && !goal) setGoal(profile.goal);
    setTraining(prev => ({ ...trainingProfileOf(profile), ...prev }));
  }, [step, profile]); // eslint-disable-line react-hooks/exhaustive-deps

  // ══════════════════════════════════════════════════════
  // SYNCING: upload this device's data, download the cloud history
  // ══════════════════════════════════════════════════════
  useEffect(() => {
    if (step !== 'syncing') return;
    if (!cloudSyncActive) {
      const timer = setTimeout(() => setStep('syncError'), LINK_TIMEOUT_MS);
      return () => clearTimeout(timer);
    }

    let cancelled = false;
    setSyncProgress(null);
    syncNow(progress => {
      if (!cancelled) setSyncProgress(progress);
    }).then(result => {
      if (cancelled) return;
      if (result.ok) {
        setSyncReport(result.report);
        setStep('complete');
      } else if (result.reason === 'conflict') {
        setStep('conflict');
      } else if (result.reason === 'notVerified') {
        setError(t('account.syncNotVerified'));
        setStep('syncError');
      } else {
        setError(result.reason === 'error' ? result.message ?? '' : '');
        setStep('syncError');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, cloudSyncActive, syncAttempt, syncNow, t]);

  // ══════════════════════════════════════════════════════
  // ACTIONS FOR THE OTHER STEPS
  // ══════════════════════════════════════════════════════
  const handleCompleteProfile = useCallback(async () => {
    if (!gender || !dateOfBirth) {
      setError(t('aiOnboarding.fillAllFields'));
      return;
    }
    setLoading(true);
    setError('');

    try {
      await updateProfile({
        dateOfBirth,
        gender,
        goal: goal.trim() || undefined,
        ...trainingProfileArgs(training),
      });
      setStep('syncing');
    } catch (err: any) {
      console.error('[AIOnboarding] Profile update failed:', err);
      setError(err?.message || t('aiOnboarding.migrationFailed'));
    } finally {
      setLoading(false);
    }
  }, [gender, dateOfBirth, goal, training, updateProfile, t]);

  const handleResolveConflict = useCallback(async (choice: 'merge' | 'replace') => {
    setLoading(true);
    try {
      await resolveOwnership(choice);
      setStep('linking');
    } catch (e: any) {
      setError(e?.message || t('aiOnboarding.migrationFailed'));
    } finally {
      setLoading(false);
    }
  }, [resolveOwnership, t]);

  const handleSubscribe = useCallback(async () => {
    setLoading(true);
    setError('');
    const result = await purchaseAISubscription();
    setLoading(false);
    if (result.success) {
      setStep('linking');
    } else if (result.alreadyOwned) {
      setError(t('aiGate.alreadyOwned'));
    } else if (result.error && !result.cancelled) {
      setError(result.error);
    }
  }, [purchaseAISubscription, t]);

  const handleRetryLink = useCallback(() => {
    setError('');
    refreshSubscriptionState();
    setStep(isSignedIn ? 'linking' : 'auth');
  }, [refreshSubscriptionState, isSignedIn]);

  const handleRetrySync = useCallback(() => {
    setError('');
    setSyncAttempt(n => n + 1);
    setStep('syncing');
  }, []);

  const goToAICoach = useCallback(() => {
    navigation.navigate('Main', { screen: 'AI' });
  }, [navigation]);

  // ── Date Picker Handler ──
  const handleDateChange = useCallback((event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setShowDatePicker(false);
    if (date) {
      setSelectedDate(date);
      const iso = date.toISOString().split('T')[0];
      setDateOfBirth(iso);
    }
  }, []);

  // ══════════════════════════════════════════════════════
  // RENDER: AUTH STEP
  // ══════════════════════════════════════════════════════
  const renderAuth = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Sparkles color={colors.primary} size={24} />
        </View>
        <Typography variant="h2" style={{ marginTop: 12 }}>
          {codeSent
            ? t('aiOnboarding.enterCodeTitle')
            : effectiveAuthMode === 'signup'
              ? t('aiOnboarding.createAccount')
              : t('aiOnboarding.signIn')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
          {codeSent
            ? t('aiOnboarding.verificationSent', { email: normalizedEmail })
            : effectiveAuthMode === 'signup'
              ? t('aiOnboarding.accountRequired')
              : t('aiOnboarding.signInDesc')}
        </Typography>
      </View>

      {!codeSent ? (
        /* ── Step 1: email (and name when signing up) ── */
        <>
          {effectiveAuthMode === 'signup' && (
            <>
              <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
                {t('aiOnboarding.name')}
              </Typography>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="John Doe"
                placeholderTextColor={colors.textMuted}
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
            </>
          )}

          <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
            {t('aiOnboarding.email')}
          </Typography>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="send"
            onSubmitEditing={handleSendCode}
          />

          <Typography variant="caption" color={colors.textMuted}>
            {t('aiOnboarding.codeHint')}
          </Typography>

          {error ? (
            <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
              {error}
            </Typography>
          ) : null}

          <Button
            title={loading ? t('subscription.processing') : t('aiOnboarding.sendCode')}
            onPress={handleSendCode}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || !normalizedEmail || (effectiveAuthMode === 'signup' && !name.trim())}
          />

          {canSignUp ? (
            <TouchableOpacity
              onPress={() => {
                setAuthMode(effectiveAuthMode === 'signup' ? 'signin' : 'signup');
                setError('');
              }}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Typography variant="bodySmall" color={colors.primary}>
                {effectiveAuthMode === 'signup'
                  ? t('aiOnboarding.alreadyHaveAccount')
                  : t('aiOnboarding.needAccount')}
              </Typography>
            </TouchableOpacity>
          ) : (
            <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 16 }}>
              {t('aiOnboarding.signupAfterPurchase')}
            </Typography>
          )}
        </>
      ) : (
        /* ── Step 2: the code from the email ── */
        <>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
            placeholder="123456"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            autoFocus
          />

          {error ? (
            <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
              {error}
            </Typography>
          ) : null}

          <Button
            title={loading ? t('subscription.processing') : t('aiOnboarding.verify')}
            onPress={handleVerifyCode}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || code.length < 6}
          />

          <TouchableOpacity onPress={handleSendCode} disabled={loading} style={{ marginTop: 16, alignItems: 'center' }}>
            <Typography variant="bodySmall" color={colors.primary}>
              {t('aiOnboarding.resendCode')}
            </Typography>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => { setCodeSent(false); setCode(''); setError(''); }}
            disabled={loading}
            style={{ marginTop: 12, alignItems: 'center' }}
          >
            <Typography variant="caption" color={colors.textSecondary}>
              {t('aiOnboarding.changeEmail')}
            </Typography>
          </TouchableOpacity>
        </>
      )}

      <Button
        title={t('common.cancel')}
        variant="ghost"
        onPress={() => { setCodeSent(false); setError(''); navigation.goBack(); }}
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );

  // ══════════════════════════════════════════════════════
  // RENDER: PROFILE STEP
  // ══════════════════════════════════════════════════════
  const renderProfile = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Brain color={colors.primary} size={24} />
        </View>
        <Typography variant="h2" style={{ marginTop: 12 }}>
          {t('aiOnboarding.completeProfile')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} style={{ marginTop: 4 }}>
          {t('aiOnboarding.profileDesc')}
        </Typography>
      </View>

      {/* Date of Birth — Native Date Picker */}
      <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 8 }}>
        <Calendar color={colors.textSecondary} size={14} /> {t('aiOnboarding.dateOfBirth')}
      </Typography>
      <TouchableOpacity
        style={styles.datePickerButton}
        onPress={() => setShowDatePicker(true)}
        activeOpacity={0.7}
      >
        <Calendar color={dateOfBirth ? colors.primary : colors.textMuted} size={18} />
        <Typography
          variant="body"
          color={dateOfBirth ? colors.text : colors.textMuted}
          style={{ marginLeft: 12 }}
        >
          {dateOfBirth || t('aiOnboarding.selectDate', 'Select your birthday')}
        </Typography>
      </TouchableOpacity>
      {showDatePicker && (
        <View style={styles.datePickerContainer}>
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            maximumDate={new Date()}
            minimumDate={new Date(1940, 0, 1)}
            themeVariant="dark"
          />
          {Platform.OS === 'ios' && (
            <TouchableOpacity
              style={styles.datePickerDone}
              onPress={() => setShowDatePicker(false)}
            >
              <Typography variant="body" color={colors.primary} bold>
                {t('common.done', 'Done')}
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Gender */}
      <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 8, marginTop: 16 }}>
        <Users color={colors.textSecondary} size={14} /> {t('aiOnboarding.gender')}
      </Typography>
      <View style={styles.genderRow}>
        {(['male', 'female', 'other'] as const).map((g) => (
          <TouchableOpacity
            key={g}
            style={[styles.genderOption, gender === g && styles.genderOptionActive]}
            onPress={() => setGender(g)}
          >
            <Typography
              variant="body"
              color={gender === g ? colors.primary : colors.textSecondary}
              bold={gender === g}
            >
              {t(`aiOnboarding.gender_${g}`)}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      {/* Fitness Goal */}
      <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 8, marginTop: 16 }}>
        <Target color={colors.textSecondary} size={14} /> {t('aiOnboarding.fitnessGoal', 'What\'s your fitness goal?')}
      </Typography>
      <TextInput
        style={[styles.input, styles.goalInput]}
        value={goal}
        onChangeText={setGoal}
        placeholder={t('aiOnboarding.goalPlaceholder', 'e.g. Build muscle, lose fat, get stronger...')}
        placeholderTextColor={colors.textMuted}
        multiline
        numberOfLines={3}
        maxLength={200}
        textAlignVertical="top"
      />

      {/* Training profile: what the coach plans around */}
      <TrainingProfileForm value={training} onChange={setTraining} />

      {error ? (
        <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
          {error}
        </Typography>
      ) : null}

      <Button
        title={loading ? t('subscription.processing') : t('aiOnboarding.continue')}
        onPress={handleCompleteProfile}
        size="large"
        style={{ marginTop: 24 }}
        disabled={loading || !gender || !dateOfBirth}
      />
    </ScrollView>
  );

  // ══════════════════════════════════════════════════════
  // RENDER: STATUS STEPS
  // ══════════════════════════════════════════════════════
  const renderCentered = (content: React.ReactNode) => (
    <View style={styles.centerContainer}>{content}</View>
  );

  const renderWaiting = (title: string, message?: string) => renderCentered(
    <>
      <ActivityIndicator size="large" color={colors.primary} />
      <Typography variant="h3" align="center" style={{ marginTop: 24 }}>
        {title}
      </Typography>
      {message ? (
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
          {message}
        </Typography>
      ) : null}
    </>
  );

  const renderSyncing = () => {
    const progressText = syncProgress
      ? t(syncProgress.phase === 'uploading' ? 'aiOnboarding.uploading' : 'aiOnboarding.downloading', {
        done: syncProgress.done,
        total: syncProgress.total,
      })
      : t('aiOnboarding.syncingDesc');
    const ratio = syncProgress && syncProgress.total > 0 ? syncProgress.done / syncProgress.total : 0;

    return renderCentered(
      <>
        <ActivityIndicator size="large" color={colors.primary} />
        <Typography variant="h3" align="center" style={{ marginTop: 24 }}>
          {t('aiOnboarding.migratingTitle')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
          {progressText}
        </Typography>
        {syncProgress && (
          <View style={styles.progressBarContainer}>
            <View style={[styles.progressBarFill, { width: `${Math.round(ratio * 100)}%` }]} />
          </View>
        )}
      </>
    );
  };

  const renderLinkError = () => renderCentered(
    <>
      <View style={[styles.statusCircle, { backgroundColor: colors.error + '18' }]}>
        <CloudOff color={colors.error} size={40} />
      </View>
      <Typography variant="h2" align="center" style={{ marginTop: 24 }}>
        {t('aiOnboarding.linkErrorTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {t('aiOnboarding.linkErrorDesc')}
      </Typography>
      <Button title={t('aiGate.retry')} onPress={handleRetryLink} size="large" style={{ marginTop: 32, width: '100%' }} />
      <Button title={t('common.close')} variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: 8, width: '100%' }} />
    </>
  );

  const renderSyncError = () => renderCentered(
    <>
      <View style={[styles.statusCircle, { backgroundColor: colors.warning + '18' }]}>
        <CloudOff color={colors.warning} size={40} />
      </View>
      <Typography variant="h2" align="center" style={{ marginTop: 24 }}>
        {t('aiOnboarding.linkErrorTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {t('aiOnboarding.syncError')}
      </Typography>
      {error ? (
        <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
          {error}
        </Typography>
      ) : null}
      <Button title={t('aiGate.retry')} onPress={handleRetrySync} size="large" style={{ marginTop: 32, width: '100%' }} />
      <Button title={t('common.continue')} variant="ghost" onPress={goToAICoach} style={{ marginTop: 8, width: '100%' }} />
    </>
  );

  const renderConflict = () => {
    const ownerEmail = ownership?.status === 'otherAccount' ? ownership.ownerEmail : null;
    return renderCentered(
      <>
        <View style={[styles.statusCircle, { backgroundColor: colors.warning + '18' }]}>
          <Users color={colors.warning} size={40} />
        </View>
        <Typography variant="h2" align="center" style={{ marginTop: 24 }}>
          {t('account.conflictTitle')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
          {t('account.conflictMessage', { email: ownerEmail || '—' })}
        </Typography>
        {error ? (
          <Typography variant="caption" color={colors.error} align="center" style={{ marginTop: 8 }}>
            {error}
          </Typography>
        ) : null}
        <Button
          title={t('account.conflictMerge')}
          onPress={() => handleResolveConflict('merge')}
          disabled={loading}
          size="large"
          style={{ marginTop: 32, width: '100%' }}
        />
        <Button
          title={t('account.conflictReplace')}
          variant="outline"
          onPress={() => handleResolveConflict('replace')}
          disabled={loading}
          style={{ marginTop: 12, width: '100%' }}
        />
        <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 12 }}>
          {t('account.conflictReplaceConfirm')}
        </Typography>
      </>
    );
  };

  const renderInactive = () => renderCentered(
    <>
      <View style={[styles.statusCircle, { backgroundColor: colors.primary + '15' }]}>
        <UserCheck color={colors.primary} size={40} />
      </View>
      <Typography variant="h2" align="center" style={{ marginTop: 24 }}>
        {t('aiOnboarding.inactiveTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {t('aiOnboarding.inactiveDesc')}
      </Typography>
      {hasLifetimePro && (
        <Typography variant="bodySmall" color={colors.success} align="center" style={{ marginTop: 8 }}>
          {t('aiOnboarding.inactiveLifetime')}
        </Typography>
      )}
      <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
        {t('aiOnboarding.inactiveCloudNote')}
      </Typography>
      {error ? (
        <Typography variant="caption" color={colors.error} align="center" style={{ marginTop: 8 }}>
          {error}
        </Typography>
      ) : null}
      <Button
        title={loading ? t('subscription.processing') : t('aiOnboarding.subscribe')}
        onPress={handleSubscribe}
        disabled={loading}
        size="large"
        style={{ marginTop: 32, width: '100%' }}
      />
      <Button
        title={t('common.continue')}
        variant="ghost"
        onPress={() => navigation.goBack()}
        style={{ marginTop: 8, width: '100%' }}
      />
    </>
  );

  const renderComplete = () => renderCentered(
    <>
      <View style={styles.successCircle}>
        <Check color="#fff" size={48} />
      </View>
      <Typography variant="h1" align="center" style={{ marginTop: 24 }}>
        {t('aiOnboarding.successTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {t('aiOnboarding.successDesc')}
      </Typography>

      {syncReport && (syncReport.uploaded > 0 || syncReport.downloaded > 0) && (
        <Card style={{ marginTop: 24, width: '100%' }}>
          {syncReport.uploaded > 0 && (
            <Typography variant="caption" color={colors.textSecondary}>
              {t('aiOnboarding.uploadedCount', { count: syncReport.uploaded })}
            </Typography>
          )}
          {syncReport.downloaded > 0 && (
            <Typography variant="caption" color={colors.textSecondary}>
              {t('aiOnboarding.downloadedCount', { count: syncReport.downloaded })}
            </Typography>
          )}
        </Card>
      )}

      <Button
        title={t('aiOnboarding.startChatting')}
        onPress={goToAICoach}
        size="large"
        style={{ marginTop: 32 }}
      />
    </>
  );

  // ══════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════
  const renderStep = () => {
    switch (step) {
      case 'auth':
        return renderAuth();
      case 'linking':
      case 'preparing':
        return renderWaiting(t('aiOnboarding.linkingTitle'), t('aiGate.connecting'));
      case 'linkError':
        return renderLinkError();
      case 'conflict':
        return renderConflict();
      case 'inactive':
        return renderInactive();
      case 'profile':
        return renderProfile();
      case 'syncing':
        return renderSyncing();
      case 'syncError':
        return renderSyncError();
      case 'complete':
        return renderComplete();
    }
  };

  return (
    <ScreenLayout>
      {/* Close button */}
      <View style={styles.closeRow}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => navigation.goBack()}
        >
          <X color={colors.textSecondary} size={22} />
        </TouchableOpacity>
      </View>

      {renderStep()}
    </ScreenLayout>
  );
};

// ── Styles ────────────────────────────────────────────────
const createStyles = (colors: any) => StyleSheet.create({
  closeRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginBottom: 8,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  stepIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: borderRadius.m,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  genderOptionActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '12',
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 4,
  },
  datePickerContainer: {
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    marginBottom: 8,
    overflow: 'hidden',
  },
  datePickerDone: {
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  goalInput: {
    minHeight: 80,
    paddingTop: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  successCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: 4,
    marginTop: 24,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 4,
  },
});
