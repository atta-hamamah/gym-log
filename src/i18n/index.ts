import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import en from './locales/en.json';
import fr from './locales/fr.json';
import hi from './locales/hi.json';
import es from './locales/es.json';
import ar from './locales/ar.json';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'hi', 'es', 'ar'] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
    en: 'English',
    fr: 'Français',
    hi: 'हिन्दी',
    es: 'Español',
    ar: 'العربية',
};

/** AsyncStorage key for persisted language */
const LANGUAGE_STORAGE_KEY = '@gym_log_language';

/** Languages that require RTL layout */
export const RTL_LANGUAGES: SupportedLanguage[] = ['ar'];

/** Returns true if the given language code is RTL */
export function isRTL(lang: SupportedLanguage): boolean {
    return RTL_LANGUAGES.includes(lang);
}

/** Save the selected language to persistent storage */
export async function saveLanguagePreference(lang: SupportedLanguage): Promise<void> {
    try {
        await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (e) {
        console.warn('Failed to save language preference:', e);
    }
}

/** Load the saved language from persistent storage */
export async function loadLanguagePreference(): Promise<SupportedLanguage | null> {
    try {
        const saved = await AsyncStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (saved && SUPPORTED_LANGUAGES.includes(saved as SupportedLanguage)) {
            return saved as SupportedLanguage;
        }
    } catch (e) {
        console.warn('Failed to load language preference:', e);
    }
    return null;
}

/**
 * Detect the device language and return a supported language code.
 * Falls back to 'en' if the device language is not supported.
 */
function getDeviceLanguage(): SupportedLanguage {
    const locales = Localization.getLocales();
    if (locales && locales.length > 0) {
        const deviceLang = locales[0].languageCode;
        if (deviceLang && SUPPORTED_LANGUAGES.includes(deviceLang as SupportedLanguage)) {
            return deviceLang as SupportedLanguage;
        }
    }
    return 'en';
}

const detectedLang = getDeviceLanguage();

// Apply RTL on startup if the detected language needs it
I18nManager.forceRTL(isRTL(detectedLang));
I18nManager.allowRTL(isRTL(detectedLang));

i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        fr: { translation: fr },
        hi: { translation: hi },
        es: { translation: es },
        ar: { translation: ar },
    },
    lng: detectedLang,
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false,
    },
    compatibilityJSON: 'v4',
});

// Load saved language and apply it (async, runs after initial render)
loadLanguagePreference().then((savedLang) => {
    if (savedLang && savedLang !== i18n.language) {
        i18n.changeLanguage(savedLang);
        // Also handle RTL if needed
        const needsRTL = isRTL(savedLang);
        if (I18nManager.isRTL !== needsRTL) {
            I18nManager.forceRTL(needsRTL);
            I18nManager.allowRTL(needsRTL);
        }
    }
});

export default i18n;
