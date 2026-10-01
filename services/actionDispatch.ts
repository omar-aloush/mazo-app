import type { MazoAction, ActionReceipt, AIActionResult, AlarmSoundId } from '@/types';
import {
  createCalendarEvent,
  scheduleReminderNotification,
  openAppSmart,
  composeMessage,
  placeCall,
  navigateTo,
  openLink,
} from './deviceActions';
import { guardAppsNow } from './deviceApps';

/**
 * Provider-backed capabilities the dispatcher can't reach on its own (they live
 * behind React hooks), injected by the caller.
 */
export interface DispatchHelpers {
  addAlarm: (alarm: {
    label: string;
    hour: number;
    minute: number;
    days: number[];
    soundId: AlarmSoundId;
    enabled: boolean;
  }) => Promise<AIActionResult>;
  saveNote: (note: string, category?: string) => void;
}

/** Actions that keep Mazō in the foreground — safe to run in a batch. */
const STAYS: MazoAction['kind'][] = ['alarm', 'calendar', 'reminder', 'guard', 'focus_preview', 'save_note'];

/** Execution order: foreground-safe actions first, app-leaving ones last. */
export function orderActions(actions: MazoAction[]): MazoAction[] {
  return [
    ...actions.filter((a) => STAYS.includes(a.kind)),
    ...actions.filter((a) => !STAYS.includes(a.kind)),
  ];
}

async function runOne(a: MazoAction, h: DispatchHelpers): Promise<AIActionResult> {
  switch (a.kind) {
    case 'alarm':
      return h.addAlarm({
        label: a.title,
        hour: a.hour ?? 7,
        minute: a.minute ?? 0,
        days: a.days ?? [],
        soundId: 'gentle',
        enabled: true,
      });
    case 'calendar':
      return a.startISO && a.endISO
        ? createCalendarEvent({ title: a.title, startISO: a.startISO, endISO: a.endISO, notes: a.detail })
        : { success: false, message: 'That event was missing a time.' };
    case 'reminder':
      return scheduleReminderNotification({ title: a.title, dueISO: a.dueISO, body: a.detail });
    case 'open_app':
      return openAppSmart(a.app ?? a.title);
    case 'message':
      return composeMessage({ to: a.to, body: a.body, via: a.via });
    case 'call':
      return placeCall(a.number ?? a.to ?? '');
    case 'navigate':
      return navigateTo(a.destination ?? '');
    case 'open_link':
      return openLink({ url: a.url, query: a.query });
    case 'guard':
      return guardAppsNow(a.apps ?? [], a.durationMinutes ?? 120);
    case 'focus_preview':
      return {
        success: true,
        message: 'Focus Shield ready — start your focus session.',
      };
    case 'save_note':
      h.saveNote(a.note ?? a.title, a.category);
      return { success: true, message: 'Saved to your Mind' };
    default:
      return { success: false, message: 'Unknown action.' };
  }
}

export async function executeAction(a: MazoAction, h: DispatchHelpers): Promise<ActionReceipt> {
  try {
    const r = await runOne(a, h);
    return { id: a.id, title: a.title, kind: a.kind, success: r.success, message: r.message };
  } catch (e) {
    console.warn('[ActionDispatch] action failed', a.kind, e);
    return { id: a.id, title: a.title, kind: a.kind, success: false, message: 'Something went wrong.' };
  }
}

/**
 * Run an approved plan. Foreground-safe actions (alarms, calendar, reminders,
 * notes) run first so they all land; app-leaving actions (open app, message,
 * call, maps, link) run last, since launching another app backgrounds Mazō.
 */
export async function dispatchPlan(actions: MazoAction[], h: DispatchHelpers): Promise<ActionReceipt[]> {
  const receipts: ActionReceipt[] = [];
  for (const a of orderActions(actions)) {
    receipts.push(await executeAction(a, h));
  }
  return receipts;
}
