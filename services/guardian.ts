import { getTopUsageApps } from '@/services/deviceApps';
import {
  loadGuardianSettings,
  startGuardianNudge,
  stopGuardianNudge,
} from '@/services/focusGuard';
import {
  detectExamContext,
  selectWatchedPackages,
  type GuardianSettings,
} from '@/services/guardianLogic';

export {
  DEFAULT_GUARDIAN_SETTINGS,
  detectExamContext,
  formatNudgeMessage,
  mergeGuardianSettings,
  selectWatchedPackages,
  type GuardianSettings,
} from '@/services/guardianLogic';

/**
 * Mazō's Exam Guardian. Pure decision helpers live here (tested); the arming
 * function ties them to the native nudge watcher. The "brains" of #7: JS decides
 * whether/when to nudge, the native service enforces the dwell-time threshold.
 */

const NUDGE_HEADLINE = "Stop — you've got exams 📚";
const NUDGE_MESSAGE = "You've been on {app} for {n} min. Let's turn this into a plan.";

/** Decide + arm the nudge. Returns true if armed. Safe to call repeatedly. */
export async function armGuardianIfWarranted(memoryStrings: string[]): Promise<boolean> {
  const s = await loadGuardianSettings();
  if (!s.enabled) { stopGuardianNudge(); return false; }

  const examContext = s.examMode || detectExamContext(memoryStrings);
  if (!examContext) { stopGuardianNudge(); return false; }

  const top = getTopUsageApps(7, 8).map((a) => a.packageName);
  const watched = selectWatchedPackages(s.watchedPackages, top);
  if (!watched.length) { stopGuardianNudge(); return false; }

  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 0);

  return startGuardianNudge(watched, {
    thresholdMinutes: s.demoFastTrigger ? 1 : s.thresholdMinutes,
    snoozeMinutes: s.snoozeMinutes,
    dailyCap: s.dailyCap,
    headline: NUDGE_HEADLINE,
    message: NUDGE_MESSAGE,
    endsAtMs: endOfDay.getTime(),
  });
}
