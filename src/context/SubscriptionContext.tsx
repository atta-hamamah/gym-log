import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { useUser } from '@clerk/clerk-expo';
import { StorageService } from '../services/storage';
import {
  initBilling,
  checkAllEntitlements,
  presentPaywall,
  presentAIPaywall,
  restorePurchasesRC,
  getManagementURL,
  disposeBilling,
  identifyUser,
} from '../services/billing';
import { SubscriptionTier } from '../types';

// ── Constants ────────────────────────────────────────────
const TRIAL_DURATION_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Context Type ─────────────────────────────────────────
interface SubscriptionContextType {
  /** Highest active tier */
  tier: SubscriptionTier;
  /** Whether the user has at least Pro (one-time purchase or active trial) */
  isPro: boolean;
  /** Whether the user has an active AI subscription */
  isAISubscriber: boolean;
  /** Whether the user is in the 14-day Pro trial period */
  isProTrial: boolean;
  trialDaysRemaining: number;
  loading: boolean;

  /** Purchase the one-time Pro unlock */
  purchasePro: () => Promise<{ success: boolean; error?: string }>;
  /** Purchase the AI monthly subscription */
  purchaseAISubscription: () => Promise<{ success: boolean; error?: string }>;
  /** Open the store's subscription management page (for cancel) */
  openManageSubscription: () => Promise<void>;
  /** Restore all purchases */
  restorePurchases: () => Promise<{ success: boolean; restoredPro: boolean; restoredAI: boolean }>;
  /** Force refresh subscription state from RevenueCat */
  refreshSubscriptionState: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

// ── Helper: Calculate trial days remaining ───────────────
function calculateTrialDaysRemaining(firstOpenDate: number): number {
  const elapsed = Date.now() - firstOpenDate;
  const daysElapsed = Math.floor(elapsed / MS_PER_DAY);
  return Math.max(0, TRIAL_DURATION_DAYS - daysElapsed);
}

// ── Provider ─────────────────────────────────────────────
export const SubscriptionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tier, setTier] = useState<SubscriptionTier>('pro_trial');
  const [isPro, setIsPro] = useState(false);
  const [isAISubscriber, setIsAISubscriber] = useState(false);
  const [isProTrial, setIsProTrial] = useState(true);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(TRIAL_DURATION_DAYS);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);
  // Track if a purchase just happened — prevents RC server overriding local state
  // (critical for test store where anonymous→identified transfer doesn't work)
  const recentAIPurchaseRef = useRef(false);

  // ── Determine subscription state ────────────────────
  const refreshSubscriptionState = useCallback(async () => {
    try {
      // 1. Check/set first open date
      let firstOpenDate = await StorageService.getFirstOpenDate();
      if (firstOpenDate === null) {
        firstOpenDate = Date.now();
        await StorageService.setFirstOpenDate(firstOpenDate);
      }

      let hasPurchasedPro = false;
      let hasAI = false;

      // 2. RevenueCat is the SOURCE OF TRUTH for subscription state
      try {
        const entitlements = await checkAllEntitlements();
        hasPurchasedPro = entitlements.hasPro;
        hasAI = entitlements.hasAI;

        // If a purchase JUST happened locally but RC doesn't reflect it yet
        // (e.g., test store can't transfer anonymous purchases), preserve the local state
        if (!hasAI && recentAIPurchaseRef.current) {
          console.log('[Subscription] RC says no AI but purchase just happened — preserving local state');
          hasAI = true;
        }

        // Update local cache to match
        await StorageService.setPurchaseStatus(hasPurchasedPro ? 'pro' : 'free');
        await StorageService.setAISubscriptionStatus(hasAI ? 'active' : 'expired');
      } catch (e) {
        // RevenueCat failed — only trust local cache if we have a reason to
        console.warn('[Subscription] RevenueCat check failed, checking local cache:', e);
        const purchaseStatus = await StorageService.getPurchaseStatus();
        const aiStatus = await StorageService.getAISubscriptionStatus();
        hasPurchasedPro = purchaseStatus === 'pro' || purchaseStatus === 'local_premium';
        hasAI = aiStatus === 'active';
      }

      // 3. Set state
      setIsAISubscriber(hasAI);

      // 4. Determine highest tier
      if (hasAI) {
        setTier('ai_subscriber');
        setIsPro(true);
        setIsProTrial(false);
        setTrialDaysRemaining(0);
      } else if (hasPurchasedPro) {
        setTier('pro');
        setIsPro(true);
        setIsProTrial(false);
        setTrialDaysRemaining(0);
      } else {
        // Trial / free logic
        const remaining = calculateTrialDaysRemaining(firstOpenDate);
        setTrialDaysRemaining(remaining);
        if (remaining > 0) {
          // 14-day reverse trial: user gets all Pro features for free
          setTier('pro_trial');
          setIsPro(true);
          setIsProTrial(true);
        } else {
          // Trial expired: downgrade to free tier (app still works, just limited)
          setTier('free');
          setIsPro(false);
          setIsProTrial(false);
        }
      }
    } catch (error) {
      console.error('[Subscription] Failed to refresh state:', error);
      setTier('pro_trial');
      setIsProTrial(true);
      setTrialDaysRemaining(TRIAL_DURATION_DAYS);
    }
  }, []);

  // ── Initialize on mount ─────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      await initBilling();
      await refreshSubscriptionState();

      if (mounted) {
        setLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      disposeBilling();
    };
  }, [refreshSubscriptionState]);

  // ── Re-check when app returns to foreground ─────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        refreshSubscriptionState();
      }
      appState.current = nextAppState;
    });

    return () => subscription.remove();
  }, [refreshSubscriptionState]);

  // ── Purchase Pro (one-time) ─────────────────────────
  const purchasePro = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await presentPaywall();

      if (result.success) {
        await StorageService.setPurchaseStatus('pro');
        setIsPro(true);
        setIsProTrial(false);
        if (!isAISubscriber) {
          setTier('pro');
        }
        setTrialDaysRemaining(0);
        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Purchase failed' };
    }
  }, [isAISubscriber]);

  // ── Purchase AI subscription ────────────────────────
  const purchaseAISubscription = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await presentAIPaywall();

      if (result.success) {
        await StorageService.setAISubscriptionStatus('active');
        setIsAISubscriber(true);
        setTier('ai_subscriber');
        setIsProTrial(false);
        setTrialDaysRemaining(0);

        // Mark that a purchase just happened — prevents refreshSubscriptionState
        // from overriding this state if RC server hasn't synced yet
        recentAIPurchaseRef.current = true;
        // Clear after 5 minutes (RC should have synced by then)
        setTimeout(() => { recentAIPurchaseRef.current = false; }, 5 * 60 * 1000);

        // AI subscribers also get Pro-level local access
        if (!isPro) {
          await StorageService.setPurchaseStatus('pro');
          setIsPro(true);
        }
        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Subscription failed' };
    }
  }, [isPro]);

  // ── Open subscription management (cancel flow) ──────
  const openManageSubscription = useCallback(async () => {
    try {
      const url = await getManagementURL();
      await Linking.openURL(url);
    } catch (error) {
      console.warn('[Subscription] Failed to open management URL:', error);
    }
  }, []);

  // ── Restore handler ─────────────────────────────────
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; restoredPro: boolean; restoredAI: boolean }> => {
    try {
      const result = await restorePurchasesRC();

      if (result.restoredPro) {
        await StorageService.setPurchaseStatus('pro');
        setIsPro(true);
        setIsProTrial(false);
      }
      if (result.restoredAI) {
        await StorageService.setAISubscriptionStatus('active');
        setIsAISubscriber(true);
        setIsProTrial(false);
      }

      // Update tier
      if (result.restoredAI) {
        setTier('ai_subscriber');
        setTrialDaysRemaining(0);
      } else if (result.restoredPro) {
        setTier('pro');
        setTrialDaysRemaining(0);
      }

      return result;
    } catch (error) {
      return { success: false, restoredPro: false, restoredAI: false };
    }
  }, []);

  const { user } = useUser();
  const isSignedIn = !!user;

  // ── Sync Clerk User with RevenueCat ─────────────────────
  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id)
        .then(() => refreshSubscriptionState())
        .catch(console.error);
    }
  }, [user?.id, refreshSubscriptionState]);

  const isSuperAdmin = user?.primaryEmailAddress?.emailAddress === 'super@admin.com';

  // AI features REQUIRE a Clerk account (for Convex auth + cloud data).
  // If user is not signed in, AI subscription is always false regardless of RevenueCat.
  const effectiveAISubscriber = isSignedIn && isAISubscriber;
  const effectiveTier: SubscriptionTier = !isSignedIn && tier === 'ai_subscriber' ? (isPro ? 'pro' : (isProTrial ? 'pro_trial' : 'free')) : tier;

  return (
    <SubscriptionContext.Provider
      value={{
        tier: isSuperAdmin ? 'ai_subscriber' : effectiveTier,
        isPro: isSuperAdmin ? true : isPro,
        isAISubscriber: isSuperAdmin ? true : effectiveAISubscriber,
        isProTrial: isSuperAdmin ? false : isProTrial,
        trialDaysRemaining: isSuperAdmin ? 0 : trialDaysRemaining,
        loading,
        purchasePro,
        purchaseAISubscription,
        openManageSubscription,
        restorePurchases,
        refreshSubscriptionState,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
};

// ── Hook ─────────────────────────────────────────────────
export const useSubscription = () => {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within a SubscriptionProvider');
  }
  return context;
};
