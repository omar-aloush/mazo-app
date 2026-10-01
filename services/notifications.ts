/**
 * Notification service — local push notifications for habits, streaks, and engagement.
 * 
 * Works in Expo Go for basic local notifications.
 * Full push notification support requires a development build.
 */

import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ── Storage Keys ───────────────────────────────────────
const NOTIF_PREF_KEY = 'mazo_notification_prefs';
const HABIT_NOTIF_PREFIX = 'mazo_habit_notif_';
const DAILY_CHECKIN_KEY = 'mazo_daily_checkin_notif';
const PERMISSION_ASKED_KEY = 'mazo_notif_permission_asked';

// ── Types ──────────────────────────────────────────────
export interface NotificationPreferences {
    dailyCheckinEnabled: boolean;
    dailyCheckinHour: number; // 0-23, default 9
    habitRemindersEnabled: boolean;
    streakAlertsEnabled: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
    dailyCheckinEnabled: true,
    dailyCheckinHour: 9,
    habitRemindersEnabled: true,
    streakAlertsEnabled: true,
};

// ── Streak-aware motivational messages ─────────────────
const CHECKIN_MESSAGES = [
    { title: '🌅 New day, new clarity', body: 'What\'s the one thing that matters most today?' },
    { title: '💪 Ready to level up?', body: 'Your AI coach is ready when you are.' },
    { title: '🧠 Quick thought exercise', body: 'Take 2 minutes to think clearly about your day.' },
    { title: '🎯 Focus check', body: 'What would make today a win? Let\'s figure it out.' },
    { title: '⚡ Momentum builder', body: 'Small wins compound. Start with one.' },
    { title: '🌟 Your potential awaits', body: 'A quick coaching session can change your whole day.' },
    { title: '🔥 Keep the streak alive!', body: 'Don\'t break your coaching streak — open Mazō.' },
];

const STREAK_MESSAGES: Record<number, { title: string; body: string }> = {
    3: { title: '🔥 3-day streak!', body: 'You\'re building a coaching habit. Keep it going!' },
    7: { title: '🏆 1 week streak!', body: 'A full week of intentional thinking. Impressive.' },
    14: { title: '⭐ 2 weeks strong!', body: 'You\'re in the top 5% of consistency. Incredible.' },
    30: { title: '👑 30-day streak!', body: 'A full month of coaching. You\'re unstoppable.' },
    60: { title: '💎 60 days!', body: 'Two months of clarity. You\'ve transformed your thinking.' },
    100: { title: '🏅 100-day legend!', body: 'You\'ve reached legendary status. Simply amazing.' },
};

// ── Configure notification handler ─────────────────────
export function configureNotifications() {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldPlaySound: true,
            shouldSetBadge: true,
            shouldShowBanner: true,
            shouldShowList: true,
        }),
    });
    // Ensure Android channels exist on every launch (Android 8+ drops channelless
    // notifications). Idempotent and fire-and-forget.
    void ensureNotificationChannels();
}

/**
 * Create the Android notification channels Mazō schedules onto. Idempotent —
 * safe to call on every launch and before any schedule. No-op on iOS.
 */
export async function ensureNotificationChannels(): Promise<void> {
    if (Platform.OS !== 'android') return;
    // Default channel for general notifications + agent reminders
    await Notifications.setNotificationChannelAsync('default', {
        name: 'Mazō',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#6C5CE7',
    });
    // Dedicated alarm channel — MAX priority, bypasses DND, shows on lock screen
    await Notifications.setNotificationChannelAsync('mazo-alarms', {
        name: 'Mazō Alarms',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 500, 300, 500, 300, 500],
        lightColor: '#6C5CE7',
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        enableVibrate: true,
        enableLights: true,
        sound: 'default',
    });
    // Task & reminder channel
    await Notifications.setNotificationChannelAsync('mazo-tasks', {
        name: 'Mazō Task Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 200, 100, 200],
        lightColor: '#7C9A82',
    });
}

// ── Permission Management ──────────────────────────────

/** Check if we already have notification permission */
export async function hasNotificationPermission(): Promise<boolean> {
    if (!Device.isDevice) return false;
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
}

/** Check if we've already asked (for soft-ask flow) */
export async function hasAskedPermission(): Promise<boolean> {
    const asked = await AsyncStorage.getItem(PERMISSION_ASKED_KEY);
    return asked === 'true';
}

