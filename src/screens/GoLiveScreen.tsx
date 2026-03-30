import React, { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { colors, spacing, borderRadius } from '../theme/colors';
import { useSignUp, useAuth, useUser } from '@clerk/clerk-expo';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { migrateLocalToConvex, type MigrationProgress } from '../services/migration';
import { useConvex } from 'convex/react';
import { useTranslation } from 'react-i18next';
import { Rocket, Check, Shield, Brain, Cloud, ChevronRight, User, Calendar, Users } from 'lucide-react-native';

type GoLiveStep = 'intro' | 'signup' | 'profile' | 'migrating' | 'complete';

export const GoLiveScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<GoLiveStep>('intro');

  // ── Clerk Auth State ──
  const { signUp, setActive, isLoaded: isSignUpLoaded } = useSignUp();
  const { isSignedIn } = useAuth();
  const { user } = useUser();

  // ── Signup Fields ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [pendingVerification, setPendingVerification] = useState(false);

  // ── Profile Fields ──
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');

  // ── Migration State ──
  const [migrationProgress, setMigrationProgress] = useState<MigrationProgress | null>(null);
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // ── Convex ──
  const convex = useConvex();
  const createUser = useMutation(api.users.createUser);

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
        setStep('profile');
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }, [isSignUpLoaded, signUp, verificationCode, setActive]);

  // ══════════════════════════════════════════════════════
  // STEP: PROFILE COMPLETION + MIGRATION
  // ══════════════════════════════════════════════════════
  const handleCompleteProfile = useCallback(async () => {
    if (!gender || !dateOfBirth) {
      setError(t('goLive.fillAllFields'));
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
        setError(result.error || t('goLive.migrationFailed'));
        setStep('profile');
      }
    } catch (err: any) {
      console.error('[GoLive] Migration error:', err);
      setError(err.message || t('goLive.migrationFailed'));
      setStep('profile');
    } finally {
      setLoading(false);
    }
  }, [gender, dateOfBirth, createUser, user, convex, t]);

  // ══════════════════════════════════════════════════════
  // RENDER: INTRO STEP
  // ══════════════════════════════════════════════════════
  const renderIntro = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.heroSection}>
        <View style={styles.rocketContainer}>
          <Rocket color={colors.primary} size={56} />
        </View>
        <Typography variant="h1" align="center" style={{ marginTop: 16 }}>
          {t('goLive.title')}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
          {t('goLive.subtitle')}
        </Typography>
      </View>

      {/* Benefits */}
      <View style={styles.benefitsContainer}>
        {[
          { icon: Cloud, title: t('goLive.benefit.backup'), desc: t('goLive.benefit.backupDesc') },
          { icon: Brain, title: t('goLive.benefit.ai'), desc: t('goLive.benefit.aiDesc') },
          { icon: Shield, title: t('goLive.benefit.sync'), desc: t('goLive.benefit.syncDesc') },
        ].map((benefit, index) => (
          <Card key={index} style={styles.benefitCard}>
            <View style={styles.benefitRow}>
              <View style={styles.benefitIconContainer}>
                <benefit.icon color={colors.primary} size={24} />
              </View>
              <View style={styles.benefitText}>
                <Typography variant="body" bold>{benefit.title}</Typography>
                <Typography variant="caption" color={colors.textSecondary}>
                  {benefit.desc}
                </Typography>
              </View>
            </View>
          </Card>
        ))}
      </View>

      <Button
        title={t('goLive.getStarted')}
        onPress={() => setStep(isSignedIn ? 'profile' : 'signup')}
        size="large"
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );

  // ══════════════════════════════════════════════════════
  // RENDER: SIGNUP STEP
  // ══════════════════════════════════════════════════════
  const renderSignup = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <Typography variant="h2" style={{ marginBottom: 24 }}>
        {pendingVerification ? t('goLive.verifyEmail') : t('goLive.createAccount')}
      </Typography>

      {!pendingVerification ? (
        <>
          <View style={styles.nameRow}>
            <View style={styles.nameField}>
              <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
                {t('goLive.firstName')}
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
                {t('goLive.lastName')}
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

          <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
            {t('goLive.email')}
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
            {t('goLive.password')}
          </Typography>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="••••••••"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
          />

          {error ? (
            <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
              {error}
            </Typography>
          ) : null}

          <Button
            title={loading ? t('subscription.processing') : t('goLive.signUp')}
            onPress={handleSignUp}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || !email || !password || !firstName}
          />
        </>
      ) : (
        <>
          <Typography variant="body" color={colors.textSecondary} style={{ marginBottom: 16 }}>
            {t('goLive.verificationSent', { email })}
          </Typography>

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
            title={loading ? t('subscription.processing') : t('goLive.verify')}
            onPress={handleVerifyEmail}
            size="large"
            style={{ marginTop: 24 }}
            disabled={loading || !verificationCode}
          />
        </>
      )}

      <Button
        title={t('goLive.back')}
        variant="ghost"
        onPress={() => { setPendingVerification(false); setStep('intro'); setError(''); }}
        style={{ marginTop: 12 }}
      />
    </ScrollView>
  );

  // ══════════════════════════════════════════════════════
  // RENDER: PROFILE STEP
  // ══════════════════════════════════════════════════════
  const renderProfile = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <Typography variant="h2" style={{ marginBottom: 8 }}>
        {t('goLive.completeProfile')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} style={{ marginBottom: 24 }}>
        {t('goLive.profileDesc')}
      </Typography>

      {/* Date of Birth */}
      <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 4 }}>
        <Calendar color={colors.textSecondary} size={14} /> {t('goLive.dateOfBirth')}
      </Typography>
      <TextInput
        style={styles.input}
        value={dateOfBirth}
        onChangeText={setDateOfBirth}
        placeholder="YYYY-MM-DD"
        placeholderTextColor={colors.textMuted}
        keyboardType="numeric"
      />

      {/* Gender */}
      <Typography variant="caption" color={colors.textSecondary} style={{ marginBottom: 8, marginTop: 16 }}>
        <Users color={colors.textSecondary} size={14} /> {t('goLive.gender')}
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
              {t(`goLive.gender_${g}`)}
            </Typography>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <Typography variant="caption" color={colors.error} style={{ marginTop: 8 }}>
          {error}
        </Typography>
      ) : null}

      <Button
        title={loading ? t('subscription.processing') : t('goLive.goLiveNow')}
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
        {t('goLive.migratingTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {migrationProgress?.step === 'reading'
          ? t('goLive.migratingReading')
          : migrationProgress?.step === 'uploading'
            ? t('goLive.migratingUploading')
            : t('goLive.migratingProcessing')}
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
        {t('goLive.successTitle')}
      </Typography>
      <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
        {t('goLive.successDesc')}
      </Typography>

      {migrationResult && (
        <Card style={{ marginTop: 24, width: '100%' }}>
          <Typography variant="caption" color={colors.textSecondary}>
            {t('goLive.migratedWorkouts', { count: migrationResult.workoutsInserted })}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            {t('goLive.migratedPRs', { count: migrationResult.prsInserted })}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary}>
            {t('goLive.migratedMeasurements', { count: migrationResult.measurementsInserted })}
          </Typography>
        </Card>
      )}

      <Button
        title={t('goLive.done')}
        onPress={() => navigation.goBack()}
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
      {step === 'intro' && renderIntro()}
      {step === 'signup' && renderSignup()}
      {step === 'profile' && renderProfile()}
      {step === 'migrating' && renderMigrating()}
      {step === 'complete' && renderComplete()}
    </ScreenLayout>
  );
};

// ── Styles ────────────────────────────────────────────────
const styles = StyleSheet.create({
  heroSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  rocketContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitsContainer: {
    gap: 12,
  },
  benefitCard: {
    marginBottom: 0,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  benefitIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
  },
  benefitText: {
    flex: 1,
    gap: 2,
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
