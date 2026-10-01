/**
 * IAP / RevenueCat Base — Interface contract for TypeScript.
 * Metro resolves iap.native.ts or iap.web.ts at runtime.
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
  package?: any;
}

export interface ValidationResult {
  success: boolean;
  isPro: boolean;
  expiresAt: string | null;
  source: string;
  error?: string;
}

export async function initIAP(userId?: string): Promise<boolean> {
  return false;
}

export async function endIAP(): Promise<void> {}

export async function getProducts(): Promise<IAPProduct[]> {
  return [];
}

export async function getOfferings(): Promise<any> {
  return null;
}

export async function purchaseSubscription(_productId: string): Promise<{ success: boolean; isPro: boolean; customerInfo?: any }> {
  return { success: false, isPro: false };
}

export async function restorePurchases(): Promise<{ success: boolean; isPro: boolean; customerInfo?: any }> {
  return { success: false, isPro: false };
}

export async function validatePurchase(
  _purchaseToken: string,
  _productId: string
): Promise<ValidationResult> {
  return { success: false, isPro: false, expiresAt: null, source: 'web' };
}

export async function registerDevice(
  _deviceId: string,
  _platform?: string
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
  return { success: false, message: 'Not available' };
}

export function setupPurchaseListeners(
  _onCustomerInfoUpdate: (customerInfo: any) => Promise<boolean> | boolean,
  _onPurchaseError: (error: any) => void
): () => void {
  return () => {};
}
