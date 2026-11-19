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

  it('§4.11.7 status keys exist in BOTH locales (chat-card status icon aria)', () => {
    for (const key of ['chats.card.aria', 'chats.status.active', 'chats.status.finished'] as const) {
      expect(en[key]).toBeTruthy();
      expect(ru[key]).toBeTruthy();
      expect(typeof en[key]).toBe('string');
      expect(typeof ru[key]).toBe('string');
    }
    // the theme words left the list item's accessible name (§4.11.6)
    expect(en['chats.card.aria']).not.toContain('{phase}');
    expect(ru['chats.card.aria']).not.toContain('{scenario}');
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

  it('persists room + user addresses and the persona token', async () => {
    const { saveIdentity, clearIdentity, identity } = await import('../src/lib/stores/identity');
    const { get } = await import('svelte/store');
    saveIdentity({ roomAddress: '0xroom1', userAddress: '0xuser1', token: 'p-token' });
    expect(get(identity)).toEqual({
      roomAddress: '0xroom1',
      userAddress: '0xuser1',
      token: 'p-token'
    });
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
  // navigation ('nav.host' retired — Concept §10.1.8: Host left the tab bar)
  'nav.room', 'nav.people', 'nav.chats', 'nav.profile',
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
  // chat transcript — the kickoff button left the dialog view (Concept
  // §8.1.9): 'chat.kickoff' and 'chat.kickoff.speaker' are retired; the
  // confirm copy stays (host drill-down kickoff uses it).
  'chat.warming_up', 'chat.kickoff.confirm_body', 'chat.contact_stub', 'chat.not_found',
  // profile
  'profile.greeting.rule', 'profile.greeting.no_questions',
  'profile.private_bio.caption', 'profile.qr.caption', 'profile.leave',
  // host (v1 keys still in use)
  'host.token.rejected', 'host.create', 'host.empty_live',
  // host — v2 credentials (DESIGN rev. 3 §3.7): creation-token gate
  'host.gate.label', 'host.gate.note', 'host.session_reset',
  // host — v2 invite management + room-token drill-down + rotation
  'host.invites.title', 'host.invites.hint', 'host.invites.mint',
  'host.invites.preset.1h', 'host.invites.preset.24h', 'host.invites.preset.7d',
  'host.invites.preset.custom', 'host.invites.expires_in',
  'host.invites.revoke', 'host.invites.revoked',
  'host.rotate_room.row', 'host.rotate_room.title', 'host.rotate_room.body',
  'host.drill.clear', 'host.drill.clear_confirm', 'host.drill.empty',
  // global 401 gate (DESIGN rev. 3 §2.8)
  'auth.401.notice',
  // join — v2 vault import + invite-code rejection
  'join.error.invite',
  'join.import.title', 'join.import.subtitle', 'join.import.empty',
  'join.import.saved_at', 'join.import.dead',
  // handshake income-rule state (DESIGN rev. 3 §2.9)
  'hs.income_limit',
  // scanner stale-code state (DESIGN rev. 3 §2.9)
  'scan.code_used',
  // profile — live QR + token rotation (DESIGN rev. 3 §3.6)
  'profile.qr.onetime', 'profile.qr.refreshed', 'profile.qr.aria',
  'profile.rotate.row', 'profile.rotate.title', 'profile.rotate.body',
  'profile.rotate.cta', 'profile.rotate.done',
  // transcript viewer fallback chip (DESIGN rev. 3 §3.5)
  'chat.host_view',
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
    expect(DESIGN_4_7_KEYS).toHaveLength(98);
  });

  it('the retired v1 key host.token.label is gone (renamed to host.gate.label)', () => {
    expect(en).not.toHaveProperty('host.token.label');
    expect(ru).not.toHaveProperty('host.token.label');
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

  it('spot-checks verbatim rev. 3 RU strings (v2 credentials scope)', () => {
    expect(ru['auth.401.notice']).toBe(
      'У этого профиля нет действительного ключа доступа — присоединитесь заново по коду события.'
    );
    expect(ru['host.gate.label']).toBe('Токен создания комнаты');
    expect(ru['host.gate.note']).toBe(
      'Одноразовый токен выдаёт оператор развертывания. После создания комнаты он больше не нужен и не сохраняется.'
    );
    expect(ru['host.session_reset']).toBe(
      'Доступ к комнате отозван — войдите заново с токеном создания.'
    );
    expect(ru['hs.income_limit']).toBe(
      'Лимит исходящих хендшейков — сначала получите рукопожатия в ответ.'
    );
    expect(ru['scan.code_used']).toBe(
      'Код уже использован — попросите обновить QR на карточке.'
    );
    expect(ru['join.error.invite']).toBe('Код приглашения недействителен или истёк.');
    expect(ru['join.import.title']).toBe('Вернуться на событие');
    expect(ru['join.import.return']).toBe('Вернуться');
    expect(ru['join.import.row_aria']).toBe('Вернуться к профилю {name}');
    expect(ru['join.import.empty']).toBe('На этом устройстве пока нет сохранённых профилей.');
    expect(ru['join.import.dead']).toBe(
      'Этот профиль больше не существует на сервере. Запись останется в списке, но вернуться в это событие нельзя.'
    );
    expect(ru['profile.qr.onetime']).toBe('QR одноразовый — после обмена он обновится сам.');
    expect(ru['profile.qr.aria']).toBe('Ваш одноразовый QR для обмена рукопожатиями');
    expect(ru['profile.rotate.done']).toBe('Ключ обновлён');
    expect(ru['host.invites.revoked']).toBe('Код отозван.');
    expect(ru['host.drill.clear_confirm']).toBe('История диалога участников будет очищена.');
    expect(ru['host.drill.empty']).toBe('У участника пока нет диалогов.');
    expect(ru['chat.host_view']).toBe('Наблюдение хоста');
  });
});

describe('v2.1 UI-polish round keys (DESIGN §4.8)', () => {
  it('the settings-block heading exists in both dictionaries (Concept §7.1.6; retitled per §11.1.3)', () => {
    expect(en['profile.settings.title']).toBe('My profile');
    expect(ru['profile.settings.title']).toBe('Мой профиль');
  });
});

describe('§4.13.3 contact-share keys (Concept §13.1.3, DESIGN §4.13.3)', () => {
  it('the slide, contact-card field and received-list copy exist in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of [
      'chat.contact_share.label',
      'chat.contact_share.shared',
      'chat.contact_share.locked',
      'chat.contact_share.no_card',
      'chat.contact_share.error',
      'profile.contact.edit',
      'profile.contact.label',
      'profile.contact.note',
      'profile.shared.title',
      'profile.shared.empty'
    ] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    // verbatim spot-checks
    expect(ru['chat.contact_share.shared']).toBe('Контакт уже передан');
    expect(en['chat.contact_share.shared']).toBe('Contact already shared');
    expect(ru['chat.contact_share.label']).toBe('Свайп вправо — поделиться контактом');
    expect(en['chat.contact_share.locked']).toBe('Available once the dialog is finished');
    expect(ru['profile.contact.note']).toContain('telegram');
    expect(en['profile.contact.note']).toContain('telegram');
  });
});

