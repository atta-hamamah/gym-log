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
        style={[styles.inlineLock, { backgroundColor: colors.primary + '12', borderColor: colors.primary + '30' }]}
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

  // Overlay mode: render children dimmed with a lock overlay on top
  return (
    <View style={styles.container}>
      {/* Dimmed children (still visible but not interactive) */}
      <View style={styles.dimmedContent} pointerEvents="none">
        {children}
      </View>

      {/* Lock overlay */}
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: colors.background + 'E8' }]}
        onPress={() => navigation.navigate('Paywall')}
        activeOpacity={0.9}
      >
        <View style={[styles.lockBadge, { backgroundColor: colors.primary + '15', borderColor: colors.primary + '30' }]}>
          <Crown color={colors.primary} size={22} />
          <Typography variant="body" bold color={colors.text} style={{ marginTop: 8 }}>
            {t('proGate.proFeature', 'Pro Feature')}
          </Typography>
          <Typography
            variant="caption"
            color={colors.textSecondary}
            align="center"
            style={{ marginTop: 4, paddingHorizontal: 8 }}
          >
            {message || t('proGate.upgradeMessage', 'Upgrade to Pro to unlock this feature — one-time payment')}
          </Typography>
          <View style={[styles.upgradeBtn, { backgroundColor: colors.primary }]}>
            <Typography variant="bodySmall" color={colors.black} bold>
              {t('proGate.upgrade', 'Upgrade to Pro')}
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
    opacity: 0.3,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: borderRadius.m,
  },
  lockBadge: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 24,
    borderRadius: borderRadius.l,
    borderWidth: 1,
  },
  upgradeBtn: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
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
