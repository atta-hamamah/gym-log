import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '@clerk/clerk-expo';
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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const AI_FEATURES = [
  { icon: MessageCircle, labelKey: 'aiGate.feature.chat', color: '#00E5FF' },
  { icon: Brain, labelKey: 'aiGate.feature.insights', color: '#7C4DFF' },
  { icon: TrendingUp, labelKey: 'aiGate.feature.analysis', color: '#00E676' },
  { icon: Cloud, labelKey: 'aiGate.feature.cloudSync', color: '#FF4081' },
  { icon: Shield, labelKey: 'aiGate.feature.backup', color: '#FFD740' },
  { icon: Dumbbell, labelKey: 'aiGate.feature.coaching', color: '#18FFFF' },
];

export const AIGateScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { isAISubscriber, purchaseAISubscription } = useSubscription();
  const { isSignedIn } = useAuth();
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
      // After purchase, user needs to create a Clerk account to use AI
      navigation.navigate('AIOnboarding');
    } else if (result.error) {
      setError(result.error);
    }

    setSubscribing(false);
  }, [purchaseAISubscription, navigation]);

  const handleSignIn = useCallback(() => {
    navigation.navigate('AIOnboarding', { mode: 'signin' });
  }, [navigation]);

  // If already subscribed but not signed in to Clerk — needs to complete onboarding
  if (isAISubscriber && !isSignedIn) {
    return (
      <ScreenLayout>
        <View style={styles.readyContainer}>
          <View style={styles.readyIcon}>
            <Sparkles color={colors.primary} size={48} />
          </View>
          <Typography variant="h2" align="center" style={{ marginTop: 20 }}>
            {t('aiGate.almostReady')}
          </Typography>
          <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8 }}>
            {t('aiGate.needAccount')}
          </Typography>
          <Button
            title={t('aiGate.setupAccount')}
            onPress={() => navigation.navigate('AIOnboarding')}
            size="large"
            style={{ marginTop: 24, width: '100%' }}
          />
        </View>
      </ScreenLayout>
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
                    <Sparkles color="#fff" size={32} />
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
                    <View style={[styles.featureIconWrapper, { backgroundColor: feature.color + '18' }]}>
                      <View style={[styles.featureIconInner, { backgroundColor: feature.color + '30' }]}>
                        <IconComponent color={feature.color} size={20} />
                      </View>
                    </View>
                    <Typography variant="bodySmall" align="center" style={styles.featureLabel}>
                      {t(feature.labelKey)}
                    </Typography>
                    <View style={[styles.featureCheck, { backgroundColor: feature.color + '20' }]}>
                      <Check color={feature.color} size={12} strokeWidth={3} />
                    </View>
                  </Animated.View>
                );
              })}
            </View>
          </View>

          {/* ─── Showcase: Post-Workout Analysis ─── */}
          <View style={styles.showcaseCard}>
            <View style={styles.showcaseGlow}>
              <View style={[styles.showcaseGlowInner, { backgroundColor: colors.success + '15' }]} />
            </View>
            <View style={styles.showcaseHeader}>
              <View style={[styles.showcaseIconCircle, { backgroundColor: colors.success + '18' }]}>
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
              <View style={[styles.showcasePreviewBar, { backgroundColor: colors.success + '12' }]}>
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
            <View style={styles.showcaseGlow}>
              <View style={[styles.showcaseGlowInner, { backgroundColor: colors.secondary + '15' }]} />
            </View>
            <View style={styles.showcaseHeader}>
              <View style={[styles.showcaseIconCircle, { backgroundColor: colors.secondary + '18' }]}>
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
              <View style={[styles.characterAvatar, { borderColor: '#FF6B00' }]}>
                <Typography style={styles.characterEmoji}>🔥</Typography>
                <Typography variant="caption" style={[styles.characterName, { color: '#FF6B00' }]}>
                  {t('aiGate.showcase.chadName', 'Chad')}
                </Typography>
                <Typography variant="caption" color={colors.textMuted} style={styles.characterVibe}>
                  {t('aiGate.showcase.chadVibe', 'Savage roasts')}
                </Typography>
              </View>
              <View style={[styles.characterAvatar, { borderColor: '#8B5CF6' }]}>
                <Typography style={styles.characterEmoji}>🛋️</Typography>
                <Typography variant="caption" style={[styles.characterName, { color: '#8B5CF6' }]}>
                  {t('aiGate.showcase.kevinName', 'Kevin')}
                </Typography>
                <Typography variant="caption" color={colors.textMuted} style={styles.characterVibe}>
                  {t('aiGate.showcase.kevinVibe', 'Lazy sarcasm')}
                </Typography>
              </View>
              <View style={[styles.characterAvatar, { borderColor: colors.primary }]}>
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
                  AI-Powered
                </Typography>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <Shield color={colors.success} size={16} />
                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginLeft: 6 }}>
                  Secure & Private
                </Typography>
              </View>
              <View style={styles.trustDivider} />
              <View style={styles.trustItem}>
                <Star color={colors.warning} size={16} />
                <Typography variant="bodySmall" color={colors.textSecondary} style={{ marginLeft: 6 }}>
                  Premium
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
              <View style={styles.ctaGlow} />

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
                    <Sparkles color="#000" size={18} />
                    <Typography
                      variant="label"
                      style={styles.subscribeText}
                    >
                      {subscribing ? t('subscription.processing') : t('aiGate.subscribe')}
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
          </Animated.View>
        </ScrollView>
      </Animated.View>
    </ScreenLayout>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
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
    top: 0,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: colors.primary,
    opacity: 0.08,
  },
  heroIconContainer: {
    marginBottom: 4,
  },
  heroRingOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: colors.primary + '10',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '20',
  },
  heroRingInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.primary + '18',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  heroIconCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 12,
  },

  /* Floating particles */
  particle: {
    position: 'absolute',
    borderRadius: 50,
    backgroundColor: colors.primary,
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
    marginTop: 20,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -1,
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
    backgroundColor: colors.warning + '18',
    justifyContent: 'center',
    alignItems: 'center',
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureCard: {
    width: '48%',
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.l,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border + '50',
    position: 'relative',
    overflow: 'hidden',
  },
  featureIconWrapper: {
    width: 52,
    height: 52,
    borderRadius: 16,
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.xl,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border + '40',
    position: 'relative',
    overflow: 'hidden',
  },
  showcaseGlow: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 100,
    height: 100,
    borderRadius: 50,
    overflow: 'hidden',
  },
  showcaseGlowInner: {
    width: '100%',
    height: '100%',
    borderRadius: 50,
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
    backgroundColor: colors.surface,
    borderRadius: borderRadius.m,
    borderWidth: 1.5,
  },
  characterEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  characterName: {
    fontWeight: '800',
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
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.m,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: colors.border + '30',
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
    borderColor: colors.primary + '25',
    position: 'relative',
    overflow: 'hidden',
  },
  ctaGlow: {
    position: 'absolute',
    top: -40,
    width: '80%',
    height: 80,
    backgroundColor: colors.primary,
    opacity: 0.06,
    borderRadius: 100,
  },
  subscribeButton: {
    width: '100%',
    height: 56,
    borderRadius: borderRadius.m,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 10,
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
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
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
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.error + '25',
  },
  signInButton: {
    marginTop: 18,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  signInText: {
    textDecorationLine: 'underline',
    fontWeight: '500',
  },

  /* ─── Ready State ─── */
  readyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  readyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
