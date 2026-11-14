/**
 * Mock interests model (ARCHITECTURE §8.1, owner plan): the future backend
 * field is an array of short hobby labels + emoji; v1 ships the SAME shape
 * client-side only — a preset catalog (RU/EN label pairs shipped with the
 * app) and the user's selection persisted in localStorage
 * (`bleak.interests`, ids only — labels follow the UI locale).
 *
 * NO network request is ever issued from here (DESIGN §3.6 AC 5): when
 * bleak-node ships the real field, the API value replaces the selection and
 * `Interest { id, label, emoji }` stays the adapter target.
 */
import type { Locale } from '#lib/i18n/index';

/** The shape the future backend field takes (architecture §8.1). */
export interface Interest {
  id: string;
  label: string;
  emoji: string;
}

/** One preset catalog entry: locale-independent id + per-locale labels. */
export interface InterestEntry {
  id: string;
  emoji: string;
  labels: Record<Locale, string>;
}

export const INTEREST_CATALOG: readonly InterestEntry[] = [
  { id: 'coffee', emoji: '☕', labels: { ru: 'Кофе', en: 'Coffee' } },
  { id: 'music', emoji: '🎵', labels: { ru: 'Музыка', en: 'Music' } },
  { id: 'sport', emoji: '⚽', labels: { ru: 'Спорт', en: 'Sport' } },
  { id: 'travel', emoji: '✈️', labels: { ru: 'Путешествия', en: 'Travel' } },
  { id: 'books', emoji: '📚', labels: { ru: 'Книги', en: 'Books' } },
  { id: 'cooking', emoji: '🍳', labels: { ru: 'Кулинария', en: 'Cooking' } },
  { id: 'photo', emoji: '📷', labels: { ru: 'Фото', en: 'Photography' } },
  { id: 'games', emoji: '🎮', labels: { ru: 'Игры', en: 'Games' } },
  { id: 'cycling', emoji: '🚲', labels: { ru: 'Велосипед', en: 'Cycling' } },
  { id: 'hiking', emoji: '🥾', labels: { ru: 'Походы', en: 'Hiking' } },
  { id: 'art', emoji: '🎨', labels: { ru: 'Искусство', en: 'Art' } },
  { id: 'tech', emoji: '💻', labels: { ru: 'Технологии', en: 'Technology' } }
];

const STORAGE_KEY = 'bleak.interests';

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id): id is string => typeof id === 'string');
  } catch {
    /* corrupted or unavailable storage — treat as empty */
    return [];
  }
}

function writeStorage(ids: readonly string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

/** Restored selection (ids, insertion order, deduped). */
export function loadInterestIds(): string[] {
  const ids = readStorage();
  return [...new Set(ids)];
}

/** Persist a selection; returns the normalized (deduped) list. */
export function saveInterestIds(ids: readonly string[]): string[] {
  const next = [...new Set(ids)];
  writeStorage(next);
  return next;
}

/** Toggle one catalog id in the selection and persist it. */
export function toggleInterestId(ids: readonly string[], id: string): string[] {
  return saveInterestIds(
    ids.includes(id) ? ids.filter((current) => current !== id) : [...ids, id]
  );
}

export function clearInterests(): void {
  writeStorage([]);
}

/** One catalog entry as the flat `Interest` shape for the given locale. */
export function toInterest(entry: InterestEntry, locale: Locale): Interest {
  const label = entry.labels[locale] ?? entry.labels.ru;
  return { id: entry.id, label, emoji: entry.emoji };
}

/** Selection rendered as `Interest[]` in the given UI locale. */
export function selectedInterests(ids: readonly string[], locale: Locale): Interest[] {
  const byId = new Map(INTEREST_CATALOG.map((entry) => [entry.id, entry]));
  const interests: Interest[] = [];
  for (const id of ids) {
    const entry = byId.get(id);
    if (entry) interests.push(toInterest(entry, locale));
  }
  return interests;
}