/** Request notification permissions (call after user taps "Enable") */
export async function requestPermissions(): Promise<boolean> {
    if (!Device.isDevice) {
        if (__DEV__) console.log('[Notifications] Not a physical device, skipping permission request');
        return false;
    }

    await AsyncStorage.setItem(PERMISSION_ASKED_KEY, 'true');

    await ensureNotificationChannels();

    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
}

// ── Preference Management ──────────────────────────────

export async function getNotificationPrefs(): Promise<NotificationPreferences> {
    try {
        const stored = await AsyncStorage.getItem(NOTIF_PREF_KEY);
        if (stored) return { ...DEFAULT_PREFS, ...JSON.parse(stored) };
    } catch (err: any) {
        console.warn('[Notifications] Failed to load prefs:', err?.message || err);
    }
    return DEFAULT_PREFS;
}

export async function saveNotificationPrefs(prefs: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const current = await getNotificationPrefs();
    const updated = { ...current, ...prefs };
    await AsyncStorage.setItem(NOTIF_PREF_KEY, JSON.stringify(updated));
    return updated;
}

// ── Daily Check-in ─────────────────────────────────────

/** Schedule the daily coaching check-in notification */
export async function scheduleDailyCheckin(hour: number = 9, customBody?: string): Promise<void> {
    try {
        // Cancel existing first
        await cancelDailyCheckin();

        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        // Pick a random message (will rotate daily), or use custom personalized body
        const msg = CHECKIN_MESSAGES[Math.floor(Math.random() * CHECKIN_MESSAGES.length)];

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: msg.title,
                body: customBody || msg.body,
                data: { type: 'daily_checkin', screen: 'chat' },
                sound: true,
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute: 0,
            },
        });

        await AsyncStorage.setItem(DAILY_CHECKIN_KEY, id);
        if (__DEV__) console.log('[Notifications] Daily check-in scheduled at', hour, '— id:', id);
    } catch (err: any) {
        console.warn('[Notifications] Failed to schedule daily check-in:', err?.message || err);
    }
}

/** Cancel the daily check-in notification */
export async function cancelDailyCheckin(): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(DAILY_CHECKIN_KEY);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id);
            await AsyncStorage.removeItem(DAILY_CHECKIN_KEY);
        }
    } catch (err: any) {
        console.warn('[Notifications] Failed to cancel daily check-in:', err?.message || err);
    }
}

// ── Habit Reminders ────────────────────────────────────

/** Schedule a reminder for a specific habit */
export async function scheduleHabitReminder(
    habitId: string,
    habitTitle: string,
    frequency: 'daily' | 'weekly' | 'monthly',
    hour: number = 8,
): Promise<void> {
    try {
        await cancelHabitReminder(habitId);

        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        const prefs = await getNotificationPrefs();
        if (!prefs.habitRemindersEnabled) return;

        let trigger: Notifications.NotificationTriggerInput;

        if (frequency === 'daily') {
            trigger = {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute: 0,
            };
        } else if (frequency === 'weekly') {
            trigger = {
                type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
                weekday: 1, // Monday
                hour,
                minute: 0,
            };
        } else {
            // Monthly — use daily and check in handler (expo doesn't support monthly natively)
            trigger = {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour,
                minute: 0,
            };
        }

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: '📋 Habit Reminder',
                body: `Time for: ${habitTitle}`,
                data: { type: 'habit_reminder', habitId, screen: 'system' },
                sound: true,
            },
            trigger,
        });

        await AsyncStorage.setItem(`${HABIT_NOTIF_PREFIX}${habitId}`, id);
        if (__DEV__) console.log('[Notifications] Habit reminder scheduled for:', habitTitle);
    } catch (err: any) {
        console.warn('[Notifications] Failed to schedule habit reminder:', err?.message || err);
    }
}

/** Cancel a specific habit reminder */
export async function cancelHabitReminder(habitId: string): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(`${HABIT_NOTIF_PREFIX}${habitId}`);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id);
            await AsyncStorage.removeItem(`${HABIT_NOTIF_PREFIX}${habitId}`);
        }
    } catch (err: any) {
        console.warn('[Notifications] Failed to cancel habit reminder:', err?.message || err);
    }
}

// ── Streak Milestone Notifications ─────────────────────

