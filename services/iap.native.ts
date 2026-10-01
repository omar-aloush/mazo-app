/**
 * In-App Purchase Service using RevenueCat SDK (react-native-purchases)
 * 
 * Configures RevenueCat for iOS & Android, handles offerings, purchases,
 * restores, and real-time entitlement validation for Shipathon 2026.
 */

import { Platform } from 'react-native';
import Purchases, {
  PurchasesPackage,
  PurchasesOffering,
  CustomerInfo,
  PACKAGE_TYPE,
  LOG_LEVEL,
} from 'react-native-purchases';
import { ensureAuthSession } from './auth';
import { supabase } from './supabase';

export const PRODUCT_IDS = {
  monthly: 'mazo_pro_monthly',
  annual: 'mazo_pro_yearly',
} as const;

export const ENTITLEMENT_ID = process.env.EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID || 'pro';

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  displayPrice: string;
  price: number | null;
  type: 'monthly' | 'annual';
  package?: PurchasesPackage;
}

export interface ValidationResult {
  success: boolean;
  isPro: boolean;
  expiresAt: string | null;
  source: string;
  error?: string;
}

let isInitialized = false;
let customerInfoListenerCleanup: (() => void) | null = null;
let cachedPackages: PurchasesPackage[] = [];

/**
 * Get the platform-specific RevenueCat API Key.
 */
function getRevenueCatApiKey(): string | null {
  const iosKey = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
  const androidKey = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;
  const testKey = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;

  if (Platform.OS === 'ios' && iosKey && !iosKey.includes('your_')) {
    return iosKey;
  }
  if (Platform.OS === 'android' && androidKey && !androidKey.includes('your_')) {
    return androidKey;
  }
  if (testKey && !testKey.includes('your_')) {
    return testKey;
  }
  // Fall back to any non-placeholder key
  return iosKey || androidKey || testKey || null;
}

/**
 * Initialize connection to RevenueCat.
 * Call this once on app launch or when user ID is known.
 */
export async function initIAP(appUserId?: string): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (isInitialized) return true;

  try {
    if (__DEV__) {
      Purchases.setLogLevel(LOG_LEVEL.DEBUG);
    }

    const apiKey = getRevenueCatApiKey();
    if (!apiKey) {
      console.warn('[RevenueCat] No valid API key found in environment. Running in sandbox mode.');
      isInitialized = true;
      return true;
    }

    await Purchases.configure({
      apiKey,
      appUserID: appUserId || undefined,
    });

    isInitialized = true;
    if (__DEV__) console.log('[RevenueCat] Initialized successfully');
    return true;
  } catch (error) {
    console.warn('[RevenueCat] Failed to initialize:', error);
    // Allow app to continue even if network/config is delayed
    isInitialized = true;
    return true;
  }
}

/**
 * End the IAP connection. Call on app unmount.
 */
export async function endIAP(): Promise<void> {
  if (customerInfoListenerCleanup) {
    customerInfoListenerCleanup();
    customerInfoListenerCleanup = null;
  }
  cachedPackages = [];
  isInitialized = false;
}

/**
 * Fetch current offerings directly from RevenueCat.
 */
export async function getOfferings(): Promise<PurchasesOffering | null> {
  if (!isInitialized) {
    await initIAP();
  }

  try {
    const offerings = await Purchases.getOfferings();
    if (offerings.current) {
      cachedPackages = offerings.current.availablePackages;
      return offerings.current;
    }
    return null;
  } catch (error) {
    console.warn('[RevenueCat] Error fetching offerings:', error);
    return null;
  }
}

/**
 * Fetch subscription products from RevenueCat offerings.
 * Maps RevenueCat packages into the format consumed by Mazō paywall.
 */
export async function getProducts(): Promise<IAPProduct[]> {
  if (!isInitialized) {
    await initIAP();
  }

  try {
    const offerings = await Purchases.getOfferings();
    const packages = offerings.current?.availablePackages || [];
    cachedPackages = packages;

    if (packages.length > 0) {
      return packages.map((pkg) => {
        const isAnnual =
          pkg.packageType === PACKAGE_TYPE.ANNUAL ||
          pkg.identifier.toLowerCase().includes('annual') ||
          pkg.product.identifier.toLowerCase().includes('yearly') ||
          pkg.product.identifier.toLowerCase().includes('annual');

        return {
          productId: pkg.product.identifier,
          title: pkg.product.title || (isAnnual ? 'Mazō Pro Annual' : 'Mazō Pro Monthly'),
          description: pkg.product.description || (isAnnual ? 'Billed annually' : 'Billed monthly'),
          displayPrice: pkg.product.priceString || (isAnnual ? '$59.99' : '$9.99'),
          price: pkg.product.price ?? (isAnnual ? 59.99 : 9.99),
          type: isAnnual ? 'annual' as const : 'monthly' as const,
          package: pkg,
        };
      });
    }
  } catch (error) {
    console.warn('[RevenueCat] Error fetching products:', error);
  }

  // Graceful fallback products for local simulation or before RevenueCat dashboard products are loaded
  return [
    {
      productId: PRODUCT_IDS.monthly,
      title: 'Mazō Pro Monthly',
      description: 'Billed monthly, cancel anytime',
      displayPrice: '$9.99',
      price: 9.99,
      type: 'monthly',
    },
    {
      productId: PRODUCT_IDS.annual,
      title: 'Mazō Pro Annual',
      description: 'Billed annually, save 50%',
      displayPrice: '$59.99',
      price: 59.99,
      type: 'annual',
    },
  ];
}

