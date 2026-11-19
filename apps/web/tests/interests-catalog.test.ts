/** Curated interests catalog (DESIGN §4.13.1 item 1): numeric group/key
 * shape, emoji + i18n title keys, caps respected, RU/EN parity resolved
 * through the dictionaries. */
import { describe, expect, it } from 'vitest';
import {
  INTEREST_CATALOG,
  INTEREST_GROUPS,
  catalogByKey,
  groupTitle,
  interestTitle
} from '../src/lib/interests/catalog';
import { en } from '../src/lib/i18n/en';
import { ru } from '../src/lib/i18n/ru';
import { translate, type Locale } from '../src/lib/i18n/index';

const LOCALES: Locale[] = ['ru', 'en'];

describe('catalog shape (numeric group → key, DESIGN §4.13.1 item 1)', () => {
  it('ships a compact useful set: 5 groups × 5 interests', () => {
    expect(INTEREST_GROUPS).toHaveLength(5);
    expect(INTEREST_CATALOG).toHaveLength(25);
    for (const group of INTEREST_GROUPS) {
      const rows = INTEREST_CATALOG.filter((entry) => entry.group === group.group);
      expect(rows).toHaveLength(5);
    }
  });

  it('groups are sequential numbers starting at 0 (≥ 0 per the API)', () => {
    expect(INTEREST_GROUPS.map((g) => g.group)).toEqual([0, 1, 2, 3, 4]);
  });

  it('every entry carries a numeric group/key, an emoji and an i18n title key', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(Number.isInteger(entry.group)).toBe(true);
      expect(Number.isInteger(entry.key)).toBe(true);
      expect(entry.group).toBeGreaterThanOrEqual(0);
      expect(entry.key).toBeGreaterThanOrEqual(0);
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(typeof entry.titleKey).toBe('string');
      expect(entry.titleKey.startsWith('interests.k')).toBe(true);
    }
  });

  it('keys are GLOBALLY unique across the catalog (the server upserts per user on the key)', () => {
    const keys = INTEREST_CATALOG.map((entry) => entry.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stays inside the client pre-flight caps: ≤ 50 rows, every implied title ≤ 64 symbols', () => {
    expect(INTEREST_CATALOG.length).toBeLessThanOrEqual(50);
    for (const locale of LOCALES) {
      for (const entry of INTEREST_CATALOG) {
        expect(interestTitle(entry, locale).length).toBeLessThanOrEqual(64);
        expect(interestTitle(entry, locale).length).toBeGreaterThan(0);
      }
    }
  });
});

describe('i18n keys resolve (RU/EN parity)', () => {
  it('every title key exists in BOTH dictionaries with a non-empty string', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(en[entry.titleKey]?.trim().length).toBeGreaterThan(0);
      expect(ru[entry.titleKey]?.trim().length).toBeGreaterThan(0);
    }
  });

  it('every group title key exists in BOTH dictionaries', () => {
    for (const group of INTEREST_GROUPS) {
      expect(en[group.titleKey]?.trim().length).toBeGreaterThan(0);
      expect(ru[group.titleKey]?.trim().length).toBeGreaterThan(0);
    }
  });

  it('titles translate per locale (spot checks: cycling, coffee, travel)', () => {
    const cycling = catalogByKey(13)!;
    expect(interestTitle(cycling, 'ru')).toBe('Велосипед');
    expect(interestTitle(cycling, 'en')).toBe('Cycling');
    const coffee = catalogByKey(1)!;
    expect(interestTitle(coffee, 'ru')).toBe('Кофе');
    expect(groupTitle(0, 'en')).toBe('Food & drinks');
    expect(groupTitle(4, 'ru')).toBe('Путешествия');
  });

  it('groupTitle returns an empty string for unknown groups', () => {
    expect(groupTitle(99, 'ru')).toBe('');
  });
});

describe('catalogByKey lookup', () => {
  it('round-trips every catalog entry', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(catalogByKey(entry.key)).toBe(entry);
    }
  });

  it('unknown keys miss (the badge falls back to the stored title)', () => {
    expect(catalogByKey(999)).toBeUndefined();
  });

  it('titles render via translate for both locales (no unresolved keys)', () => {
    for (const locale of LOCALES) {
      for (const entry of INTEREST_CATALOG) {
        const title = interestTitle(entry, locale);
        expect(title).not.toBe(entry.titleKey);
        expect(title).toBe(translate(locale, entry.titleKey));
      }
    }
  });
});
