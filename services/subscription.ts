/**
 * Subscription Service — READ-ONLY access to Supabase subscribers table.
 * 
 * SECURITY: This service only READS subscription status.
 * All writes (granting pro, trial, voucher) happen via Edge Functions.
 * The client CANNOT modify subscription data due to RLS policies.
 */

import { ensureAuthSession } from './auth';
import { supabase } from './supabase';

export interface SubscriptionStatus {
    isPro: boolean;
    tier: string;
    source: string | null;
    expiresAt: string | null;
    isActive: boolean;
}

const DEFAULT_STATUS: SubscriptionStatus = {
    isPro: false,
    tier: 'free',
    source: null,
    expiresAt: null,
    isActive: false,
};

/**
 * Check subscription status from Supabase subscribers table (READ-ONLY).
 * 
 * Admin actions (run in Supabase SQL Editor):
 *   Grant trial:   SELECT grant_trial('user-id', 2);
 *   Revoke:        SELECT revoke_subscription('user-id');
 *   View all:      SELECT * FROM subscribers WHERE is_active=true;
 */
export async function checkSubscriptionStatus(): Promise<SubscriptionStatus> {
    await ensureAuthSession();
    const { data, error } = await supabase
        .from('subscribers')
        .select('subscription_tier, subscription_source, is_active, expires_at')
        .maybeSingle();

    if (error) throw new Error(error.message);

    if (!data) return DEFAULT_STATUS;

    // Check if subscription has expired
    if (data.expires_at) {
        const expiryDate = new Date(data.expires_at);
        if (expiryDate < new Date()) {
            return {
                isPro: false,
                tier: 'free',
                source: data.subscription_source || null,
                expiresAt: data.expires_at,
                isActive: false,
            };
        }
    }

    const isPro = data.is_active && data.subscription_tier === 'pro';

    return {
        isPro,
        tier: data.subscription_tier || 'free',
        source: data.subscription_source || null,
        expiresAt: data.expires_at || null,
        isActive: data.is_active || false,
    };
}

/**
 * Get remaining trial days (if on trial).
 */
export function getTrialDaysRemaining(expiresAt: string | null): number {
    if (!expiresAt) return 0;
    const expiry = new Date(expiresAt);
    const now = new Date();
    if (expiry <= now) return 0;
    return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
