/**
 * Packages the Guardian nudge may watch — games + the most time-sink social
 * apps. Curated (like blockable-apps) so we never need QUERY_ALL_PACKAGES.
 */
export const GUARDABLE_PACKAGES: string[] = [
  // social / video time-sinks
  'com.zhiliaoapp.musically', // TikTok
  'com.instagram.android',
  'com.google.android.youtube',
  'com.snapchat.android',
  'com.twitter.android',
  'com.reddit.frontpage',
  'com.facebook.katana',
  'com.netflix.mediaclient',
  // popular mobile games
  'com.tencent.ig',            // PUBG Mobile
  'com.activision.callofduty.shooter',
  'com.dts.freefireth',        // Free Fire
  'com.supercell.clashofclans',
  'com.supercell.clashroyale',
  'com.miHoYo.GenshinImpact',
  'com.roblox.client',
  'com.mojang.minecraftpe',
];
