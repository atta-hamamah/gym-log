import React, { useState, useCallback } from 'react';
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
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { migrateLocalToConvex, syncConvexToLocal, type MigrationProgress } from '../services/migration';
import { useConvex } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { Check, Brain, Cloud, ChevronRight, Calendar, Users, Sparkles, X, Eye, EyeOff, Target } from 'lucide-react-native';
import { identifyUser } from '../services/billing';
import { useSubscription } from '../context/SubscriptionContext';
import { useTheme } from '../context/ThemeContext';

type OnboardingStep = 'signup' | 'profile' | 'migrating' | 'complete';

export const AIOnboardingScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);

  // ── Clerk Auth State ──
  const { signUp, setActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { signIn, setActive: setSignInActive, isLoaded: isSignInLoaded } = useSignIn();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // Start at signup or skip to profile if already signed in
  const [step, setStep] = useState<OnboardingStep>(isSignedIn ? 'profile' : 'signup');
  const [authMode, setAuthMode] = useState<'signup' | 'signin'>('signup');

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

  // ── Profile Fields ──
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [goal, setGoal] = useState('');

  // ── Migration State ──
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Convex ──
  const convex = useConvex();
  const createUser = useMutation(api.users.createUser);
  const { refreshSubscriptionState } = useSubscription();

  // ══════════════════════════════════════════════════════
  // STEP: SIGN UP
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
      setError(err.errors?.[0]?.longMessage || err.message || 'Sign up failed');
    } finally {
      setLoading(false);
    }
  }, [isSignUpLoaded, signUp, email, password, firstName, lastName]);

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

        // CRITICAL: Link RevenueCat to the new Clerk user ID.
        // This transfers the anonymous purchase (made before signup) to this user.
        const clerkUserId = signUp.createdUserId;
        console.log('[AIOnboarding] Clerk user created:', clerkUserId);
        if (clerkUserId) {
          console.log('[AIOnboarding] Identifying user in RevenueCat...');
          await identifyUser(clerkUserId);
          console.log('[AIOnboarding] Refreshing subscription state...');
          await refreshSubscriptionState();
          console.log('[AIOnboarding] ✅ Subscription state refreshed');
        }

        setStep('profile');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }, [isSignUpLoaded, signUp, verificationCode, setActive, refreshSubscriptionState]);

  const handleSignIn = useCallback(async () => {
    if (!isSignInLoaded) return;
    setLoading(true);
    setError('');

    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });

        // Link RevenueCat to Clerk user and refresh entitlements
        const clerkUserId = (signIn as any)?.createdUserId || (result as any)?.createdUserId;
        if (clerkUserId) {
          await identifyUser(clerkUserId);
          await refreshSubscriptionState();
        }
        
        // Show restoring UI
        setStep('migrating');
        setMigrationProgress({ step: 'restoring', current: 0, total: 1 });
        
        await syncConvexToLocal(convex);
        
        setMigrationProgress({ step: 'restoring', current: 1, total: 1 });

        // Returning user - go back to AI tab (wrapper will show chat)
        setTimeout(() => {
          navigation.goBack();
        }, 1000);
      } else {
        setError('Complete sign in via other methods not supported here yet.');
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Sign in failed');
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, email, password, setSignInActive, navigation, convex]);

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
      setError(err.errors?.[0]?.longMessage || err.message || 'Failed to send reset code');
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

      if (result.status === 'complete') {
        await setSignInActive({ session: result.createdSessionId });

        // Link RevenueCat
        const clerkUserId = (result as any)?.createdUserId;
        if (clerkUserId) {
          await identifyUser(clerkUserId);
          await refreshSubscriptionState();
        }

        // Restore cloud data
        setStep('migrating');
        setMigrationProgress({ step: 'restoring', current: 0, total: 1 });
        await syncConvexToLocal(convex);
        setMigrationProgress({ step: 'restoring', current: 1, total: 1 });

        setTimeout(() => {
          navigation.goBack();
        }, 1000);
      } else {
        setError(t('aiOnboarding.resetIncomplete', 'Password reset could not be completed.'));
        setLoading(false);
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Reset failed');
      setLoading(false);
    }
  }, [isSignInLoaded, signIn, resetCode, newPassword, setSignInActive, navigation, convex, refreshSubscriptionState, t]);

  // ══════════════════════════════════════════════════════
  // STEP: PROFILE COMPLETION + MIGRATION
  // ══════════════════════════════════════════════════════
  const handleCompleteProfile = useCallback(async () => {
    if (!gender || !dateOfBirth) {
      setError(t('aiOnboarding.fillAllFields'));
      return;
    }
    setLoading(true);
    setError('');
    setStep('migrating');

    try {
      // 1. Create user in Convex
      const userId = await createUser({
        clerkId: user?.id || '',
        name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
        email: user?.primaryEmailAddress?.emailAddress || '',
        dateOfBirth,
        gender: gender as 'male' | 'female' | 'other',
        goal: goal.trim() || undefined,
      });

      // 2. Migrate local data
      const result = await migrateLocalToConvex(
        convex,
        userId,
        (progress) => setMigrationProgress(progress),
      );

      if (result.success) {
        setMigrationResult(result);
        setStep('complete');
      } else {
        setError(result.error || t('aiOnboarding.migrationFailed'));
        setStep('profile');
      }
    } catch (err: any) {
      console.error('[AIOnboarding] Migration error:', err);
      setError(err.message || t('aiOnboarding.migrationFailed'));
      setStep('profile');
    } finally {
      setLoading(false);
    }
  }, [gender, dateOfBirth, goal, createUser, user, convex, t]);

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
  // RENDER: SIGNUP STEP
  // ══════════════════════════════════════════════════════
  const renderSignup = () => (
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
              : authMode === 'signup'
                ? t('aiOnboarding.createAccount')
                : t('aiOnboarding.signIn', 'Sign In')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} style={{ marginTop: 4 }}>
          {pendingVerification
            ? t('aiOnboarding.verificationSent', { email })
            : forgotPasswordMode
              ? (pendingReset
                ? t('aiOnboarding.resetCodeSent', 'Enter the code sent to {{email}} and your new password', { email })
                : t('aiOnboarding.resetDesc', 'We\'ll send a code to your email'))
              : authMode === 'signup'
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
          {authMode === 'signup' && (
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
            title={loading ? t('subscription.processing') : (authMode === 'signup' ? t('aiOnboarding.signUp') : t('aiOnboarding.signIn', 'Sign In'))}
            onPress={authMode === 'signup' ? handleSignUp : handleSignIn}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || !email || !password || (authMode === 'signup' && !firstName)}
          />

          {/* Forgot Password link — only in sign-in mode */}
          {authMode === 'signin' && (
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

          <TouchableOpacity
            onPress={() => {
              setAuthMode(authMode === 'signup' ? 'signin' : 'signup');
              setForgotPasswordMode(false);
              setPendingReset(false);
              setError('');
            }}
            style={{ marginTop: 16, alignItems: 'center' }}
          >
            <Typography variant="bodySmall" color={colors.primary}>
              {authMode === 'signup'
                ? t('aiOnboarding.alreadyHaveAccount', 'Already have an account? Sign in')
                : t('aiOnboarding.needAccount', "Don't have an account? Sign up")}
            </Typography>
          </TouchableOpacity>
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
  // RENDER: MIGRATING STEP
  // ══════════════════════════════════════════════════════
  const renderMigrating = () => (
    <View style={styles.centerContainer}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Typography variant="h3" align="center" style={{ marginTop: 24 }}>
        {t('aiOnboarding.migratingTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {migrationProgress?.step === 'reading'
          ? t('aiOnboarding.migratingReading')
          : migrationProgress?.step === 'uploading'
            ? t('aiOnboarding.migratingUploading')
            : migrationProgress?.step === 'restoring'
              ? t('aiOnboarding.restoringCloud', 'Restoring from Cloud...')
              : t('aiOnboarding.migratingProcessing')}
      </Typography>

      {/* Progress bar */}
      <View style={styles.progressBarContainer}>
        <View style={[styles.progressBarFill, {
          width: `${((migrationProgress?.current || 0) / (migrationProgress?.total || 4)) * 100}%`
        }]} />
      </View>
    </View>
  );

  // ══════════════════════════════════════════════════════
  // RENDER: COMPLETE STEP
  // ══════════════════════════════════════════════════════
  const renderComplete = () => (
    <View style={styles.centerContainer}>
      <View style={styles.successCircle}>
        <Check color="#fff" size={48} />
      </View>
      <Typography variant="h1" align="center" style={{ marginTop: 24 }}>
        {t('aiOnboarding.successTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {t('aiOnboarding.successDesc')}
      </Typography>

      {migrationResult && (
        <Card style={{ marginTop: 24, width: '100%' }}>
          <Typography variant="caption" color={colors.textSecondary}>
            {t('aiOnboarding.migratedWorkouts', { count: migrationResult.workoutsInserted })}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            {t('aiOnboarding.migratedPRs', { count: migrationResult.prsInserted })}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            {t('aiOnboarding.migratedMeasurements', { count: migrationResult.measurementsInserted })}
          </Typography>
        </Card>
      )}

      <Button
        title={t('aiOnboarding.startChatting')}
        onPress={async () => {
          // Refresh subscription state so AITabScreen knows we're subscribed
          await refreshSubscriptionState();
          // Go back to AI tab — the wrapper will show chat automatically
          navigation.goBack();
        }}
        size="large"
        style={{ marginTop: 32 }}
      />
    </View>
  );

  // ══════════════════════════════════════════════════════
  // MAIN RENDER
  // ══════════════════════════════════════════════════════
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

      {step === 'signup' && renderSignup()}
      {step === 'profile' && renderProfile()}
      {step === 'migrating' && renderMigrating()}
      {step === 'complete' && renderComplete()}
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
