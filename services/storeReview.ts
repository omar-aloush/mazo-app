/**
 * Store Review service — prompts users to rate the app at the right moments.
 * Uses expo-store-review for native App Store / Play Store review dialogs.
 * 
 * Rate-limited: max once per 30 days, and only after meaningful moments.
 */

import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAST_REVIEW_KEY = 'mazo_last_review_prompt';
const REVIEW_COUNT_KEY = 'mazo_review_prompt_count';
const MIN_DAYS_BETWEEN = 30;

type ReviewTrigger = 'breakthrough' | 'streak_7' | 'streak_14' | 'streak_30' | 'session_5' | 'task_complete_5';

/**
 * Maybe request an App Store review. Returns true if the prompt was shown.
 * 
 * Conditions:
 * - StoreReview must be available on this platform
 * - At least 30 days since last prompt
 * - Max 3 prompts ever (Apple guideline)
 */
export async function maybeRequestReview(trigger: ReviewTrigger): Promise<boolean> {
    try {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) {
            if (__DEV__) console.log('[StoreReview] Not available on this platform');
            return false;
        }

        // Check rate limiting
        const lastPrompt = await AsyncStorage.getItem(LAST_REVIEW_KEY);
        if (lastPrompt) {
            const daysSince = (Date.now() - parseInt(lastPrompt, 10)) / (1000 * 60 * 60 * 24);
            if (daysSince < MIN_DAYS_BETWEEN) {
                if (__DEV__) console.log('[StoreReview] Too soon, last prompt was', Math.round(daysSince), 'days ago');
                return false;
            }
        }

        // Check total count (Apple limits to ~3 per year)
        const countStr = await AsyncStorage.getItem(REVIEW_COUNT_KEY);
        const count = countStr ? parseInt(countStr, 10) : 0;
        if (count >= 3) {
            if (__DEV__) console.log('[StoreReview] Max prompts reached:', count);
            return false;
        }

        // Show the review prompt
        await StoreReview.requestReview();

        // Track it
        await AsyncStorage.setItem(LAST_REVIEW_KEY, Date.now().toString());
        await AsyncStorage.setItem(REVIEW_COUNT_KEY, (count + 1).toString());

        if (__DEV__) console.log('[StoreReview] Review prompted for trigger:', trigger);
        return true;
    } catch (err: any) {
        console.warn('[StoreReview] Failed to request review:', err?.message || err);
        return false;
    }
}

/** Check if a review can potentially be shown (for UI purposes) */
export async function canShowReview(): Promise<boolean> {
    try {
        const isAvailable = await StoreReview.isAvailableAsync();
        if (!isAvailable) return false;

        const lastPrompt = await AsyncStorage.getItem(LAST_REVIEW_KEY);
        if (lastPrompt) {
            const daysSince = (Date.now() - parseInt(lastPrompt, 10)) / (1000 * 60 * 60 * 24);
            if (daysSince < MIN_DAYS_BETWEEN) return false;
        }

        const countStr = await AsyncStorage.getItem(REVIEW_COUNT_KEY);
        const count = countStr ? parseInt(countStr, 10) : 0;
        return count < 3;
    } catch {
        return false;
    }
}

/** Open the app's store page directly (for a "Rate Us" button in settings) */
export async function openStorePage(): Promise<void> {
    try {
        const hasAction = await StoreReview.hasAction();
        if (hasAction) {
            await StoreReview.requestReview();
        }
    } catch (err: any) {
        console.warn('[StoreReview] Failed to open store page:', err?.message || err);
    }
}
