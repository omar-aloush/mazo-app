import type { AIActionResult } from '@/types';
import {
  isSupported,
  getInstalledApps,
  launchApp,
  getUsageStats,
  type InstalledApp,
  type UsageStat,
} from '@/modules/mazo-focus-guard';
import { startFocusGuard } from '@/services/focusGuard';
import { BLOCKABLE_APPS } from '@/constants/blockable-apps';

/**
 * Bridges the Agent to the device's real installed apps + usage. This is what
 * makes "open <any app>" actually launch the app (instead of a web search) and
 * lets the coach reflect on real screen-time — the edge a generic assistant
 * can't match. Android-only; degrades to empty/unsupported elsewhere.
 */

export const isDeviceAppsSupported = isSupported;

let cache: InstalledApp[] | null = null;

/** Installed launchable apps, cached for the session (cheap to refresh if empty). */
export function listInstalledApps(): InstalledApp[] {
  if (!isSupported) return [];
  if (cache && cache.length) return cache;
  cache = getInstalledApps();
  return cache;
}

const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/** Fuzzy-match a spoken/typed app name to an installed app. */
export function findInstalledApp(name?: string): InstalledApp | null {
  if (!name) return null;
  const apps = listInstalledApps();
  if (!apps.length) return null;
  const q = norm(name);
  if (!q) return null;

  let exact: InstalledApp | null = null;
  let starts: InstalledApp | null = null;
  let contains: InstalledApp | null = null;
  for (const app of apps) {
    const label = norm(app.label);
    const pkg = norm(app.packageName);
    if (label === q) { exact = app; break; }
    if (!starts && (label.startsWith(q) || q.startsWith(label))) starts = app;
    if (!contains && (label.includes(q) || q.includes(label) || pkg.includes(q))) contains = app;
  }
  return exact ?? starts ?? contains;
}

/** Launch an installed app matched by name. Returns null if no match (caller falls back). */
export function launchAppByName(name?: string): AIActionResult | null {
  const app = findInstalledApp(name);
  if (!app) return null;
  const ok = launchApp(app.packageName);
  return ok
    ? { success: true, message: `Opened ${app.label}` }
    : { success: false, message: `Couldn't open ${app.label}.` };
}

// ── Guard (agent → Focus Guardian) ───────────────────────────────────────────

/** Resolve free-text app names to packages, curated blocklist first then installed. */
export function resolveAppPackages(names: string[]): { packages: string[]; labels: string[] } {
  const packages: string[] = [];
  const labels: string[] = [];
  for (const name of names ?? []) {
    const q = norm(name);
    if (!q) continue;
    const curated = BLOCKABLE_APPS.find(
      (a) => a.key === q || norm(a.label) === q || norm(a.label).includes(q) || q.includes(a.key),
    );
    let pkg = curated?.packageName;
    let label = curated?.label;
    if (!pkg) {
      const installed = findInstalledApp(name);
      if (installed) {
        pkg = installed.packageName;
        label = installed.label;
      }
    }
    if (pkg && !packages.includes(pkg)) {
      packages.push(pkg);
      labels.push(label ?? name);
    }
  }
  return { packages, labels };
}

/** Arm Focus Guardian for packages (already resolved), starting now, for `minutes`. */
export function guardPackagesNow(packages: string[], minutes: number, label = 'Focus session'): AIActionResult {
  if (!isSupported) return { success: false, message: 'App-blocking is available on Android.' };
  if (!packages.length) return { success: false, message: 'Nothing to guard.' };
  const mins = Math.max(1, Math.round(minutes));
  const endsAt = Date.now() + mins * 60_000;
  const ok = startFocusGuard(packages, label, endsAt);
  if (!ok) {
    return { success: false, message: 'Grant Usage access + overlay in Focus Guardian, then try again.' };
  }
  const dur = mins >= 60 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  return { success: true, message: `Guarding ${packages.length} app${packages.length > 1 ? 's' : ''} for ${dur}` };
}

/**
 * Arm Focus Guardian for the named apps, starting now, for `minutes`. This is the
 * agent's `guard` action — the thing a generic assistant can't do.
 */
export function guardAppsNow(appNames: string[], minutes: number): AIActionResult {
  if (!isSupported) return { success: false, message: 'App-blocking is available on Android.' };
  const { packages, labels } = resolveAppPackages(appNames);
  if (!packages.length) return { success: false, message: "Couldn't match those apps to block." };
  const r = guardPackagesNow(packages, minutes);
  return r.success ? { success: true, message: `Guarding ${labels.join(', ')} for ${r.message.split(' for ')[1] ?? 'a while'}` } : r;
}

// ── Usage ────────────────────────────────────────────────────────────────────

export function formatDuration(ms: number): string {
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}
const fmtDuration = formatDuration;

export function getUsageSummary(days: number): UsageStat[] {
  if (!isSupported) return [];
  return getUsageStats(days);
}

/**
 * Top time-sinks, filtered to real launchable apps (drops system UI / launcher),
 * for the proactive "you've been on X" insight on the home screen.
 */
export function getTopUsageApps(days: number, limit = 5): UsageStat[] {
  if (!isSupported) return [];
  const launchable = new Set(listInstalledApps().map((a) => a.packageName));
  return getUsageStats(days)
    .filter((s) => launchable.has(s.packageName))
    .slice(0, limit);
}

/**
 * Human-readable usage summary for the coach to reason about. Returns a short
 * sentence so the AI can coach on it naturally, or a clear "unavailable" note.
 */
export function getUsageSummaryText(days = 7): string {
  if (!isSupported) {
    return 'Phone usage data is only available on Android. Tell the user you can coach on their habits once they run the Android app.';
  }
  const stats = getUsageSummary(days);
  if (!stats.length) {
    return `No usage data yet (the user may not have granted "Usage access" in Settings → Focus Guardian, or the phone is new). Invite them to enable it so you can coach on their real screen-time.`;
  }
  const top = stats.slice(0, 6);
  const totalMs = stats.reduce((sum, s) => sum + s.totalMs, 0);
  const list = top.map((s) => `${s.label} ${fmtDuration(s.totalMs)}`).join(', ');
  return `Real phone usage over the last ${days} days — total ~${fmtDuration(totalMs)}. Top apps: ${list}. Use this to coach concretely (name the actual time-sinks), and offer a focus session or to guard those apps if relevant.`;
}

