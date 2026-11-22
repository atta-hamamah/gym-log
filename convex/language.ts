/** The app's languages, as the AI models should read them. */
const LANGUAGES: Record<string, string> = { en: "English", ar: "Arabic", fr: "French", es: "Spanish", hi: "Hindi" };

/** Base language code from an app language ("fr-FR" → "fr"). */
export const languageCode = (code?: string) => (code ?? "en").split("-")[0].toLowerCase();

/** Language name for the model, from an app language code ("ar", "fr-FR"...). */
export const languageName = (code?: string) => LANGUAGES[languageCode(code)] ?? "English";
