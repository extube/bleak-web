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

  it('Concept §47 (2026-11-23): the resume-card keys are GONE from BOTH dictionaries — the 6-digit form is the only form on /income', () => {
    for (const dict of [en, ru]) {
      expect(Object.keys(dict).filter((k) => k.startsWith('join.resume'))).toEqual([]);
    }
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
  // navigation ('nav.host' retired — Concept §10.1.8: Host left the tab bar;
  // 'nav.contacts' + the dot-aria clauses added by §4.14.2, asserted in the
  // dedicated describe below)
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
  // people ('people.filter.*' retired — Concept §19.2: the filter chips are
  // gone, the list is just sorted; asserted in the v3.6 describe below)
  'people.empty', 'people.search.placeholder',
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
    expect(DESIGN_4_7_KEYS).toHaveLength(94);
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

describe('v2.1 UI-polish round keys (DESIGN §4.8) — v3.23 value edits applied', () => {
  it('the settings heading reads «Настройки» / "Settings" (DESIGN §4.29.E: the old «Мой профиль» value moved to /profile)', () => {
    expect(en['profile.settings.title']).toBe('Settings');
    expect(ru['profile.settings.title']).toBe('Настройки');
    expect(en['profile.title']).toBe('My profile');
    expect(ru['profile.title']).toBe('Мой профиль');
  });
});

describe('v3.23 profile-redesign keys (DESIGN §4.29.E, Concept §42)', () => {
  it('the 9 new keys exist in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of [
      'profile.header.qr',
      'profile.tab.about',
      'profile.tab.interests',
      'profile.tab.qr',
      'profile.edit.title',
      'profile.edit.row.name',
      'profile.edit.row.public_bio',
      'profile.edit.row.private_bio',
      'profile.edit.save'
    ] as const) {
      expect(en[key]?.trim().length, `en missing "${key}"`).toBeGreaterThan(0);
      expect(ru[key]?.trim().length, `ru missing "${key}"`).toBeGreaterThan(0);
    }
  });

  it('the new keys carry the §4.29.E verbatim copy (RU is a design invention — I-rec 14)', () => {
    // Concept §50 (2026-11-23): profile.header.qr announces scanner intent —
    // the header scan icon opens the §3.8 QrScanner (the old tab-switch
    // reading is superseded); same copy as scan.title, RU/EN parity kept.
    expect(ru['profile.header.qr']).toBe('Сканировать QR');
    expect(en['profile.header.qr']).toBe('Scan QR code');
    expect(ru['profile.tab.about']).toBe('Обо мне');
    expect(en['profile.tab.about']).toBe('About');
    expect(ru['profile.tab.interests']).toBe('Интересы');
    expect(en['profile.tab.interests']).toBe('Interests');
    expect(ru['profile.tab.qr']).toBe('QR-код');
    expect(en['profile.tab.qr']).toBe('QR code');
    expect(ru['profile.edit.title']).toBe('Редактировать профиль');
    expect(en['profile.edit.title']).toBe('Edit profile');
    expect(ru['profile.edit.row.name']).toBe('Имя');
    expect(en['profile.edit.row.name']).toBe('Name');
    expect(ru['profile.edit.row.public_bio']).toBe('О себе');
    expect(en['profile.edit.row.public_bio']).toBe('About you');
    expect(ru['profile.edit.row.private_bio']).toBe('Для агента');
    expect(en['profile.edit.row.private_bio']).toBe('For your agent');
    expect(ru['profile.edit.save']).toBe('Сохранить изменения');
    expect(en['profile.edit.save']).toBe('Save changes');
  });
});

describe('§4.35.E auto-handshake keys (Concept §49, DESIGN §4.35.E)', () => {
  it('exactly the four §4.35.E keys exist in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of [
      'profile.auto_handshake.row',
      'profile.auto_handshake.label',
      'profile.auto_handshake.on',
      'profile.auto_handshake.off'
    ] as const) {
      expect(en[key]?.trim().length, `en missing "${key}"`).toBeGreaterThan(0);
      expect(ru[key]?.trim().length, `ru missing "${key}"`).toBeGreaterThan(0);
    }
  });

  it('the keys carry the verbatim §4.35.E copy (the row label is the owner-adopted wording)', () => {
    expect(ru['profile.auto_handshake.row']).toBe('Отправлять рукопожатия автоматически');
    expect(en['profile.auto_handshake.row']).toBe('Automatically send handshake');
    expect(ru['profile.auto_handshake.label']).toBe('Авто-рукопожатия');
    expect(en['profile.auto_handshake.label']).toBe('Auto-handshake');
    expect(ru['profile.auto_handshake.on']).toBe('вкл.');
    expect(en['profile.auto_handshake.on']).toBe('on');
    expect(ru['profile.auto_handshake.off']).toBe('выкл.');
    expect(en['profile.auto_handshake.off']).toBe('off');
    // The composed /profile indicator pairs read as designed (§4.35.E).
    expect(`${ru['profile.auto_handshake.label']}: ${ru['profile.auto_handshake.on']}`).toBe(
      'Авто-рукопожатия: вкл.'
    );
    expect(`${en['profile.auto_handshake.label']}: ${en['profile.auto_handshake.on']}`).toBe(
      'Auto-handshake: on'
    );
  });
});

