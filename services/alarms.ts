/**
 * Alarm Scheduling Service
 *
 * Handles scheduling, cancelling, and rescheduling alarms
 * using expo-notifications scheduled triggers.
 * Uses dedicated 'mazo-alarms' channel for lock-screen + DND bypass on Android.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { Alarm } from '@/types';

// Web fallback: store timeout IDs so we can cancel them
const webAlarmTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── Mazo alarm personality ───────────────────────────────

const MAZO_WAKE_MESSAGES = [
  { title: '⏰ Mazō: Wake up!', body: '☀️ Rise and shine! Time for: {{label}}' },
  { title: '⏰ Mazō is calling!', body: '🌅 Good morning! Don\'t forget: {{label}}' },
  { title: '⏰ Hey! Mazō here!', body: '💪 Time to get moving! {{label}}' },
  { title: '⏰ Mazō says: GET UP!', body: '🔥 Your future self will thank you! {{label}}' },
  { title: '⏰ Mazō Alarm!', body: '🚀 No snooze! Let\'s go — {{label}}' },
];

const MAZO_AFTERNOON_MESSAGES = [
  { title: '⏰ Mazō Reminder', body: '📋 Hey! Don\'t forget: {{label}}' },
  { title: '⏰ Mazō nudge', body: '🎯 Time for: {{label}} — you got this!' },
  { title: '⏰ Mazō says:', body: '⚡ Reminder: {{label}}' },
];

const MAZO_EVENING_MESSAGES = [
  { title: '⏰ Mazō Evening', body: '🌙 Reminder before you rest: {{label}}' },
  { title: '⏰ Mazō says goodnight', body: '✨ Last thing: {{label}}' },
];

function getMazoAlarmMessage(hour: number, label: string): { title: string; body: string } {
  let pool: typeof MAZO_WAKE_MESSAGES;
  if (hour >= 5 && hour < 12) {
    pool = MAZO_WAKE_MESSAGES;
  } else if (hour >= 12 && hour < 18) {
    pool = MAZO_AFTERNOON_MESSAGES;
  } else {
    pool = MAZO_EVENING_MESSAGES;
  }
  const entry = pool[Math.floor(Math.random() * pool.length)];
  return {
    title: entry.title,
    body: entry.body.replace('{{label}}', label),
  };
}

// ── Schedule a single alarm notification ─────────────────

export async function scheduleAlarm(alarm: Alarm): Promise<string | null> {
  // Cancel existing if present
  if (alarm.notificationId) {
    await cancelAlarm(alarm.notificationId);
  }

  if (Platform.OS === 'web') {
    // Web fallback: use setTimeout to fire alarm
    const safeH = typeof alarm.hour === 'number' && !isNaN(alarm.hour) ? alarm.hour : 7;
    const safeM = typeof alarm.minute === 'number' && !isNaN(alarm.minute) ? alarm.minute : 0;
    const now = new Date();
    const target = new Date();
    target.setHours(safeH, safeM, 0, 0);
    if (target <= now) {
      target.setDate(target.getDate() + 1);
    }
    const delay = target.getTime() - now.getTime();
    const webId = `web-alarm-${alarm.id}`;

    const existing = webAlarmTimers.get(webId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(() => {
      const msg = getMazoAlarmMessage(alarm.hour, alarm.label);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(msg.title, { body: msg.body });
      }
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('mazo-alarm-fire', {
          detail: { alarmId: alarm.id, soundId: alarm.soundId },
        }));
      }
      webAlarmTimers.delete(webId);
    }, delay);

    webAlarmTimers.set(webId, timer);
    if (__DEV__) console.log('[Alarms] Web alarm scheduled in', Math.round(delay / 1000), 'seconds');
    return webId;
  }

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') {
      const { status: newStatus } = await Notifications.requestPermissionsAsync();
      if (newStatus !== 'granted') return null;
    }

    const msg = getMazoAlarmMessage(alarm.hour, alarm.label);
    const isOneTime = alarm.days.length === 0;

    // Common notification content — Mazo-branded with MAX priority
    const notificationContent: Notifications.NotificationContentInput = {
      title: msg.title,
      body: msg.body,
      data: { type: 'alarm', alarmId: alarm.id, soundId: alarm.soundId },
      sound: true,
      priority: Notifications.AndroidNotificationPriority.MAX,
      // Android-specific: use dedicated alarm channel + sticky notification
      ...(Platform.OS === 'android' && {
        channelId: 'mazo-alarms',
        sticky: true, // Keep in notification bar until dismissed
      }),
    };

    if (isOneTime) {
      const now = new Date();
      const target = new Date();
      target.setHours(alarm.hour, alarm.minute, 0, 0);
      if (target <= now) {
        target.setDate(target.getDate() + 1);
      }

      const id = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: target,
          channelId: 'mazo-alarms',
        },
      });

      if (__DEV__) console.log('[Alarms] One-time alarm scheduled:', id, 'at', target.toISOString());
      return id;
    } else {
      // Recurring: schedule for each day of the week
      const ids: string[] = [];
      for (const day of alarm.days) {
        const id = await Notifications.scheduleNotificationAsync({
          content: notificationContent,
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
            weekday: day + 1, // expo uses 1-indexed (1=Sunday)
            hour: alarm.hour,
            minute: alarm.minute,
            channelId: 'mazo-alarms',
          },
        });
        ids.push(id);
      }

      // Store ALL IDs joined so cancelAlarm can remove them all
      const combinedId = ids.join(',');
      if (__DEV__) console.log('[Alarms] Recurring alarm scheduled:', ids.length, 'days, IDs:', combinedId);
      return combinedId;
    }
  } catch (err: any) {
    console.warn('[Alarms] Failed to schedule alarm:', err?.message || err);
    return null;
  }
}

/**
 * Cancel a scheduled alarm notification.
 */
