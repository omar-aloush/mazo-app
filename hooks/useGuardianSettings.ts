import { useCallback, useEffect, useState } from 'react';
import { GuardianSettings, DEFAULT_GUARDIAN_SETTINGS } from '@/services/guardian';
import { loadGuardianSettings, saveGuardianSettings } from '@/services/focusGuard';

/** Loads + persists the Exam Guardian settings, mirroring useFocusGuardSettings. */
export function useGuardianSettings() {
  const [settings, setSettings] = useState<GuardianSettings>(DEFAULT_GUARDIAN_SETTINGS);

  useEffect(() => {
    loadGuardianSettings().then(setSettings);
  }, []);

  const setField = useCallback(<K extends keyof GuardianSettings>(key: K, value: GuardianSettings[K]) => {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      saveGuardianSettings(next);
      return next;
    });
  }, []);

  return { settings, setField };
}
