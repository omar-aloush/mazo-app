import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  isSupported,
  hasUsageAccess,
  openUsageAccessSettings,
  hasOverlayPermission,
  requestOverlayPermission,
  startGuard,
  stopGuard,
  startNudge,
  stopNudge,
} from '@/modules/mazo-focus-guard';
import { DEFAULT_BLOCKED_PACKAGES } from '@/constants/blockable-apps';
import {
  GuardianSettings,
  DEFAULT_GUARDIAN_SETTINGS,
  mergeGuardianSettings,
} from '@/services/guardian';

/**
 * App-facing wrapper around the native Focus Guardian module. Keeps all the
 * "is this even supported / are permissions granted" gating in one place so the
 * UI and the focus-session lifecycle can call it without platform branching.
 */

export const isFocusGuardSupported = isSupported;

export interface GuardPermissions {
  usageAccess: boolean;
  overlay: boolean;
}

export function getGuardPermissions(): GuardPermissions {
  if (!isSupported) return { usageAccess: false, overlay: false };
  return { usageAccess: hasUsageAccess(), overlay: hasOverlayPermission() };
}

export function hasAllGuardPermissions(): boolean {
  const p = getGuardPermissions();
  return p.usageAccess && p.overlay;
}

export function openUsageAccess(): void {
  if (isSupported) openUsageAccessSettings();
}

export function openOverlaySettings(): void {
  if (isSupported) requestOverlayPermission();
}

/**
 * Arm the guard for a focus session. Returns true only if it actually started
 * (supported + permissions granted + at least one app to block). A false return
 * means the session should run as the normal soft timer.
 */
export function startFocusGuard(blockedPackages: string[], label: string, endsAtMs: number): boolean {
  if (!isSupported || blockedPackages.length === 0) return false;
  if (!hasAllGuardPermissions()) return false;
  startGuard(blockedPackages, label, endsAtMs);
  return true;
}

export function stopFocusGuard(): void {
  if (isSupported) stopGuard();
}

// ── Persisted settings ───────────────────────────────────────────────────────

export const FOCUS_GUARD_STORAGE_KEY = 'mazo.focusGuard.settings.v1';

export interface FocusGuardSettings {
  enabled: boolean;
  blockedPackages: string[];
}

export const DEFAULT_FOCUS_GUARD_SETTINGS: FocusGuardSettings = {
  enabled: false,
  blockedPackages: DEFAULT_BLOCKED_PACKAGES,
};

export async function loadFocusGuardSettings(): Promise<FocusGuardSettings> {
  try {
    const raw = await AsyncStorage.getItem(FOCUS_GUARD_STORAGE_KEY);
    if (raw) return { ...DEFAULT_FOCUS_GUARD_SETTINGS, ...JSON.parse(raw) };
  } catch {
    // fall back to defaults
  }
  return DEFAULT_FOCUS_GUARD_SETTINGS;
}

export async function saveFocusGuardSettings(settings: FocusGuardSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(FOCUS_GUARD_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort persistence
  }
}

/**
 * Arm the guard for a focus session using the user's saved settings. Safe to
 * call on every session start — it self-checks support, the enabled toggle, the
 * blocklist, and permissions, and quietly no-ops when any are missing. Returns
 * true only if the guard actually armed.
 */
export async function armFocusGuardForSession(durationMinutes: number, label: string): Promise<boolean> {
  if (!isSupported) return false;
  const settings = await loadFocusGuardSettings();
  if (!settings.enabled || settings.blockedPackages.length === 0) return false;
  const endsAt = Date.now() + Math.max(1, durationMinutes) * 60_000;
  return startFocusGuard(settings.blockedPackages, label, endsAt);
}

// ── Guardian (the angry-face nudge) ──────────────────────────────────────────

export const GUARDIAN_STORAGE_KEY = 'mazo.guardian.settings.v1';

export async function loadGuardianSettings(): Promise<GuardianSettings> {
  try {
    const raw = await AsyncStorage.getItem(GUARDIAN_STORAGE_KEY);
    return mergeGuardianSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return DEFAULT_GUARDIAN_SETTINGS;
  }
}

export async function saveGuardianSettings(settings: GuardianSettings): Promise<void> {
  try {
    await AsyncStorage.setItem(GUARDIAN_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // best-effort
  }
}

/** Arm the soft nudge watcher. Returns false (no-op) if unsupported / unpermitted. */
export function startGuardianNudge(
  packages: string[],
  opts: { thresholdMinutes: number; snoozeMinutes: number; dailyCap: number; headline: string; message: string; endsAtMs: number },
): boolean {
  if (!isSupported || packages.length === 0) return false;
  if (!hasAllGuardPermissions()) return false;
  startNudge(
    packages,
    Math.max(10, Math.round(opts.thresholdMinutes * 60)),
    Math.max(30, Math.round(opts.snoozeMinutes * 60)),
    Math.max(1, opts.dailyCap),
    opts.headline,
    opts.message,
    opts.endsAtMs,
  );
  return true;
}

export function stopGuardianNudge(): void {
  if (isSupported) stopNudge();
}
