/**
 * Curated alarm sounds for the Smart Alarm System.
 *
 * All sounds are bundled locally (~3.4 MB total) for offline reliability.
 * Royalty-free, sourced from Mixkit (free for commercial use).
 */

import { AlarmSoundId } from '@/types';

export interface AlarmSoundDef {
  id: AlarmSoundId;
  /** Translation key, e.g. 'alarm.sounds.gentle' */
  labelKey: string;
  icon: string;
  /** Local require() asset or null = vibrate-only */
  asset: any | null;
}

export const ALARM_SOUNDS: AlarmSoundDef[] = [
  { id: 'gentle',  labelKey: 'alarm.sounds.gentle',  icon: '◦',  asset: require('@/assets/sounds/alarms/gentle.mp3') },
  { id: 'sunrise', labelKey: 'alarm.sounds.sunrise', icon: '◐',  asset: require('@/assets/sounds/alarms/sunrise.mp3') },
  { id: 'classic', labelKey: 'alarm.sounds.classic', icon: '◉',  asset: require('@/assets/sounds/alarms/classic.mp3') },
  { id: 'birds',   labelKey: 'alarm.sounds.birds',   icon: '⌘',  asset: require('@/assets/sounds/alarms/birds.mp3') },
  { id: 'ocean',   labelKey: 'alarm.sounds.ocean',   icon: '≈',  asset: require('@/assets/sounds/alarms/ocean.mp3') },
  { id: 'piano',   labelKey: 'alarm.sounds.piano',   icon: '♪',  asset: require('@/assets/sounds/alarms/piano.mp3') },
  { id: 'digital', labelKey: 'alarm.sounds.digital', icon: '▪',  asset: require('@/assets/sounds/alarms/digital.mp3') },
  { id: 'vibrate', labelKey: 'alarm.sounds.vibrate', icon: '—',  asset: null },
];

export const DEFAULT_ALARM_SOUND: AlarmSoundId = 'gentle';
