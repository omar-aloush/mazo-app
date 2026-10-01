import { Platform } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

/**
 * JS bridge for the Mazō Focus Guardian native module (Android only).
 *
 * The native side polls the foreground app and, when a blocked app surfaces
 * during a focus session, draws a full-screen overlay over it. On iOS / web /
 * Expo Go the native module is absent, so every function degrades to a no-op
 * and `isSupported` is false — callers must check it before relying on a block.
 */
export interface InstalledApp {
  packageName: string;
  label: string;
}

export interface UsageStat {
  packageName: string;
  label: string;
  totalMs: number;
}

export interface DocFile {
  uri: string;
  name: string;
  mime: string;
  size: number;
  modified: number;
}

interface MazoFocusGuardNative {
  hasUsageAccess(): boolean;
  openUsageAccessSettings(): void;
  hasOverlayPermission(): boolean;
  requestOverlayPermission(): void;
  startGuard(blockedPackages: string[], sessionLabel: string, endsAtEpochMs: number): void;
  stopGuard(): void;
  getInstalledApps(): InstalledApp[];
  launchApp(packageName: string): boolean;
  getUsageStats(daysBack: number): UsageStat[];
  getDistractionByHour(daysBack: number, packages: string[]): number[];
  startNudge(
    packages: string[],
    thresholdSeconds: number,
    snoozeSeconds: number,
    dailyCap: number,
    headline: string,
    message: string,
    endsAtEpochMs: number,
  ): void;
  stopNudge(): void;
  consumeNudgeLaunch(): string | null;
  setWidgetData(json: string): void;
  pickDocsFolder(): Promise<string | null>;
  listDocsInTree(treeUri: string): Promise<DocFile[]>;
  readDocText(uri: string, maxBytes: number): Promise<string>;
  openDocument(uri: string): boolean;
}

let native: MazoFocusGuardNative | null = null;
if (Platform.OS === 'android') {
  try {
    native = requireNativeModule<MazoFocusGuardNative>('MazoFocusGuard');
  } catch {
    // Module not linked (e.g. running in Expo Go) — stay in no-op mode.
    native = null;
  }
}

/** True only when the native blocker is actually available (Android dev build). */
export const isSupported = native != null;

/** Has the user granted "Usage access" in system settings? */
export function hasUsageAccess(): boolean {
  return native?.hasUsageAccess() ?? false;
}

/** Open the system "Usage access" settings screen. */
export function openUsageAccessSettings(): void {
  native?.openUsageAccessSettings();
}

/** Has the user granted "Draw over other apps"? */
export function hasOverlayPermission(): boolean {
  return native?.hasOverlayPermission() ?? false;
}

/** Open the system "Draw over other apps" settings screen for Mazō. */
export function requestOverlayPermission(): void {
  native?.requestOverlayPermission();
}

/** Arm the guard for the current session. `endsAtEpochMs` auto-stops the guard. */
export function startGuard(blockedPackages: string[], sessionLabel: string, endsAtEpochMs: number): void {
  native?.startGuard(blockedPackages, sessionLabel, endsAtEpochMs);
}

/** Disarm the guard and remove any overlay. */
export function stopGuard(): void {
  native?.stopGuard();
}

/** All launchable apps installed on the device (Android). [] when unsupported. */
export function getInstalledApps(): InstalledApp[] {
  return native?.getInstalledApps() ?? [];
}

/** Launch an installed app by package name. False if not installed/unsupported. */
export function launchApp(packageName: string): boolean {
  return native?.launchApp(packageName) ?? false;
}

/** Per-app foreground time over the last `daysBack` days (needs usage access). */
export function getUsageStats(daysBack: number): UsageStat[] {
  return native?.getUsageStats(daysBack) ?? [];
}

/** Opens-per-hour-of-day (length 24) for the given packages (needs usage access). */
export function getDistractionByHour(daysBack: number, packages: string[]): number[] {
  return native?.getDistractionByHour(daysBack, packages) ?? [];
}

/** Arm the soft nudge: watch `packages`, nudge after `thresholdSeconds` of dwell. */
export function startNudge(
  packages: string[],
  thresholdSeconds: number,
  snoozeSeconds: number,
  dailyCap: number,
  headline: string,
  message: string,
  endsAtEpochMs: number,
): void {
  native?.startNudge(packages, thresholdSeconds, snoozeSeconds, dailyCap, headline, message, endsAtEpochMs);
}

/** Disarm the nudge watcher and remove any nudge overlay. */
export function stopNudge(): void {
  native?.stopNudge();
}

/** If the app was launched from a nudge, returns the offending app's label once. */
export function consumeNudgeLaunch(): string | null {
  return native?.consumeNudgeLaunch() ?? null;
}

/** Write the JSON the home-screen widget reads, and trigger it to refresh. */
export function setWidgetData(json: string): void {
  native?.setWidgetData(json);
}

// ── Document Finder (Android SAF) ─────────────────────────────────────────────

/** Prompt the user to grant a folder. Resolves to the tree URI, or null. */
export async function pickDocsFolder(): Promise<string | null> {
  return (await native?.pickDocsFolder()) ?? null;
}

/** Recursively list files inside a granted folder tree. [] when unsupported. */
export async function listDocsInTree(treeUri: string): Promise<DocFile[]> {
  return (await native?.listDocsInTree(treeUri)) ?? [];
}

/** Read up to `maxBytes` of UTF-8 text from a document URI. "" when unsupported. */
export async function readDocText(uri: string, maxBytes = 1_000_000): Promise<string> {
  return (await native?.readDocText(uri, maxBytes)) ?? '';
}

/** Open a document in the user's default app. False if unsupported/failed. */
export function openDocument(uri: string): boolean {
  return native?.openDocument(uri) ?? false;
}
