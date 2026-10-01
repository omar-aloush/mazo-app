/**
 * Curated list of commonly-distracting apps the Focus Guardian can block.
 * Deliberately curated (not enumerated from the device) so we never need the
 * Play-restricted QUERY_ALL_PACKAGES permission. Package names are the real
 * Android application IDs the guard matches against the foreground app.
 */
export interface BlockableApp {
  key: string;
  label: string;
  packageName: string;
  emoji: string;
}

export const BLOCKABLE_APPS: BlockableApp[] = [
  { key: 'instagram', label: 'Instagram', packageName: 'com.instagram.android', emoji: '📸' },
  { key: 'tiktok', label: 'TikTok', packageName: 'com.zhiliaoapp.musically', emoji: '🎵' },
  { key: 'youtube', label: 'YouTube', packageName: 'com.google.android.youtube', emoji: '▶️' },
  { key: 'x', label: 'X (Twitter)', packageName: 'com.twitter.android', emoji: '🐦' },
  { key: 'facebook', label: 'Facebook', packageName: 'com.facebook.katana', emoji: '👥' },
  { key: 'reddit', label: 'Reddit', packageName: 'com.reddit.frontpage', emoji: '👽' },
  { key: 'snapchat', label: 'Snapchat', packageName: 'com.snapchat.android', emoji: '👻' },
  { key: 'whatsapp', label: 'WhatsApp', packageName: 'com.whatsapp', emoji: '💬' },
  { key: 'netflix', label: 'Netflix', packageName: 'com.netflix.mediaclient', emoji: '🎬' },
  { key: 'chrome', label: 'Chrome', packageName: 'com.android.chrome', emoji: '🌐' },
];

export const BLOCKABLE_BY_PACKAGE: Record<string, BlockableApp> = Object.fromEntries(
  BLOCKABLE_APPS.map((a) => [a.packageName, a]),
);

/** Default selection the first time a user opens the Guardian setup. */
export const DEFAULT_BLOCKED_PACKAGES: string[] = [
  'com.instagram.android',
  'com.zhiliaoapp.musically',
  'com.twitter.android',
];
