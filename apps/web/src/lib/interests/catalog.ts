/**
 * Curated interests catalog — the §23.2 5.5 THEMES model (2026-11-20
 * owner amendment; supersedes the tz5-02 5×5 groups). Each interest group
 * is a "theme" with an id slug; picking a theme offers that theme's
 * dedicated TOPICS (music → composers/rock/jazz/rap…, sport → ice
 * hockey/running/football…). EIGHT themes × six topics = 48 rows, inside
 * the client pre-flight caps (1..50 rows, title 1..64 symbols) enforced
 * by `@bleak/api-client` (`ValidationError`).
 *
 * The API contract stays NUMERIC (server Interest model: numeric `group`
 * category + numeric `key`, unique per user, free 1..64 title): the
 * theme/topic slugs ride in the TITLE string as `'<theme>:<topic>'`
 * (e.g. `music:rock`, `sport:hockey`) — `interestApiTitle()` composes it,
 * `interestTitle()` (i18n) is for DISPLAY. The badge re-localizes through
 * the catalog by numeric key, as before.
 */
import { translate } from '#lib/i18n/locale';
import type { Locale, MessageKey } from '#lib/i18n/index';

/** One catalog theme heading (the renamed interest group): numeric group
 * + its id slug + the i18n title key (e.g. `interests.group.0`). */
export interface InterestCatalogGroup {
  /** Numeric category sent to the API (`Interest.group`, ≥ 0). */
  group: number;
  /** Theme id used in the stored title (`<theme>:<topic>`). */
  slug: string;
  /** Dictionary key of the theme heading (e.g. `interests.group.0`). */
  titleKey: MessageKey;
}

/** One catalog topic: numeric pair + id slug + emoji + the i18n title key. */
export interface InterestCatalogEntry {
  /** Numeric category (shared with the theme above). */
  group: number;
  /** Numeric interest id, unique per user (server upserts on it). */
  key: number;
  /** Topic id used in the stored title (`<theme>:<topic>`). */
  slug: string;
  /** Short icon per the §1 owner note «icon with short hobby + emoji». */
  emoji: string;
  /** Dictionary key of the title (e.g. `interests.k13`). */
  titleKey: MessageKey;
}

export const INTEREST_GROUPS: readonly InterestCatalogGroup[] = [
  { group: 0, slug: 'music', titleKey: 'interests.group.0' },
  { group: 1, slug: 'sport', titleKey: 'interests.group.1' },
  { group: 2, slug: 'food', titleKey: 'interests.group.2' },
  { group: 3, slug: 'art', titleKey: 'interests.group.3' },
  { group: 4, slug: 'computer', titleKey: 'interests.group.4' },
  { group: 5, slug: 'science', titleKey: 'interests.group.5' },
  { group: 6, slug: 'architecture', titleKey: 'interests.group.6' },
  { group: 7, slug: 'travel', titleKey: 'interests.group.7' }
];

