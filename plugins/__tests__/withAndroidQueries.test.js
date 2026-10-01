const { test, expect } = require('bun:test');
const withAndroidQueries = require('../withAndroidQueries');

function fakeManifest() {
  return {
    queries: [
      {
        intent: [
          {
            action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
            data: [{ $: { 'android:scheme': 'https' } }],
          },
        ],
      },
    ],
  };
}

test('adds whatsapp package and keeps the existing https intent', () => {
  const { applyQueries } = withAndroidQueries;
  const manifest = fakeManifest();
  applyQueries(manifest);
  const q = manifest.queries[0];
  expect(q.package.some((p) => p.$['android:name'] === 'com.whatsapp')).toBe(true);
  expect(q.intent.some((i) => i.data?.[0]?.$['android:scheme'] === 'https')).toBe(true);
  expect(q.intent.some((i) => i.data?.[0]?.$['android:scheme'] === 'whatsapp')).toBe(true);
});

test('is idempotent — running twice does not duplicate entries', () => {
  const { applyQueries } = withAndroidQueries;
  const manifest = fakeManifest();
  applyQueries(manifest);
  applyQueries(manifest);
  const q = manifest.queries[0];
  const whatsappPkgs = q.package.filter((p) => p.$['android:name'] === 'com.whatsapp');
  const telIntents = q.intent.filter((i) => i.data?.[0]?.$['android:scheme'] === 'tel');
  expect(whatsappPkgs.length).toBe(1);
  expect(telIntents.length).toBe(1);
});
