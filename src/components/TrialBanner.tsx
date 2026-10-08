import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { useSubscription } from '../context/SubscriptionContext';
import { borderRadius, ThemeColors } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronRight, Crown, Sparkles } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';

interface TrialBannerProps {
  onPress?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const navigation = useNavigation<any>();
  const { tier, trialDaysRemaining, needsAccount } = useSubscription();

  // Paid for AI but no account yet — the most important thing to finish
  if (needsAccount) {
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate('AIOnboarding', { mode: 'signup' })}
        activeOpacity={0.8}
        style={[styles.container, styles.containerUpgrade]}
      >
        <View style={[styles.iconCircle, styles.iconCircleUpgrade]}>
          <Sparkles color={colors.primary} size={16} />
        </View>

        <View style={styles.textContainer}>
          <Typography variant="bodySmall" bold color={colors.text}>
            {t('account.needsAccountTitle')}
          </Typography>
          <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 1 }}>
            {t('account.needsAccountHint')}
          </Typography>
        </View>

        <ChevronRight color={colors.textMuted} size={18} />
      </TouchableOpacity>
    );
  }

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

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: borderRadius.l,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  containerUrgent: {
    backgroundColor: colors.warningSoft,
    borderColor: 'transparent',
  },
  containerUpgrade: {
    backgroundColor: colors.primarySoft,
    borderColor: 'transparent',
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconCircleUrgent: {
    backgroundColor: colors.surface,
  },
  iconCircleUpgrade: {
    backgroundColor: colors.surface,
  },
  textContainer: {
    flex: 1,
  },
});