/** Send an immediate notification for a streak milestone */
export async function sendStreakMilestoneNotification(streakCount: number): Promise<void> {
    try {
        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        const prefs = await getNotificationPrefs();
        if (!prefs.streakAlertsEnabled) return;

        const msg = STREAK_MESSAGES[streakCount];
        if (!msg) return; // Not a milestone

        await Notifications.scheduleNotificationAsync({
            content: {
                title: msg.title,
                body: msg.body,
                data: { type: 'streak_milestone', streak: streakCount, screen: 'system' },
                sound: true,
            },
            trigger: null, // Immediate
        });
    } catch (err: any) {
        console.warn('[Notifications] Failed to send streak notification:', err?.message || err);
    }
}

// ── Task Reminder Notifications ────────────────────────

const TASK_NOTIF_PREFIX = 'mazo_task_notif_';
const GOAL_NOTIF_KEY = 'mazo_goal_reminder_notif';

const TASK_NUDGE_MESSAGES = [
    { title: '📋 Mazō: Task waiting', body: 'You set out to do: "{{title}}" — ready to start?' },
    { title: '📋 Mazō nudge', body: '"{{title}}" is still on your list. Want to knock it out?' },
    { title: '📋 Hey! Don\'t forget', body: 'Mazō remembers: "{{title}}". You got this 💪' },
    { title: '📋 Mazō reminder', body: '"{{title}}" — small progress is still progress!' },
];

const MORNING_TASK_MESSAGES = [
    { title: '🌅 Mazō: Today\'s tasks', body: 'You have {{count}} pending tasks. Let\'s make today count!' },
    { title: '🌅 Good morning!', body: '{{count}} tasks are waiting. Which one will you tackle first?' },
    { title: '🌅 Mazō says:', body: 'Start strong — you have {{count}} things to do today.' },
];

const GOAL_NUDGE_MESSAGES = [
    { title: '🎯 Mazō: Your North Star', body: 'Remember your goal: "{{title}}". What did you do today to move closer?' },
    { title: '🎯 Big picture check', body: '"{{title}}" — every small step counts toward your dream.' },
    { title: '🎯 Mazō evening check', body: 'Did you move toward "{{title}}" today? Even 1% counts.' },
];

/**
 * Schedule task reminders:
 * 1) Gentle nudge 2 hours after task creation
 * 2) Morning summary nudge at 9 AM next day
 */
export async function scheduleTaskReminder(taskId: string, taskTitle: string): Promise<void> {
    try {
        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        // Cancel existing reminders for this task
        await cancelTaskReminder(taskId);

        const msg = TASK_NUDGE_MESSAGES[Math.floor(Math.random() * TASK_NUDGE_MESSAGES.length)];

        // 1) Nudge in 2 hours
        const nudgeId = await Notifications.scheduleNotificationAsync({
            content: {
                title: msg.title,
                body: msg.body.replace('{{title}}', taskTitle),
                data: { type: 'task_reminder', taskId, screen: 'system' },
                sound: true,
                ...(Platform.OS === 'android' && { channelId: 'mazo-tasks' }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
                seconds: 2 * 60 * 60, // 2 hours
                channelId: Platform.OS === 'android' ? 'mazo-tasks' : undefined,
            } as any,
        });

        await AsyncStorage.setItem(`${TASK_NOTIF_PREFIX}${taskId}_nudge`, nudgeId);
        if (__DEV__) console.log('[Notifications] Task nudge scheduled for:', taskTitle);
    } catch (err: any) {
        console.warn('[Notifications] Failed to schedule task reminder:', err?.message || err);
    }
}

/** Cancel all reminders for a specific task */
export async function cancelTaskReminder(taskId: string): Promise<void> {
    try {
        const nudgeId = await AsyncStorage.getItem(`${TASK_NOTIF_PREFIX}${taskId}_nudge`);
        if (nudgeId) {
            await Notifications.cancelScheduledNotificationAsync(nudgeId);
            await AsyncStorage.removeItem(`${TASK_NOTIF_PREFIX}${taskId}_nudge`);
        }
        if (__DEV__) console.log('[Notifications] Task reminders cancelled for:', taskId);
    } catch (err: any) {
        console.warn('[Notifications] Failed to cancel task reminder:', err?.message || err);
    }
}

/**
 * Schedule a morning task summary notification.
 * Shows how many pending tasks the user has at 9 AM.
 */
export async function scheduleMorningTaskSummary(pendingCount: number): Promise<void> {
    try {
        if (pendingCount <= 0) return;
        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        // Cancel previous morning summary
        const existingId = await AsyncStorage.getItem(`${TASK_NOTIF_PREFIX}morning`);
        if (existingId) {
            await Notifications.cancelScheduledNotificationAsync(existingId).catch(() => {});
        }

        const msg = MORNING_TASK_MESSAGES[Math.floor(Math.random() * MORNING_TASK_MESSAGES.length)];

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: msg.title,
                body: msg.body.replace('{{count}}', String(pendingCount)),
                data: { type: 'morning_tasks', screen: 'system' },
                sound: true,
                ...(Platform.OS === 'android' && { channelId: 'mazo-tasks' }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: 9,
                minute: 0,
                channelId: Platform.OS === 'android' ? 'mazo-tasks' : undefined,
            } as any,
        });

        await AsyncStorage.setItem(`${TASK_NOTIF_PREFIX}morning`, id);
        if (__DEV__) console.log('[Notifications] Morning task summary scheduled, count:', pendingCount);
    } catch (err: any) {
        console.warn('[Notifications] Failed to schedule morning summary:', err?.message || err);
    }
}

