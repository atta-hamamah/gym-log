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
import { useSignUp, useSignIn, useAuth, useUser } from '@clerk/clerk-expo';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useTranslation } from 'react-i18next';
import { Check, Brain, Calendar, Users, Sparkles, X, Eye, EyeOff, Target, CloudOff, UserCheck } from 'lucide-react-native';
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
 * - auth:      sign in, or sign up (sign-up only after paying for AI)
 * - linking:   wait for Clerk + RevenueCat to point at the same user, then
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

type SignInResult = NonNullable<ReturnType<typeof useSignIn>['signIn']>;
type SecondFactorStrategy = 'email_code' | 'phone_code' | 'totp' | 'backup_code';

export const AIOnboardingScreen = ({ navigation, route }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { workouts, bodyMeasurements } = useWorkout();

  // ── Clerk Auth State ──
  const { signUp, setActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
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

  // ── Signup/Signin Fields ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ── Forgot Password Fields ──
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [pendingReset, setPendingReset] = useState(false);

  // ── Second factor (code after the password) ──
  const [secondFactor, setSecondFactor] = useState<{ strategy: SecondFactorStrategy; target?: string } | null>(null);
  const [secondFactorCode, setSecondFactorCode] = useState('');

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

  const clerkError = (err: any, fallback: string) =>
    err?.errors?.[0]?.longMessage || err?.message || fallback;

  // ══════════════════════════════════════════════════════
  // AUTH
  // ══════════════════════════════════════════════════════
  const handleSignUp = useCallback(async () => {
    if (!isSignUpLoaded) return;
    setLoading(true);
    setError('');

    try {
      await signUp.create({
        emailAddress: email,
        password,
        firstName,
        lastName,
      });

      // Send email verification
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      setPendingVerification(true);
    } catch (err: any) {
      if (err?.errors?.[0]?.code === 'form_identifier_exists') {
        setAuthMode('signin');
        setError(t('aiOnboarding.emailTaken'));
      } else {
        setError(clerkError(err, 'Sign up failed'));
      }
    } finally {
      setLoading(false);
    }
  }, [isSignUpLoaded, signUp, email, password, firstName, lastName, t]);

  const handleVerifyEmail = useCallback(async () => {
    if (!isSignUpLoaded) return;
    setLoading(true);
    setError('');

    try {
      const result = await signUp.attemptEmailAddressVerification({
        code: verificationCode,
      });

      if (result.status === 'complete') {
        await setActive({ session: result.createdSessionId });
        // RevenueCat follows the new Clerk user automatically, which moves the
        // purchase made before sign-up onto this account.
        setStep('linking');
      }
    } catch (err: any) {
      setError(clerkError(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  }, [isSignUpLoaded, signUp, verificationCode, setActive]);

  // Clerk may ask for a one-time code after the password (e.g. the first
  // sign-in on a new device). Send it and show the code step.
  const startSecondFactor = useCallback(async (result: SignInResult) => {
    const factors = result.supportedSecondFactors ?? [];
    const factor =
      factors.find(f => f.strategy === 'email_code') ??
      factors.find(f => f.strategy === 'phone_code') ??
      factors.find(f => f.strategy === 'totp') ??
      factors.find(f => f.strategy === 'backup_code');
    if (!factor) {
      setError(t('aiOnboarding.unsupportedSignIn'));
      return;
    }
    if (factor.strategy === 'email_code') {
      await result.prepareSecondFactor({ strategy: 'email_code', emailAddressId: factor.emailAddressId });
    } else if (factor.strategy === 'phone_code') {
      await result.prepareSecondFactor({ strategy: 'phone_code', phoneNumberId: factor.phoneNumberId });
    }
    setSecondFactorCode('');
    setSecondFactor({
      strategy: factor.strategy as SecondFactorStrategy,
      target: 'safeIdentifier' in factor ? factor.safeIdentifier : undefined,
    });
  }, [t]);

  const continueSignIn = useCallback(async (result: SignInResult) => {
    if (result.status === 'complete') {
      if (!setSignInActive) return;
      await setSignInActive({ session: result.createdSessionId });
      setSecondFactor(null);
      setStep('linking');
    } else if (result.status === 'needs_second_factor') {
      await startSecondFactor(result);
    } else {
      setError(t('aiOnboarding.unsupportedSignIn'));
    }
  }, [setSignInActive, startSecondFactor, t]);

  const handleSignIn = useCallback(async () => {
    if (!isSignInLoaded) return;
    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      await continueSignIn(result);
    } catch (err: any) {
      if (err?.errors?.[0]?.code === 'session_exists') {
        setStep('linking');
      } else {
        setError(clerkError(err, 'Sign in failed'));
      }
    } finally {
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, email, password, continueSignIn]);

  const handleVerifySecondFactor = useCallback(async () => {
    if (!isSignInLoaded || !secondFactor) return;
    setLoading(true);
    setError('');
    try {
      const result = await signIn.attemptSecondFactor({
        strategy: secondFactor.strategy,
        code: secondFactorCode.trim(),
      } as Parameters<typeof signIn.attemptSecondFactor>[0]);
      await continueSignIn(result);
    } catch (err: any) {
      setError(clerkError(err, 'Verification failed'));
    } finally {
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, secondFactor, secondFactorCode, continueSignIn]);

  const handleResendSecondFactor = useCallback(async () => {
    if (!isSignInLoaded) return;
    setError('');
    try {
      await startSecondFactor(signIn);
    } catch (err: any) {
      setError(clerkError(err, 'Failed to send code'));
    }
  }, [isSignInLoaded, signIn, startSecondFactor]);

  // ══════════════════════════════════════════════════════
  // FORGOT PASSWORD
  // ══════════════════════════════════════════════════════
  const handleForgotPassword = useCallback(async () => {
    if (!isSignInLoaded) return;
    if (!email) {
      setError(t('aiOnboarding.enterEmailFirst', 'Please enter your email address first'));
      return;
    }
    setLoading(true);
    setError('');

    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email,
      });
      setPendingReset(true);
    } catch (err: any) {
      setError(clerkError(err, 'Failed to send reset code'));
    } finally {
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, email, t]);

  const handleResetPassword = useCallback(async () => {
    if (!isSignInLoaded) return;
    setLoading(true);
    setError('');

    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: resetCode,
        password: newPassword,
      });

      if (result.status === 'complete' || result.status === 'needs_second_factor') {
        setForgotPasswordMode(false);
        setPendingReset(false);
        await continueSignIn(result);
      } else {
        setError(t('aiOnboarding.resetIncomplete', 'Password reset could not be completed.'));
      }
    } catch (err: any) {
      setError(clerkError(err, 'Reset failed'));
    } finally {
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, resetCode, newPassword, continueSignIn, t]);

  // ══════════════════════════════════════════════════════
  // LINKING: Clerk + RevenueCat agree on the user → link device data
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
      name: user?.fullName ?? undefined,
      email: user?.primaryEmailAddress?.emailAddress ?? undefined,
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
  const renderSecondFactor = () => {
    const strategy = secondFactor?.strategy;
    const message =
      strategy === 'email_code'
        ? t('aiOnboarding.secondFactorEmail', { target: secondFactor?.target ?? email })
        : strategy === 'phone_code'
          ? t('aiOnboarding.secondFactorPhone', { target: secondFactor?.target ?? '' })
          : strategy === 'totp'
            ? t('aiOnboarding.secondFactorTotp')
            : t('aiOnboarding.secondFactorBackup');
    const canResend = strategy === 'email_code' || strategy === 'phone_code';

    return (
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.stepHeader}>
          <View style={styles.stepIconContainer}>
            <UserCheck color={colors.primary} size={24} />
          </View>
          <Typography variant="h2" style={{ marginTop: 12 }}>
            {t('aiOnboarding.secondFactorTitle')}
          </Typography>
          <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
            {message}
          </Typography>
        </View>

        <TextInput
          style={styles.input}
          value={secondFactorCode}
          onChangeText={setSecondFactorCode}
          placeholder={strategy === 'backup_code' ? 'xxxx-xxxx' : '123456'}
          placeholderTextColor={colors.textMuted}
          keyboardType={strategy === 'backup_code' ? 'default' : 'number-pad'}
          autoCapitalize="none"
          autoFocus
        />

        {error ? (
          <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
            {error}
          </Typography>
        ) : null}

        <Button
          title={loading ? t('subscription.processing') : t('aiOnboarding.verify')}
          onPress={handleVerifySecondFactor}
          size="large"
          style={{ marginTop: 24 }}
          disabled={loading || !secondFactorCode.trim()}
        />

        {canResend && (
          <TouchableOpacity onPress={handleResendSecondFactor} disabled={loading} style={{ marginTop: 16, alignItems: 'center' }}>
            <Typography variant="bodySmall" color={colors.primary}>
              {t('aiOnboarding.resendCode')}
            </Typography>
          </TouchableOpacity>
        )}

        <Button
          title={t('common.cancel')}
          variant="ghost"
          onPress={() => { setSecondFactor(null); setSecondFactorCode(''); setError(''); }}
          style={{ marginTop: 12 }}
        />
      </ScrollView>
    );
  };

  const renderAuth = () => secondFactor ? renderSecondFactor() : (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={styles.stepHeader}>
        <View style={styles.stepIconContainer}>
          <Sparkles color={colors.primary} size={24} />
        </View>
        <Typography variant="h2" style={{ marginTop: 12 }}>
          {pendingVerification
            ? t('aiOnboarding.verifyEmail')
            : forgotPasswordMode
              ? t('aiOnboarding.resetPassword', 'Reset Password')
              : effectiveAuthMode === 'signup'
                ? t('aiOnboarding.createAccount')
                : t('aiOnboarding.signIn', 'Sign In')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 4 }}>
          {pendingVerification
            ? t('aiOnboarding.verificationSent', { email })
            : forgotPasswordMode
              ? (pendingReset
                ? t('aiOnboarding.resetCodeSent', 'Enter the code sent to {{email}} and your new password', { email })
                : t('aiOnboarding.resetDesc', 'We\'ll send a code to your email'))
              : effectiveAuthMode === 'signup'
                ? t('aiOnboarding.accountRequired')
                : t('aiOnboarding.signInDesc', 'Welcome back to your AI Coach')}
        </Typography>
      </View>

      {forgotPasswordMode ? (
        /* ── Forgot Password Flow ── */
        !pendingReset ? (
          <>
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
            />

            {error ? (
              <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
                {error}
              </Typography>
            ) : null}

            <Button
              title={loading ? t('subscription.processing') : t('aiOnboarding.sendResetCode', 'Send Reset Code')}
              onPress={handleForgotPassword}
              size="large"
              style={{ marginTop: 24 }}
              disabled={loading || !email}
            />

            <TouchableOpacity
              onPress={() => {
                setForgotPasswordMode(false);
                setError('');
              }}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Typography variant="bodySmall" color={colors.primary}>
                {t('aiOnboarding.backToSignIn', 'Back to Sign In')}
              </Typography>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
              {t('aiOnboarding.resetCodeLabel', 'Reset Code')}
            </Typography>
            <TextInput
              style={styles.input}
              value={resetCode}
              onChangeText={setResetCode}
              placeholder="123456"
              placeholderTextColor={colors.textMuted}
              keyboardType="number-pad"
            />

            <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
              {t('aiOnboarding.newPassword', 'New Password')}
            </Typography>
            <View style={styles.passwordContainer}>
              <TextInput
                style={[styles.input, { marginBottom: 0, paddingRight: 45 }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry={!showPassword}
              />
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.eyeIcon}
                activeOpacity={0.7}
              >
                {showPassword ? (
                  <EyeOff color={colors.textMuted} size={20} />
                ) : (
                  <Eye color={colors.textMuted} size={20} />
                )}
              </TouchableOpacity>
            </View>

            {error ? (
              <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
                {error}
              </Typography>
            ) : null}

            <Button
              title={loading ? t('subscription.processing') : t('aiOnboarding.resetAndSignIn', 'Reset & Sign In')}
              onPress={handleResetPassword}
              size="large"
              style={{ marginTop: 24 }}
              disabled={loading || !resetCode || !newPassword}
            />

            <TouchableOpacity
              onPress={() => {
                setPendingReset(false);
                setForgotPasswordMode(false);
                setError('');
              }}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Typography variant="bodySmall" color={colors.primary}>
                {t('aiOnboarding.backToSignIn', 'Back to Sign In')}
              </Typography>
            </TouchableOpacity>
          </>
        )
      ) : !pendingVerification ? (
        <>
          {effectiveAuthMode === 'signup' && (
            <View style={styles.nameRow}>
              <View style={styles.nameField}>
                <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
                  {t('aiOnboarding.firstName')}
                </Typography>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
              <View style={styles.nameField}>
                <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
                  {t('aiOnboarding.lastName')}
                </Typography>
                <TextInput
                  style={styles.input}
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Doe"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="words"
                />
              </View>
            </View>
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
          />

          <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4, marginTop: 12 }}>
            {t('aiOnboarding.password')}
          </Typography>
          <View style={styles.passwordContainer}>
            <TextInput
              style={[styles.input, { marginBottom: 0, paddingRight: 45 }]}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textMuted}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeIcon}
              activeOpacity={0.7}
            >
              {showPassword ? (
                <EyeOff color={colors.textMuted} size={20} />
              ) : (
                <Eye color={colors.textMuted} size={20} />
              )}
            </TouchableOpacity>
          </View>

          {error ? (
            <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
              {error}
            </Typography>
          ) : null}

          <Button
            title={loading ? t('subscription.processing') : (effectiveAuthMode === 'signup' ? t('aiOnboarding.signUp') : t('aiOnboarding.signIn', 'Sign In'))}
            onPress={effectiveAuthMode === 'signup' ? handleSignUp : handleSignIn}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || !email || !password || (effectiveAuthMode === 'signup' && !firstName)}
          />

          {/* Forgot Password link — only in sign-in mode */}
          {effectiveAuthMode === 'signin' && (
            <TouchableOpacity
              onPress={() => {
                setForgotPasswordMode(true);
                setError('');
              }}
              style={{ marginTop: 14, alignItems: 'center' }}
            >
              <Typography variant="caption" color={colors.textSecondary}>
                {t('aiOnboarding.forgotPassword', 'Forgot your password?')}
              </Typography>
            </TouchableOpacity>
          )}

          {canSignUp ? (
            <TouchableOpacity
              onPress={() => {
                setAuthMode(effectiveAuthMode === 'signup' ? 'signin' : 'signup');
                setForgotPasswordMode(false);
                setPendingReset(false);
                setError('');
              }}
              style={{ marginTop: 16, alignItems: 'center' }}
            >
              <Typography variant="bodySmall" color={colors.primary}>
                {effectiveAuthMode === 'signup'
                  ? t('aiOnboarding.alreadyHaveAccount', 'Already have an account? Sign in')
                  : t('aiOnboarding.needAccount', "Don't have an account? Sign up")}
              </Typography>
            </TouchableOpacity>
          ) : (
            <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 16 }}>
              {t('aiOnboarding.signupAfterPurchase')}
            </Typography>
          )}
        </>
      ) : (
        <>
          <TextInput
            style={styles.input}
            value={verificationCode}
            onChangeText={setVerificationCode}
            placeholder="123456"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
          />

          {error ? (
            <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
              {error}
            </Typography>
          ) : null}

          <Button
            title={loading ? t('subscription.processing') : t('aiOnboarding.verify')}
            onPress={handleVerifyEmail}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || !verificationCode}
          />
        </>
      )}

      <Button
        title={t('common.cancel')}
        variant="ghost"
        onPress={() => { setPendingVerification(false); setForgotPasswordMode(false); setPendingReset(false); navigation.goBack(); setError(''); }}
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
  passwordContainer: {
    marginBottom: 12,
    justifyContent: 'center',
  },
  eyeIcon: {
    position: 'absolute',
    right: 16,
    height: '100%',
    justifyContent: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nameField: {
    flex: 1,
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
