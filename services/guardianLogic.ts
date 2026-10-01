import { GUARDABLE_PACKAGES } from '@/constants/distraction-apps';

const EXAM_PATTERNS: RegExp[] = [
  /\b(exam|finals?|midterm|deadline|assignment|revision|study)\b/i,
  /(امتحان|الامتحان|امتحانات|مذاكرة|المذاكرة|ذاكر|نهائي|واجب)/,
];

export function detectExamContext(haystack: string[]): boolean {
  return (haystack ?? []).some((value) =>
    EXAM_PATTERNS.some((pattern) => pattern.test(value ?? '')),
  );
}

export function formatNudgeMessage(template: string, appLabel: string, minutes: number): string {
  return (template ?? '')
    .replace(/\{app\}/g, appLabel)
    .replace(/\{n\}/g, String(Math.max(0, Math.round(minutes))));
}

export function selectWatchedPackages(saved: string[], topPackages: string[]): string[] {
  if (saved?.length) return saved;
  const guardable = new Set(GUARDABLE_PACKAGES);
  return (topPackages ?? []).filter((packageName) => guardable.has(packageName));
}

export interface GuardianSettings {
  enabled: boolean;
  watchedPackages: string[];
  thresholdMinutes: number;
  snoozeMinutes: number;
  dailyCap: number;
  examMode: boolean;
  demoFastTrigger: boolean;
}

export const DEFAULT_GUARDIAN_SETTINGS: GuardianSettings = {
  enabled: false,
  watchedPackages: [],
  thresholdMinutes: 15,
  snoozeMinutes: 5,
  dailyCap: 6,
  examMode: false,
  demoFastTrigger: false,
};

export function mergeGuardianSettings(raw: unknown): GuardianSettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_GUARDIAN_SETTINGS;
  return { ...DEFAULT_GUARDIAN_SETTINGS, ...(raw as Partial<GuardianSettings>) };
}
