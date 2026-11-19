/** Interests MIRROR store (DESIGN §4.13.1 item 3): write-through from the
 * real endpoint responses (201 FULL list / 200 REMAINING list), per
 * room+user persistence under `bleak.interests`, corrupt-storage
 * tolerance, the 1..50 cap, and display re-localization through the
 * catalog (stored-title fallback for unknown keys). The API has no
 * interests GET — reads are purely local (documented limitation). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Interest } from '@bleak/api-client';
import {
  MAX_INTERESTS,
  clearInterests,
  displayInterests,
  interestCount,
  loadInterests,
  saveInterests
} from '../src/lib/stores/interests';

const ROOM = '0xroom';
const ME = '0xme';
const OTHER = '0xother';

function row(key: number, title: string, group = 0, user = ME): Interest {
  return { title, group, key, user_address: user };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('mirror persistence (per room + user)', () => {
  it('saves and restores the 201 FULL list in order', () => {
    const list = [row(1, 'Кофе', 0), row(13, 'Велосипед', 2), row(21, 'Путешествия', 4)];
    expect(saveInterests(ROOM, ME, list)).toEqual(list);
    expect(loadInterests(ROOM, ME)).toEqual(list);
    expect(JSON.parse(localStorage.getItem('bleak.interests') ?? '{}')).toMatchObject({
      '0xroom|0xme': list
    });
  });

  it('scopes the mirror per room+user — other personas are untouched', () => {
    saveInterests(ROOM, ME, [row(1, 'Кофе')]);
    saveInterests(ROOM, OTHER, [row(6, 'Музыка', 1)]);
    expect(loadInterests(ROOM, ME).map((r) => r.key)).toEqual([1]);
    expect(loadInterests(ROOM, OTHER).map((r) => r.key)).toEqual([6]);
    expect(loadInterests('0xother-room', ME)).toEqual([]);
  });

  it('clearInterests empties only the matching scope', () => {
    saveInterests(ROOM, ME, [row(1, 'Кофе')]);
    saveInterests(ROOM, OTHER, [row(6, 'Музыка', 1)]);
    clearInterests(ROOM, ME);
    expect(loadInterests(ROOM, ME)).toEqual([]);
    expect(loadInterests(ROOM, OTHER).length).toBe(1);
  });

  it('interestCount reports the mirrored row count', () => {
    expect(interestCount(ROOM, ME)).toBe(0);
    saveInterests(ROOM, ME, [row(1, 'Кофе'), row(2, 'Чай')]);
    expect(interestCount(ROOM, ME)).toBe(2);
  });
});

describe('write-through normalization (201 FULL / 200 REMAINING responses)', () => {
  it('dedupes by key — the upsert semantics of the server mirrored locally', () => {
    const saved = saveInterests(ROOM, ME, [row(1, 'Кофе'), row(1, 'Кофе, другой'), row(2, 'Чай')]);
    expect(saved.map((r) => r.key)).toEqual([1, 2]);
    // first occurrence wins (the server upsert would replace — either is
    // consistent; the mirror never duplicates a key)
    expect(saved[0]?.title).toBe('Кофе');
  });

  it('clamps to the 1..50 cap', () => {
    const list: Interest[] = Array.from({ length: 60 }, (_, i) => row(i + 1, `Ряд ${i + 1}`, i % 5));
    const saved = saveInterests(ROOM, ME, list);
    expect(saved).toHaveLength(MAX_INTERESTS);
    expect(interestCount(ROOM, ME)).toBe(50);
  });

  it('tolerates corrupt JSON and non-object values', () => {
    localStorage.setItem('bleak.interests', '{oops');
    expect(loadInterests(ROOM, ME)).toEqual([]);
    localStorage.setItem('bleak.interests', JSON.stringify({ nope: 'not rows' }));
    expect(loadInterests(ROOM, ME)).toEqual([]);
    localStorage.setItem('bleak.interests', JSON.stringify([1, 2, 3]));
    expect(loadInterests(ROOM, ME)).toEqual([]);
  });

  it('drops malformed rows from a saved list (shape guard)', () => {
    const bad = { title: 'x', group: 'not-a-number', key: 1, user_address: ME };
    const saved = saveInterests(ROOM, ME, [bad as unknown as Interest, row(2, 'Чай')]);
    expect(saved.map((r) => r.key)).toEqual([2]);
  });
});

describe('display re-localization through the catalog', () => {
  it('renders exactly {key, title, emoji} chips for the current locale', () => {
    saveInterests(ROOM, ME, [row(1, 'Кофе', 0), row(13, 'Велосипед', 2)]);
    const chips = displayInterests(loadInterests(ROOM, ME), 'en');
    expect(chips).toEqual([
      { key: 1, title: 'Coffee', emoji: '☕' },
      { key: 13, title: 'Cycling', emoji: '🚲' }
    ]);
    const ru = displayInterests(loadInterests(ROOM, ME), 'ru');
    expect(ru.map((c) => c.title)).toEqual(['Кофе', 'Велосипед']);
  });

  it('unknown keys fall back to the stored title with no emoji', () => {
    const chips = displayInterests([row(999, 'Парусный спорт', 4)], 'ru');
    expect(chips).toEqual([{ key: 999, title: 'Парусный спорт', emoji: '' }]);
  });
});

describe('no-GET rule (documented limitation — reads are local)', () => {
  it('reading/writing the mirror never issues a fetch', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    saveInterests(ROOM, ME, [row(1, 'Кофе')]);
    loadInterests(ROOM, ME);
    displayInterests(loadInterests(ROOM, ME), 'ru');
    interestCount(ROOM, ME);
    await Promise.resolve();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
