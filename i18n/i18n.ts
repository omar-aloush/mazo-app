/**
 * i18n Translation Engine
 *
 * Lightweight internationalization for Mazō.
 * Supports English and Arabic with RTL layout switching.
 *
 * Usage:
 *   import { t, setLanguage, getLanguage } from '@/i18n/i18n';
 *   t('greeting.morning')          → "Good morning"
 *   t('chat.freeMessages', { count: 3 }) → "3 free messages left"
 */

import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import en from './en.json';
import ar from './ar.json';
import es from './es.json';
import fr from './fr.json';
import de from './de.json';
import pt from './pt.json';
import ru from './ru.json';
import zh from './zh.json';
import ja from './ja.json';
import ko from './ko.json';
import hi from './hi.json';
import tr from './tr.json';
import id from './id.json';
import it from './it.json';

export type SupportedLanguage = 'en' | 'ar' | 'es' | 'fr' | 'de' | 'pt' | 'ru' | 'zh' | 'ja' | 'ko' | 'hi' | 'tr' | 'id' | 'it';

const SUPPORTED_LANGUAGES: SupportedLanguage[] = ['en', 'ar', 'es', 'fr', 'de', 'pt', 'ru', 'zh', 'ja', 'ko', 'hi', 'tr', 'id', 'it'];

const translations: Record<SupportedLanguage, Record<string, any>> = { en, ar, es, fr, de, pt, ru, zh, ja, ko, hi, tr, id, it };

const LANGUAGE_KEY = 'mazo_language';

let currentLanguage: SupportedLanguage = 'en';
let listeners: Array<(lang: SupportedLanguage) => void> = [];

/**
 * Get a nested value from an object using dot-notation.
 * e.g. resolve(obj, 'greeting.morning') → obj.greeting.morning
 */
function resolve(obj: any, path: string): string | undefined {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

/**
 * Translate a key, with optional interpolation.
 *
 * @param key    Dot-notation key, e.g. 'chat.freeMessages'
 * @param params Values to interpolate, e.g. { count: 3 }
 * @returns      Translated string, or the key itself as fallback
 */
export function t(key: string, params?: Record<string, string | number>): string {
    let value = resolve(translations[currentLanguage], key);

    // Fallback to English if key not found in current language
    if (value === undefined && currentLanguage !== 'en') {
        value = resolve(translations.en, key);
    }

    // Final fallback: return the key itself
    if (value === undefined) {
        if (__DEV__) console.warn(`[i18n] Missing key: "${key}"`);
        return key;
    }

    // Interpolate {{param}} placeholders
    if (params) {
        Object.entries(params).forEach(([paramKey, paramValue]) => {
            value = value!.replace(new RegExp(`\\{\\{${paramKey}\\}\\}`, 'g'), String(paramValue));
        });
    }

    return value;
}

/**
 * Get the current language.
 */
export function getLanguage(): SupportedLanguage {
    return currentLanguage;
}

/**
 * Check if current language is RTL.
 */
export function isRTL(): boolean {
    return currentLanguage === 'ar';
}

/**
 * Set the app language. Persists to AsyncStorage and updates RTL.
 * Note: RTL changes require an app restart to take full effect.
 */
export async function setLanguage(lang: SupportedLanguage): Promise<void> {
    currentLanguage = lang;
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);

    // Update RTL layout direction
    const shouldBeRTL = lang === 'ar';
    if (I18nManager.isRTL !== shouldBeRTL) {
        I18nManager.allowRTL(shouldBeRTL);
        I18nManager.forceRTL(shouldBeRTL);
    }

    // Notify all listeners
    listeners.forEach((fn) => fn(lang));
}

/**
 * Load saved language from AsyncStorage.
 * Call this once at app startup.
 */
export async function loadSavedLanguage(): Promise<SupportedLanguage> {
    try {
        const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
            currentLanguage = saved as SupportedLanguage;
        } else {
            // No saved language, try to match system language
            const systemLocales = Localization.getLocales();
            if (systemLocales && systemLocales.length > 0) {
                const systemLang = systemLocales[0].languageCode as SupportedLanguage;
                // Check if system locale is one of our supported ones
                if (SUPPORTED_LANGUAGES.includes(systemLang as SupportedLanguage)) {
                    currentLanguage = systemLang as SupportedLanguage;
                    // Persist to storage so we don't have to detect again every time
                    await AsyncStorage.setItem(LANGUAGE_KEY, systemLang);
                }
            }
        }

        // Ensure RTL matches current session
        const shouldBeRTL = currentLanguage === 'ar';
        if (I18nManager.isRTL !== shouldBeRTL) {
            I18nManager.allowRTL(shouldBeRTL);
            I18nManager.forceRTL(shouldBeRTL);
        }

        // Notify all listeners after loading
        listeners.forEach((fn) => fn(currentLanguage));
    } catch {
        // Default to English
    }
    return currentLanguage;
}

/**
 * Subscribe to language changes. Returns unsubscribe function.
 */
export function onLanguageChange(callback: (lang: SupportedLanguage) => void): () => void {
    listeners.push(callback);
    return () => {
        listeners = listeners.filter((fn) => fn !== callback);
    };
}

/**
 * Get list of available languages.
 */
export function getAvailableLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
    return [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
        { code: 'es', name: 'Spanish', nativeName: 'Español' },
        { code: 'fr', name: 'French', nativeName: 'Français' },
        { code: 'de', name: 'German', nativeName: 'Deutsch' },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
        { code: 'ru', name: 'Russian', nativeName: 'Русский' },
        { code: 'zh', name: 'Chinese', nativeName: '中文' },
        { code: 'ja', name: 'Japanese', nativeName: '日本語' },
        { code: 'ko', name: 'Korean', nativeName: '한국어' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
        { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
        { code: 'id', name: 'Indonesian', nativeName: 'Bahasa Indonesia' },
        { code: 'it', name: 'Italian', nativeName: 'Italiano' },
    ];
}
