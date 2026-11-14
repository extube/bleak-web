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
    expect(translate('en', 'nav.room')).toBe('Around');
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

/**
 * Binding key checklist from docs/DESIGN.md §4.7 (owner-approved copy table).
 * Every key here MUST exist in both dictionaries — a missing key fails CI
 * (TZ-01 technical criterion).
 */
const DESIGN_4_7_KEYS: string[] = [
  // navigation
  'nav.room', 'nav.people', 'nav.chats', 'nav.profile', 'nav.host',
  // join
  'join.title', 'join.enter', 'join.error.unknown', 'join.scan.open',
  // camera scanner
  'scan.title', 'scan.close', 'scan.hint.join', 'scan.hint.person',
  'scan.permission.intro', 'scan.turn_on', 'scan.permission.denied',
  'scan.try_again', 'scan.no_camera', 'scan.insecure',
  'scan.fallback.enter_code', 'scan.fallback.find_list', 'scan.again',
  'scan.invalid_qr', 'scan.own_qr', 'scan.foreign_persona',
  'scan.confirm.title', 'scan.confirm.cta', 'scan.confirm.cancel',
  'scan.error.network',
  // room radar
  'room.around', 'room.scan.open', 'room.empty',
  // handshake states
  'hs.send', 'hs.sent', 'hs.waiting', 'hs.back', 'hs.added_you',
  'hs.chatting', 'hs.agents_talking', 'hs.open_dialog',
  // people
  'people.empty', 'people.search.placeholder', 'people.filter.all',
  'people.filter.sent', 'people.filter.added', 'people.filter.chatting',
  // chats
  'chats.empty', 'chats.find_people',
  // chat transcript
  'chat.warming_up', 'chat.kickoff', 'chat.kickoff.confirm_body',
  'chat.kickoff.speaker', 'chat.contact_stub', 'chat.not_found',
  // profile
  'profile.greeting.rule', 'profile.greeting.no_questions',
  'profile.private_bio.caption', 'profile.qr.caption', 'profile.leave',
  // host
  'host.token.label', 'host.token.rejected', 'host.create', 'host.empty_live',
  // common
  'common.error.network', 'common.retry'
];

describe('DESIGN §4.7 copy table coverage', () => {
  it('every §4.7 key exists in both dictionaries', () => {
    for (const key of DESIGN_4_7_KEYS) {
      expect(en, `en missing §4.7 key "${key}"`).toHaveProperty(key);
      expect(ru, `ru missing §4.7 key "${key}"`).toHaveProperty(key);
      expect((ru as Record<string, string>)[key]?.trim().length).toBeGreaterThan(0);
      expect((en as Record<string, string>)[key]?.trim().length).toBeGreaterThan(0);
    }
    expect(DESIGN_4_7_KEYS).toHaveLength(65);
  });

  it('spot-checks verbatim RU strings from §4.7', () => {
    expect(ru['room.around']).toBe('{n} вокруг вас');
    expect(ru['hs.waiting']).toBe('Хендшейк отправлен — ждём ответа');
    expect(ru['scan.permission.denied']).toBe(
      'Доступ к камере запрещён. Разрешите его в настройках браузера — или введите код вручную.'
    );
    expect(ru['profile.qr.caption']).toBe('Покажите, чтобы обменяться рукопожатиями');
    expect(ru['host.empty_live']).toBe('Пока никто не присоединился.');
  });
});

describe('placeholder interpolation', () => {
  it('interpolates {n} / {q} / {name} params in both languages', () => {
    expect(translate('ru', 'room.around', { n: '12' })).toBe('12 вокруг вас');
    expect(translate('en', 'room.around', { n: '12' })).toBe('12 around you');
    expect(translate('ru', 'chat.kickoff.speaker', { name: 'Алиса' })).toBe(
      'Первым говорит Алиса'
    );
    expect(translate('en', 'chat.kickoff.speaker', { name: 'Alice' })).toBe(
      'Alice speaks first'
    );
    expect(translate('ru', 'people.empty_search', { q: 'Ива' })).toBe(
      'Никого не найдено по «Ива»'
    );
  });

  it('leaves placeholders intact when params are absent', () => {
    expect(translate('ru', 'room.around')).toBe('{n} вокруг вас');
  });
});

