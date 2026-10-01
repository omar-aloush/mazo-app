/**
 * Expo Config Plugin — Android package visibility for the Agent.
 *
 * Android 11+ (API 30) hides other apps from `Linking.openURL`/`canOpenURL`
 * unless they're declared in <queries>. Without this, launching apps by scheme
 * (whatsapp://, spotify://…) or via tel:/sms:/geo: throws ActivityNotFound even
 * when the app is installed. We merge the packages + schemes Mazō opens into the
 * existing <queries> block (which already declares https) without clobbering it.
 *
 * Usage: add "./plugins/withAndroidQueries.js" to app.json expo.plugins.
 */

const { withAndroidManifest } = require('@expo/config-plugins');

const PACKAGES = [
  'com.whatsapp',
  'com.spotify.music',
  'com.google.android.apps.maps',
  'com.android.chrome',
  'com.instagram.android',
  'com.google.android.youtube',
  'org.telegram.messenger',
  'com.twitter.android',
  'com.google.android.gm',
];

// Custom app schemes + standard intents Mazō opens.
const SCHEMES = [
  'whatsapp',
  'spotify',
  'tg',
  'instagram',
  'youtube',
  'googlechrome',
  'twitter',
  'googlegmail',
  'tel',
  'sms',
  'smsto',
  'mailto',
  'geo',
];

function applyQueries(manifest) {
  manifest.queries = manifest.queries && manifest.queries.length ? manifest.queries : [{}];
  const q = manifest.queries[0];
  q.package = q.package || [];
  q.intent = q.intent || [];

  for (const name of PACKAGES) {
    if (!q.package.some((p) => p.$ && p.$['android:name'] === name)) {
      q.package.push({ $: { 'android:name': name } });
    }
  }
  for (const scheme of SCHEMES) {
    const exists = q.intent.some(
      (i) => i.data && i.data.some((d) => d.$ && d.$['android:scheme'] === scheme),
    );
    if (!exists) {
      q.intent.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      });
    }
  }
  return manifest;
}

const withAndroidQueries = (config) =>
  withAndroidManifest(config, (cfg) => {
    applyQueries(cfg.modResults.manifest);
    return cfg;
  });

withAndroidQueries.applyQueries = applyQueries; // exported for unit test
module.exports = withAndroidQueries;
