import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenLayout } from '../components/ScreenLayout';
import { useSubscription } from '../context/SubscriptionContext';
import { colors, spacing, borderRadius } from '../theme/colors';
import { getStoreProducts, type BillingProduct } from '../services/billing';
import { useTranslation } from 'react-i18next';
import { Check, Dumbbell, TrendingUp, Trophy, BookOpen, FileSpreadsheet, Zap } from 'lucide-react-native';

const FEATURES = [
  { icon: Dumbbell, labelKey: 'subscription.features.tracking' },
  { icon: BookOpen, labelKey: 'subscription.features.programs' },
  { icon: TrendingUp, labelKey: 'subscription.features.progress' },
  { icon: Trophy, labelKey: 'subscription.features.pr' },
  { icon: FileSpreadsheet, labelKey: 'subscription.features.export' },
  { icon: Zap, labelKey: 'subscription.features.noLimits' },
];

export const PaywallScreen = () => {
  const { t } = useTranslation();
  const { purchaseLocalPremium, trialDaysRemaining, tier } = useSubscription();
  const [purchasing, setPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [product, setProduct] = useState<BillingProduct | null>(null);

  // Load product info from store
  useEffect(() => {
    const loadProduct = async () => {
      const products = await getStoreProducts();
      if (products.length > 0) {
        setProduct(products[0]);
      }
    };
    loadProduct();
  }, []);

  const handlePurchase = async () => {
    setPurchasing(true);
    setError(null);

    const result = await purchaseLocalPremium();

    if (!result.success) {
      setError(result.error || t('subscription.purchaseError'));
    }

    setPurchasing(false);
  };


  const priceText = product?.localizedPrice || '$6.99';
  const isTrialActive = tier === 'trial' && trialDaysRemaining > 0;

  return (
    <ScreenLayout>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* App Branding */}
        <View style={styles.brandingSection}>
          <View style={styles.iconWrapper}>
            <Zap color={colors.primary} size={48} />
          </View>
          <Typography variant="h1" style={styles.appTitle}>
            RepAI
          </Typography>
          <Typography variant="body" color={colors.textSecondary} align="center">
            {isTrialActive
              ? t('subscription.trialBanner', { days: trialDaysRemaining })
              : t('subscription.trialExpired')
            }
          </Typography>
        </View>

        {/* Features List */}
        <Card variant="elevated" style={styles.featuresCard}>
          <Typography variant="h3" style={{ marginBottom: 16 }}>
            {t('subscription.everythingYouNeed')}
          </Typography>

          {FEATURES.map((feature, index) => {
            const IconComponent = feature.icon;
            return (
              <View key={index} style={styles.featureRow}>
                <View style={styles.featureCheck}>
                  <Check color={colors.success} size={16} />
                </View>
                <IconComponent color={colors.textSecondary} size={18} style={{ marginRight: 12 }} />
                <Typography variant="body" style={{ flex: 1 }}>
                  {t(feature.labelKey)}
                </Typography>
              </View>
            );
          })}
        </Card>

        {/* CTA Section */}
        <View style={styles.ctaSection}>
          <Button
            title={purchasing
              ? t('subscription.processing')
              : `${t('subscription.unlockForever')} — ${priceText}`
            }
            onPress={handlePurchase}
            size="large"
            fullWidth
            disabled={purchasing}
            style={styles.purchaseButton}
          />

          <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
            {t('subscription.oneTimePayment')}
          </Typography>

          {/* Error message */}
          {error && (
            <View style={styles.errorContainer}>
              <Typography variant="bodySmall" color={colors.error} align="center">
                {error}
              </Typography>
            </View>
          )}
        </View>
      </ScrollView>
    </ScreenLayout>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    paddingBottom: 40,
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandingSection: {
    alignItems: 'center',
    marginBottom: 32,
    paddingTop: 20,
  },
  iconWrapper: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 2,
    borderColor: colors.primary + '40',
  },
  appTitle: {
    marginBottom: 8,
    fontSize: 28,
  },
  featuresCard: {
    marginBottom: 24,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border + '30',
  },
  featureCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.success + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  purchaseButton: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
});
