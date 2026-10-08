import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Typography } from './Typography';
import { useFeatureAccess } from '../hooks/useFeatureAccess';
import { ProFeatureKey } from '../config/features';
import { borderRadius } from '../theme/colors';
import { useTheme } from '../context/ThemeContext';
import { Lock, Crown } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

interface ProFeatureGateProps {
  /** Which feature to gate */
  feature: ProFeatureKey;
  children: React.ReactNode;
  /** Optional: render inline lock instead of overlay (for buttons) */
  inline?: boolean;
  /** Optional: custom lock message */
  message?: string;
}

/**
 * Wraps a UI section. If the user has access, renders children normally.
 * If not, renders a locked overlay with an upgrade prompt.
 */
export const ProFeatureGate: React.FC<ProFeatureGateProps> = ({
  feature,
  children,
  inline = false,
  message,
}) => {
  const { canAccess } = useFeatureAccess();
  const { colors } = useTheme();
  const { t } = useTranslation();
  const navigation = useNavigation<any>();

  if (canAccess(feature)) {
    return <>{children}</>;
  }

  if (inline) {
    // Inline mode: replace the children with a small lock button
    return (
      <TouchableOpacity
        style={[styles.inlineLock, { backgroundColor: colors.primarySoft, borderColor: 'transparent' }]}
        onPress={() => navigation.navigate('Paywall')}
        activeOpacity={0.7}
      >
        <Lock color={colors.primary} size={14} />
        <Typography variant="bodySmall" color={colors.primary} bold style={{ marginLeft: 6 }}>
          {t('proGate.unlockPro', 'Unlock with Pro')}
        </Typography>
      </TouchableOpacity>
    );
  }

  // Overlay mode: children stay visible but dimmed, with a small Pro pill on top.
  // The pill fits inside a single row, so it never covers neighbouring free content.
  return (
    <View style={styles.container}>
      <View style={styles.dimmedContent} pointerEvents="none">
        {children}
      </View>

      <TouchableOpacity
        style={styles.overlay}
        onPress={() => navigation.navigate('Paywall')}
        activeOpacity={0.7}
        accessibilityRole="button"
        accessibilityLabel={t('proGate.proFeature', 'Pro Feature')}
        accessibilityHint={message || t('proGate.upgradeMessage', 'Upgrade to Pro to unlock this feature — one-time payment')}
      >
        {/* Opaque backing so the dimmed row's own trailing icon doesn't show through the tint */}
        <View style={[styles.proPillBacking, { backgroundColor: colors.surface }]}>
          <View style={[styles.proPill, { backgroundColor: colors.primarySoft }]}>
            <Crown color={colors.primary} size={13} />
            <Typography variant="caption" color={colors.primary} bold style={styles.proPillText}>
              {t('proGate.badge', 'Pro')}
            </Typography>
          </View>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  dimmedContent: {
    opacity: 0.4,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  proPillBacking: {
    borderRadius: borderRadius.full,
  },
  proPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 26,
    paddingHorizontal: 9,
    borderRadius: borderRadius.full,
  },
  proPillText: {
    fontSize: 12,
  },
  inlineLock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: borderRadius.m,
    borderWidth: 1,
  },
});
