/**
 * Pure URL builders for the Agent's link-based actions. Kept separate from the
 * executors so the string logic is unit-testable without native modules. Prefer
 * https deep links (wa.me, google.com) — Android routes them to the installed
 * app via App Links and falls back to the browser, which is more reliable than
 * a bare custom scheme.
 */

/** WhatsApp via the universal https link — opens the app if installed, else web. */
export function buildWhatsAppUrl(to: string, body: string): string {
  const digits = (to ?? '').replace(/[^0-9]/g, '');
  const text = `?text=${encodeURIComponent(body ?? '')}`;
  return digits ? `https://wa.me/${digits}${text}` : `https://wa.me/${text}`;
}

/** Native SMS composer. iOS uses `&body=`, Android uses `?body=`. */
export function buildSmsUrl(to: string, body: string, platform: 'ios' | 'android'): string {
  const num = (to ?? '').replace(/[^0-9+]/g, '');
  if (!body) return `sms:${num}`;
  const sep = platform === 'ios' ? '&' : '?';
  return `sms:${num}${sep}body=${encodeURIComponent(body)}`;
}

/** Google Maps directions to a destination. */
export function buildMapsUrl(destination: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
}

/** Google web search. */
export function buildSearchUrl(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
}

/** Ensure a bare host gets an https scheme; leave existing schemes intact. */
export function normalizeWebUrl(url: string): string {
  const u = (url ?? '').trim();
  return /^[a-z]+:\/\//i.test(u) ? u : `https://${u}`;
}