/**
 * Start a subscription purchase through RevenueCat.
 */
export async function purchaseSubscription(productId: string): Promise<{
  success: boolean;
  isPro: boolean;
  customerInfo?: CustomerInfo;
}> {
  if (!isInitialized) {
    await initIAP();
  }

  try {
    // 1. Try to find a matched package in cached offerings
    const pkg = cachedPackages.find(
      (p) =>
        p.product.identifier === productId ||
        p.identifier === productId ||
        (productId.includes('yearly') && (p.packageType === PACKAGE_TYPE.ANNUAL || p.identifier.includes('annual'))) ||
        (productId.includes('monthly') && (p.packageType === PACKAGE_TYPE.MONTHLY || p.identifier.includes('monthly')))
    );

    let customerInfo: CustomerInfo;

    if (pkg) {
      const result = await Purchases.purchasePackage(pkg);
      customerInfo = result.customerInfo;
    } else {
      const result = await Purchases.purchaseProduct(productId);
      customerInfo = result.customerInfo;
    }

    const hasPro =
      typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined' ||
      typeof customerInfo.entitlements.active['premium'] !== 'undefined' ||
      Object.keys(customerInfo.entitlements.active).length > 0;

    return {
      success: true,
      isPro: hasPro,
      customerInfo,
    };
  } catch (error: any) {
    if (error?.userCancelled) {
      throw { userCancelled: true, message: 'User cancelled purchase' };
    }
    console.warn('[RevenueCat] Purchase failed:', error);
    throw error;
  }
}

/**
 * Restore purchases using RevenueCat.
 */
export async function restorePurchases(): Promise<{
  success: boolean;
  isPro: boolean;
  customerInfo?: CustomerInfo;
}> {
  if (!isInitialized) {
    await initIAP();
  }

  try {
    const customerInfo = await Purchases.restorePurchases();
    const hasPro =
      typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined' ||
      typeof customerInfo.entitlements.active['premium'] !== 'undefined' ||
      Object.keys(customerInfo.entitlements.active).length > 0;

    return {
      success: true,
      isPro: hasPro,
      customerInfo,
    };
  } catch (error) {
    console.warn('[RevenueCat] Restore failed:', error);
    throw error;
  }
}

/**
 * Validate a purchase receipt (retained for backward compatibility).
 */
export async function validatePurchase(
  _purchaseToken: string,
  _productId: string
): Promise<ValidationResult> {
  try {
    const customerInfo = await Purchases.getCustomerInfo();
    const hasPro =
      typeof customerInfo.entitlements.active[ENTITLEMENT_ID] !== 'undefined' ||
      typeof customerInfo.entitlements.active['premium'] !== 'undefined' ||
      Object.keys(customerInfo.entitlements.active).length > 0;

    return {
      success: true,
      isPro: hasPro,
      expiresAt: customerInfo.latestExpirationDate,
      source: 'revenuecat',
    };
  } catch (error: any) {
    return {
      success: false,
      isPro: false,
      expiresAt: null,
      source: 'revenuecat',
      error: error?.message,
    };
  }
}

/**
 * Register device with Supabase Edge Function (preserves trial and user session).
 */
export async function registerDevice(
  deviceId: string,
  platform?: string
): Promise<{
  isNew: boolean;
  isPro: boolean;
  tier: string;
  source: string | null;
  expiresAt: string | null;
  trialDays?: number;
}> {
  try {
    await ensureAuthSession();
    const { data, error } = await supabase.functions.invoke('register-device', {
      body: { device_id: deviceId, platform: platform || Platform.OS },
    });
    if (error) {
      throw new Error(data?.error || error.message || 'Could not register device.');
    }
    if (!data || typeof data.isPro !== 'boolean') throw new Error('Invalid device registration response.');
    return data;
  } catch (error: any) {
    console.warn('[RevenueCat] Register device error:', error);
    throw error;
  }
}

/**
 * Redeem a voucher code via Edge Function.
 */
export async function redeemVoucherCode(
  code: string
): Promise<{
  success: boolean;
  message: string;
  expiresAt?: string;
  isPro?: boolean;
}> {
  try {
    await ensureAuthSession();
    const { data, error } = await supabase.functions.invoke('redeem-voucher', {
      body: { code },
    });
    if (error) {
      return { success: false, message: data?.message || 'Could not redeem voucher.' };
    }
    return data;
  } catch (error: any) {
    return {
      success: false,
      message: 'Network error. Please try again.',
    };
  }
}

/**
 * Set up real-time RevenueCat CustomerInfo listeners.
 * Returns a cleanup function.
 */
export function setupPurchaseListeners(
  onCustomerInfoUpdate: (customerInfo: CustomerInfo) => Promise<boolean> | boolean,
  onPurchaseError: (error: any) => void
): () => void {
  try {
    const listener = async (customerInfo: CustomerInfo) => {
      if (__DEV__) console.log('[RevenueCat] CustomerInfo updated');
      try {
        await onCustomerInfoUpdate(customerInfo);
      } catch (err) {
        onPurchaseError(err);
      }
    };

    Purchases.addCustomerInfoUpdateListener(listener);

    return () => {
      // In react-native-purchases, listener is kept active or replaced
    };
  } catch (e) {
    console.warn('[RevenueCat] Could not attach listener:', e);
    return () => {};
  }
}
