/**
 * Supabase Push Notifications Service
 * 
 * Registers the device's Expo push token with Supabase so you can
 * send targeted push notifications from the Supabase Dashboard.
 * 
 * ─── How it works ───
 * 1. On app mount, registerPushToken() gets the Expo push token
 * 2. Stores it in the `push_tokens` table in Supabase
 * 3. A trusted backend sends notifications through Expo's push service
 * 
 * ─── Supabase Setup (run in SQL Editor) ───
 * 
 * CREATE TABLE push_tokens (
 *   id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
 *   user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
 *   push_token text NOT NULL,
 *   platform text DEFAULT 'ios',
 *   updated_at timestamptz DEFAULT now()
 * );
 * 
 * ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
 * Use authenticated ownership policies; never expose all users' tokens.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from './supabase';

/**
 * Get the Expo push token for this device.
 * 
 * An Expo Push Token is a unique address like `ExponentPushToken[xxxxxx]`.
 * Expo's push service uses it to route notifications to Apple (APNs)
 * or Google (FCM) to deliver the actual notification to this device.
 */
async function getExpoPushToken(): Promise<string | null> {
    try {
        // Push tokens only work on physical devices
        if (!Device.isDevice) {
            if (__DEV__) console.log('[Push] Skipped — not a physical device');
            return null;
        }

        // Check/request permissions
        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            if (__DEV__) console.log('[Push] Permission not granted');
            return null;
        }

        // Get the project ID from expo config
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;

        const tokenData = await Notifications.getExpoPushTokenAsync({
            projectId,
        });

        if (__DEV__) console.log('[Push] Token:', tokenData.data);
        return tokenData.data;
    } catch (error) {
        console.warn('[Push] Failed to get push token:', error);
        return null;
    }
}

/**
 * Register this device's push token in Supabase.
 * Call this on app mount after the user has completed onboarding.
 */
export async function registerPushToken(userId: string): Promise<void> {
    try {
        const token = await getExpoPushToken();
        if (!token) return;

        const { error } = await supabase
            .from('push_tokens')
            .upsert(
                {
                    user_id: userId,
                    push_token: token,
                    platform: Platform.OS,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: 'user_id' }
            );

        if (error) {
            console.warn('[Push] Failed to register token:', error.message);
        } else {
            if (__DEV__) console.log('[Push] Token registered for user:', userId);
        }
    } catch (error) {
        console.warn('[Push] registerPushToken error:', error);
    }
}
