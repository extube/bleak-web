/**
 * Minimal typed i18n for RU (primary) and EN (second), Concept §2.
 * Hand-rolled on purpose: two dictionaries, no runtime deps, a few hundred
 * bytes — heavyweight i18n frameworks would dominate the bundle budget.
 */
import type { MessageKey } from './en';
import { en } from './en';
import { ru } from './ru';

export type Locale = 'ru' | 'en';
export const LOCALES: Locale[] = ['ru', 'en'];
export const DEFAULT_LOCALE: Locale = 'ru';

const dictionaries: Record<Locale, Record<MessageKey, string>> = { ru, en };

const STORAGE_KEY = 'bleak.locale';
const HTML_LANG = 'lang';

export function messages(locale: Locale): Record<MessageKey, string> {
  return dictionaries[locale];
}

/** Translate with optional {placeholders}. Unknown keys fall back to the key. */
export function translate(locale: Locale, key: MessageKey, params?: Record<string, string>): string {
  const template = messages(locale)[key] ?? en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => params[name] ?? match);
}

/** Preferred locale from persistence (localStorage), else RU. */
export function storedLocale(): Locale {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'ru' || value === 'en') return value;
  } catch {
    /* storage unavailable (private mode) — default */
  }
  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    /* ignore */
  }
}

export function applyDocumentLang(locale: Locale): void {
  document.documentElement.setAttribute(HTML_LANG, locale);
}

export { en, ru };
export type { MessageKey };
