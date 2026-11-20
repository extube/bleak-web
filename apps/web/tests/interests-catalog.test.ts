/** Curated interests catalog — the §23.2 5.5 THEMES model: 8 themes ×
 * 6 topics, numeric group/key (server contract), slugs composed into the
 * stored title `theme:topic_key`, emoji + i18n title keys, caps
 * respected, RU/EN parity resolved through the dictionaries. */
import { describe, expect, it } from 'vitest';
import {
  INTEREST_CATALOG,
  INTEREST_GROUPS,
  catalogByKey,
  groupTitle,
  interestApiTitle,
  interestTitle
} from '../src/lib/interests/catalog';
import { en } from '../src/lib/i18n/en';
import { ru } from '../src/lib/i18n/ru';
import { translate, type Locale } from '../src/lib/i18n/index';

const LOCALES: Locale[] = ['ru', 'en'];

describe('catalog shape (§23.2 5.5 themes model, numeric server contract)', () => {
  it('ships 8 themes (the §23.2 5.5 6–10 badge range) × 6 topics each', () => {
    expect(INTEREST_GROUPS).toHaveLength(8);
    expect(INTEREST_CATALOG).toHaveLength(48);
    for (const group of INTEREST_GROUPS) {
      const rows = INTEREST_CATALOG.filter((entry) => entry.group === group.group);
      expect(rows).toHaveLength(6);
    }
  });

  it('themes are sequential numbers starting at 0 (≥ 0 per the API)', () => {
    expect(INTEREST_GROUPS.map((g) => g.group)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('every entry carries a numeric group/key, a topic slug, an emoji and an i18n title key', () => {
    for (const entry of INTEREST_CATALOG) {
      expect(Number.isInteger(entry.group)).toBe(true);
      expect(Number.isInteger(entry.key)).toBe(true);
      expect(entry.group).toBeGreaterThanOrEqual(0);
      expect(entry.key).toBeGreaterThanOrEqual(0);
      expect(entry.slug.length).toBeGreaterThan(0);
      expect(entry.emoji.length).toBeGreaterThan(0);
      expect(entry.titleKey.startsWith('interests.k')).toBe(true);
    }
  });

  it('every theme carries an id slug (the stored title prefix)', () => {
    for (const group of INTEREST_GROUPS) {
      expect(group.slug.length).toBeGreaterThan(0);
      expect(group.titleKey.startsWith('interests.group.')).toBe(true);
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

  it('the composed API title is "<theme slug>:<topic slug>" (§23.2 5.5) and fits the 1..64 cap', () => {
    expect(interestApiTitle(catalogByKey(2)!)).toBe('music:rock');
    expect(interestApiTitle(catalogByKey(7)!)).toBe('sport:hockey');
    expect(interestApiTitle(catalogByKey(13)!)).toBe('food:coffee');
    for (const entry of INTEREST_CATALOG) {
      const title = interestApiTitle(entry);
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThanOrEqual(64);
      expect(title).toMatch(/^[a-z_]+:[a-z_]+$/);
    }
  });

  it('the owner examples are covered: music → rock/jazz/rap topics; sport → hockey/running/football', () => {
    const music = INTEREST_CATALOG.filter((entry) => entry.group === 0).map((e) => e.slug);
    for (const slug of ['rock', 'jazz', 'rap']) expect(music).toContain(slug);
    const sport = INTEREST_CATALOG.filter((entry) => entry.group === 1).map((e) => e.slug);
    for (const slug of ['hockey', 'running', 'football']) expect(sport).toContain(slug);
    for (const slug of ['science', 'architecture']) {
      expect(INTEREST_GROUPS.some((g) => g.slug === slug)).toBe(true);
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

  it('every theme title key exists in BOTH dictionaries', () => {
    for (const group of INTEREST_GROUPS) {
      expect(en[group.titleKey]?.trim().length).toBeGreaterThan(0);
      expect(ru[group.titleKey]?.trim().length).toBeGreaterThan(0);
    }
  });

  it('titles translate per locale (spot checks: hockey, coffee, books)', () => {
    const hockey = catalogByKey(7)!;
    expect(interestTitle(hockey, 'ru')).toBe('Хоккей');
    expect(interestTitle(hockey, 'en')).toBe('Ice hockey');
    const coffee = catalogByKey(13)!;
    expect(interestTitle(coffee, 'ru')).toBe('Кофе');
    expect(groupTitle(0, 'en')).toBe('Music');
    expect(groupTitle(7, 'ru')).toBe('Путешествия');
  });

  it('groupTitle returns an empty string for unknown themes', () => {
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