describe('§4.38.D searching-badge keys (Concept §52, DESIGN §4.38.D)', () => {
  it('exactly the two §4.38.D keys exist in BOTH dictionaries (RU/EN parity)', () => {
    // The only `people.searching*` keys in either dictionary: the
    // repurposed title + the new remark key (net +1 per dictionary — no
    // retired keys, no reuse-of-convenience).
    for (const dict of [en, ru]) {
      expect(Object.keys(dict).filter((k) => k.startsWith('people.searching'))).toEqual([
        'people.searching',
        'people.searching_settings'
      ]);
      expect(dict['people.searching']?.trim().length).toBeGreaterThan(0);
      expect(dict['people.searching_settings']?.trim().length).toBeGreaterThan(0);
    }
  });

  it('the keys carry the verbatim concept-adopted copy (owner, 2026-11-24)', () => {
    expect(en['people.searching']).toBe('Automatic contact search mode');
    expect(ru['people.searching']).toBe('Режим автоматического поиска контактов');
    expect(en['people.searching_settings']).toBe('Change it in settings');
    expect(ru['people.searching_settings']).toBe('Изменить можно в настройках');
  });
});

describe('§4.13.3 contact-share keys (Concept §13.1.3, DESIGN §4.13.3)', () => {
  it('the slide and contact-card field copy exist in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of [
      'chat.contact_share.label',
      'chat.contact_share.shared',
      'chat.contact_share.locked',
      'chat.contact_share.no_card',
      'chat.contact_share.error',
      'profile.contact.edit',
      'profile.contact.label',
      'profile.contact.note'
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

describe('§4.14.2 contacts footer page keys (Concept §14.1.2)', () => {
  it('the tab label, dot aria, page title/subtitle and empty state exist in BOTH dictionaries', () => {
    for (const key of [
      'nav.contacts',
      'nav.contacts.dot_aria',
      'nav.chats.dot_aria',
      'contacts.title',
      'contacts.subtitle',
      'contacts.empty'
    ] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    // verbatim spot-checks
    expect(ru['nav.contacts']).toBe('Контакты');
    expect(en['nav.contacts']).toBe('Contacts');
    expect(ru['nav.contacts.dot_aria']).toBe('есть новые контакты');
    expect(en['nav.contacts.dot_aria']).toBe('new contacts');
    expect(ru['nav.chats.dot_aria']).toBe('есть новые диалоги');
    expect(en['nav.chats.dot_aria']).toBe('new chats');
    expect(ru['contacts.title']).toBe('Контакты');
    expect(en['contacts.title']).toBe('Contacts');
    expect(ru['contacts.empty']).toBe('Пока никто не поделился с вами контактом.');
    expect(en['contacts.empty']).toBe('Nobody has shared a contact with you yet.');
  });

  it('the superseded §4.13.3 settings-list keys are retired from BOTH dictionaries', () => {
    expect(en).not.toHaveProperty('profile.shared.title');
    expect(ru).not.toHaveProperty('profile.shared.title');
    expect(en).not.toHaveProperty('profile.shared.empty');
    expect(ru).not.toHaveProperty('profile.shared.empty');
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
    // verbatim spot-checks (DESIGN §4.14.5 bug round: ALL four sheet keys
    // asserted verbatim in BOTH locales); the {score} placeholder interpolates
    expect(ru['chat.summary.title']).toBe('Итоги встречи');
    expect(en['chat.summary.title']).toBe('Meeting summary');
    expect(ru['chat.summary.checklist']).toBe('Сетевой чек-лист');
    expect(en['chat.summary.checklist']).toBe('Networking checklist');
    expect(ru['chat.summary.loading']).toBe('Считаем итог диалога…');
    expect(en['chat.summary.loading']).toBe('Summarizing the dialog…');
    expect(translate('ru', 'chat.summary.score.aria', { score: '87' })).toBe(
      'Совпадение: 87 из 100'
    );
    expect(translate('en', 'chat.summary.score.aria', { score: '87' })).toBe(
      'Match: 87 out of 100'
    );
  });
});

describe('§4.15.E arcade-sheet keys (Concept §15.3, DESIGN §4.15.C/E)', () => {
  it('the tier labels, the sheet-variant slide copy and the completion text exist in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of [
      'chat.summary.tier.great',
      'chat.summary.tier.good',
      'chat.summary.tier.low',
      'chat.contact_share.sheet_label',
      'chat.contact_share.shared_done'
    ] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    // verbatim spot-checks (§4.15.E table, owner copy)
    expect(ru['chat.summary.tier.great']).toBe('Отличное совпадение');
    expect(en['chat.summary.tier.great']).toBe('Great match');
    expect(ru['chat.summary.tier.good']).toBe('Хороший разговор');
    expect(en['chat.summary.tier.good']).toBe('Good chat');
    expect(ru['chat.summary.tier.low']).toBe('Разные вибрации');
    expect(en['chat.summary.tier.low']).toBe('Different vibes');
    expect(ru['chat.contact_share.sheet_label']).toBe('Смахните, чтобы поделиться');
    expect(en['chat.contact_share.sheet_label']).toBe('Slide to share contact');
    // the completion text swaps in on a gesture-made share (§4.15.C-8);
    // the 409 "already shared" label keeps its own copy
    expect(ru['chat.contact_share.shared_done']).toBe('Контакт отправлен!');
    expect(en['chat.contact_share.shared_done']).toBe('Contact shared!');
    expect(ru['chat.contact_share.shared']).toBe('Контакт уже передан');
    expect(en['chat.contact_share.shared']).toBe('Contact already shared');
  });
});

describe('v2.5 copy sweep (Concept §11.1.3, DESIGN §4.12.3)', () => {
  it('the interests badge copy is RU/EN paired (DESIGN §4.13.1; §23.2 5.6 — the settings picker copy is gone, interests are creation-only)', () => {
    for (const key of [
      'profile.interests.title',
      'profile.interests.empty'
    ] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    // §23.2 5.6: the removed settings-picker keys must not come back.
    expect(en['profile.interests.edit' as keyof typeof en]).toBeUndefined();
    expect(ru['profile.interests.note' as keyof typeof ru]).toBeUndefined();
  });

  it('the §23.2 5.5 themes catalog title keys resolve in both dictionaries (all 48 topics + 8 themes)', async () => {
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

  it('edit-screen titles drop the word "Edit" — superseded for /profile/edit only (DESIGN §4.29.G.8: the owner\'s reference names that screen; the retired editor keys are gone)', () => {
    // §4.29.E.3: profile.persona.edit / profile.greeting.edit are RETIRED
    // from BOTH dictionaries — the editors' h2s were replaced by the field
    // labels of C.3 (profile.edit.row.*).
    expect(en).not.toHaveProperty('profile.persona.edit');
    expect(ru).not.toHaveProperty('profile.persona.edit');
    expect(en).not.toHaveProperty('profile.greeting.edit');
    expect(ru).not.toHaveProperty('profile.greeting.edit');
    // The screen title the owner's reference names explicitly keeps "Edit".
    expect(en['profile.edit.title']).toBe('Edit profile');
    expect(ru['profile.edit.title']).toBe('Редактировать профиль');
  });

  it('the persona section heading is retitled to the settings title (the block became the entry row; §4.29.E value edits)', () => {
    // §4.29.E.3: profile.settings.persona is RETIRED — the settings persona
    // block became the ONE profile entry row → /profile/edit.
    expect(en).not.toHaveProperty('profile.settings.persona');
    expect(ru).not.toHaveProperty('profile.settings.persona');
    // The §4.29.E value edits: /profile takes «Мой профиль»/"My profile";
    // the settings h1 becomes «Настройки»/"Settings".
    expect(en['profile.settings.title']).toBe('Settings');
    expect(ru['profile.settings.title']).toBe('Настройки');
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

describe('v3.6 people-page rework keys (Concept §19.2+§19.3, DESIGN §4.15.4.2/4.15.4.3)', () => {
  it('the handshake! + Open-chat copy exists in BOTH dictionaries (RU/EN parity)', () => {
    for (const key of ['people.action.back', 'people.action.open_chat'] as const) {
      expect(en[key]?.trim().length).toBeGreaterThan(0);
      expect(ru[key]?.trim().length).toBeGreaterThan(0);
    }
    // verbatim owner copy (Concept §19.3)
    expect(ru['people.action.back']).toBe('Привет!');
    expect(en['people.action.back']).toBe('handshake!');
    expect(ru['people.action.open_chat']).toBe('Открыть чат');
    expect(en['people.action.open_chat']).toBe('Open chat');
  });

  it('the filter-chip keys are retired from BOTH dictionaries (no chips — v3.6)', () => {
    for (const key of [
      'people.filter.all',
      'people.filter.sent',
      'people.filter.added',
      'people.filter.chatting',
      'people.filters'
    ] as const) {
      expect(en).not.toHaveProperty(key);
      expect(ru).not.toHaveProperty(key);
    }
  });

  it('the removed right-icon copy is retired; hs.back stays for the sheet (task 88)', () => {
    expect(en).not.toHaveProperty('people.action.dialog');
    expect(ru).not.toHaveProperty('people.action.dialog');
    expect(en).not.toHaveProperty('people.action.expand');
    expect(ru).not.toHaveProperty('people.action.expand');
    expect(en).not.toHaveProperty('people.action.collapse');
    expect(ru).not.toHaveProperty('people.action.collapse');
    expect(ru['hs.back']).toBe('Ответить хендшейком');
    expect(en['hs.back']).toBe('Handshake back');
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

