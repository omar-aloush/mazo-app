import {
  Clock,
  CalendarDays,
  Bell,
  AppWindow,
  MessageSquare,
  Phone,
  Navigation,
  Globe,
  Lightbulb,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react-native';
import type { MazoActionKind } from '@/types';

/**
 * Single source of truth for how each action kind looks and where it lands.
 * Shared by the planner, the approval/command UI, and the receipts so they
 * can never drift apart.
 */
export const ACTION_META: Record<MazoActionKind, { Icon: LucideIcon; dest: string }> = {
  alarm: { Icon: Clock, dest: 'Alarms' },
  calendar: { Icon: CalendarDays, dest: 'Calendar' },
  reminder: { Icon: Bell, dest: 'Reminders' },
  open_app: { Icon: AppWindow, dest: 'Opens app' },
  message: { Icon: MessageSquare, dest: 'Messages' },
  call: { Icon: Phone, dest: 'Phone' },
  navigate: { Icon: Navigation, dest: 'Maps' },
  open_link: { Icon: Globe, dest: 'Browser' },
  guard: { Icon: ShieldCheck, dest: 'Focus Guardian' },
  focus_preview: { Icon: ShieldCheck, dest: 'Demo preview' },
  save_note: { Icon: Lightbulb, dest: 'Your Mind' },
};

/**
 * Known apps Mazō can launch by URL scheme, with a web fallback when the app
 * isn't installed. Keeping this list explicit (rather than launching arbitrary
 * package names) keeps behaviour predictable and avoids extra native modules.
 */
export interface AppEntry {
  label: string;
  scheme: string; // e.g. "whatsapp://"
  web?: string;   // fallback URL when the scheme can't open
}

export const APP_CATALOG: Record<string, AppEntry> = {
  whatsapp: { label: 'WhatsApp', scheme: 'whatsapp://', web: 'https://web.whatsapp.com' },
  spotify: { label: 'Spotify', scheme: 'spotify://', web: 'https://open.spotify.com' },
  instagram: { label: 'Instagram', scheme: 'instagram://app', web: 'https://instagram.com' },
  youtube: { label: 'YouTube', scheme: 'youtube://', web: 'https://youtube.com' },
  gmail: { label: 'Gmail', scheme: 'googlegmail://', web: 'https://mail.google.com' },
  maps: { label: 'Maps', scheme: 'geo:0,0', web: 'https://maps.google.com' },
  camera: { label: 'Camera', scheme: 'camera://' },
  telegram: { label: 'Telegram', scheme: 'tg://', web: 'https://web.telegram.org' },
  twitter: { label: 'X', scheme: 'twitter://', web: 'https://x.com' },
  chrome: { label: 'Chrome', scheme: 'googlechrome://', web: 'https://google.com' },
  notes: { label: 'Notes', scheme: 'mobilenotes://' },
  calculator: { label: 'Calculator', scheme: 'calc://' },
};

/** Resolve a free-text app name to a catalog key, tolerant of casing/spaces. */
export function resolveAppKey(name?: string): string | null {
  if (!name) return null;
  const n = name.toLowerCase().replace(/[^a-z]/g, '');
  if (APP_CATALOG[n]) return n;
  const hit = Object.keys(APP_CATALOG).find((k) => n.includes(k) || k.includes(n));
  return hit ?? null;
}
