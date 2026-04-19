import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { useSubscription } from '../context/SubscriptionContext';
import { borderRadius } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronRight, Crown } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface TrialBannerProps {
  onPress?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { tier, trialDaysRemaining } = useSubscription();

  // Show during active Pro trial
  if (tier === 'pro_trial') {
    const isUrgent = trialDaysRemaining <= 3;

    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[
          styles.container,
          isUrgent && styles.containerUrgent,
        ]}
      >
        <View style={[styles.iconCircle, isUrgent && styles.iconCircleUrgent]}>
          <Clock color={isUrgent ? colors.warning : colors.primary} size={16} />
        </View>

        <View style={styles.textContainer}>
          <Typography variant="bodySmall" bold color={colors.text}>
            {t('subscription.proTrialBanner', { days: trialDaysRemaining, defaultValue: '{{days}} days of Pro remaining' })}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 1 }}>
            {t('subscription.proTrialHint', { defaultValue: 'Enjoying all features for free!' })}
          </Typography>
        </View>

        <ChevronRight color={colors.textMuted} size={18} />
      </TouchableOpacity>
    );
  }

  // Show upgrade banner when trial expired (free tier)
  if (tier === 'free') {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.8}
        style={[styles.container, styles.containerUpgrade]}
      >
        <View style={[styles.iconCircle, styles.iconCircleUpgrade]}>
          <Crown color={colors.primary} size={16} />
        </View>

        <View style={styles.textContainer}>
          <Typography variant="bodySmall" bold color={colors.text}>
            {t('subscription.upgradeProBanner', { defaultValue: 'Upgrade to Pro' })}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 1 }}>
            {t('subscription.upgradeProHint', { defaultValue: 'Unlock all features — one-time $4.99' })}
          </Typography>
        </View>

        <ChevronRight color={colors.textMuted} size={18} />
      </TouchableOpacity>
    );
  }

  // Don't show for pro or ai_subscriber
  return null;
};

const createStyles = (colors: any) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surfaceLight,
    borderRadius: borderRadius.m,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.primary + '30',
  },
  containerUrgent: {
    borderColor: colors.warning + '50',
    backgroundColor: colors.warning + '08',
  },
  containerUpgrade: {
    borderColor: colors.primary + '40',
    backgroundColor: colors.primary + '08',
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircleUrgent: {
    backgroundColor: colors.warning + '15',
  },
  iconCircleUpgrade: {
    backgroundColor: colors.primary + '20',
  },
  textContainer: {
    flex: 1,
  },
});
