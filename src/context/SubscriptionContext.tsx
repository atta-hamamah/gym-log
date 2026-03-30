import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { StorageService } from '../services/storage';
import { initBilling, checkEntitlement, presentPaywall, restorePurchasesRC, disposeBilling } from '../services/billing';
import { SubscriptionTier } from '../types';

// ── Constants ────────────────────────────────────────────
const TRIAL_DURATION_DAYS = 5;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ── Context Type ─────────────────────────────────────────
interface SubscriptionContextType {
  tier: SubscriptionTier;
  trialDaysRemaining: number;
  loading: boolean;
  purchaseLocalPremium: () => Promise<{ success: boolean; error?: string }>;
  restorePurchases: () => Promise<{ success: boolean; restored: boolean }>;
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
  const [tier, setTier] = useState<SubscriptionTier>('trial');
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(TRIAL_DURATION_DAYS);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // ── Determine subscription state ────────────────────
  const refreshSubscriptionState = useCallback(async () => {
    try {
      // 1. Check/set first open date
      let firstOpenDate = await StorageService.getFirstOpenDate();
      if (firstOpenDate === null) {
        firstOpenDate = Date.now();
        await StorageService.setFirstOpenDate(firstOpenDate);
      }

      // 2. Check local purchase cache
      const purchaseStatus = await StorageService.getPurchaseStatus();
      if (purchaseStatus === 'local_premium') {
        setTier('local_premium');
        setTrialDaysRemaining(0);
        return;
      }

      // 3. Check RevenueCat entitlement
      try {
        const hasEntitlement = await checkEntitlement();
        if (hasEntitlement) {
          await StorageService.setPurchaseStatus('local_premium');
          setTier('local_premium');
          setTrialDaysRemaining(0);
          return;
        }
      } catch (e) {
        console.warn('[Subscription] RevenueCat check failed:', e);
      }

      // 4. Calculate trial status
      const remaining = calculateTrialDaysRemaining(firstOpenDate);
      setTrialDaysRemaining(remaining);
      setTier(remaining > 0 ? 'trial' : 'expired');
    } catch (error) {
      console.error('[Subscription] Failed to refresh state:', error);
      setTier('trial');
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

  // ── Purchase handler (uses RevenueCat Paywall UI) ───
  const purchaseLocalPremium = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    try {
      const result = await presentPaywall();

      if (result.success) {
        await StorageService.setPurchaseStatus('local_premium');
        setTier('local_premium');
        setTrialDaysRemaining(0);
        return { success: true };
      }

      return { success: false, error: result.error };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Purchase failed' };
    }
  }, []);

  // ── Restore handler ─────────────────────────────────
  const restorePurchases = useCallback(async (): Promise<{ success: boolean; restored: boolean }> => {
    try {
      const result = await restorePurchasesRC();

      if (result.restored) {
        await StorageService.setPurchaseStatus('local_premium');
        setTier('local_premium');
        setTrialDaysRemaining(0);
      }

      return result;
    } catch (error) {
      return { success: false, restored: false };
    }
  }, []);

  return (
    <SubscriptionContext.Provider
      value={{
        tier,
        trialDaysRemaining,
        loading,
        purchaseLocalPremium,
        restorePurchases,
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
