/**
 * Billing Abstraction Layer — RevenueCat Implementation
 * 
 * This is the ONLY file that touches RevenueCat directly.
 * All other code interacts with billing through this service.
 */

import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// ── Configuration ────────────────────────────────────────
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
const ENTITLEMENT_ID = 'RepAI Pro';

// ── Types ────────────────────────────────────────────────
export interface BillingProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}

export interface BillingPurchaseResult {
  success: boolean;
  productId?: string;
  error?: string;
}

// ── State ────────────────────────────────────────────────
let isInitialized = false;

// ── Public API ───────────────────────────────────────────

/**
 * Initialize RevenueCat. Must be called once on app start.
 */
export async function initBilling(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
    }

    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    isInitialized = true;
    return true;
  } catch (error) {
    console.warn('[Billing] Failed to initialize RevenueCat:', error);
    return false;
  }
}

/**
 * Check if the user has an active premium entitlement.
 */
export async function checkEntitlement(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
  } catch (error) {
    console.warn('[Billing] Failed to check entitlement:', error);
    return false;
  }
}

/**
 * Present the RevenueCat paywall UI.
 * Returns true if user purchased or restored.
 */
export async function presentPaywall(): Promise<BillingPurchaseResult> {
  try {
    const result: PAYWALL_RESULT = await RevenueCatUI.presentPaywall();

    switch (result) {
      case PAYWALL_RESULT.PURCHASED:
      case PAYWALL_RESULT.RESTORED:
        return { success: true };
      case PAYWALL_RESULT.NOT_PRESENTED:
      case PAYWALL_RESULT.ERROR:
      case PAYWALL_RESULT.CANCELLED:
      default:
        return { success: false, error: 'Purchase cancelled or failed' };
    }
  } catch (error: any) {
    return { success: false, error: error?.message || 'Paywall error' };
  }
}

/**
 * Restore purchases (for users who reinstalled the app).
 */
export async function restorePurchasesRC(): Promise<{ success: boolean; restored: boolean }> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasEntitlement = typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined';
    return { success: true, restored: hasEntitlement };
  } catch (error) {
    console.warn('[Billing] Failed to restore purchases:', error);
    return { success: false, restored: false };
  }
}

/**
 * Get current offerings (products) from RevenueCat.
 */
export async function getStoreProducts(): Promise<BillingProduct[]> {
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    if (!current) return [];

    return current.availablePackages.map((pkg) => ({
      productId: pkg.product.identifier,
      title: pkg.product.title,
      description: pkg.product.description,
      price: pkg.product.priceString,
      localizedPrice: pkg.product.priceString,
      currency: pkg.product.currencyCode,
    }));
  } catch (error) {
    console.warn('[Billing] Failed to get products:', error);
    return [];
  }
}

/**
 * Identify the user with RevenueCat (call after Clerk auth).
 * Links purchases to a user account.
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    await Purchases.logIn(userId);
  } catch (error) {
    console.warn('[Billing] Failed to identify user:', error);
  }
}

/**
 * Clean up (no-op for RevenueCat, kept for API compatibility).
 */
export function disposeBilling(): void {
  // RevenueCat handles its own lifecycle
}
