/**
 * Share Service — generates organic share moments with embedded referral codes.
 * Creates natural viral loops at breakthrough, streak, and goal-complete moments.
 */

import { Share, Platform } from 'react-native';
import { track } from './analytics';

const APP_LINK = Platform.select({
    ios: 'https://apps.apple.com/app/mazo/id0000000000',
    android: 'https://play.google.com/store/apps/details?id=com.mazo.app',
    default: 'https://mazo.app',
});

function buildShareLink(referralCode: string | null): string {
    if (referralCode) {
        return `${APP_LINK} (Use code: ${referralCode})`;
    }
    return APP_LINK;
}

/**
 * Share a streak milestone achievement.
 */
export async function shareStreakMilestone(
    streakCount: number,
    referralCode: string | null,
    t: (key: string, params?: Record<string, string | number>) => string,
): Promise<boolean> {
    const link = buildShareLink(referralCode);
    const message = t('shareMoment.streakMessage', {
        count: streakCount,
        link,
    });

    try {
        const result = await Share.share({ message });
        const shared = result.action === Share.sharedAction;
        track('share_streak', { streak: streakCount, shared });
        return shared;
    } catch {
        return false;
    }
}

/**
 * Share a breakthrough insight.
 */
export async function shareBreakthrough(
    insight: string,
    referralCode: string | null,
    t: (key: string, params?: Record<string, string | number>) => string,
): Promise<boolean> {
    const link = buildShareLink(referralCode);
    const message = t('shareMoment.breakthroughMessage', {
        insight,
        link,
    });

    try {
        const result = await Share.share({ message });
        const shared = result.action === Share.sharedAction;
        track('share_breakthrough', { shared });
        return shared;
    } catch {
        return false;
    }
}

/**
 * Share a goal completion.
 */
export async function shareGoalComplete(
    goalTitle: string,
    referralCode: string | null,
    t: (key: string, params?: Record<string, string | number>) => string,
): Promise<boolean> {
    const link = buildShareLink(referralCode);
    const message = t('shareMoment.goalMessage', {
        goal: goalTitle,
        link,
    });

    try {
        const result = await Share.share({ message });
        const shared = result.action === Share.sharedAction;
        track('share_goal', { goal: goalTitle, shared });
        return shared;
    } catch {
        return false;
    }
}
