import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { useSubscription } from '../context/SubscriptionContext';
import { borderRadius } from '../theme/colors';
import { useTranslation } from 'react-i18next';
import { Clock, ChevronRight } from 'lucide-react-native';
import { useTheme } from '../context/ThemeContext';

interface TrialBannerProps {
  onPress?: () => void;
}

export const TrialBanner: React.FC<TrialBannerProps> = ({ onPress }) => {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { tier, trialDaysRemaining } = useSubscription();

  // Only show during active trial
  if (tier !== 'trial') return null;

  const isUrgent = trialDaysRemaining <= 2;

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
          {t('subscription.trialBanner', { days: trialDaysRemaining })}
        </Typography>
        <Typography variant="caption" color={colors.textSecondary} style={{ marginTop: 1 }}>
          {t('subscription.tapToUnlock')}
        </Typography>
      </View>

      <ChevronRight color={colors.textMuted} size={18} />
    </TouchableOpacity>
  );
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
  textContainer: {
    flex: 1,
  },
});
