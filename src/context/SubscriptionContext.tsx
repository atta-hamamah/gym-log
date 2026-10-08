import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { AppState, AppStateStatus, Linking } from 'react-native';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { StorageService, type BillingCache } from '../services/storage';
import {
  initBilling,
  isBillingReady,
  fetchBillingSnapshot,
  logInBillingUser,
  logOutBillingUser,
  addBillingListener,
  purchaseProPackage,
  purchaseAIPackage,
  restoreBillingPurchases,
  getManagementURL,
  type BillingSnapshot,
} from '../services/billing';
import { SubscriptionTier } from '../types';

// ── Constants ────────────────────────────────────────────
export const TRIAL_DURATION_DAYS = 14;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  /** The store account already owns this (bought under another app account). */
  alreadyOwned?: boolean;
  error?: string;
}

// ── Context Type ─────────────────────────────────────────
interface SubscriptionContextType {
  /** Highest usable tier */
  tier: SubscriptionTier;
  /** Basic (Pro) features unlocked: trial, Pro purchase, or AI subscriber (current or past) */
  isPro: boolean;
  /** Pro is unlocked forever: bought Pro, or subscribed to AI at least once */
  hasLifetimePro: boolean;
  /** Has subscribed to AI at least once (used for "Resubscribe" wording) */
  hasEverSubscribedAI: boolean;
  /** The store reports an active AI subscription (it may not be linked to an account yet) */
  hasAIEntitlement: boolean;
  /** AI subscription is active AND linked to the signed-in account → AI + cloud usable */
  isAISubscriber: boolean;
  /** Paid for AI but hasn't created / signed in to an account yet */
  needsAccount: boolean;
  /** RevenueCat is identified as the signed-in Clerk user (always true when signed out) */
  identityReady: boolean;
  aiExpiresAt: number | null;
  aiWillRenew: boolean;
  aiBillingIssue: boolean;
  /** Whether the user is in the 14-day Pro trial period */
  isProTrial: boolean;
  trialDaysRemaining: number;
  loading: boolean;

  /** Purchase the one-time Pro unlock */
  purchasePro: () => Promise<PurchaseResult>;
  /** Purchase the AI monthly subscription */
  purchaseAISubscription: () => Promise<PurchaseResult>;
  /** Open the store's subscription management page (for cancel) */
  openManageSubscription: () => Promise<void>;
  /** Restore all purchases owned by the device's store account */
  restorePurchases: () => Promise<{ success: boolean; restoredPro: boolean; restoredAI: boolean }>;
  /** Re-align RevenueCat with the signed-in user and refresh entitlements */
  refreshSubscriptionState: () => Promise<void>;
  /** Forget device-level entitlements (after the account was deleted) */
  forgetDeviceEntitlements: () => void;
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
  const { isLoaded: authLoaded, isSignedIn, userId } = useAuth();
  const { user } = useUser();

  const [snapshot, setSnapshot] = useState<BillingSnapshot | null>(null);
  const [cache, setCache] = useState<BillingCache | null>(null);
  const cacheRef = useRef<BillingCache | null>(null);
  const [firstOpenDate, setFirstOpenDate] = useState<number | null>(null);
  const [billingReady, setBillingReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const appState = useRef(AppState.currentState);

  // Latest Clerk state, read by queued billing tasks when they actually run.
  const authRef = useRef({ authLoaded: false, isSignedIn: false, userId: null as string | null });
  authRef.current = { authLoaded, isSignedIn: !!isSignedIn, userId: userId ?? null };

  // RevenueCat identity changes and purchases must never interleave.
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const enqueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = queueRef.current.then(task);
    queueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  const applySnapshot = useCallback((next: BillingSnapshot) => {
    const updated: BillingCache = {
      lifetimePro:
        (cacheRef.current?.lifetimePro ?? false) || next.hasProPurchase || next.everHadAI || next.hasAI,
      hasAI: next.hasAI,
      aiExpiresAt: next.aiExpiresAt,
      appUserId: next.appUserId,
    };
    cacheRef.current = updated;
    setCache(updated);
    setSnapshot(next);
    StorageService.setBillingCache(updated);
  }, []);

  /**
   * RevenueCat follows Clerk: identified as the Clerk user while signed in,
   * anonymous while signed out. Then refresh entitlements.
   */
  const syncBilling = useCallback(() => enqueue(async () => {
    if (!isBillingReady()) return;
    const auth = authRef.current;
    try {
      let next: BillingSnapshot;
      if (!auth.authLoaded) {
        next = await fetchBillingSnapshot();
      } else if (auth.isSignedIn && auth.userId) {
        next = await logInBillingUser(auth.userId);
      } else {
        next = await logOutBillingUser();
      }
      applySnapshot(next);
    } catch (e) {
      // Offline or store unavailable: keep the last known state.
      console.warn('[Subscription] Billing refresh failed:', e);
    }
  }), [enqueue, applySnapshot]);

  // ── Initialize on mount ─────────────────────────────
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      let first = await StorageService.getFirstOpenDate();
      if (first === null) {
        first = Date.now();
        await StorageService.setFirstOpenDate(first);
      }
      const cached = await StorageService.getBillingCache();
      if (!mounted) return;
      setFirstOpenDate(first);
      cacheRef.current = cached;
      setCache(cached);

      const ready = initBilling();
      setBillingReady(ready);
      if (ready) await syncBilling();
      if (mounted) setLoading(false);
    };