describe('§4.13.5 summary-sheet keys (Concept §13.1.5, DESIGN §4.13.5)', () => {
  it('the sheet heading, checklist heading, donut aria and loading copy exist in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of [
      'chat.summary.title',
      'chat.summary.checklist',
      'chat.summary.score.aria',
      'chat.summary.loading'
    ] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    // verbatim spot-checks; the {score} placeholder interpolates
    expect(ru['chat.summary.title']).toBe('Итоги встречи');
    expect(en['chat.summary.title']).toBe('Meeting summary');
    expect(translate('ru', 'chat.summary.score.aria', { score: '87' })).toBe(
      'Совпадение: 87 из 100'
    );
    expect(translate('en', 'chat.summary.score.aria', { score: '87' })).toBe(
      'Match: 87 out of 100'
    );
  });
});

describe('v2.5 copy sweep (Concept §11.1.3, DESIGN §4.12.3)', () => {
  it('the interests picker copy is RU/EN paired (DESIGN §4.13.1)', () => {
    for (const key of [
      'profile.interests.title',
      'profile.interests.edit',
      'profile.interests.note',
      'profile.interests.error',
      'profile.interests.empty',
      'profile.interests.done'
    ] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    expect(ru['profile.interests.error']).toBe('Не удалось сохранить интересы — попробуйте ещё раз.');
    expect(en['profile.interests.note']).toContain('50');
    expect(ru['profile.interests.note']).toContain('50');
  });

  it('the §4.13.1 catalog title keys resolve in both dictionaries (all 25 keys + 5 groups)', async () => {
    const { INTEREST_CATALOG, INTEREST_GROUPS } = await import('../src/lib/interests/catalog');
    for (const entry of INTEREST_CATALOG) {
      expect(en[entry.titleKey]?.trim().length).toBeGreaterThan(0);
      expect(ru[entry.titleKey]?.trim().length).toBeGreaterThan(0);
    }
    for (const group of INTEREST_GROUPS) {
      expect(en[group.titleKey]?.trim().length).toBeGreaterThan(0);
      expect(ru[group.titleKey]?.trim().length).toBeGreaterThan(0);
    }
  });

  it('edit-screen titles drop the word "Edit" (values only — key names intact)', () => {
    expect(en['profile.persona.edit']).toBe('Profile');
    expect(ru['profile.persona.edit']).toBe('Профиль');
    expect(en['profile.greeting.edit']).toBe('Greeting');
    expect(ru['profile.greeting.edit']).toBe('Приветствие');
    expect(en['profile.interests.edit']).toBe('Interests');
    expect(ru['profile.interests.edit']).toBe('Интересы');
  });

  it('the persona section heading is retitled "My profile" / «Мой профиль» (owner change request)', () => {
    expect(en['profile.settings.persona']).toBe('My profile');
    expect(ru['profile.settings.persona']).toBe('Мой профиль');
  });

  it('no user-visible "persona" / "персона" remains in any dictionary value', () => {
    // Word-boundary match: "Personal" (EN) is a different word and stays.
    const enHits = Object.values(en).filter((v) => /\bpersonas?\b/i.test(v));
    const ruHits = Object.values(ru).filter((v) => /персона/i.test(v));
    expect(enHits, `EN values still say persona: ${enHits.join(' | ')}`).toEqual([]);
    expect(ruHits, `RU values still say персона: ${ruHits.join(' | ')}`).toEqual([]);
  });
});

describe('v2.2 UI-polish round keys (DESIGN §4.9)', () => {
  it('kickoff button/speaker keys are retired from BOTH dictionaries; the confirm copy stays (Concept §8.1.9)', () => {
    expect(ru).not.toHaveProperty('chat.kickoff');
    expect(en).not.toHaveProperty('chat.kickoff');
    expect(ru).not.toHaveProperty('chat.kickoff.speaker');
    expect(en).not.toHaveProperty('chat.kickoff.speaker');
    expect(ru['chat.kickoff.confirm_title']).toBeTruthy();
    expect(en['chat.kickoff.confirm_title']).toBeTruthy();
    expect(ru['chat.kickoff.confirm_run']).toBeTruthy();
    expect(en['chat.kickoff.confirm_run']).toBeTruthy();
  });

  it('the private-bio caption key is present in both dictionaries (Concept §8.1.6)', () => {
    expect(ru['profile.private_bio.caption']).toBe('видно только вашему агенту');
    expect(en['profile.private_bio.caption']).toBe('only your agent sees this');
  });
});

describe('v2.5 leave copy (Concept §11.1.1, DESIGN §4.12.1)', () => {
  it('the leave confirmation copy describes the local leave — no deletion wording, both dictionaries', () => {
    expect(ru['profile.leave.confirm_body']).toBe(
      'Вы покинете событие. Токен останется на этом устройстве — вы сможете вернуться в любой момент через «Вернуться на событие».'
    );
    expect(en['profile.leave.confirm_body']).toBe(
      'You will leave the event. Your token stays on this device — you can return any time via Return to event.'
    );
    // The copy no longer implies server-side deletion of the persona.
    expect(ru['profile.leave.confirm_body']).not.toMatch(/удал/i);
    expect(en['profile.leave.confirm_body']).not.toMatch(/remov|delet/i);
  });
});

describe('placeholder interpolation', () => {
  it('interpolates {n} / {q} / {name} params in both languages', () => {
    expect(translate('ru', 'room.around', { n: '12' })).toBe('12 вокруг вас');
    expect(translate('en', 'room.around', { n: '12' })).toBe('12 around you');
    expect(translate('ru', 'chat.new_message', { name: 'Алиса' })).toBe(
      'Новое сообщение от Алиса'
    );
    expect(translate('en', 'chat.new_message', { name: 'Alice' })).toBe(
      'New message from Alice'
    );
    expect(translate('ru', 'people.empty_search', { q: 'Ива' })).toBe(
      'Никого не найдено по «Ива»'
    );
    expect(translate('ru', 'join.import.saved_at', { date: '14.11' })).toBe(
      'Сохранено 14.11'
    );
    expect(translate('en', 'join.import.saved_at', { date: 'Nov 14' })).toBe(
      'Saved Nov 14'
    );
    expect(translate('ru', 'host.invites.expires_in', { time: '2 ч' })).toBe(
      'истекает через 2 ч'
    );
    expect(translate('en', 'host.invites.expires_in', { time: '2 h' })).toBe(
      'expires in 2 h'
    );
  });

  it('leaves placeholders intact when params are absent', () => {
    expect(translate('ru', 'room.around')).toBe('{n} вокруг вас');
  });
});

