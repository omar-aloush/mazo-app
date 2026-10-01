import * as Calendar from 'expo-calendar';
import * as Linking from 'expo-linking';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import type { AIActionResult } from '@/types';
import { APP_CATALOG, resolveAppKey } from '@/constants/actionCatalog';
import { buildWhatsAppUrl, buildSmsUrl, buildMapsUrl, buildSearchUrl, normalizeWebUrl } from './actionUrls';
import { ensureNotificationChannels } from './notifications';
import { launchAppByName } from './deviceApps';
import { resolveContact, isPhoneNumber } from './contacts';

/**
 * Day Architect's real-world writers. Calendar + reminders go through
 * expo-calendar (permission-gated); alarms are handled by the existing alarm
 * system at the call site. Every function is only ever called AFTER the user
 * approves the proposal.
 */

async function getWritableEventCalendarId(): Promise<string | null> {
    const perm = await Calendar.requestCalendarPermissionsAsync();
    if (perm.status !== 'granted') return null;
    if (Platform.OS === 'ios') {
        try {
            const def = await Calendar.getDefaultCalendarAsync();
            if (def?.id) return def.id;
        } catch {
            // fall through to scanning calendars
        }
    }
    const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
    const writable = cals.filter(c => c.allowsModifications);
    if (writable[0]?.id) return writable[0].id;

    // Android with no Google account synced (common on emulators / fresh demo
    // phones) has no writable calendar — create a local one so events can land.
    if (Platform.OS === 'android') {
        try {
            const id = await Calendar.createCalendarAsync({
                title: 'Mazō',
                name: 'Mazo',
                color: '#6E8E76',
                entityType: Calendar.EntityTypes.EVENT,
                accessLevel: Calendar.CalendarAccessLevel.OWNER,
                ownerAccount: 'personal',
                source: { isLocalAccount: true, name: 'Mazō' } as any,
            });
            return id;
        } catch (e) {
            console.warn('[DeviceActions] createCalendarAsync (android) failed', e);
        }
    }
    return cals[0]?.id ?? null;
}

export async function createCalendarEvent(opts: { title: string; startISO: string; endISO: string; notes?: string }): Promise<AIActionResult> {
    try {
        const calId = await getWritableEventCalendarId();
        if (!calId) return { success: false, message: 'Calendar access is needed to add this.' };
        await Calendar.createEventAsync(calId, {
            title: opts.title,
            startDate: new Date(opts.startISO),
            endDate: new Date(opts.endISO),
            notes: opts.notes,
        });
        return { success: true, message: `Added "${opts.title}" to your calendar` };
    } catch (e) {
        console.warn('[DeviceActions] createCalendarEvent failed', e);
        return { success: false, message: 'Could not add the calendar event.' };
    }
}

export async function createReminder(opts: { title: string; dueISO?: string }): Promise<AIActionResult> {
    if (Platform.OS !== 'ios') {
        return { success: false, message: 'Reminders are available on iOS only.' };
    }
    try {
        const perm = await Calendar.requestRemindersPermissionsAsync();
        if (perm.status !== 'granted') return { success: false, message: 'Reminders access is needed.' };
        const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
        const calId = cals.find(c => c.allowsModifications)?.id ?? cals[0]?.id;
        if (!calId) return { success: false, message: 'No reminders list is available.' };
        await Calendar.createReminderAsync(calId, {
            title: opts.title,
            dueDate: opts.dueISO ? new Date(opts.dueISO) : undefined,
        });
        return { success: true, message: `Reminder set: "${opts.title}"` };
    } catch (e) {
        console.warn('[DeviceActions] createReminder failed', e);
        return { success: false, message: 'Could not set the reminder.' };
    }
}

/**
 * Cross-platform reminder. Unlike `createReminder` (iOS Reminders app, EventKit),
 * this schedules a local notification at the due time — so it works on Android too,
 * which is the demo target.
 */
export async function scheduleReminderNotification(opts: { title: string; dueISO?: string; body?: string }): Promise<AIActionResult> {
    try {
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') {
            status = (await Notifications.requestPermissionsAsync()).status;
        }
        if (status !== 'granted') {
            return { success: false, message: 'Notifications need to be on for reminders.' };
        }
        await ensureNotificationChannels();
        const isAndroid = Platform.OS === 'android';
        const due = opts.dueISO ? new Date(opts.dueISO) : new Date(Date.now() + 60_000);
        const when = due.getTime() <= Date.now() ? new Date(Date.now() + 60_000) : due;
        await Notifications.scheduleNotificationAsync({
            content: {
                title: opts.title,
                body: opts.body ?? 'A nudge from Mazō',
                sound: true,
                ...(isAndroid && { channelId: 'mazo-tasks' }),
            },
            trigger: {
                type: Notifications.SchedulableTriggerInputTypes.DATE,
                date: when,
                ...(isAndroid && { channelId: 'mazo-tasks' }),
            } as any,
        });
        return { success: true, message: `Reminder set: "${opts.title}"` };
    } catch (e) {
        console.warn('[DeviceActions] scheduleReminderNotification failed', e);
        return { success: false, message: 'Could not set the reminder.' };
    }
}

