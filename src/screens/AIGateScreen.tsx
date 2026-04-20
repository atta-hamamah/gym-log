import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { ScreenLayout } from '../components/ScreenLayout';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useSubscription } from '../context/SubscriptionContext';
import { useAuth } from '@clerk/clerk-expo';
import { borderRadius } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import {
  Sparkles,
  Brain,
  TrendingUp,
  Dumbbell,
  MessageCircle,
  Shield,
  Cloud,
  ChevronRight,
  Crown,
  Zap,
} from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const AI_FEATURES = [
  { icon: MessageCircle, labelKey: 'aiGate.feature.chat' },
  { icon: Brain, labelKey: 'aiGate.feature.insights' },
  { icon: TrendingUp, labelKey: 'aiGate.feature.analysis' },
  { icon: Cloud, labelKey: 'aiGate.feature.cloudSync' },
  { icon: Shield, labelKey: 'aiGate.feature.backup' },
  { icon: Dumbbell, labelKey: 'aiGate.feature.coaching' },
];

export const AIGateScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { isAISubscriber, purchaseAISubscription } = useSubscription();
  const { isSignedIn } = useAuth();
  const [subscribing, setSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.95))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
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

  return (
    <ScreenLayout>
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ scale: scaleAnim }] }}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {/* Hero Section */}
          <View style={styles.heroSection}>
            <View style={styles.heroIconOuter}>
              <View style={styles.heroIconInner}>
                <Sparkles color="#fff" size={36} />
              </View>
            </View>
            <Typography variant="h1" align="center" style={{ marginTop: 20 }}>
              {t('aiGate.title')}
            </Typography>
            <Typography variant="body" color={colors.textSecondary} align="center" style={{ marginTop: 8, paddingHorizontal: 12 }}>
              {t('aiGate.subtitle')}
            </Typography>
          </View>

          {/* Features */}
          <Card variant="elevated" style={styles.featuresCard}>
            <View style={styles.featuresHeader}>
              <Crown color={colors.warning} size={18} />
              <Typography variant="h3" style={{ marginLeft: 8 }}>
                {t('aiGate.whatsIncluded')}
              </Typography>
            </View>

            {AI_FEATURES.map((feature, index) => {
              const IconComponent = feature.icon;
              return (
                <View
                  key={index}
                  style={[
                    styles.featureRow,
                    index === AI_FEATURES.length - 1 && { borderBottomWidth: 0 },
                  ]}
                >
                  <View style={styles.featureIconCircle}>
                    <IconComponent color={colors.primary} size={18} />
                  </View>
                  <Typography variant="body" style={{ flex: 1 }}>
                    {t(feature.labelKey)}
                  </Typography>
                  <ChevronRight color={colors.textMuted} size={16} />
                </View>
              );
            })}
          </Card>

          {/* CTA */}
          <View style={styles.ctaSection}>
            <Button
              title={subscribing ? t('subscription.processing') : t('aiGate.subscribe')}
              onPress={handleSubscribe}
              size="large"
              fullWidth
              disabled={subscribing}
              style={styles.subscribeButton}
            />

            <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
              {t('aiGate.cancelAnytime')}
            </Typography>

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
              style={styles.restoreButton}
              activeOpacity={0.7}
            >
              <Typography variant="bodySmall" color={colors.primary} style={{ textDecorationLine: 'underline' }}>
                {t('aiGate.alreadyHaveAccount', 'Already have an account? Sign in')}
              </Typography>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Animated.View>
    </ScreenLayout>
  );
};

const createStyles = (colors: any) => StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
  },
  heroSection: {
    alignItems: 'center',
    paddingTop: 16,
    paddingBottom: 28,
  },
  heroIconOuter: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  heroIconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  featuresCard: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  featuresHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '40',
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '25',
  },
  featureIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary + '12',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  subscribeButton: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 8,
  },
  errorContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: colors.error + '15',
    borderRadius: borderRadius.s,
  },
  restoreButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
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
