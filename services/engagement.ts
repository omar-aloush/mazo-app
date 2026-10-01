/**
 * Engagement service — smart paywall triggers + streak management.
 * All features respect Supabase remote config flags.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAppConfig } from './remoteConfig';

const TRIGGER_PREFIX = 'mazo_paywall_trigger_';

export type PaywallTrigger = 'breakthrough' | 'session_3' | 'task_complete' | 'streak_milestone';

export interface PaywallTriggerResult {
    show: boolean;
    trigger: PaywallTrigger;
    message: string;
    subtitle: string;
}

const TRIGGER_MESSAGES: Record<PaywallTrigger, { message: string; subtitle: string }> = {
    breakthrough: {
        message: 'You just had a breakthrough!',
        subtitle: 'Unlock unlimited sessions to keep this momentum going.',
    },
    session_3: {
        message: "You're getting real value",
        subtitle: "3 sessions in — imagine what unlimited coaching could do.",
    },
    task_complete: {
        message: 'Action taker! 💪',
        subtitle: 'You turned thinking into doing. Unlock unlimited coaching to keep going.',
    },
    streak_milestone: {
        message: 'Streak milestone! 🔥',
        subtitle: "You're building a coaching habit. Go Pro to supercharge it.",
    },
};

/**
 * Check if a smart paywall trigger should fire.
 * Each trigger only fires ONCE per user (tracked via AsyncStorage).
 */
export async function shouldShowSmartPaywall(
    trigger: PaywallTrigger,
    localTriggers: Record<string, boolean>
): Promise<PaywallTriggerResult | null> {
    try {
        const config = await getAppConfig();
        if (!config.smart_paywall_enabled) return null;

        // Check if already triggered locally
        if (localTriggers[trigger]) return null;

        // Double-check with AsyncStorage (in case state was reset)
        const key = `${TRIGGER_PREFIX}${trigger}`;
        const stored = await AsyncStorage.getItem(key);
        if (stored === 'true') return null;

        return {
            show: true,
            trigger,
            ...TRIGGER_MESSAGES[trigger],
        };
    } catch (err: any) {
        console.warn('[Engagement] Paywall check failed:', err?.message || err);
        return null;
    }
}

/**
 * Mark a trigger as fired so it won't show again.
 */
export async function markTriggerFired(trigger: PaywallTrigger): Promise<void> {
    try {
        const key = `${TRIGGER_PREFIX}${trigger}`;
        await AsyncStorage.setItem(key, 'true');
    } catch (err: any) {
        console.warn('[Engagement] Mark trigger failed:', err?.message || err);
    }
}

/**
 * Update streak and return new streak data.
 */
export function calculateStreak(current: {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    totalSessions: number;
}): {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;
    totalSessions: number;
    isNewDay: boolean;
    milestoneReached: number | null;
} {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    if (current.lastActiveDate === today) {
        return { ...current, isNewDay: false, milestoneReached: null };
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    let newStreak: number;
    if (current.lastActiveDate === yesterdayStr) {
        newStreak = current.currentStreak + 1;
    } else {
        newStreak = 1; // streak broken
    }

    const newLongest = Math.max(newStreak, current.longestStreak);
    const newTotal = current.totalSessions + 1;

    // Check for milestone
    const milestones = [3, 7, 14, 30, 60, 100];
    const milestoneReached = milestones.includes(newStreak) ? newStreak : null;

    return {
        currentStreak: newStreak,
        longestStreak: newLongest,
        lastActiveDate: today,
        totalSessions: newTotal,
        isNewDay: true,
        milestoneReached,
    };
}