/**
 * Open a known app by URL scheme, falling back to its web version if the app
 * isn't installed. We try `openURL` directly rather than `canOpenURL` because
 * Android 11+ hides un-declared schemes from `canOpenURL`, giving false negatives.
 */
export async function openApp(appKey: string): Promise<AIActionResult> {
    const entry = APP_CATALOG[appKey];
    if (!entry) return { success: false, message: `I can't open "${appKey}" yet.` };
    try {
        await Linking.openURL(entry.scheme);
        return { success: true, message: `Opened ${entry.label}` };
    } catch {
        if (entry.web) {
            try {
                await Linking.openURL(entry.web);
                return { success: true, message: `Opened ${entry.label} on the web` };
            } catch {
                // fall through
            }
        }
        return { success: false, message: `${entry.label} isn't installed.` };
    }
}

/**
 * Open an app the user named, the smart way:
 *   1) launch the real installed app matched by name (Android) — the reliable path,
 *   2) else a known URL scheme (iOS + apps not matched by name),
 *   3) else a web search so the request still does *something*.
 * This is what fixes "open pubg" launching a search instead of the game.
 */
export async function openAppSmart(name?: string): Promise<AIActionResult> {
    const n = (name ?? '').trim();
    if (!n) return { success: false, message: 'Which app should I open?' };
    const launched = launchAppByName(n);
    if (launched) return launched;
    const key = resolveAppKey(n);
    if (key) return openApp(key);
    return openLink({ query: n });
}

/** Compose a text or WhatsApp message — resolves a contact name to a number first. */
export async function composeMessage(opts: { to?: string; body?: string; via?: 'sms' | 'whatsapp' }): Promise<AIActionResult> {
    const body = opts.body ?? '';
    let to = (opts.to ?? '').trim();
    let who = to;
    if (to && !isPhoneNumber(to)) {
        const c = await resolveContact(to);
        if (!c) return { success: false, message: `I couldn't find "${opts.to}" in your contacts.` };
        to = c.number;
        who = c.name;
    }
    try {
        if (opts.via === 'whatsapp') {
            await Linking.openURL(buildWhatsAppUrl(to, body));
            return { success: true, message: who ? `Opened WhatsApp to ${who}` : 'Opened WhatsApp with your message' };
        }
        await Linking.openURL(buildSmsUrl(to, body, Platform.OS === 'ios' ? 'ios' : 'android'));
        return { success: true, message: who ? `Texting ${who}` : 'Opened Messages with your text ready' };
    } catch (e) {
        console.warn('[DeviceActions] composeMessage failed', e);
        return { success: false, message: 'Could not open the messaging app.' };
    }
}

/** Place a call — resolves a contact name to a number, then opens the dialer. */
export async function placeCall(target: string): Promise<AIActionResult> {
    let raw = (target ?? '').trim();
    let who = raw;
    if (raw && !isPhoneNumber(raw)) {
        const c = await resolveContact(raw);
        if (!c) return { success: false, message: `I couldn't find "${target}" in your contacts.` };
        raw = c.number;
        who = c.name;
    }
    const num = raw.replace(/[^0-9+]/g, '');
    if (!num) return { success: false, message: 'I need a number to call.' };
    try {
        await Linking.openURL(`tel:${num}`);
        return { success: true, message: `Calling ${who}` };
    } catch {
        return { success: false, message: 'Could not open the dialer.' };
    }
}

/** Open Maps with directions to a place. */
export async function navigateTo(destination: string): Promise<AIActionResult> {
    if (!destination) return { success: false, message: 'Where to?' };
    try {
        await Linking.openURL(buildMapsUrl(destination));
        return { success: true, message: `Directions to ${destination}` };
    } catch {
        return { success: false, message: 'Could not open Maps.' };
    }
}

/** Open a website, or a Google search when only a query is given. */
export async function openLink(opts: { url?: string; query?: string }): Promise<AIActionResult> {
    const target = opts.query ? buildSearchUrl(opts.query) : opts.url ? normalizeWebUrl(opts.url) : '';
    if (!target) return { success: false, message: 'Nothing to open.' };
    try {
        await Linking.openURL(target);
        return { success: true, message: `Opened ${opts.query ?? target}` };
    } catch {
        return { success: false, message: 'Could not open that link.' };
    }
}
