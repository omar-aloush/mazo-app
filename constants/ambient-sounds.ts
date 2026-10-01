/**
 * Ambient sound definitions for Focus Mode.
 *
 * All sounds are bundled locally (~2.9 MB total) for offline reliability.
 * Royalty-free, sourced from Mixkit (free for commercial use).
 */

export type AmbientSoundId = 'none' | 'rain' | 'ocean' | 'forest' | 'whitenoise' | 'lofi' | 'cafe';

export interface AmbientSound {
  id: AmbientSoundId;
  /** Translation key, e.g. 'focus.ambient.rain' */
  labelKey: string;
  icon: string;
  /** Local require() asset or null = silence. */
  asset: any | null;
}

export const AMBIENT_SOUNDS: AmbientSound[] = [
  { id: 'none',       labelKey: 'focus.ambient.silence',    icon: '—',  asset: null },
  { id: 'rain',       labelKey: 'focus.ambient.rain',       icon: '∴',  asset: require('@/assets/sounds/ambient/rain.mp3') },
  { id: 'ocean',      labelKey: 'focus.ambient.ocean',      icon: '≈',  asset: require('@/assets/sounds/ambient/ocean.mp3') },
  { id: 'forest',     labelKey: 'focus.ambient.forest',     icon: '⌘',  asset: require('@/assets/sounds/ambient/forest.mp3') },
  { id: 'whitenoise', labelKey: 'focus.ambient.whiteNoise', icon: '◌',  asset: require('@/assets/sounds/ambient/whitenoise.mp3') },
  { id: 'lofi',       labelKey: 'focus.ambient.loFi',       icon: '♪',  asset: require('@/assets/sounds/ambient/lofi.mp3') },
  { id: 'cafe',       labelKey: 'focus.ambient.cafe',       icon: '◎',  asset: require('@/assets/sounds/ambient/cafe.mp3') },
];
