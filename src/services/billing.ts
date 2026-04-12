/**
 * Billing Abstraction Layer — RevenueCat Implementation
 * 
 * This is the ONLY file that touches RevenueCat directly.
 * All other code interacts with billing through this service.
 * 
 * Two products:
 *  - "RepAI Pro"  → one-time purchase, full local features forever
 *  - "RepAI AI"   → monthly subscription, AI coach + cloud sync
 */

import { Platform, Alert } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  type CustomerInfo,
  type PurchasesOffering,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';

// ── Configuration ────────────────────────────────────────
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
const ENTITLEMENT_PRO = 'RepAI Pro';
const ENTITLEMENT_AI  = 'RepAI AI';

// Offering identifiers — must match what's configured in RevenueCat dashboard
const OFFERING_PRO = 'pro_lifetime';
const OFFERING_AI  = 'ai_monthly';

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
 * Check if the user has an active Pro (one-time) entitlement.
 */
export async function checkProEntitlement(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined';
  } catch (error) {
    console.warn('[Billing] Failed to check Pro entitlement:', error);
    return false;
  }
}

/**
 * Check if the user has an active AI subscription entitlement.
 */
export async function checkAIEntitlement(): Promise<boolean> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    return typeof customerInfo.entitlements.active[ENTITLEMENT_AI] !== 'undefined';
  } catch (error) {
    console.warn('[Billing] Failed to check AI entitlement:', error);
    return false;
  }
}

/**
 * Check both entitlements at once (more efficient — single API call).
 */
export async function checkAllEntitlements(): Promise<{ hasPro: boolean; hasAI: boolean }> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const activeKeys = Object.keys(customerInfo.entitlements.active);
    const hasPro = typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined';
    const hasAI  = typeof customerInfo.entitlements.active[ENTITLEMENT_AI]  !== 'undefined';
    console.log(`[Billing] checkAllEntitlements: active=[${activeKeys.join(',')}] looking for PRO="${ENTITLEMENT_PRO}" AI="${ENTITLEMENT_AI}" → hasPro=${hasPro} hasAI=${hasAI}`);
    return { hasPro, hasAI };
  } catch (error) {
    console.warn('[Billing] Failed to check entitlements:', error);
    return { hasPro: false, hasAI: false };
  }
}

// Keep backward-compatible alias
export const checkEntitlement = checkProEntitlement;
/**
 * Present the Google Play purchase flow (for Pro one-time purchase).
 * Grabs the first package from the 'pro_lifetime' offering.
 */
export async function presentPaywall(): Promise<BillingPurchaseResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const proOffering = offerings.all[OFFERING_PRO];

    if (!proOffering || proOffering.availablePackages.length === 0) {
      console.warn('[Billing] Pro offering not found or has no packages.');
      return { success: false, error: 'Product not found' };
    }

    const packageToBuy = proOffering.availablePackages[0];
    const { customerInfo } = await Purchases.purchasePackage(packageToBuy);
    
    if (typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined') {
      return { success: true };
    }
    
    return { success: false, error: 'Purchase incomplete' };
  } catch (error: any) {
    if (error.userCancelled) {
      return { success: false, error: 'Purchase cancelled' };
    }
    return { success: false, error: error?.message || 'Paywall error' };
  }
}

/**
 * Present the Google Play purchase flow for AI subscription.
 * Grabs the first package from the 'ai_monthly' offering.
 */
export async function presentAIPaywall(): Promise<BillingPurchaseResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const aiOffering = offerings.all[OFFERING_AI];

    if (!aiOffering || aiOffering.availablePackages.length === 0) {
      console.warn('[Billing] AI offering not found or has no packages.');
      return { success: false, error: 'Product not found' };
    }

    const packageToBuy = aiOffering.availablePackages[0];
    const { customerInfo } = await Purchases.purchasePackage(packageToBuy);

    if (typeof customerInfo.entitlements.active[ENTITLEMENT_AI] !== 'undefined') {
      return { success: true };
    }

    return { success: false, error: 'Subscription incomplete' };
  } catch (error: any) {
    if (error.userCancelled) {
      return { success: false, error: 'Subscription cancelled' };
    }
    return { success: false, error: error?.message || 'AI Paywall error' };
  }
}

/**
 * Restore purchases (for users who reinstalled the app).
 */
export async function restorePurchasesRC(): Promise<{ success: boolean; restoredPro: boolean; restoredAI: boolean }> {
  try {
    const customerInfo = await Purchases.restorePurchases();
    const restoredPro = typeof customerInfo.entitlements.active[ENTITLEMENT_PRO] !== 'undefined';
    const restoredAI  = typeof customerInfo.entitlements.active[ENTITLEMENT_AI]  !== 'undefined';
    return { success: true, restoredPro, restoredAI };
  } catch (error) {
    console.warn('[Billing] Failed to restore purchases:', error);
    return { success: false, restoredPro: false, restoredAI: false };
  }
}

/**
 * Get the management URL for the current user's subscriptions.
 * This lets users cancel/modify their AI subscription.
 * Falls back to the Play Store subscriptions page if RevenueCat returns null.
 */
export async function getManagementURL(): Promise<string> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    if (customerInfo.managementURL) {
      return customerInfo.managementURL;
    }
  } catch (error) {
    console.warn('[Billing] Failed to get management URL:', error);
  }

  // Fallback: open Play Store subscriptions page directly
  return Platform.OS === 'ios'
    ? 'https://apps.apple.com/account/subscriptions'
    : 'https://play.google.com/store/account/subscriptions';
}

/**
 * Get current offerings (products) from RevenueCat.
 */
export async function getStoreProducts(): Promise<BillingProduct[]> {
  try {
    const offerings = await Purchases.getOfferings();
    // Force it to read from the Pro offering, not the 'current/default' one
    const proOffering = offerings.all[OFFERING_PRO];
    if (!proOffering) return [];

    return proOffering.availablePackages.map((pkg) => ({
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
 * Also syncs purchases to ensure anonymous → identified transfer is reflected.
 */
export async function identifyUser(userId: string): Promise<void> {
  try {
    const { customerInfo } = await Purchases.logIn(userId);
    console.log('[Billing] Identified user:', userId);
    console.log('[Billing] Active entitlements after logIn:', Object.keys(customerInfo.entitlements.active));

    // Force sync to ensure anonymous purchases are transferred
    await Purchases.syncPurchases();
    console.log('[Billing] ✅ Purchases synced');
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
