/**
 * SubscriptionProvider — manages subscription & IAP state powered by RevenueCat.
 * 
 * ARCHITECTURE FOR SHIPATHON 2026:
 * - Native RevenueCat SDK (react-native-purchases) handles in-app purchases, offerings, and restores
 * - Real-time entitlement listener updates Pro status automatically
 * - Retains Supabase subscribers table sync and voucher redemption for full backward compatibility
 * - Graceful simulator fallback for Web and Expo Go development
 */

import createContextHook from '@nkzw/create-context-hook';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import { ensureAuthSession } from '@/services/auth';
import { supabase } from '@/services/supabase';
import { checkSubscriptionStatus, getTrialDaysRemaining } from '@/services/subscription';
import { isLocalDemoMode } from '@/services/demoMode';
import {
  initIAP,
  endIAP,
  getProducts,
  getOfferings,
  purchaseSubscription,
  restorePurchases,
  registerDevice,
  setupPurchaseListeners,
  type IAPProduct,
} from '@/services/iap';

const SUPABASE_USER_ID_KEY = 'mazo_supabase_user_id';
const DEVICE_ID_KEY = 'mazo_device_id';
const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate or retrieve a persistent device ID.
 */
async function getOrCreateDeviceId(): Promise<string> {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = `dev_${Crypto.randomUUID().replace(/-/g, '')}`;
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

export const [SubscriptionProvider, useSubscription] = createContextHook(() => {
  const queryClient = useQueryClient();
  const localDemo = isLocalDemoMode();

  // Subscription states
  const [revenueCatPro, setRevenueCatPro] = useState(false);
  const [supabasePro, setSupabasePro] = useState(false);
  const [supabaseSource, setSupabaseSource] = useState<string | null>(null);
  const [supabaseExpiresAt, setSupabaseExpiresAt] = useState<string | null>(null);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [iapReady, setIapReady] = useState(false);

  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const purchaseListenerCleanup = useRef<(() => void) | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== 'SIGNED_OUT') return;
      setSupabasePro(false);
      setRevenueCatPro(false);
      setSupabaseSource(null);
      setSupabaseExpiresAt(null);
      AsyncStorage.removeItem(SUPABASE_USER_ID_KEY).catch(() => {});
    });
    return () => subscription.unsubscribe();
  }, []);

  // ── Initialize RevenueCat IAP ───────────────────────────
  useEffect(() => {
    // The scripted walkthrough does not demonstrate purchases or account sync.
    if (localDemo) return;
    let mounted = true;

    const init = async () => {
      try {
        const storedUserId = await AsyncStorage.getItem(SUPABASE_USER_ID_KEY);
        const ok = await initIAP(storedUserId || undefined);
        if (mounted) setIapReady(ok);
      } catch (e) {
        console.warn('[Subscription] RevenueCat init failed:', e);
        if (mounted) setIapReady(true);
      }
    };

    init();

    return () => {
      mounted = false;
      endIAP();
    };
  }, [localDemo]);

  // ── Set up RevenueCat CustomerInfo listeners ────────────
  useEffect(() => {
    if (!iapReady) return;

    const cleanup = setupPurchaseListeners(
      async (customerInfo) => {
        if (__DEV__) console.log('[Subscription] RevenueCat listener update');
        const hasEntitlement =
          customerInfo?.entitlements?.active?.['pro'] !== undefined ||
          customerInfo?.entitlements?.active?.['premium'] !== undefined ||
          (customerInfo?.entitlements?.active && Object.keys(customerInfo.entitlements.active).length > 0);

        if (hasEntitlement) {
          setRevenueCatPro(true);
          setSupabasePro(true);
          setSupabaseSource('revenuecat');
          queryClient.invalidateQueries({ queryKey: ['products'] });
          queryClient.invalidateQueries({ queryKey: ['offerings'] });
        }
        return true;
      },
      (error) => {
        if (__DEV__) console.warn('[Subscription] RevenueCat listener error:', error);
      }
    );

    purchaseListenerCleanup.current = cleanup;
    return cleanup;
  }, [iapReady, queryClient]);

  // ── Supabase subscription sync ──────────────────────────
  const syncFromSupabase = useCallback(async () => {
    try {
      const status = await checkSubscriptionStatus();
      setSupabasePro(status.isPro);
      setSupabaseSource(status.source);
      setSupabaseExpiresAt(status.expiresAt);
    } catch (err) {
      console.warn('[Subscription] Supabase sync error:', err);
    }
  }, []);

  // ── Set user ID for Supabase & RevenueCat tracking ──────
  const setUserId = useCallback(async () => {
    if (localDemo) return;
    try {
      const session = await ensureAuthSession();
      await AsyncStorage.setItem(SUPABASE_USER_ID_KEY, session.user.id);
      const deviceId = await getOrCreateDeviceId();

      // Register device via Edge Function
      const result = await registerDevice(deviceId, Platform.OS);

      setSupabasePro(result.isPro);
      setSupabaseSource(result.source);
      setSupabaseExpiresAt(result.expiresAt);
    } catch (err) {
      console.warn('[Subscription] Error setting user ID:', err);
      throw err;
    }
  }, [localDemo]);

  // ── Sync on launch + periodic sync + app foreground sync
  useEffect(() => {
    if (localDemo) return;
    syncFromSupabase();

    syncIntervalRef.current = setInterval(syncFromSupabase, SYNC_INTERVAL_MS);

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        syncFromSupabase();
      }
    });

    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current);
      subscription.remove();
    };
  }, [localDemo, syncFromSupabase]);

  // ── Fetch products from RevenueCat ──────────────────────
  const productsQuery = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      if (!iapReady) return [];
      return await getProducts();
    },
    staleTime: 1000 * 60 * 10,
    enabled: iapReady,
  });

  // ── Fetch current offerings from RevenueCat ─────────────
  const offeringsQuery = useQuery({
    queryKey: ['offerings'],
    queryFn: async () => {
      if (!iapReady) return null;
      return await getOfferings();
    },
    staleTime: 1000 * 60 * 10,
    enabled: iapReady,
  });

  // ── Purchase handler ────────────────────────────────────
  const purchase = useCallback(async (productId: string): Promise<void> => {
    if (!iapReady) {
      throw new Error('Purchase service is not available. Please try again later.');
    }

    setIsPurchasing(true);
    try {
      const result = await purchaseSubscription(productId);
      if (result.isPro || result.success) {
        setRevenueCatPro(true);
        setSupabasePro(true);
        setSupabaseSource('revenuecat');
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['offerings'] });
      }
    } catch (error: any) {
      setIsPurchasing(false);
      throw error;
    } finally {
      setIsPurchasing(false);
    }
  }, [iapReady, queryClient]);

  // ── Restore purchases ───────────────────────────────────
  const restore = useCallback(async () => {
    setIsRestoring(true);
    try {
      const result = await restorePurchases();
      if (result.isPro || result.success) {
        setRevenueCatPro(true);
        setSupabasePro(true);
        setSupabaseSource('revenuecat');
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['offerings'] });
      }
      await syncFromSupabase();
    } finally {
      setIsRestoring(false);
    }
  }, [syncFromSupabase, queryClient]);

  // ── Voucher redemption (via Edge Function) ──────────────
  const activateVoucherPro = useCallback(async (expiresAt: string, _voucherCode?: string) => {
    setSupabasePro(true);
    setSupabaseSource('voucher');
    setSupabaseExpiresAt(expiresAt);
  }, []);

  // ── Trial state (synced from Supabase) ──────────────────
  const trialDaysRemaining = getTrialDaysRemaining(
    supabaseSource === 'trial' ? supabaseExpiresAt : null
  );

  // ── Get available products ──────────────────────────────
  const getMonthlyProduct = useCallback((): IAPProduct | null => {
    return productsQuery.data?.find((p) => p.type === 'monthly') || null;
  }, [productsQuery.data]);

  const getAnnualProduct = useCallback((): IAPProduct | null => {
    return productsQuery.data?.find((p) => p.type === 'annual') || null;
  }, [productsQuery.data]);

  const isPro = supabasePro || revenueCatPro;

  return {
    // Pro status comes from either RevenueCat active entitlement or Supabase
    isPro,
    isPremium: isPro,

    // Loading states
    isLoading: productsQuery.isLoading,
    isPurchasing,
    isRestoring,
    isConfigured: iapReady,

    // Actions
    purchase,
    restore,
    activateVoucherPro,
    setUserId,
    syncFromSupabase,
    setTrialActive: (_active: boolean) => {},

    // Products & Offerings
    products: productsQuery.data || [],
    offerings: offeringsQuery.data,
    getCurrentOffering: () => offeringsQuery.data,
    getMonthlyProduct,
    getAnnualProduct,

    // Subscription details
    trialDaysRemaining,
    voucherExpiresAt: supabaseExpiresAt,
    subscriptionSource: supabaseSource,

    refetch: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['offerings'] });
      syncFromSupabase();
    },
  };
});
