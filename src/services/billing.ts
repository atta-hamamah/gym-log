/**
 * Billing Abstraction Layer
 * 
 * This is the ONLY file that touches react-native-iap directly.
 * All other code interacts with billing through this service.
 * To swap to RevenueCat later, only this file needs to change.
 */

import {
  initConnection,
  endConnection,
  fetchProducts,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  type Product,
  type Purchase,
  type PurchaseError,
  type EventSubscription,
} from 'react-native-iap';

// ── Product IDs ──────────────────────────────────────────
// These must match the product IDs created in Google Play Console
export const PRODUCT_SKU = 'gym_log_premium_lifetime';
const PRODUCT_SKUS = [PRODUCT_SKU];

// ── Types ────────────────────────────────────────────────
export interface BillingProduct {
  productId: string;
  title: string;
  description: string;
  price: string;           // Formatted price string e.g. "$6.99"
  localizedPrice: string;
  currency: string;
}

export interface BillingPurchaseResult {
  success: boolean;
  productId?: string;
  transactionId?: string;
  error?: string;
}

// ── State ────────────────────────────────────────────────
let isInitialized = false;
let purchaseUpdateSubscription: EventSubscription | null = null;
let purchaseErrorSubscription: EventSubscription | null = null;
let onPurchaseComplete: ((purchase: Purchase) => void) | null = null;
let onPurchaseError: ((error: PurchaseError) => void) | null = null;

// ── Public API ───────────────────────────────────────────

/**
 * Initialize the billing connection. Must be called once on app start.
 */
export async function initBilling(): Promise<boolean> {
  if (isInitialized) return true;

  try {
    await initConnection();
    isInitialized = true;

    // Set up purchase listeners
    purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase) => {
        // Acknowledge/finish the transaction (required by Google Play)
        try {
          await finishTransaction({
            purchase,
            isConsumable: false,
          });
        } catch (e) {
          console.warn('[Billing] Failed to finish transaction:', e);
        }

        if (onPurchaseComplete) {
          onPurchaseComplete(purchase);
        }
      }
    );

    purchaseErrorSubscription = purchaseErrorListener((error: PurchaseError) => {
      if (onPurchaseError) {
        onPurchaseError(error);
      }
    });

    return true;
  } catch (error) {
    console.warn('[Billing] Failed to initialize:', error);
    return false;
  }
}

/**
 * Get available products from the store.
 */
export async function getStoreProducts(): Promise<BillingProduct[]> {
  if (!isInitialized) {
    const connected = await initBilling();
    if (!connected) return [];
  }

  try {
    const products = await fetchProducts({ skus: PRODUCT_SKUS });
    if (!products) return [];

    return (products as Product[]).map((p: Product) => ({
      productId: p.id,
      title: p.title,
      description: p.description,
      price: p.displayPrice || '$6.99',
      localizedPrice: p.displayPrice || '$6.99',
      currency: p.currency || 'USD',
    }));
  } catch (error) {
    console.warn('[Billing] Failed to get products:', error);
    return [];
  }
}

/**
 * Initiate the purchase flow for the premium lifetime unlock.
 * Returns a promise that resolves when the purchase completes or fails.
 */
export function purchasePremium(): Promise<BillingPurchaseResult> {
  return new Promise(async (resolve) => {
    if (!isInitialized) {
      const connected = await initBilling();
      if (!connected) {
        resolve({ success: false, error: 'Store connection failed' });
        return;
      }
    }

    // Set up one-time handlers for this purchase
    onPurchaseComplete = (purchase) => {
      onPurchaseComplete = null;
      onPurchaseError = null;
      resolve({
        success: true,
        productId: purchase.productId,
        transactionId: purchase.transactionId ?? undefined,
      });
    };

    onPurchaseError = (error) => {
      onPurchaseComplete = null;
      onPurchaseError = null;
      resolve({
        success: false,
        error: error.message || 'Purchase failed',
      });
    };

    try {
      await requestPurchase({
        request: {
          android: { skus: [PRODUCT_SKU] },
        },
        type: 'in-app',
      });
    } catch (error: any) {
      onPurchaseComplete = null;
      onPurchaseError = null;
      resolve({
        success: false,
        error: error?.message || 'Purchase request failed',
      });
    }
  });
}

/**
 * Check if the user has previously purchased the premium unlock.
 * Used for "Restore Purchase" and silent checks on launch.
 */
export async function checkExistingPurchases(): Promise<boolean> {
  if (!isInitialized) {
    const connected = await initBilling();
    if (!connected) return false;
  }

  try {
    const purchases = await getAvailablePurchases();
    if (!purchases) return false;
    return (purchases as Purchase[]).some((p: Purchase) => p.productId === PRODUCT_SKU);
  } catch (error) {
    console.warn('[Billing] Failed to check purchases:', error);
    return false;
  }
}

/**
 * Clean up billing connection. Call on app unmount.
 */
export function disposeBilling(): void {
  if (purchaseUpdateSubscription) {
    purchaseUpdateSubscription.remove();
    purchaseUpdateSubscription = null;
  }
  if (purchaseErrorSubscription) {
    purchaseErrorSubscription.remove();
    purchaseErrorSubscription = null;
  }

  onPurchaseComplete = null;
  onPurchaseError = null;

  try {
    endConnection();
  } catch (e) {
    // Ignore cleanup errors
  }

  isInitialized = false;
}
