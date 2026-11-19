/**
 * Curated interests catalog (DESIGN §4.13.1 item 1, Concept §13.1.1):
 * a static, client-side catalog backing the interests picker and the
 * badge chips. The API carries NUMERIC `group` (category) and `key`
 * (concrete interest, unique per user) fields only — no titles — so the
 * human-readable labels ship here: each entry carries an emoji plus an
 * i18n dictionary key (`interests.group.<n>` / `interests.k<n>`,
 * RU/EN in lib/i18n). The key is GLOBALLY unique across the catalog
 * (1..25): the server upserts per user by `key`, and DELETE addresses
 * rows by `key` alone — globally unique keys make every (group, key)
 * pair unambiguous for the exact-match scoring (same group AND key).
 *
 * Caps (DESIGN §4.13.1 item 6): the catalog is small by design and stays
 * inside the client pre-flight limits (1..50 rows, title 1..64 symbols)
 * enforced by `@bleak/api-client` (`ValidationError`).
 */
import { translate } from '#lib/i18n/locale';
import type { Locale, MessageKey } from '#lib/i18n/index';

/** One catalog group heading: numeric group + its i18n title key. */
export interface InterestCatalogGroup {
  /** Numeric category sent to the API (`Interest.group`, ≥ 0). */
  group: number;
  /** Dictionary key of the group heading (e.g. `interests.group.0`). */
  titleKey: MessageKey;
}

/** One catalog entry: numeric pair + emoji + the i18n title key. */
export interface InterestCatalogEntry {
  /** Numeric category (shared with the group above). */
  group: number;
  /** Numeric interest id, unique per user (server upserts on it). */
  key: number;
  /** Short icon per the §1 owner note «icon with short hobby + emoji». */
  emoji: string;
  /** Dictionary key of the title (e.g. `interests.k13`). */
  titleKey: MessageKey;
}

export const INTEREST_GROUPS: readonly InterestCatalogGroup[] = [
  { group: 0, titleKey: 'interests.group.0' },
  { group: 1, titleKey: 'interests.group.1' },
  { group: 2, titleKey: 'interests.group.2' },
  { group: 3, titleKey: 'interests.group.3' },
  { group: 4, titleKey: 'interests.group.4' }
];

export const INTEREST_CATALOG: readonly InterestCatalogEntry[] = [
  // 0 — food & drinks
  { group: 0, key: 1, emoji: '☕', titleKey: 'interests.k1' },
  { group: 0, key: 2, emoji: '🍵', titleKey: 'interests.k2' },
  { group: 0, key: 3, emoji: '🍳', titleKey: 'interests.k3' },
  { group: 0, key: 4, emoji: '🍷', titleKey: 'interests.k4' },
  { group: 0, key: 5, emoji: '🍰', titleKey: 'interests.k5' },
  // 1 — art & music
  { group: 1, key: 6, emoji: '🎵', titleKey: 'interests.k6' },
  { group: 1, key: 7, emoji: '🎨', titleKey: 'interests.k7' },
  { group: 1, key: 8, emoji: '📷', titleKey: 'interests.k8' },
  { group: 1, key: 9, emoji: '🎬', titleKey: 'interests.k9' },
  { group: 1, key: 10, emoji: '📚', titleKey: 'interests.k10' },
  // 2 — sport & outdoors
  { group: 2, key: 11, emoji: '⚽', titleKey: 'interests.k11' },
  { group: 2, key: 12, emoji: '🏃', titleKey: 'interests.k12' },
  { group: 2, key: 13, emoji: '🚲', titleKey: 'interests.k13' },
  { group: 2, key: 14, emoji: '🥾', titleKey: 'interests.k14' },
  { group: 2, key: 15, emoji: '🧘', titleKey: 'interests.k15' },
  // 3 — tech & games
  { group: 3, key: 16, emoji: '💻', titleKey: 'interests.k16' },
  { group: 3, key: 17, emoji: '🎮', titleKey: 'interests.k17' },
  { group: 3, key: 18, emoji: '🔬', titleKey: 'interests.k18' },
  { group: 3, key: 19, emoji: '🤖', titleKey: 'interests.k19' },
  { group: 3, key: 20, emoji: '🧠', titleKey: 'interests.k20' },
  // 4 — travel & city
  { group: 4, key: 21, emoji: '✈️', titleKey: 'interests.k21' },
  { group: 4, key: 22, emoji: '🚗', titleKey: 'interests.k22' },
  { group: 4, key: 23, emoji: '⛺', titleKey: 'interests.k23' },
  { group: 4, key: 24, emoji: '🌊', titleKey: 'interests.k24' },
  { group: 4, key: 25, emoji: '🏙️', titleKey: 'interests.k25' }
];

const BY_KEY = new Map(INTEREST_CATALOG.map((entry) => [entry.key, entry]));
const GROUP_TITLE_KEYS = new Map(INTEREST_GROUPS.map((g) => [g.group, g.titleKey]));

/** Catalog entry by numeric key (unknown keys — e.g. future rows — miss). */
export function catalogByKey(key: number): InterestCatalogEntry | undefined {
  return BY_KEY.get(key);
}

/** Localized title of one catalog entry. */
export function interestTitle(entry: InterestCatalogEntry, locale: Locale): string {
  return translate(locale, entry.titleKey);
}

/** Localized heading of a catalog group (empty string for unknown groups). */
export function groupTitle(group: number, locale: Locale): string {
  const key = GROUP_TITLE_KEYS.get(group);
  return key === undefined ? '' : translate(locale, key);
}