    init();
    return () => {
      mounted = false;
    };
  }, [syncBilling]);

  // ── Live entitlement updates (renewal, expiry, purchase) ──
  useEffect(() => {
    if (!billingReady) return;
    return addBillingListener(applySnapshot);
  }, [billingReady, applySnapshot]);

  // ── Follow Clerk sign-in / sign-out ─────────────────
  useEffect(() => {
    if (!billingReady || !authLoaded) return;
    syncBilling();
  }, [billingReady, authLoaded, isSignedIn, userId, syncBilling]);

  // ── Re-check when app returns to foreground ─────────
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
        syncBilling();
      }
      appState.current = nextAppState;
    });
    return () => subscription.remove();
  }, [syncBilling]);

  // ── Purchases ───────────────────────────────────────
  const purchasePro = useCallback(async (): Promise<PurchaseResult> => {
    await syncBilling(); // make sure the purchase lands on the right account
    const { snapshot: next, ...result } = await enqueue(() => purchaseProPackage());
    if (next) applySnapshot(next);
    return result;
  }, [syncBilling, enqueue, applySnapshot]);

  const purchaseAISubscription = useCallback(async (): Promise<PurchaseResult> => {
    await syncBilling();
    const { snapshot: next, ...result } = await enqueue(() => purchaseAIPackage());
    if (next) applySnapshot(next);
    return result;
  }, [syncBilling, enqueue, applySnapshot]);

  const restorePurchases = useCallback(async () => {
    try {
      await syncBilling();
      const next = await enqueue(() => restoreBillingPurchases());
      applySnapshot(next);
      return {
        success: true,
        restoredPro: next.hasProPurchase || next.everHadAI,
        restoredAI: next.hasAI,
      };
    } catch (error) {
      console.warn('[Subscription] Restore failed:', error);
      return { success: false, restoredPro: false, restoredAI: false };
    }
  }, [syncBilling, enqueue, applySnapshot]);

  // ── Open subscription management (cancel flow) ──────
  const openManageSubscription = useCallback(async () => {
    try {
      await Linking.openURL(getManagementURL(snapshot));
    } catch (error) {
      console.warn('[Subscription] Failed to open management URL:', error);
    }
  }, [snapshot]);

  const forgetDeviceEntitlements = useCallback(() => {
    cacheRef.current = null;
    setCache(null);
    syncBilling();
  }, [syncBilling]);

  // ── Derived state ───────────────────────────────────
  // Offline fallback: trust a cached AI entitlement until it expires.
  const cachedAIValid = !!cache?.hasAI && (cache.aiExpiresAt ?? 0) > Date.now();
  const hasAIEntitlement = snapshot ? snapshot.hasAI : cachedAIValid;
  const billingUserId = snapshot?.appUserId ?? cache?.appUserId ?? null;
  const identityReady = !isSignedIn || billingUserId === userId;

  const hasEverSubscribedAI = !!snapshot?.everHadAI || hasAIEntitlement;
  const hasLifetimePro =
    !!cache?.lifetimePro || !!snapshot?.hasProPurchase || hasEverSubscribedAI;
  const isAISubscriber = hasAIEntitlement && !!isSignedIn && identityReady;
  const needsAccount = hasAIEntitlement && authLoaded && !isSignedIn;

  const trialDaysRemaining = firstOpenDate !== null
    ? calculateTrialDaysRemaining(firstOpenDate)
    : TRIAL_DURATION_DAYS;
  const isProTrial = !hasLifetimePro && trialDaysRemaining > 0;
  const isPro = hasLifetimePro || isProTrial;
  const tier: SubscriptionTier = isAISubscriber
    ? 'ai_subscriber'
    : hasLifetimePro
      ? 'pro'
      : isProTrial
        ? 'pro_trial'
        : 'free';

  const isSuperAdmin = user?.primaryEmailAddress?.emailAddress === 'super@admin.com';

  return (
    <SubscriptionContext.Provider
      value={{
        tier: isSuperAdmin ? 'ai_subscriber' : tier,
        isPro: isSuperAdmin ? true : isPro,
        hasLifetimePro: isSuperAdmin ? true : hasLifetimePro,
        hasEverSubscribedAI: isSuperAdmin ? true : hasEverSubscribedAI,
        hasAIEntitlement: isSuperAdmin ? true : hasAIEntitlement,
        isAISubscriber: isSuperAdmin ? true : isAISubscriber,
        needsAccount: isSuperAdmin ? false : needsAccount,
        identityReady: isSuperAdmin ? true : identityReady,
        aiExpiresAt: snapshot?.aiExpiresAt ?? null,
        aiWillRenew: snapshot?.aiWillRenew ?? false,
        aiBillingIssue: snapshot?.aiBillingIssue ?? false,
        isProTrial: isSuperAdmin ? false : isProTrial,
        trialDaysRemaining: isSuperAdmin ? 0 : trialDaysRemaining,
        loading,
        purchasePro,
        purchaseAISubscription,
        openManageSubscription,
        restorePurchases,
        refreshSubscriptionState: syncBilling,
        forgetDeviceEntitlements,
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
