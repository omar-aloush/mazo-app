/**
 * Living Garden type system.
 *
 * Spectral — a soulful serif — carries the display voice: greetings, section
 * titles, and the companion's own words. Body and data text stay on the system
 * sans for neutrality and legibility (a deliberate fixture, not an oversight).
 *
 * The font assets are loaded once in app/_layout.tsx via expo-font; the names
 * below match the registered family keys exactly.
 */
export const Fonts = {
  /** Section titles, headlines — the confident voice. */
  serif: 'Spectral_600SemiBold',
  /** Greetings and softer headings. */
  serifMedium: 'Spectral_500Medium',
  /** Long serif passages set calm. */
  serifRegular: 'Spectral_400Regular',
  /** The companion "speaking" — insights, reflections. */
  serifItalic: 'Spectral_500Medium_Italic',
} as const;

export type FontFamily = (typeof Fonts)[keyof typeof Fonts];
