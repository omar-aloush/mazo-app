import { test, expect } from 'bun:test';
import { buildSmsUrl, buildWhatsAppUrl, buildMapsUrl, buildSearchUrl, normalizeWebUrl } from './actionUrls';

test('whatsapp uses wa.me https with digits only', () => {
  expect(buildWhatsAppUrl('+1 (555) 234', 'hi there')).toBe('https://wa.me/1555234?text=hi%20there');
});

test('whatsapp without a number', () => {
  expect(buildWhatsAppUrl('', 'hey')).toBe('https://wa.me/?text=hey');
});

test('sms separator differs by platform', () => {
  expect(buildSmsUrl('555', 'yo', 'ios')).toBe('sms:555&body=yo');
  expect(buildSmsUrl('555', 'yo', 'android')).toBe('sms:555?body=yo');
});

test('sms with no body has no separator', () => {
  expect(buildSmsUrl('555', '', 'android')).toBe('sms:555');
});

test('maps, search, and normalize', () => {
  expect(buildMapsUrl('Cairo')).toBe('https://www.google.com/maps/dir/?api=1&destination=Cairo');
  expect(buildSearchUrl('best coffee')).toBe('https://www.google.com/search?q=best%20coffee');
  expect(normalizeWebUrl('example.com')).toBe('https://example.com');
  expect(normalizeWebUrl('https://x.com')).toBe('https://x.com');
});
