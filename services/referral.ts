/**
 * Referral service — generates codes, redeems referrals, grants Pro to both users.
 * Controlled via Supabase remote config (referral_enabled, referral_reward_days).
 *
 * Supabase table setup (run in SQL Editor):
 *   CREATE TABLE referrals (
 *     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
 *     referrer_user_id TEXT NOT NULL,
 *     referral_code TEXT UNIQUE NOT NULL,
 *     referred_user_id TEXT,
 *     redeemed_at TIMESTAMPTZ,
 *     reward_days INTEGER DEFAULT 3,
 *     created_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 *   CREATE INDEX idx_referrals_code ON referrals(referral_code);
 *   CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);
 */

import { supabase } from './supabase';
import { getAppConfig } from './remoteConfig';
import { upsertSubscriber } from './community';

export type ReferralCodeResult =
    | { status: 'success'; code: string }
    | { status: 'disabled' }
    | { status: 'error'; message: string };

/**
 * Generate or get existing referral code for a user.
 * Returns typed result distinguishing disabled vs error vs success.
 */
export async function getOrCreateReferralCode(userId: string): Promise<ReferralCodeResult> {
    if (!userId) return { status: 'error', message: 'No user ID available.' };

    try {
        const config = await getAppConfig();
        if (!config.referral_enabled) return { status: 'disabled' };

        // Check if user already has a code
        const { data: existing, error: fetchError } = await supabase
            .from('referrals')
            .select('referral_code')
            .eq('referrer_user_id', userId)
            .is('referred_user_id', null)
            .limit(1)
            .single();

        if (existing?.referral_code) return { status: 'success', code: existing.referral_code };

        // Table might not exist — detect this specific error
        if (fetchError && fetchError.code === '42P01') {
            return { status: 'error', message: 'Referral system is being set up. Check back soon!' };
        }

        // Generate new code
        const code = `REF-${userId.substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

        const { error } = await supabase
            .from('referrals')
            .insert({
                referrer_user_id: userId,
                referral_code: code,
                reward_days: config.referral_reward_days,
            });

        if (error) {
            console.warn('[Referral] Error creating code:', error.message);
            return { status: 'error', message: 'Could not generate your code. Try again later.' };
        }

        return { status: 'success', code };
    } catch (err: any) {
        console.warn('[Referral] Unexpected error:', err?.message || err);
        return { status: 'error', message: 'Something went wrong. Check your connection.' };
    }
}

/**
 * Redeem a referral code — grants Pro to BOTH referrer and referred user.
 */
export async function redeemReferral(
    code: string,
    newUserId: string
): Promise<{ success: boolean; message: string; rewardDays: number }> {
    if (!code || !newUserId) {
        return { success: false, message: 'Invalid code or user.', rewardDays: 0 };
    }

    try {
        const config = await getAppConfig();
        if (!config.referral_enabled) {
            return { success: false, message: 'Referrals are currently disabled.', rewardDays: 0 };
        }

        // Find the referral
        const { data: referral, error: findError } = await supabase
            .from('referrals')
            .select('*')
            .eq('referral_code', code.toUpperCase().trim())
            .is('referred_user_id', null)
            .single();

        if (findError || !referral) {
            return { success: false, message: 'Invalid or already used referral code.', rewardDays: 0 };
        }

        // Can't refer yourself
        if (referral.referrer_user_id === newUserId) {
            return { success: false, message: "You can't use your own referral code.", rewardDays: 0 };
        }

        const rewardDays = referral.reward_days || config.referral_reward_days;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + rewardDays);
        const expiresAtStr = expiresAt.toISOString();

        // Mark referral as redeemed
        await supabase
            .from('referrals')
            .update({
                referred_user_id: newUserId,
                redeemed_at: new Date().toISOString(),
            })
            .eq('id', referral.id);

        // Grant Pro to referred user (new user)
        await upsertSubscriber({
            userId: newUserId,
            tier: 'pro',
            source: 'referral',
            expiresAt: expiresAtStr,
        });

        // Grant/extend Pro for referrer
        const { data: referrerSub } = await supabase
            .from('subscribers')
            .select('expires_at, is_active')
            .eq('user_id', referral.referrer_user_id)
            .single();

        const referrerExpiry = new Date(
            referrerSub?.is_active && referrerSub?.expires_at
                ? new Date(referrerSub.expires_at).getTime()
                : Date.now()
        );
        referrerExpiry.setDate(referrerExpiry.getDate() + rewardDays);

        await upsertSubscriber({
            userId: referral.referrer_user_id,
            tier: 'pro',
            source: 'referral_reward',
            expiresAt: referrerExpiry.toISOString(),
        });

        // Create a new referral slot for the referrer
        const newCode = `REF-${referral.referrer_user_id.substring(0, 4).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        await supabase.from('referrals').insert({
            referrer_user_id: referral.referrer_user_id,
            referral_code: newCode,
            reward_days: rewardDays,
        });

        return {
            success: true,
            message: `Welcome! You and your friend both got ${rewardDays} days of Pro.`,
            rewardDays,
        };
    } catch (err) {
        console.warn('[Referral] Redemption error:', err);
        return { success: false, message: 'Something went wrong. Please try again.', rewardDays: 0 };
    }
}

/**
 * Get referral stats for a user.
 */
export async function getReferralStats(userId: string): Promise<{
    totalReferred: number;
    totalDaysEarned: number;
}> {
    if (!userId) return { totalReferred: 0, totalDaysEarned: 0 };

    try {
        const { data, error } = await supabase
            .from('referrals')
            .select('reward_days')
            .eq('referrer_user_id', userId)
            .not('referred_user_id', 'is', null);

        if (error || !data) return { totalReferred: 0, totalDaysEarned: 0 };

        return {
            totalReferred: data.length,
            totalDaysEarned: data.reduce((sum, r) => sum + (r.reward_days || 3), 0),
        };
    } catch (err: any) {
        console.warn('[Referral] Stats error:', err?.message || err);
        return { totalReferred: 0, totalDaysEarned: 0 };
    }
}
