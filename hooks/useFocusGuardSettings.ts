import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_FOCUS_GUARD_SETTINGS,
  FocusGuardSettings,
  loadFocusGuardSettings,
  saveFocusGuardSettings,
} from '@/services/focusGuard';

/**
 * Loads + persists the Focus Guardian settings (master toggle + blocked apps).
 * Backed by the same AsyncStorage key the session-arming helper reads, so the
 * setup screen and the focus-session lifecycle never drift out of sync.
 */
export function useFocusGuardSettings() {
  const [settings, setSettings] = useState<FocusGuardSettings>(DEFAULT_FOCUS_GUARD_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Mirror of `settings` so the callbacks below always read the latest value
  // without being re-created on every change.
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let active = true;
    loadFocusGuardSettings().then((s) => {
      if (active) {
        setSettings(s);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const update = useCallback((next: FocusGuardSettings) => {
    setSettings(next);
    void saveFocusGuardSettings(next);
  }, []);

  const setEnabled = useCallback(
    (enabled: boolean) => update({ ...settingsRef.current, enabled }),
    [update],
  );

  const togglePackage = useCallback(
    (packageName: string) => {
      const current = settingsRef.current;
      const has = current.blockedPackages.includes(packageName);
      const blockedPackages = has
        ? current.blockedPackages.filter((p) => p !== packageName)
        : [...current.blockedPackages, packageName];
      update({ ...current, blockedPackages });
    },
    [update],
  );

  return { settings, loaded, setEnabled, togglePackage };
}