export const INTEREST_CATALOG: readonly InterestCatalogEntry[] = [
  // 0 — music
  { group: 0, key: 1, slug: 'classics', emoji: '🎼', titleKey: 'interests.k1' },
  { group: 0, key: 2, slug: 'rock', emoji: '🎸', titleKey: 'interests.k2' },
  { group: 0, key: 3, slug: 'jazz', emoji: '🎷', titleKey: 'interests.k3' },
  { group: 0, key: 4, slug: 'rap', emoji: '🎤', titleKey: 'interests.k4' },
  { group: 0, key: 5, slug: 'electronic', emoji: '🎛️', titleKey: 'interests.k5' },
  { group: 0, key: 6, slug: 'indie', emoji: '🌌', titleKey: 'interests.k6' },
  // 1 — sport
  { group: 1, key: 7, slug: 'hockey', emoji: '🏒', titleKey: 'interests.k7' },
  { group: 1, key: 8, slug: 'running', emoji: '🏃', titleKey: 'interests.k8' },
  { group: 1, key: 9, slug: 'football', emoji: '⚽', titleKey: 'interests.k9' },
  { group: 1, key: 10, slug: 'yoga', emoji: '🧘', titleKey: 'interests.k10' },
  { group: 1, key: 11, slug: 'hiking', emoji: '🥾', titleKey: 'interests.k11' },
  { group: 1, key: 12, slug: 'cycling', emoji: '🚲', titleKey: 'interests.k12' },
  // 2 — food & drinks
  { group: 2, key: 13, slug: 'coffee', emoji: '☕', titleKey: 'interests.k13' },
  { group: 2, key: 14, slug: 'tea', emoji: '🍵', titleKey: 'interests.k14' },
  { group: 2, key: 15, slug: 'cooking', emoji: '🍳', titleKey: 'interests.k15' },
  { group: 2, key: 16, slug: 'wine', emoji: '🍷', titleKey: 'interests.k16' },
  { group: 2, key: 17, slug: 'desserts', emoji: '🍰', titleKey: 'interests.k17' },
  { group: 2, key: 18, slug: 'street_food', emoji: '🌮', titleKey: 'interests.k18' },
  // 3 — art
  { group: 3, key: 19, slug: 'painting', emoji: '🖼️', titleKey: 'interests.k19' },
  { group: 3, key: 20, slug: 'photography', emoji: '📷', titleKey: 'interests.k20' },
  { group: 3, key: 21, slug: 'cinema', emoji: '🎬', titleKey: 'interests.k21' },
  { group: 3, key: 22, slug: 'books', emoji: '📚', titleKey: 'interests.k22' },
  { group: 3, key: 23, slug: 'theatre', emoji: '🎭', titleKey: 'interests.k23' },
  { group: 3, key: 24, slug: 'design', emoji: '✏️', titleKey: 'interests.k24' },
  // 4 — computers
  { group: 4, key: 25, slug: 'programming', emoji: '💻', titleKey: 'interests.k25' },
  { group: 4, key: 26, slug: 'ai', emoji: '🤖', titleKey: 'interests.k26' },
  { group: 4, key: 27, slug: 'games', emoji: '🎮', titleKey: 'interests.k27' },
  { group: 4, key: 28, slug: 'gadgets', emoji: '📱', titleKey: 'interests.k28' },
  { group: 4, key: 29, slug: 'opensource', emoji: '🐧', titleKey: 'interests.k29' },
  { group: 4, key: 30, slug: 'hardware', emoji: '🔧', titleKey: 'interests.k30' },
  // 5 — science
  { group: 5, key: 31, slug: 'physics', emoji: '⚛️', titleKey: 'interests.k31' },
  { group: 5, key: 32, slug: 'biology', emoji: '🧬', titleKey: 'interests.k32' },
  { group: 5, key: 33, slug: 'space', emoji: '🚀', titleKey: 'interests.k33' },
  { group: 5, key: 34, slug: 'math', emoji: '🧮', titleKey: 'interests.k34' },
  { group: 5, key: 35, slug: 'chemistry', emoji: '⚗️', titleKey: 'interests.k35' },
  { group: 5, key: 36, slug: 'robotics', emoji: '🦾', titleKey: 'interests.k36' },
  // 6 — architecture
  { group: 6, key: 37, slug: 'modernism', emoji: '🏢', titleKey: 'interests.k37' },
  { group: 6, key: 38, slug: 'gothic', emoji: '⛪', titleKey: 'interests.k38' },
  { group: 6, key: 39, slug: 'urbanism', emoji: '🗺️', titleKey: 'interests.k39' },
  { group: 6, key: 40, slug: 'interiors', emoji: '🛋️', titleKey: 'interests.k40' },
  { group: 6, key: 41, slug: 'bridges', emoji: '🌉', titleKey: 'interests.k41' },
  { group: 6, key: 42, slug: 'monuments', emoji: '🗿', titleKey: 'interests.k42' },
  // 7 — travel
  { group: 7, key: 43, slug: 'backpacking', emoji: '🎒', titleKey: 'interests.k43' },
  { group: 7, key: 44, slug: 'road_trips', emoji: '🚗', titleKey: 'interests.k44' },
  { group: 7, key: 45, slug: 'camping', emoji: '⛺', titleKey: 'interests.k45' },
  { group: 7, key: 46, slug: 'sea', emoji: '🌊', titleKey: 'interests.k46' },
  { group: 7, key: 47, slug: 'cities', emoji: '🏙️', titleKey: 'interests.k47' },
  { group: 7, key: 48, slug: 'mountains', emoji: '🏔️', titleKey: 'interests.k48' }
];

const BY_KEY = new Map(INTEREST_CATALOG.map((entry) => [entry.key, entry]));
const THEME_BY_GROUP = new Map(INTEREST_GROUPS.map((g) => [g.group, g]));

/** Catalog entry by numeric key (unknown keys — e.g. legacy rows — miss). */
export function catalogByKey(key: number): InterestCatalogEntry | undefined {
  return BY_KEY.get(key);
}

/** Localized display title of one catalog topic. */
export function interestTitle(entry: InterestCatalogEntry, locale: Locale): string {
  return translate(locale, entry.titleKey);
}

/** Localized heading of a catalog theme (empty string for unknown groups). */
export function groupTitle(group: number, locale: Locale): string {
  const key = INTEREST_GROUPS.find((g) => g.group === group)?.titleKey;
  return key === undefined ? '' : translate(locale, key);
}

/**
 * The STORED title per §23.2 5.5: `'<theme slug>:<topic slug>'`
 * (e.g. `music:rock`) — the slugs ride the free 1..64 title string; the
 * numeric (group, key) pair keeps the server contract.
 */
export function interestApiTitle(entry: InterestCatalogEntry): string {
  const theme = THEME_BY_GROUP.get(entry.group);
  return `${theme?.slug ?? 'unknown'}:${entry.slug}`;
}
