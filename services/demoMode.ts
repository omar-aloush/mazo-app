/**
 * Opt-in, development-only walkthrough. It never calls an AI provider.
 * Web: open /chat?demo=1 (or ?demo=0 to leave); the choice lasts for this tab.
 * Native dev build: set EXPO_PUBLIC_DEMO_MODE=1 before starting Metro.
 */
export function isLocalDemoMode(): boolean {
  if (typeof __DEV__ === 'undefined' || !__DEV__) return false;
  if (process.env.EXPO_PUBLIC_DEMO_MODE === '1' || process.env.EXPO_PUBLIC_DEMO_MODE === 'true') return true;
  if (typeof window === 'undefined') return false;

  try {
    const requested = new URLSearchParams(window.location.search).get('demo');
    if (requested === '1' || requested === '0') {
      window.sessionStorage.setItem('mazo-local-demo', requested);
      return requested === '1';
    }
    return window.sessionStorage.getItem('mazo-local-demo') === '1';
  } catch {
    return false;
  }
}
