/**
 * Haptics utility — semantic haptic feedback for premium app feel.
 * Uses expo-haptics under the hood. Safe on all platforms (no-ops on web).
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const isNative = Platform.OS === 'ios' || Platform.OS === 'android';

/** Light tap — buttons, chip selection, toggles */
export const hapticTap = () => {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
};

/** Medium tap — important actions like send message, mode select */
export const hapticPress = () => {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
};

/** Heavy tap — major actions like starting a focus timer */
export const hapticHeavy = () => {
  if (!isNative) return;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
};

/** Success — task completed, goal achieved, session ended */
export const hapticSuccess = () => {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
};

/** Warning — error retry, session limit reached */
export const hapticWarning = () => {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
};

/** Error — something went wrong */
export const hapticError = () => {
  if (!isNative) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
};

/** Selection changed — picker, coach switch, tab change */
export const hapticSelection = () => {
  if (!isNative) return;
  Haptics.selectionAsync().catch(() => {});
};

/** Celebration — streak milestones, breakthroughs */
export const hapticCelebration = () => {
  if (!isNative) return;
  // Triple burst pattern for celebrations
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    .then(() => new Promise(r => setTimeout(r, 100)))
    .then(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy))
    .then(() => new Promise(r => setTimeout(r, 100)))
    .then(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success))
    .catch(() => {});
};
