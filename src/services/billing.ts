/**
 * Billing Abstraction Layer — RevenueCat Implementation
 *
 * This is the ONLY file that touches RevenueCat directly.
 * All other code interacts with billing through this service.
 *
 * Two products:
 *  - "RepAI Pro"  → one-time purchase, full local features forever
 *  - "RepAI AI"   → monthly subscription, AI coach + cloud sync
 *
 * Anyone who has ever subscribed to AI also keeps Pro forever. RevenueCat
 * remembers expired entitlements, so this follows the account across devices.
 *
 * Identity: the RevenueCat app user ID mirrors the Clerk user ID while signed
 * in, and is anonymous while signed out. Purchases made while anonymous are
 * moved to the account on the next logIn().
 */

import { Platform } from 'react-native';
import Purchases, {
  LOG_LEVEL,
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
} from 'react-native-purchases';

// ── Configuration ────────────────────────────────────────
const REVENUECAT_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_API_KEY || '';
const ENTITLEMENT_PRO = 'RepAI Pro';
const ENTITLEMENT_AI  = 'RepAI AI';

// Offering identifiers — must match what's configured in RevenueCat dashboard
const OFFERING_PRO = 'pro_lifetime';
const OFFERING_AI  = 'ai_monthly';

const ANONYMOUS_PREFIX = '$RCAnonymousID:';

// ── Types ────────────────────────────────────────────────
export interface BillingProduct {
  productId: string;
  title: string;
  description: string;
  price: string;
  localizedPrice: string;
  currency: string;
}

/** Everything the app needs to know about the current store customer. */
export interface BillingSnapshot {
  appUserId: string;
  isAnonymous: boolean;
  /** Bought the one-time Pro unlock. */
  hasProPurchase: boolean;
  /** AI subscription is currently active. */
  hasAI: boolean;
  /** Subscribed to AI at least once (active or expired) → lifetime Pro. */
  everHadAI: boolean;
  aiExpiresAt: number | null;
  aiWillRenew: boolean;
  aiBillingIssue: boolean;
  managementURL: string | null;
}

export interface BillingPurchaseResult {
  success: boolean;
  cancelled?: boolean;
  /** The store account already owns this product (bought under another account). */
  alreadyOwned?: boolean;
  error?: string;
  snapshot?: BillingSnapshot;
}

// ── State ────────────────────────────────────────────────
let isInitialized = false;

// ── Helpers ──────────────────────────────────────────────

/**
 * RevenueCat logs recoverable problems at ERROR level — for example Google
 * Play's purchase-history query failing ("Error querying purchase history
 * through AIDL"). Its default handler sends those to console.error, which shows
 * a red LogBox in development. Failures that matter reach us as rejected
 * promises, so the SDK's own log lines are only diagnostics.
 */
function handleRevenueCatLog(level: LOG_LEVEL, message: string) {
  const line = `[RevenueCat] ${message}`;
  if ((level === LOG_LEVEL.ERROR || level === LOG_LEVEL.WARN) && !/purchase history/i.test(message)) {
    console.warn(line);
  } else if (__DEV__) {
    console.log(line);
  }
}

function toSnapshot(info: CustomerInfo, appUserId: string): BillingSnapshot {
  const ai = info.entitlements.active[ENTITLEMENT_AI];
  return {
    appUserId,
    isAnonymous: appUserId.startsWith(ANONYMOUS_PREFIX),
    hasProPurchase: info.entitlements.active[ENTITLEMENT_PRO] !== undefined,
    hasAI: ai !== undefined,
    everHadAI: info.entitlements.all[ENTITLEMENT_AI] !== undefined,
    aiExpiresAt: ai?.expirationDateMillis ?? null,
    aiWillRenew: ai?.willRenew ?? false,
    aiBillingIssue: !!ai?.billingIssueDetectedAt,
    managementURL: info.managementURL,
  };
}

// ── Public API ───────────────────────────────────────────

/**
 * Initialize RevenueCat. Must be called once on app start.
 */
