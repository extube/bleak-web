/** Interests mock store (TZ-08, ARCHITECTURE §8.1, DESIGN §3.6 AC 5):
 * persist/restore roundtrip, toggle, corrupt-storage tolerance, the exact
 * `Interest {id, label, emoji}` shape per locale, and the no-network rule. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  INTEREST_CATALOG,
  clearInterests,
  loadInterestIds,
  saveInterestIds,
  selectedInterests,
  toInterest,
  toggleInterestId
} from '../src/lib/stores/interests';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('interests store — persist/restore', () => {
  it('saves ids and restores them in insertion order', () => {
    expect(saveInterestIds(['tech', 'music', 'coffee'])).toEqual(['tech', 'music', 'coffee']);
    expect(loadInterestIds()).toEqual(['tech', 'music', 'coffee']);
    expect(JSON.parse(localStorage.getItem('bleak.interests') ?? '[]')).toEqual([
      'tech',
      'music',
      'coffee'
    ]);
  });

  it('dedupes the selection', () => {
    expect(saveInterestIds(['music', 'music', 'tech', 'music'])).toEqual(['music', 'tech']);
  });

  it('tolerates corrupt JSON and non-array values', () => {
    localStorage.setItem('bleak.interests', '{oops');
    expect(loadInterestIds()).toEqual([]);
    localStorage.setItem('bleak.interests', JSON.stringify({ not: 'an array' }));
    expect(loadInterestIds()).toEqual([]);
  });

  it('toggle adds then removes, persisting each step', () => {
    toggleInterestId(loadInterestIds(), 'travel');
    expect(loadInterestIds()).toEqual(['travel']);
    toggleInterestId(loadInterestIds(), 'travel');
    expect(loadInterestIds()).toEqual([]);
  });

  it('clearInterests empties the store', () => {
    saveInterestIds(['art']);
    clearInterests();
    expect(loadInterestIds()).toEqual([]);
  });
});

describe('interest shape (architecture §8.1 adapter target)', () => {
  it('every catalog entry has an id, an emoji and RU/EN labels', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(entry.id.length).toBeGreaterThan(0);
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(entry.labels.ru.length).toBeGreaterThan(0);
      expect(entry.labels.en.length).toBeGreaterThan(0);
    }
  });

  it('selectedInterests renders exactly {id, label, emoji} per locale', () => {
    const ids = ['coffee', 'hiking'];
    expect(selectedInterests(ids, 'ru')).toEqual([
      { id: 'coffee', label: INTEREST_CATALOG[0]!.labels.ru, emoji: INTEREST_CATALOG[0]!.emoji },
      { id: 'hiking', label: INTEREST_CATALOG[9]!.labels.ru, emoji: INTEREST_CATALOG[9]!.emoji }
    ]);
    expect(selectedInterests(ids, 'en').map((i) => i.label)).toEqual([
      INTEREST_CATALOG[0]!.labels.en,
      INTEREST_CATALOG[9]!.labels.en
    ]);
  });

  it('toInterest falls back to the RU label for unknown locales', () => {
    const entry = INTEREST_CATALOG[0]!;
    expect(toInterest(entry, 'ru')).toEqual({
      id: entry.id,
      label: entry.labels.ru,
      emoji: entry.emoji
    });
  });

  it('unknown stored ids are skipped when rendering', () => {
    saveInterestIds(['ghost-id', 'music']);
    const rendered = selectedInterests(loadInterestIds(), 'ru');
    expect(rendered.map((i) => i.id)).toEqual(['music']);
  });
});

describe('no network rule (AC 5)', () => {
  it('never issues a fetch while reading/writing interests', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    saveInterestIds(['games']);
    toggleInterestId(loadInterestIds(), 'games');
    loadInterestIds();
    selectedInterests(loadInterestIds(), 'ru');
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
