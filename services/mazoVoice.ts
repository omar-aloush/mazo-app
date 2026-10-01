/**
 * MazoVoice — Text-to-Speech service for Mazo's voice announcements.
 *
 * Makes Mazo feel alive by speaking during key moments:
 * - Focus break start: "Great work! Time for a break."
 * - Break end / back to work: "Let's go! Back to focus."
 * - Session complete: "Amazing session! You crushed it."
 * - Alarm wake-up (optional)
 *
 * Uses expo-speech (native TTS engine, works on both iOS and Android).
 * Detects device locale so TTS engine uses the correct language.
 */

import * as Speech from 'expo-speech';
import { Platform } from 'react-native';
import { getLocales } from 'expo-localization';

// ── Voice Configuration ──
function getVoiceConfig() {
  const locale = getLocales()?.[0]?.languageTag || 'en-US';
  return {
    rate: Platform.OS === 'ios' ? 0.48 : 0.9,
    pitch: 1.05,
    language: locale,
  };
}

// ── Break Announcements ──
const BREAK_MESSAGES = [
  "Great work! Time for a break. Stretch, breathe, and recharge.",
  "Break time! You've earned it. Step away and reset your mind.",
  "Hey! Mazo says: take a break. Your brain needs a moment to recover.",
  "Awesome focus session! Now relax for a few minutes. You deserve it.",
  "Break time! Stand up, drink some water, and look away from the screen.",
  "Mazo here! That was solid work. Take your break and come back stronger.",
];

// ── Back to Work Announcements ──
const WORK_MESSAGES = [
  "Break's over! Let's get back to it. You've got this!",
  "Time to focus! Let's crush this next session.",
  "Alright! Back to work. Stay sharp and stay strong.",
  "Let's go! Focus mode activated. Make this session count.",
  "Ready? Your break is over. Time to build momentum!",
];

// ── Session Complete Announcements ──
const DONE_MESSAGES = [
  "Session complete! Amazing work. You should be proud.",
  "You did it! Another great focus session in the books.",
  "Incredible! You stayed focused and finished strong.",
  "That's a wrap! Mazo is proud of you. Great session.",
  "Done! You just proved that consistency beats everything.",
];

// ── Alarm Wake-up Announcements ──
const ALARM_MESSAGES = [
  "Wake up! It's time to start your day. Let's make it a great one!",
  "Good morning! Mazo is here to get you moving. Rise and shine!",
  "Hey! Time to wake up. The world is waiting for you.",
  "Up and at it! A new day means new opportunities.",
];

// ── Helper: pick random message ──
function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Public API ──

/** Speak a break announcement */
export async function speakBreak(): Promise<void> {
  await speak(pickRandom(BREAK_MESSAGES));
}

/** Speak a back-to-work announcement */
export async function speakWorkResume(): Promise<void> {
  await speak(pickRandom(WORK_MESSAGES));
}

/** Speak a session complete announcement */
export async function speakSessionDone(): Promise<void> {
  await speak(pickRandom(DONE_MESSAGES));
}

/** Speak an alarm wake-up announcement */
export async function speakAlarmWakeUp(): Promise<void> {
  await speak(pickRandom(ALARM_MESSAGES));
}

/** Speak a custom message with Mazo's voice */
export async function speakCustom(message: string): Promise<void> {
  await speak(message);
}

/** Stop any ongoing speech */
export async function stopSpeaking(): Promise<void> {
  try {
    await Speech.stop();
  } catch (e) {
    if (__DEV__) console.warn('[MazoVoice] stop error:', e);
  }
}

/** Check if Mazo is currently speaking */
export async function isSpeaking(): Promise<boolean> {
  try {
    return await Speech.isSpeakingAsync();
  } catch (e) {
    if (__DEV__) console.warn('[MazoVoice] isSpeaking error:', e);
    return false;
  }
}

// ── Core speak function ──
async function speak(text: string): Promise<void> {
  try {
    const speaking = await Speech.isSpeakingAsync();
    if (speaking) {
      await Speech.stop();
      await new Promise(r => setTimeout(r, 150));
    }

    const config = getVoiceConfig();
    Speech.speak(text, {
      language: config.language,
      pitch: config.pitch,
      rate: config.rate,
      onError: (err) => {
        if (__DEV__) console.warn('[MazoVoice] Speech error:', err);
      },
    });
  } catch (err) {
    if (__DEV__) console.warn('[MazoVoice] Failed to speak:', err);
  }
}
