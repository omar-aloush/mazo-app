import AsyncStorage from '@react-native-async-storage/async-storage';

// Key for storing pending coach import code
const PENDING_IMPORT_KEY = 'pendingCoachImport';

export async function redirectSystemPath({
  path,
  initial,
}: { path: string; initial: boolean }): Promise<string> {
  // Check for coach import deep link: /import?c=<encoded_coach_data>
  if (path.startsWith('/import')) {
    try {
      const url = new URL(`mazo://${path}`);
      const coachCode = url.searchParams.get('c');

      if (coachCode) {
        // Decode the coach code and store it for auto-import
        const decodedCode = decodeURIComponent(coachCode);
        await AsyncStorage.setItem(PENDING_IMPORT_KEY, decodedCode);

        // Redirect to coaches tab where the code will be auto-imported
        return '/(tabs)/coaches';
      }
    } catch (error) {
      console.error('Failed to parse import deep link:', error);
    }
  }

  // Home-screen widget deep links (mazo://chat | mazo://focus | mazo://command).
  if (path.includes('focus')) return '/focus-guardian';
  if (path.includes('command')) return '/(tabs)/system';
  if (path.includes('chat')) return '/(tabs)/chat';
  if (path.includes('first-launch')) {
    const qIdx = path.indexOf('?');
    return qIdx !== -1 ? `/first-launch${path.substring(qIdx)}` : '/first-launch';
  }
  if (path.includes('coaches')) return '/(tabs)/coaches';
  if (path.includes('intro')) return '/mazo-intro';

  // Default: go to home
  return '/';
}