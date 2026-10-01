/**
 * Remote config — fetches feature flags from Supabase `app_config` table.
 * 
 * Supabase table setup (run in SQL Editor):
 *   CREATE TABLE app_config (
 *     key TEXT PRIMARY KEY,
 *     value JSONB NOT NULL,
 *     updated_at TIMESTAMPTZ DEFAULT NOW()
 *   );
 * 
 * Insert defaults:
 *   INSERT INTO app_config (key, value) VALUES
 *     ('trial_enabled', 'true'),
 *     ('trial_days', '7'),
 *     ('referral_enabled', 'true'),
 *     ('referral_reward_days', '3'),
 *     ('smart_paywall_enabled', 'true'),
 *     ('streak_enabled', 'true'),
 *     ('streak_milestones', '[3, 7, 14, 30]');
 * 
 * To change any config:
 *   UPDATE app_config SET value = '3', updated_at = NOW() WHERE key = 'trial_days';
 *   UPDATE app_config SET value = 'false', updated_at = NOW() WHERE key = 'referral_enabled';
 */

import { supabase } from './supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

const CONFIG_CACHE_KEY = 'mazo_app_config';
const CONFIG_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export interface AppConfig {
    trial_enabled: boolean;
    trial_days: number;
    referral_enabled: boolean;
    referral_reward_days: number;
    smart_paywall_enabled: boolean;
    streak_enabled: boolean;
    streak_milestones: number[];
}

const DEFAULT_CONFIG: AppConfig = {
    trial_enabled: true,
    trial_days: 7,
    referral_enabled: true,
    referral_reward_days: 3,
    smart_paywall_enabled: true,
    streak_enabled: true,
    streak_milestones: [3, 7, 14, 30],
};

let cachedConfig: AppConfig | null = null;
let lastFetchTime = 0;

/**
 * Fetch remote config from Supabase.
 * Caches locally for 10 minutes + persists to AsyncStorage for offline use.
 */
export async function getAppConfig(): Promise<AppConfig> {
    // Return cache if fresh
    if (cachedConfig && Date.now() - lastFetchTime < CONFIG_CACHE_TTL) {
        return cachedConfig;
    }

    try {
        const { data, error } = await supabase
            .from('app_config')
            .select('key, value');

        if (error || !data || data.length === 0) {
            // Fall back to local cache
            return loadCachedConfig();
        }

        const config = { ...DEFAULT_CONFIG };
        for (const row of data) {
            const val = row.value;
            switch (row.key) {
                case 'trial_enabled':
                    config.trial_enabled = val === true || val === 'true';
                    break;
                case 'trial_days':
                    config.trial_days = typeof val === 'number' ? val : parseInt(String(val), 10) || 7;
                    break;
                case 'referral_enabled':
                    config.referral_enabled = val === true || val === 'true';
                    break;
                case 'referral_reward_days':
                    config.referral_reward_days = typeof val === 'number' ? val : parseInt(String(val), 10) || 3;
                    break;
                case 'smart_paywall_enabled':
                    config.smart_paywall_enabled = val === true || val === 'true';
                    break;
                case 'streak_enabled':
                    config.streak_enabled = val === true || val === 'true';
                    break;
                case 'streak_milestones':
                    config.streak_milestones = Array.isArray(val) ? val : DEFAULT_CONFIG.streak_milestones;
                    break;
            }
        }

        cachedConfig = config;
        lastFetchTime = Date.now();

        // Persist for offline use
        AsyncStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config)).catch(() => { });

        return config;
    } catch (err: any) {
        console.warn('[RemoteConfig] Fetch failed, using cache:', err?.message || err);
        return loadCachedConfig();
    }
}

async function loadCachedConfig(): Promise<AppConfig> {
    if (cachedConfig) return cachedConfig;
    try {
        const stored = await AsyncStorage.getItem(CONFIG_CACHE_KEY);
        if (stored) {
            cachedConfig = { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
            return cachedConfig as AppConfig;
        }
    } catch (err: any) {
        console.warn('[RemoteConfig] Cache parse failed:', err?.message || err);
    }
    return DEFAULT_CONFIG;
}
