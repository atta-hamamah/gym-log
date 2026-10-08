import { format, type Locale } from 'date-fns';
// Per-locale imports: the 'date-fns/locale' barrel would bundle every locale.
import { ar } from 'date-fns/locale/ar';
import { es } from 'date-fns/locale/es';
import { fr } from 'date-fns/locale/fr';
import { hi } from 'date-fns/locale/hi';
import i18n from '../i18n';

const LOCALES: Record<string, Locale> = { ar, es, fr, hi };

/** date-fns `format` in the app's current language (English when no locale matches). */
export function formatDate(date: Date | number, pattern: string): string {
    return format(date, pattern, { locale: LOCALES[i18n.language] });
}
