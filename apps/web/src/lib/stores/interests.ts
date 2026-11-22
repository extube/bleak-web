/**
 * Local interests MIRROR (DESIGN §4.13.1 item 3): the v3 API carries the
 * real interests endpoints (bulk upsert → 201 with the user's FULL list,
 * delete by keys → 200 with the REMAINING list) but has NO interests GET,
 * so this per-device store is the read source — a documented limitation.
 * Every write goes through the real endpoints; the endpoint responses are
 * mirrored here per room+user under `bleak.interests` (the §1 mock ids
 * store this key held is retired — same key, new scope-mapped shape).
 *
 * The badge reads the mirror; titles are stored as sent (the active UI
 * locale at add time) and re-localized through the catalog for display
 * (`displayInterests`), with the stored title as the fallback for keys
 * missing from the catalog.
 */
import type { Interest } from '@bleak/api-client';
import type { Locale } from '#lib/i18n/index';
import { translate } from '#lib/i18n/locale';
import { catalogByKey } from '#lib/interests/catalog';

export type { Interest } from '@bleak/api-client';

/** One badge chip: numeric key + localized title + emoji. */
export interface InterestChip {
  key: number;
  title: string;
  emoji: string;
}

/** Client-side mirror of the 1..50 rows cap (client pre-flight `ValidationError`). */
export const MAX_INTERESTS = 50;

const STORAGE_KEY = 'bleak.interests';

/** Mirror map: `${roomAddress}|${userAddress}` → the persona's interests. */
type InterestMirror = Record<string, Interest[]>;

function scopeKey(room: string, user: string): string {
  return `${room}|${user}`;
}

function isValidRow(row: Partial<Interest>): row is Interest {
  return (
    typeof row.title === 'string' &&
    typeof row.group === 'number' &&
    Number.isFinite(row.group) &&
    row.group >= 0 &&
    typeof row.key === 'number' &&
    Number.isFinite(row.key) &&
    row.key >= 0 &&
    typeof row.user_address === 'string'
  );
}

function readStorage(): InterestMirror {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const map: InterestMirror = {};
    for (const [scope, rows] of Object.entries(parsed as Record<string, unknown>)) {
      if (!Array.isArray(rows)) continue;
      const valid = rows.filter((row): row is Interest => isValidRow(row as Partial<Interest>));
      if (valid.length > 0) map[scope] = valid;
    }
    return map;
  } catch {
    /* corrupted or unavailable storage — treat as empty */
    return {};
  }
}

function writeStorage(map: InterestMirror): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

/** The persona's mirrored interests, in stored order (empty when none). */
export function loadInterests(room: string, user: string): Interest[] {
  return readStorage()[scopeKey(room, user)] ?? [];
}

/** Current row count in the mirror (the 1..50 picker cap source). */
export function interestCount(room: string, user: string): number {
  return loadInterests(room, user).length;
}

/**
 * Mirror write-through: persist an endpoint response (the 201 FULL list or
 * the 200 REMAINING list) for this persona. Dedupes by key (the server
 * upserts per user on the key) and clamps to the 1..50 cap; returns the
 * normalized list.
 */
export function saveInterests(room: string, user: string, list: readonly Interest[]): Interest[] {
  const byKey = new Map<number, Interest>();
  for (const row of list) {
    if (isValidRow(row) && !byKey.has(row.key)) byKey.set(row.key, row);
  }
  const next = [...byKey.values()].slice(0, MAX_INTERESTS);
  const map = readStorage();
  map[scopeKey(room, user)] = next;
  writeStorage(map);
  return next;
}

/** Remove one persona's mirror (used by tests; the API never lists interests). */
export function clearInterests(room: string, user: string): void {
  const map = readStorage();
  delete map[scopeKey(room, user)];
  writeStorage(map);
}

/**
 * Mirror rows as display chips for the given UI locale: catalog keys are
 * re-localized (title follows the CURRENT locale, not the one at add time);
 * unknown keys fall back to the stored title without an emoji.
 */
export function displayInterests(rows: readonly Interest[], locale: Locale): InterestChip[] {
  return rows.map((row) => {
    const entry = catalogByKey(row.key);
    return {
      key: row.key,
      emoji: entry?.emoji ?? '',
      title: entry ? translate(locale, entry.titleKey) : row.title
    };
  });
}
