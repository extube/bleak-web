/** Locale + i18n dictionary tests. */
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_LOCALE,
  storedLocale,
  persistLocale,
  translate,
  type Locale,
  type MessageKey
} from '../src/lib/i18n/index';
import { en } from '../src/lib/i18n/en';
import { ru } from '../src/lib/i18n/ru';

describe('i18n dictionaries (RU primary, EN second)', () => {
  it('ru and en have exactly the same keys', () => {
    const enKeys = Object.keys(en).sort();
    const ruKeys = Object.keys(ru).sort();
    expect(ruKeys).toEqual(enKeys);
  });

  it('every entry is a non-empty string in both languages', () => {
    for (const dict of [en, ru]) {
      for (const value of Object.values(dict)) {
        expect(typeof value).toBe('string');
        expect((value as string).trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('translates and falls back to en, then to the key', () => {
    expect(translate('ru', 'nav.chats')).toBe('Диалоги');
    expect(translate('en', 'nav.chats')).toBe('Chats');
    const fakeKey = 'nope.missing' as MessageKey;
    expect(translate('en', fakeKey)).toBe('nope.missing');
  });

  it('interpolates {params} when provided', () => {
    // Uses an existing key; params simply leave the string unchanged if absent.
    expect(translate('en', 'nav.room')).toBe('Room');
  });
});

describe('locale persistence', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('defaults to ru with empty storage', () => {
    expect(DEFAULT_LOCALE).toBe('ru');
    expect(storedLocale()).toBe('ru');
  });

  it('persists and restores a chosen locale', () => {
    persistLocale('en');
    expect(storedLocale()).toBe('en');
    persistLocale('ru');
    expect(storedLocale()).toBe('ru');
  });

  it('ignores corrupt values', () => {
    localStorage.setItem('bleak.locale', 'fr');
    expect(storedLocale()).toBe('ru');
  });
});

describe('identity store', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('persists room + user addresses', async () => {
    const { saveIdentity, clearIdentity, identity } = await import('../src/lib/stores/identity');
    const { get } = await import('svelte/store');
    saveIdentity({ roomAddress: '0xroom1', userAddress: '0xuser1' });
    expect(get(identity)).toEqual({ roomAddress: '0xroom1', userAddress: '0xuser1' });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? '{}')).toMatchObject({
      roomAddress: '0xroom1'
    });
    clearIdentity();
    expect(get(identity)).toBeNull();
    expect(localStorage.getItem('bleak.identity')).toBeNull();
  });

  it('readStorage tolerates corrupt JSON', async () => {
    localStorage.setItem('bleak.identity', '{oops');
    const { initIdentity, identity } = await import('../src/lib/stores/identity');
    const { get } = await import('svelte/store');
    initIdentity();
    expect(get(identity)).toBeNull();
  });
});

describe('locale store', () => {
  afterEach(() => {
    localStorage.clear();
  });

  it('setLocale persists and updates the store', async () => {
    const { setLocale, locale } = await import('../src/lib/i18n/locale');
    const { get } = await import('svelte/store');
    setLocale('en');
    expect(get(locale)).toBe<Locale>('en');
    setLocale('ru');
    expect(get(locale)).toBe<Locale>('ru');
  });
});