export async function cancelAlarm(notificationId: string): Promise<void> {
  if (Platform.OS === 'web') {
    const timer = webAlarmTimers.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      webAlarmTimers.delete(notificationId);
    }
    return;
  }
  try {
    // Handle comma-separated IDs from recurring alarms
    const ids = notificationId.includes(',') ? notificationId.split(',') : [notificationId];
    for (const id of ids) {
      const trimmed = id.trim();
      if (trimmed) {
        await Notifications.cancelScheduledNotificationAsync(trimmed);
      }
    }
    if (__DEV__) console.log('[Alarms] Cancelled alarm(s):', ids.length, 'notifications');
  } catch (err: any) {
    console.warn('[Alarms] Failed to cancel alarm:', err?.message || err);
  }
}

/**
 * Reschedule all enabled alarms. Call on app start to ensure
 * alarms survive app restarts and device reboots.
 */
export async function rescheduleAllAlarms(alarms: Alarm[]): Promise<Map<string, string>> {
  const idMap = new Map<string, string>();
  for (const alarm of alarms) {
    if (!alarm.enabled) continue;
    const newId = await scheduleAlarm(alarm);
    if (newId) {
      idMap.set(alarm.id, newId);
    }
  }
  return idMap;
}

/**
 * Schedule a snooze notification (fires in N minutes).
 */
export async function scheduleSnooze(alarm: Alarm, minutes: number = 5): Promise<string | null> {
  if (Platform.OS === 'web') return null;
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Mazō: Snoozed!`,
        body: `💤 "${alarm.label}" will ring again in ${minutes} minutes...`,
        data: { type: 'alarm', alarmId: alarm.id, soundId: alarm.soundId },
        sound: true,
        priority: Notifications.AndroidNotificationPriority.MAX,
        ...(Platform.OS === 'android' && { channelId: 'mazo-alarms' }),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: minutes * 60,
        channelId: 'mazo-alarms',
      },
    });
    if (__DEV__) console.log('[Alarms] Snooze scheduled in', minutes, 'min:', id);
    return id;
  } catch (err: any) {
    console.warn('[Alarms] Failed to snooze:', err?.message || err);
    return null;
  }
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Format an hour:minute pair for display.
 */
export function formatAlarmTime(hour: number, minute: number): string {
  const safeH = typeof hour === 'number' && !isNaN(hour) ? hour : 7;
  const safeM = typeof minute === 'number' && !isNaN(minute) ? minute : 0;
  const h = safeH % 12 || 12;
  const m = safeM.toString().padStart(2, '0');
  const period = safeH < 12 ? 'AM' : 'PM';
  return `${h}:${m} ${period}`;
}

/**
 * Get a human-readable days string.
 */
export function formatAlarmDays(rawDays: any): string {
  const days = Array.isArray(rawDays) ? rawDays : typeof rawDays === 'number' ? [0, 1, 2, 3, 4, 5, 6] : [];
  if (days.length === 0) return 'Once';
  if (days.length === 7) return 'Every day';
  const weekdays = [1, 2, 3, 4, 5];
  const weekend = [0, 6];
  if (days.length === 5 && weekdays.every(d => days.includes(d))) return 'Weekdays';
  if (days.length === 2 && weekend.every(d => days.includes(d))) return 'Weekends';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days.map(d => names[d]).join(', ');
}
