/**
 * RevenueCat Web Stub & Dev Simulator.
 * Provides safe defaults, simulated offerings, and preview flows so the app
 * runs on web without crashing and allows recording demo flows seamlessly.
 */

export const PRODUCT_IDS = {
  monthly: 'mazo_pro_monthly',
  annual: 'mazo_pro_yearly',
} as const;

export interface IAPProduct {
  productId: string;
  title: string;
  description: string;
  displayPrice: string;
  price: number | null;
  type: 'monthly' | 'annual';
}

export interface ValidationResult {
  success: boolean;
  isPro: boolean;
  expiresAt: string | null;
  source: string;
  error?: string;
}

export async function initIAP(): Promise<boolean> {
  if (__DEV__) console.log('[RevenueCat] Web platform — simulated store mode active');
  return true;
}

export async function endIAP(): Promise<void> {}

export async function getOfferings(): Promise<any> {
  return null;
}

export async function getProducts(): Promise<IAPProduct[]> {
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

export async function purchaseSubscription(productId: string): Promise<{ success: boolean; isPro: boolean }> {
  if (__DEV__) console.log('[RevenueCat Web] Simulated purchase for:', productId);
  return { success: true, isPro: true };
}

export async function restorePurchases(): Promise<{ success: boolean; isPro: boolean }> {
  if (__DEV__) console.log('[RevenueCat Web] Simulated restore');
  return { success: true, isPro: true };
}

export async function validatePurchase(
  _purchaseToken: string,
  _productId: string
): Promise<ValidationResult> {
  return { success: true, isPro: true, expiresAt: null, source: 'web_simulator' };
}

export async function registerDevice(
  _deviceId: string,
  _platform: string = 'web'
): Promise<{
  isNew: boolean;
  isPro: boolean;
  tier: string;
  source: string | null;
  expiresAt: string | null;
  trialDays?: number;
}> {
  return { isNew: false, isPro: false, tier: 'free', source: null, expiresAt: null };
}

export async function redeemVoucherCode(
  _code: string
): Promise<{ success: boolean; message: string; expiresAt?: string; isPro?: boolean }> {
  return { success: false, message: 'Voucher redemption unavailable in web mode' };
}

export function setupPurchaseListeners(
  _onCustomerInfoUpdate: (customerInfo: any) => Promise<boolean> | boolean,
  _onPurchaseError: (error: any) => void
): () => void {
  return () => {};
}
