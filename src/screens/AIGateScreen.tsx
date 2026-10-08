import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { useConvexAuth, useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { borderRadius, spacing } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Brain,
  TrendingUp,
  Dumbbell,
  MessageCircle,
  Shield,
  Cloud,
  Crown,
  Zap,
  Check,
  Star,
  BarChart3,
  Users,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';
import { Tone, toneColors } from '../theme/tones';
import { ThemeColors } from '../theme/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AI_FEATURES: { icon: typeof MessageCircle; labelKey: string; tone: Tone }[] = [
  { icon: MessageCircle, labelKey: 'aiGate.feature.chat', tone: 'secondary' },
  { icon: Brain, labelKey: 'aiGate.feature.insights', tone: 'primary' },
  { icon: TrendingUp, labelKey: 'aiGate.feature.analysis', tone: 'success' },
  { icon: Cloud, labelKey: 'aiGate.feature.cloudSync', tone: 'primary' },
  { icon: Shield, labelKey: 'aiGate.feature.backup', tone: 'accent' },
  { icon: Dumbbell, labelKey: 'aiGate.feature.coaching', tone: 'secondary' },
];

export const AIGateScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const {
    isAISubscriber,
    hasAIEntitlement,
    hasEverSubscribedAI,
    needsAccount,
    identityReady,
    purchaseAISubscription,
    refreshSubscriptionState,
  } = useSubscription();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const { isAuthenticated: convexAuthenticated } = useConvexAuth();
  const profile = useQuery(api.users.me, isAISubscriber && convexAuthenticated ? {} : 'skip');
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const heroScale = useRef(new Animated.Value(0.6)).current;
  const heroGlow = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const featureAnims = useRef(AI_FEATURES.map(() => new Animated.Value(0))).current;
  const ctaAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Main entrance (made faster and snappier)
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Hero icon bounce in (faster tension)
    Animated.spring(heroScale, {
      toValue: 1,
      tension: 80,
      friction: 7,
      delay: 100,
      useNativeDriver: true,
    }).start();

    // Hero glow pulse (slightly faster cycle)
    Animated.loop(
      Animated.sequence([
        Animated.timing(heroGlow, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(heroGlow, {
          toValue: 0,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Subtle pulse for the CTA button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.03,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Staggered feature items (faster staggered flow)
    const featureAnimations = featureAnims.map((anim, i) =>
      Animated.timing(anim, {
        toValue: 1,
        duration: 250,
        delay: 200 + i * 60,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      })
    );
    Animated.stagger(60, featureAnimations).start();

    // CTA slide up
    Animated.timing(ctaAnim, {
      toValue: 1,
      duration: 350,
      delay: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // Shimmer animation for the button (faster sweep)
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 2000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const handleSubscribe = useCallback(async () => {
    setSubscribing(true);
    setError(null);

    const result = await purchaseAISubscription();

    if (result.success) {
      // Signed in: the purchase is already on the account → finish setup.
      // Not signed in: the account is created right after paying.
      navigation.navigate('AIOnboarding', isSignedIn ? undefined : { mode: 'signup' });
    } else if (result.alreadyOwned) {
      setError(t('aiGate.alreadyOwned'));
    } else if (result.error && !result.cancelled) {
      setError(result.error);
    }

    setSubscribing(false);
  }, [purchaseAISubscription, navigation, isSignedIn, t]);

  const handleSignIn = useCallback(() => {
    navigation.navigate('AIOnboarding', { mode: 'signin' });
  }, [navigation]);

  const renderStatus = (
    icon: React.ReactNode,
    title: string,
    message: string,
    actions?: React.ReactNode,
  ) => (
    <ScreenLayout>
      <View style={styles.readyContainer}>
        <View style={styles.readyIcon}>{icon}</View>
        <Typography variant="h2" align="center" style={{ marginTop: 20 }}>
          {title}
        </Typography>
        <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
          {message}
        </Typography>
        {actions}
      </View>
    </ScreenLayout>
  );

  // Signed in with an active subscription, still linking it to the account
  if (isSignedIn && hasAIEntitlement && !identityReady) {
    return renderStatus(
      <ActivityIndicator size="large" color={colors.primary} />,
      t('aiOnboarding.linkingTitle'),
      t('aiGate.connecting'),
      <Button
        title={t('aiGate.retry')}
        variant="outline"
        onPress={() => refreshSubscriptionState()}
        style={{ marginTop: 24, width: '100%' }}
      />,
    );
  }

  // Subscribed + signed in: the AI coach needs the profile first
  if (isAISubscriber) {
    if (profile === undefined) {
      return renderStatus(
        <ActivityIndicator size="large" color={colors.primary} />,
        t('aiOnboarding.linkingTitle'),
        t('aiGate.connecting'),
      );
    }
    return renderStatus(
      <Sparkles color={colors.primary} size={48} />,
      t('aiGate.finishSetupTitle'),
      t('aiGate.finishSetupMessage'),
      <Button
        title={t('aiGate.finishSetup')}
        onPress={() => navigation.navigate('AIOnboarding')}
        size="large"
        style={{ marginTop: 24, width: '100%' }}
      />,
    );
  }

  // Paid but no account yet — registration opens only after payment
  if (needsAccount) {
    return renderStatus(
      <Sparkles color={colors.primary} size={48} />,
      t('aiGate.almostReady'),
      t('aiGate.needAccount'),
      <>
        <Button
          title={t('aiGate.createAccount')}
          onPress={() => navigation.navigate('AIOnboarding', { mode: 'signup' })}
          size="large"
          style={{ marginTop: 24, width: '100%' }}
        />
        <Button
          title={t('aiGate.haveAccountSignIn')}
          variant="ghost"
          onPress={handleSignIn}
          style={{ marginTop: 8, width: '100%' }}
        />
      </>,
    );
  }

  const glowOpacity = heroGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-SCREEN_WIDTH, SCREEN_WIDTH],
  });

  return (
    <ScreenLayout>
      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* ─── Hero Section ─── */}
          <Animated.View style={[styles.heroSection, { transform: [{ translateY: slideAnim }] }]}>
            {/* Ambient glow behind icon */}
            <Animated.View style={[styles.heroGlowOuter, { opacity: glowOpacity }]} />

            <Animated.View style={[styles.heroIconContainer, { transform: [{ scale: heroScale }] }]}>
              {/* Outer ring */}
              <View style={styles.heroRingOuter}>
                <View style={styles.heroRingInner}>
                  <View style={styles.heroIconCore}>
                    <Sparkles color={colors.onSecondary} size={30} />
                  </View>
                </View>
              </View>
            </Animated.View>

            {/* Floating particles (decorative dots) */}
            <Animated.View style={[styles.particle, styles.particle1, { opacity: glowOpacity }]} />
            <Animated.View style={[styles.particle, styles.particle2, { opacity: glowOpacity }]} />
            <Animated.View style={[styles.particle, styles.particle3, { opacity: glowOpacity }]} />

            <Typography variant="h1" align="center" style={styles.heroTitle}>
              {t('aiGate.title')}
            </Typography>
            <Typography
              variant="body"
              color={colors.textSecondary}
              align="center"
              style={styles.heroSubtitle}
            >
              {t('aiGate.subtitle')}
            </Typography>
          </Animated.View>

          {/* ─── Features Grid ─── */}
          <View style={styles.featuresSection}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}>
                <Crown color={colors.warning} size={14} />
              </View>
              <Typography variant="h3" style={{ marginLeft: 10 }}>
                {t('aiGate.whatsIncluded')}
              </Typography>
            </View>

            <View style={styles.featuresGrid}>
              {AI_FEATURES.map((feature, index) => {
                const IconComponent = feature.icon;
                const tone = toneColors(colors, feature.tone);
                return (
                  <Animated.View
                    key={index}
                    style={[
                      styles.featureCard,
                      {
                        opacity: featureAnims[index],
                        transform: [
                          {
                            translateY: featureAnims[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [20, 0],
                            }),
                          },
                          {
                            scale: featureAnims[index].interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.8, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <View style={[styles.featureIconWrapper, { backgroundColor: tone.soft }]}>
                      <IconComponent color={tone.fg} size={20} />
                    </View>
                    <Typography variant="bodySmall" align="center" style={styles.featureLabel}>
                      {t(feature.labelKey)}
                    </Typography>
                    <View style={[styles.featureCheck, { backgroundColor: colors.successSoft }]}>
                      <Check color={colors.success} size={11} strokeWidth={3} />
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* ─── Showcase: Post-Workout Analysis ─── */}
          <View style={styles.showcaseCard}>
            <View style={styles.showcaseHeader}>
              <View style={[styles.showcaseIconCircle, { backgroundColor: colors.successSoft }]}>
                <BarChart3 color={colors.success} size={22} />
              </View>
              <View style={styles.showcaseHeaderText}>
                <Typography variant="h3" style={{ fontSize: 16 }}>
                  {t('aiGate.showcase.analysisTitle', 'Post-Workout Coach')}
                </Typography>
                <Typography variant="caption" color={colors.success} style={{ marginTop: 2, textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                  {t('aiGate.showcase.analysisTag', 'After every session')}
                </Typography>
              </View>
            </View>
            <Typography variant="bodySmall" color={colors.textSecondary} style={styles.showcaseDesc}>
              {t('aiGate.showcase.analysisDesc', 'Your AI coach analyzes every workout — comparing volume, exercises, and intensity with your past week. It tracks your progress toward your fitness goal and gives you a personalized, data-driven coaching verdict after each session.')}
            </Typography>
            {/* Mini preview */}
            <View style={styles.showcasePreview}>
              <View style={[styles.showcasePreviewBar, { backgroundColor: colors.surfaceLight }]}>
                <View style={[styles.showcasePreviewAccent, { backgroundColor: colors.success }]} />
                <View style={{ flex: 1 }}>
                  <Typography variant="bodySmall" style={{ fontWeight: '700', fontSize: 13 }}>
                    {t('aiGate.showcase.previewTitle', '"Volume PR Crusher"')}
                  </Typography>
                  <Typography variant="caption" color={colors.textMuted} style={{ marginTop: 2, textTransform: 'none', letterSpacing: 0, fontSize: 11 }}>
                    {t('aiGate.showcase.previewSubtitle', 'Your volume is up 18% from last session...')}
                  </Typography>
                </View>
              </View>
            </View>
          </View>

          {/* ─── Showcase: Gym Characters ─── */}
          <View style={styles.showcaseCard}>
            <View style={styles.showcaseHeader}>
              <View style={[styles.showcaseIconCircle, { backgroundColor: colors.secondarySoft }]}>
                <Users color={colors.secondary} size={22} />
              </View>
              <View style={styles.showcaseHeaderText}>
                <Typography variant="h3" style={{ fontSize: 16 }}>
                  {t('aiGate.showcase.charactersTitle', 'Gym Characters')}
                </Typography>
                <Typography variant="caption" color={colors.secondary} style={{ marginTop: 2, textTransform: 'none', letterSpacing: 0, fontSize: 12 }}>
                  {t('aiGate.showcase.charactersTag', 'Fun post-workout reactions')}
                </Typography>
              </View>
            </View>
            <Typography variant="bodySmall" color={colors.textSecondary} style={styles.showcaseDesc}>
              {t('aiGate.showcase.charactersDesc', 'After each workout, get a hilarious take from unique AI personalities. Switch between characters for different vibes — from savage roasts to reluctant admiration.')}
            </Typography>
            {/* Character avatars */}
            <View style={styles.characterPreview}>
              <View style={styles.characterAvatar}>
                <Typography style={styles.characterEmoji}>🔥</Typography>
                <Typography variant="caption" style={[styles.characterName, { color: colors.accent }]}>
                  {t('aiGate.showcase.chadName', 'Chad')}
                </Typography>
                <Typography variant="caption" color={colors.textMuted} style={styles.characterVibe}>
                  {t('aiGate.showcase.chadVibe', 'Savage roasts')}
                </Typography>
              </View>
              <View style={styles.characterAvatar}>
                <Typography style={styles.characterEmoji}>🛋️</Typography>
                <Typography variant="caption" style={[styles.characterName, { color: colors.secondary }]}>
                  {t('aiGate.showcase.kevinName', 'Kevin')}
                </Typography>
                <Typography variant="caption" color={colors.textMuted} style={styles.characterVibe}>
                  {t('aiGate.showcase.kevinVibe', 'Lazy sarcasm')}
                </Typography>
              </View>
              <View style={styles.characterAvatar}>
                <Typography style={styles.characterEmoji}>🏆</Typography>
                <Typography variant="caption" style={[styles.characterName, { color: colors.primary }]}>
                  {t('aiGate.showcase.coachName', 'Coach')}
                </Typography>
                <Typography variant="caption" color={colors.textMuted} style={styles.characterVibe}>
                  {t('aiGate.showcase.coachVibe', 'Real analysis')}
                </Typography>
              </View>
            </View>
          </View>

          {/* ─── Social proof / trust ─── */}
          <View style={styles.trustSection}>
            <View style={styles.trustRow}>
              <View style={styles.trustItem}>
                <Zap color={colors.warning} size={16} />
                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginLeft: 6 }}>
                  {t('aiGate.trustAI', 'AI-Powered')}
                </Typography>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <Shield color={colors.success} size={16} />
                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginLeft: 6 }}>
                  {t('aiGate.trustSecure', 'Secure & Private')}
                </Typography>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <Star color={colors.warning} size={16} />
                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginLeft: 6 }}>
                  {t('aiGate.trustPremium', 'Premium')}
                </Typography>
              </View>
            </View>
          </View>

          {/* ─── CTA Section ─── */}
          <Animated.View
            style={[
              styles.ctaSection,
              {
                opacity: ctaAnim,
                transform: [
                  {
                    translateY: ctaAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            {/* CTA Card with glow */}
            <View style={styles.ctaCard}>

              <Animated.View style={{ transform: [{ scale: pulseAnim }], width: '100%' }}>
                <TouchableOpacity
                  style={styles.subscribeButton}
                  onPress={handleSubscribe}
                  disabled={subscribing}
                  activeOpacity={0.85}
                >
                  {/* Shimmer overlay */}
                  <Animated.View
                    style={[
                      styles.shimmer,
                      { transform: [{ translateX: shimmerTranslate }] },
                    ]}
                  />
                  <View style={styles.subscribeContent}>
                    <Sparkles color={colors.onPrimary} size={18} />
                    <Typography
                      variant="body"
                      style={styles.subscribeText}
                    >
                      {subscribing
                        ? t('subscription.processing')
                        : hasEverSubscribedAI ? t('aiGate.resubscribe') : t('aiGate.subscribe')}
                    </Typography>
                  </View>
                </TouchableOpacity>
              </Animated.View>

              <View style={styles.cancelRow}>
                <Shield color={colors.textMuted} size={12} />
                <Typography variant="caption" color={colors.textMuted} style={{ marginLeft: 6 }}>
                  {t('aiGate.cancelAnytime')}
                </Typography>
              </View>
            </View>

            {error && (
              <View style={styles.errorContainer}>
                <Typography variant="bodySmall" color={colors.error} align="center">
                  {error}
                </Typography>
              </View>
            )}

            {isSignedIn ? (
              <Typography variant="caption" color={colors.textMuted} align="center" style={styles.signInButton}>
                {t('account.signedInAs', { email })}
              </Typography>
            ) : (
              <TouchableOpacity
                onPress={handleSignIn}
                disabled={subscribing}
                style={styles.signInButton}
                activeOpacity={0.7}
              >
                <Typography variant="bodySmall" color={colors.primary} style={styles.signInText}>
                  {t('aiGate.alreadyHaveAccount', 'Already have an account? Sign in')}
                </Typography>
              </TouchableOpacity>
            )}
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </ScreenLayout>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 50,
    flexGrow: 1,
  },

  /* ─── Hero ─── */
  heroSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 32,
    position: 'relative',
  },
  heroGlowOuter: {
    position: 'absolute',
    top: 6,
    width: 170,
    height: 170,
    borderRadius: 85,
    backgroundColor: colors.secondarySoft,
  },
  heroIconContainer: {
    marginBottom: 4,
  },
  heroRingOuter: {
    width: 116,
    height: 116,
    borderRadius: 58,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.secondary + '30',
  },
  heroRingInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.secondarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconCore: {
    width: 64,
    height: 64,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 18,
    elevation: 8,
  },

  /* Floating particles */
  particle: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: colors.secondary,
  },
  particle1: {
    width: 6,
    height: 6,
    top: 30,
    right: SCREEN_WIDTH * 0.2,
  },
  particle2: {
    width: 4,
    height: 4,
    top: 60,
    left: SCREEN_WIDTH * 0.15,
    backgroundColor: colors.secondary,
  },
  particle3: {
    width: 5,
    height: 5,
    top: 100,
    right: SCREEN_WIDTH * 0.12,
    backgroundColor: colors.accent,
  },

  heroTitle: {
    marginTop: 22,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    lineHeight: 36,
  },
  heroSubtitle: {
    marginTop: 10,
    paddingHorizontal: 24,
    lineHeight: 22,
  },

  /* ─── Features ─── */
  featuresSection: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  sectionBadge: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: colors.warningSoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48.5%',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.l,
    padding: 16,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  featureIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  featureIconInner: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureLabel: {
    fontWeight: '600',
    lineHeight: 18,
  },
  featureCheck: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },

  /* ─── Showcase Cards ─── */
  showcaseCard: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  showcaseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  showcaseIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  showcaseHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  showcaseDesc: {
    lineHeight: 20,
    marginBottom: 14,
  },
  showcasePreview: {
    borderRadius: borderRadius.m,
    overflow: 'hidden',
  },
  showcasePreviewBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: borderRadius.m,
  },
  showcasePreviewAccent: {
    width: 3,
    height: 32,
    borderRadius: 2,
    marginRight: 12,
  },
  characterPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    gap: 10,
  },
  characterAvatar: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 8,
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
  },
  characterEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  characterName: {
    fontWeight: '700',
    fontSize: 13,
    textTransform: 'none',
    letterSpacing: 0,
  },
  characterVibe: {
    fontSize: 10,
    marginTop: 2,
    textTransform: 'none',
    letterSpacing: 0,
  },

  /* ─── Trust Section ─── */
  trustSection: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  trustRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.m,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  trustItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trustDivider: {
    width: 1,
    height: 16,
    backgroundColor: colors.border,
    marginHorizontal: 14,
  },

  /* ─── CTA ─── */
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  ctaCard: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.xl,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
    overflow: 'hidden',
  },
  subscribeButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 60,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    transform: [{ skewX: '-20deg' }],
  },
  subscribeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  subscribeText: {
    color: colors.onPrimary,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  cancelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  errorContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.errorSoft,
    borderRadius: borderRadius.m,
  },
  signInButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signInText: {
    fontWeight: '600',
  },

  /* ─── Ready State ─── */
  readyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  readyIcon: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.secondarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
