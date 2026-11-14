/**
 * Locale store: persisted preference, RU default, document.lang sync.
 * Classic writable store (works in Svelte 5, testable without the compiler).
 */
import { get, writable } from 'svelte/store';
import {
  applyDocumentLang,
  DEFAULT_LOCALE,
  persistLocale,
  storedLocale,
  translate,
  type Locale,
  type MessageKey
} from '#lib/i18n/index';

export const locale = writable<Locale>(DEFAULT_LOCALE);

/** Initialize from persistence; call once from the root layout. */
export function initLocale(): void {
  const stored = storedLocale();
  locale.set(stored);
  applyDocumentLang(stored);
}

export function setLocale(next: Locale): void {
  locale.set(next);
  persistLocale(next);
  applyDocumentLang(next);
}

/** Reactive translate helper: use $locale + t('key') in components. */
export function t(key: MessageKey, params?: Record<string, string>): string {
  return translate(get(locale), key, params);
}

export { translate, type Locale, type MessageKey };