export function initBilling(): boolean {
  if (isInitialized) return true;
  if (!REVENUECAT_API_KEY) {
    console.warn('[Billing] EXPO_PUBLIC_REVENUECAT_API_KEY is not set');
    return false;
  }

  try {
    // Must be set before configure(), otherwise the SDK installs its default handler.
    Purchases.setLogHandler(handleRevenueCatLog);
    Purchases.setLogLevel(__DEV__ ? LOG_LEVEL.DEBUG : LOG_LEVEL.WARN);
    Purchases.configure({ apiKey: REVENUECAT_API_KEY });
    isInitialized = true;
    return true;
  } catch (error) {
    console.warn('[Billing] Failed to initialize RevenueCat:', error);
    return false;
  }
}

export function isBillingReady(): boolean {
  return isInitialized;
}

/** Current entitlements for whoever RevenueCat is identified as. */
export async function fetchBillingSnapshot(): Promise<BillingSnapshot> {
  const [info, appUserId] = await Promise.all([
    Purchases.getCustomerInfo(),
    Purchases.getAppUserID(),
  ]);
  return toSnapshot(info, appUserId);
}

/**
 * Identify RevenueCat as the signed-in Clerk user. Purchases made while
 * anonymous on this device move to the account. No-op if already identified.
 */
export async function logInBillingUser(userId: string): Promise<BillingSnapshot> {
  const current = await Purchases.getAppUserID();
  if (current === userId) return fetchBillingSnapshot();
  const { customerInfo } = await Purchases.logIn(userId);
  return toSnapshot(customerInfo, userId);
}

/** Return to an anonymous RevenueCat user (after sign-out or account deletion). */
export async function logOutBillingUser(): Promise<BillingSnapshot> {
  if (await Purchases.isAnonymous()) return fetchBillingSnapshot();
  const info = await Purchases.logOut();
  return toSnapshot(info, await Purchases.getAppUserID());
}

/** Subscribe to entitlement changes (renewals, expirations, purchases). */
export function addBillingListener(onChange: (snapshot: BillingSnapshot) => void): () => void {
  const listener = (info: CustomerInfo) => {
    Purchases.getAppUserID()
      .then(appUserId => onChange(toSnapshot(info, appUserId)))
      .catch(e => console.warn('[Billing] listener failed', e));
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => {
    Purchases.removeCustomerInfoUpdateListener(listener);
  };
}

async function purchaseFromOffering(
  offeringId: string,
  entitlement: string,
): Promise<BillingPurchaseResult> {
  try {
    const offerings = await Purchases.getOfferings();
    const offering = offerings.all[offeringId];

    if (!offering || offering.availablePackages.length === 0) {
      console.warn(`[Billing] Offering "${offeringId}" not found or has no packages.`);
      return { success: false, error: 'Product not found' };
    }

    const { customerInfo } = await Purchases.purchasePackage(offering.availablePackages[0]);
    const snapshot = toSnapshot(customerInfo, await Purchases.getAppUserID());

    if (customerInfo.entitlements.active[entitlement] !== undefined) {
      return { success: true, snapshot };
    }
    return { success: false, error: 'Purchase incomplete', snapshot };
  } catch (error: any) {
    if (error?.userCancelled || error?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR) {
      return { success: false, cancelled: true };
    }
    if (error?.code === PURCHASES_ERROR_CODE.PRODUCT_ALREADY_PURCHASED_ERROR) {
      return { success: false, alreadyOwned: true, error: error?.message };
    }
    return { success: false, error: error?.message || 'Purchase failed' };
  }
}

/** Buy the one-time Pro unlock (first package of the 'pro_lifetime' offering). */
export function purchaseProPackage(): Promise<BillingPurchaseResult> {
  return purchaseFromOffering(OFFERING_PRO, ENTITLEMENT_PRO);
}

/** Buy the AI subscription (first package of the 'ai_monthly' offering). */
export function purchaseAIPackage(): Promise<BillingPurchaseResult> {
  return purchaseFromOffering(OFFERING_AI, ENTITLEMENT_AI);
}

/**
 * Restore purchases owned by the device's store account (reinstall / new device).
 * They are attached to the current RevenueCat user — the account if signed in.
 */
export async function restoreBillingPurchases(): Promise<BillingSnapshot> {
  const info = await Purchases.restorePurchases();
  return toSnapshot(info, await Purchases.getAppUserID());
}

/**
 * The store page where users cancel/modify their AI subscription.
 * Falls back to the store's subscription list if RevenueCat returns none.
 */
export function getManagementURL(snapshot: BillingSnapshot | null): string {
  if (snapshot?.managementURL) return snapshot.managementURL;
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
