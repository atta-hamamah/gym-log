import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Image } from 'react-native';
import { Typography } from '../components/Typography';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ScreenLayout } from '../components/ScreenLayout';
import { useSubscription } from '../context/SubscriptionContext';
import { IconButton } from '../components/IconButton';
import { borderRadius, ThemeColors } from '../theme/colors';
import { getStoreProducts, type BillingProduct } from '../services/billing';
import { useTranslation } from 'react-i18next';
import { Check, Dumbbell, TrendingUp, Trophy, BookOpen, FileSpreadsheet, Zap, X } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

const FEATURES = [
  { icon: Dumbbell, labelKey: 'subscription.features.tracking' },
  { icon: BookOpen, labelKey: 'subscription.features.programs' },
  { icon: TrendingUp, labelKey: 'subscription.features.progress' },
  { icon: Trophy, labelKey: 'subscription.features.pr' },
  { icon: FileSpreadsheet, labelKey: 'subscription.features.export' },
  { icon: Zap, labelKey: 'subscription.features.noLimits' },
];

export const PaywallScreen = ({ navigation }: any) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { purchasePro, trialDaysRemaining, tier, restorePurchases } = useSubscription();
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

    const result = await purchasePro();
    setPurchasing(false);

    if (result.success) {
      navigation.goBack();
    } else if (!result.cancelled) {
      setError(result.error || t('subscription.purchaseError'));
    }
  };

  const handleRestore = async () => {
    setPurchasing(true);
    setError(null);
    const result = await restorePurchases();
    setPurchasing(false);

    if (result.restoredPro || result.restoredAI) {
      navigation.goBack();
    } else {
      setError(t('subscription.noRestoreFoundMessage'));
    }
  };


  const priceText = product?.localizedPrice || '$4.99';
  const isTrialActive = tier === 'pro_trial' && trialDaysRemaining > 0;

  return (
    <ScreenLayout>
      {navigation.canGoBack() && (
        <View style={styles.closeRow}>
          <IconButton
            icon={c => <X color={c} size={20} />}
            onPress={() => navigation.goBack()}
            accessibilityLabel={t('common.close', 'Close')}
          />
        </View>
      )}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* App Branding */}
        <View style={styles.brandingSection}>
          <View style={styles.iconWrapper}>
            <Zap color={colors.primary} size={40} strokeWidth={2.2} />
          </View>
          <Typography 
            variant="h1" 
            style={styles.appTitle}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {"RepAI"}
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
              <View key={index} style={[styles.featureRow, index === FEATURES.length - 1 && styles.featureRowLast]}>
                <View style={styles.featureIcon}>
                  <IconComponent color={colors.primary} size={17} />
                </View>
                <Typography variant="body" style={{ flex: 1 }}>
                  {t(feature.labelKey)}
                </Typography>
                <Check color={colors.success} size={18} strokeWidth={2.5} />
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
          />

          <Typography variant="caption" color={colors.textMuted} align="center" style={{ marginTop: 8 }}>
            {t('subscription.oneTimePayment')}
          </Typography>

          <Button
            title={t('subscription.restorePurchase')}
            variant="ghost"
            onPress={handleRestore}
            disabled={purchasing}
            style={{ marginTop: 8 }}
          />

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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  closeRow: {
    alignItems: 'flex-end',
    paddingTop: 4,
  },
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
    width: 80,
    height: 80,
    borderRadius: 26,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 18,
  },
  appTitle: {
    marginBottom: 6,
    fontSize: 28,
  },
  featuresCard: {
    marginBottom: 24,
    paddingTop: 20,
    paddingBottom: 8,
    paddingHorizontal: 18,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  featureRowLast: {
    borderBottomWidth: 0,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctaSection: {
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  errorContainer: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: colors.errorSoft,
    borderRadius: borderRadius.m,
  },
});
