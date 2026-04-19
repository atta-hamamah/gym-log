import { useCallback } from 'react';
import { useSubscription } from '../context/SubscriptionContext';
import { PRO_FEATURES, ProFeatureKey } from '../config/features';

/**
 * Hook to check feature access based on subscription tier.
 *
 * During pro_trial: all Pro features are accessible.
 * During free: only features with PRO_FEATURES[key] === false are accessible.
 * During pro / ai_subscriber: all Pro features are accessible.
 */
export function useFeatureAccess() {
  const {
    tier,
    isPro,
    isProTrial,
    trialDaysRemaining,
    purchasePro,
  } = useSubscription();

  /**
   * Check if the user can access a given Pro feature.
   * Returns true if the feature is free, or the user has Pro/AI/trial.
   */
  const canAccess = useCallback(
    (feature: ProFeatureKey): boolean => {
      // Feature is free for everyone
      if (!PRO_FEATURES[feature]) return true;

      // User has Pro (purchased, trial, or AI subscriber)
      if (isPro) return true;

      return false;
    },
    [isPro]
  );

  /**
   * Whether a specific feature is marked as a Pro feature in the config.
   */
  const isProFeature = useCallback(
    (feature: ProFeatureKey): boolean => PRO_FEATURES[feature],
    []
  );

  return {
    canAccess,
    isProFeature,
    isPro,
    isProTrial,
    trialDaysRemaining,
    tier,
    purchasePro,
  };
}