// ── Goal Reminder Notifications ────────────────────────

/**
 * Schedule a daily 8 PM goal reminder for the user's #1 long-term goal.
 * "Remember your goal: [title]. What did you do today?"
 */
export async function scheduleGoalReminder(goalTitle: string): Promise<void> {
    try {
        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        // Cancel previous
        await cancelGoalReminder();

        const msg = GOAL_NUDGE_MESSAGES[Math.floor(Math.random() * GOAL_NUDGE_MESSAGES.length)];

        const id = await Notifications.scheduleNotificationAsync({
            content: {
                title: msg.title,
                body: msg.body.replace('{{title}}', goalTitle),
                data: { type: 'goal_reminder', screen: 'system' },
                sound: true,
                ...(Platform.OS === 'android' && { channelId: 'mazo-tasks' }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DAILY,
                hour: 20, // 8 PM
                minute: 0,
                channelId: Platform.OS === 'android' ? 'mazo-tasks' : undefined,
            } as any,
        });

        await AsyncStorage.setItem(GOAL_NOTIF_KEY, id);
        if (__DEV__) console.log('[Notifications] Goal reminder scheduled for:', goalTitle);
    } catch (err: any) {
        console.warn('[Notifications] Failed to schedule goal reminder:', err?.message || err);
    }
}

/** Cancel the daily goal reminder */
export async function cancelGoalReminder(): Promise<void> {
    try {
        const id = await AsyncStorage.getItem(GOAL_NOTIF_KEY);
        if (id) {
            await Notifications.cancelScheduledNotificationAsync(id);
            await AsyncStorage.removeItem(GOAL_NOTIF_KEY);
        }
    } catch (err: any) {
        console.warn('[Notifications] Failed to cancel goal reminder:', err?.message || err);
    }
}

// ── Focus Timer Break Notification ─────────────────────

/**
 * Send an immediate notification when a focus break starts.
 * Also plays the default notification sound.
 */
export async function sendFocusBreakNotification(taskName: string, breakMinutes: number): Promise<void> {
    try {
        const hasPermission = await hasNotificationPermission();
        if (!hasPermission) return;

        await Notifications.scheduleNotificationAsync({
            content: {
                title: '☕ Mazō: Break Time!',
                body: `Great work on "${taskName}"! Take ${breakMinutes} minutes to stretch, breathe, and reset.`,
                data: { type: 'focus_break', screen: 'chat' },
                sound: true,
                ...(Platform.OS === 'android' && { channelId: 'default' }),
            },
            trigger: null, // Immediate
        });

        if (__DEV__) console.log('[Notifications] Focus break notification sent');
    } catch (err: any) {
        console.warn('[Notifications] Failed to send break notification:', err?.message || err);
    }
}

// ── Utility ────────────────────────────────────────────

/** Cancel all Mazō notifications */
export async function cancelAllNotifications(): Promise<void> {
    try {
        await Notifications.cancelAllScheduledNotificationsAsync();
        await AsyncStorage.removeItem(DAILY_CHECKIN_KEY);
        if (__DEV__) console.log('[Notifications] All notifications cancelled');
    } catch (err: any) {
        console.warn('[Notifications] Failed to cancel all:', err?.message || err);
    }
}

/** Get count of scheduled notifications */
export async function getScheduledCount(): Promise<number> {
    try {
        const scheduled = await Notifications.getAllScheduledNotificationsAsync();
        return scheduled.length;
    } catch {
        return 0;
    }
}
