import { test, expect } from 'bun:test';
import {
  detectExamContext,
  formatNudgeMessage,
  selectWatchedPackages,
  mergeGuardianSettings,
  DEFAULT_GUARDIAN_SETTINGS,
} from '@/services/guardianLogic';

test('detectExamContext matches English + Arabic exam words', () => {
  expect(detectExamContext(['I have finals next week'])).toBe(true);
  expect(detectExamContext(['عندي امتحانات'])).toBe(true);
  expect(detectExamContext(['خطة المذاكرة'])).toBe(true);
  expect(detectExamContext(['I feel calm today'])).toBe(false);
  expect(detectExamContext([])).toBe(false);
});

test('formatNudgeMessage substitutes {app} and {n}', () => {
  expect(formatNudgeMessage("You've been on {app} for {n} min.", 'PUBG', 12))
    .toBe("You've been on PUBG for 12 min.");
});

test('selectWatchedPackages prefers saved, else top∩guardable', () => {
  expect(selectWatchedPackages(['com.foo'], ['com.bar'])).toEqual(['com.foo']);
  // com.zhiliaoapp.musically (TikTok) is guardable; com.bank is not
  expect(selectWatchedPackages([], ['com.bank', 'com.zhiliaoapp.musically']))
    .toEqual(['com.zhiliaoapp.musically']);
});

test('mergeGuardianSettings fills defaults and ignores junk', () => {
  expect(mergeGuardianSettings(null)).toEqual(DEFAULT_GUARDIAN_SETTINGS);
  expect(mergeGuardianSettings({ enabled: true }).enabled).toBe(true);
  expect(mergeGuardianSettings({ enabled: true }).thresholdMinutes)
    .toBe(DEFAULT_GUARDIAN_SETTINGS.thresholdMinutes);
});
