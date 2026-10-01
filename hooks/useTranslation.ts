/**
 * useTranslation Hook
 *
 * React hook for i18n translations with automatic re-render on language change.
 *
 * Usage:
 *   const { t, language, setLanguage, isRTL } = useTranslation();
 *   <Text>{t('greeting.morning')}</Text>
 *   <Text>{t('chat.freeMessages', { count: 3 })}</Text>
 */

import { useState, useEffect, useCallback } from 'react';
import {
    t as translate,
    getLanguage,
    setLanguage as setLang,
    isRTL as checkRTL,
    onLanguageChange,
    getAvailableLanguages,
    type SupportedLanguage,
} from '@/i18n/i18n';

export function useTranslation() {
    const [language, setLanguageState] = useState<SupportedLanguage>(getLanguage());

    useEffect(() => {
        const unsubscribe = onLanguageChange((newLang) => {
            setLanguageState(newLang);
        });
        return unsubscribe;
    }, []);

    const changeLanguage = useCallback(async (lang: SupportedLanguage) => {
        await setLang(lang);
    }, []);

    return {
        /** Translate a key with optional interpolation params */
        t: translate,
        /** Current language code */
        language,
        /** Change the app language */
        setLanguage: changeLanguage,
        /** Whether current language is RTL */
        isRTL: checkRTL(),
        /** List of available languages */
        languages: getAvailableLanguages(),
    };
}
