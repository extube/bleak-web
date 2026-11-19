/** /profile/settings tests (Concept §8.1.3, DESIGN §4.9.3; persona edits per
 * Concept §10.1.4 / DESIGN §4.11.4): the settings block moved off /profile
 * onto this sub-page — a pure logic move, so the moved suites assert the
 * same behaviors against the new route: heading + rows render (RU + EN),
 * token rotation (identity + vault written only after 2xx; 403 keeps them),
 * leave room (purely local per Concept §11.1.1 / DESIGN §4.12.1: the
 * confirmation question first; clears identity + mutual code; NO server
 * delete anywhere in the exit path; the vault entry survives and the
 * return-to-event pick validates the stored token), outline-style leave
 * button (red font + red border, no filled background), back navigation,
 * and no tab bar (sub-page pattern).
 *
 * ALL persona editing lives here now (Concept §10.1.4): the persona section
 * hosts the PersonaEditor (name/public/private bio), GreetingEditor and the
 * interests picker (DESIGN §4.13.1: real addUserInterests/deleteUserInterests
 * + the local mirror store).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, type User } from '@bleak/api-client';
import { identity, saveIdentity } from '../src/lib/stores/identity';
import { mutualCode } from '../src/lib/stores/mutualCode';
import { tokenVault } from '../src/lib/stores/tokenVault';
import { verifyVaultEntry } from '../src/lib/join';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route.replace('[address]', '0xchat')
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoomUser: vi.fn(),
    updateRoomUser: vi.fn(),
    getUserGreeting: vi.fn(),
    putUserGreeting: vi.fn(),
    regenerateGreeting: vi.fn(),
    deleteRoomUser: vi.fn(),
    rotateUserToken: vi.fn(),
    addUserInterests: vi.fn(),
    deleteUserInterests: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  generateTokenSecret: () => 'N'.repeat(43)
}));

// Deterministic back rule: the test environment's history length is not
// meaningful — force the fallback branch so goto(/profile) is assertable.
vi.mock('#lib/chats/view', () => ({
  backTarget: () => 'list'
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/profile/settings/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';
const TOKEN = 'persona-token';
const mockedApi = vi.mocked(api, true);

function userFixture(overrides: Partial<User> = {}): User {
  return {
    address: ME,
    room: ROOM,
    name: 'Трамвайщик',
    greeting: 'Привет! Я про трамваи.',
    public_bio: 'Поттер из Питера',
    private_bio: 'Люблю глина и стеклодувное дело',
    language: 'ru',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  // The page hydrates the stores from localStorage defensively (initIdentity),
  // so storage AND the store must carry the identity.
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: TOKEN })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  // The persona editors prefill from the persona record (mount-time fetch).
  mockedApi.getRoomUser.mockResolvedValue(userFixture());
  mockedApi.getUserGreeting.mockResolvedValue({ address: ME, greeting: 'Привет! Я про трамваи.' });
  mockedApi.rotateUserToken.mockResolvedValue(undefined);
  mockedApi.deleteRoomUser.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  identity.set(null);
  mutualCode.set(null);
  tokenVault.set([]);
  localStorage.clear();
  vi.useRealTimers();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('settings route renders (AC: heading, locale, rows; RU + EN)', () => {
  it('renders the heading, locale control, rotate row and leave button (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    await renderPage();
    // level 1: the top-bar h1 — the section h2 now shares the same
    // «Мой профиль» name (v2.5 copy sweep), so the level disambiguates.
    expect(screen.getByRole('heading', { level: 1, name: ru['profile.settings.title'] })).toBeTruthy();
    expect(screen.getByText(ru['common.locale'])).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.leave'] })).toBeTruthy();
    // EN parity: the same route re-renders through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('heading', { level: 1, name: en['profile.settings.title'] })).toBeTruthy();
    expect(screen.getByText(en['common.locale'])).toBeTruthy();
    setLocale('ru');
    await tick();
  });

  it('is a sub-page: no tab bar (scoped style) + back navigation falling back to /profile', async () => {
    await renderPage();
    // The /chats/[address] sub-page pattern: the tab bar is hidden while the
    // route is mounted (scoped style injected into <head>).
    expect(document.head.innerHTML).toContain('nav.tabbar');
    // Back control: backTarget is forced to the fallback → goto(/profile).
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/profile'));
  });
});

describe('persona editing section (Concept §10.1.4, DESIGN §4.11.4)', () => {
  it('renders the persona section with the three editor rows (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    await renderPage();
    // level 2: the persona section h2 — shares the «Мой профиль» name with
    // the top-bar h1 after the v2.5 copy sweep; the level disambiguates.
    expect(screen.getByRole('heading', { level: 2, name: ru['profile.settings.persona'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.persona.edit'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.greeting.edit'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.interests.edit'] })).toBeTruthy();
    // EN parity through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('heading', { level: 2, name: en['profile.settings.persona'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: en['profile.persona.edit'] })).toBeTruthy();
    setLocale('ru');
    await tick();
  });
});

describe('persona editor (AC 2, moved from /profile)', () => {
  it('opens from the persona row, prefills from the persona record, and saves all three fields via PUT updateRoomUser', async () => {
    mockedApi.updateRoomUser.mockResolvedValue(
      userFixture({ name: 'Стеклодув', public_bio: 'Новое био', private_bio: 'Секрет' })
    );
    await renderPage();

    await screen.getByRole('button', { name: ru['profile.persona.edit'] }).click();
    await tick();

    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    expect(nameInput.value).toBe('Трамвайщик'); // prefilled from getRoomUser
    nameInput.value = 'Стеклодув';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    const publicInput = screen.getByLabelText(ru['join.form.public_bio']) as HTMLInputElement;
    publicInput.value = 'Новое био';
    publicInput.dispatchEvent(new Event('input', { bubbles: true }));

    await screen.getByRole('button', { name: ru['common.save'] }).click();

    await waitFor(() =>
      expect(mockedApi.updateRoomUser).toHaveBeenCalledWith(ROOM, ME, {
        name: 'Стеклодув',
        public_bio: 'Новое био',
        private_bio: 'Люблю глина и стеклодувное дело'
      })
    );
    // After the save the editor returns to the settings rows with the
    // transient «Saved» note (the badge re-fetches on /profile).
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
  });

  it('cancel returns to the rows without a PUT', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.persona.edit'] }).click();
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
  });
});

describe('greeting editor (AC 3, 4, moved from /profile)', () => {
  it('blocks saving when the text contains a question mark — half-width or full-width — with the rule copy', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.edit'] }).click();
    await waitFor(() => expect(mockedApi.getUserGreeting).toHaveBeenCalled());
    await tick();

    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Кто здесь?';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect((screen.getByRole('button', { name: ru['common.save'] }) as HTMLButtonElement).disabled)
      .toBe(true);
    expect(screen.getByText(ru['profile.greeting.no_questions'])).toBeTruthy();
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();

    // The full-width ？ is blocked by the same rule.
    textarea.value = '你好？';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect((screen.getByRole('button', { name: ru['common.save'] }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('saves via PUT putUserGreeting when question-free (AC 3) and returns to the rows', async () => {
    mockedApi.putUserGreeting.mockResolvedValue({ address: ME, greeting: 'Новый оффлайн-режим' });
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.edit'] }).click();
    await waitFor(() => expect(mockedApi.getUserGreeting).toHaveBeenCalled());
    await tick();

    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Новый оффлайн-режим';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['common.save'] }).click();

    await waitFor(() =>
      expect(mockedApi.putUserGreeting).toHaveBeenCalledWith(ROOM, ME, 'Новый оффлайн-режим')
    );
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
  });

  it('regenerate fills the editor without saving until Save (AC 4); cancel returns without a PUT', async () => {
    mockedApi.regenerateGreeting.mockResolvedValue({
      address: ME,
      greeting: 'Сгенерировано из био'
    });
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.edit'] }).click();
    await waitFor(() => expect(mockedApi.getUserGreeting).toHaveBeenCalled());
    await tick();

    await screen.getByRole('button', { name: ru['profile.greeting.regenerate'] }).click();
    await waitFor(() =>
      expect(screen.getByLabelText(ru['profile.greeting.label'])).toHaveProperty('value', 'Сгенерировано из био')
    );
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
    // Cancel discards the regenerated text — nothing was saved.
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
  });
});

describe('interests picker (DESIGN §4.13.1 — real endpoints + local mirror)', () => {
  const FULL_AFTER_ADD = [
    { title: 'Велосипед', group: 2, key: 13, user_address: ME },
    { title: 'Кофе', group: 0, key: 1, user_address: ME }
  ];

  it('toggling a chip ON upserts via addUserInterests and mirrors the 201 FULL list; Done returns to the rows', async () => {
    mockedApi.addUserInterests.mockResolvedValue(FULL_AFTER_ADD);
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    const chip = screen.getByRole('button', { name: /Велосипед/ });
    await chip.click();

    await waitFor(() =>
      expect(mockedApi.addUserInterests).toHaveBeenCalledWith(ROOM, ME, [
        { title: 'Велосипед', group: 2, key: 13 }
      ])
    );
    expect(mockedApi.deleteUserInterests).not.toHaveBeenCalled();
    // The 201 FULL list is mirrored per room+user (`bleak.interests`).
    expect(JSON.parse(localStorage.getItem('bleak.interests') ?? '{}')).toMatchObject({
      '0xroom|0xme': FULL_AFTER_ADD
    });
    // The chip stays selected from the mirrored list.
    await waitFor(() => expect(chip.getAttribute('aria-pressed')).toBe('true'));

    // Done returns to the settings rows.
    await screen.getByRole('button', { name: ru['profile.interests.done'] }).click();
    await tick();
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
  });

  it('toggling a mirrored chip OFF deletes via deleteUserInterests and mirrors the 200 REMAINING list', async () => {
    localStorage.setItem(
      'bleak.interests',
      JSON.stringify({ '0xroom|0xme': FULL_AFTER_ADD })
    );
    const remaining = [{ title: 'Кофе', group: 0, key: 1, user_address: ME }];
    mockedApi.deleteUserInterests.mockResolvedValue(remaining);
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    const chip = screen.getByRole('button', { name: /Велосипед/ });
    expect(chip.getAttribute('aria-pressed')).toBe('true'); // pre-selected from the mirror
    await chip.click();

    await waitFor(() =>
      expect(mockedApi.deleteUserInterests).toHaveBeenCalledWith(ROOM, ME, [13])
    );
    expect(mockedApi.addUserInterests).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem('bleak.interests') ?? '{}')['0xroom|0xme']
      ).toEqual(remaining)
    );
    await waitFor(() => expect(chip.getAttribute('aria-pressed')).toBe('false'));
  });

  it('the mirror takes whatever the server answers — even a REMAINING list that differs locally', async () => {
    localStorage.setItem(
      'bleak.interests',
      JSON.stringify({ '0xroom|0xme': [FULL_AFTER_ADD[0]] }) // only Велосипед mirrored
    );
    // The delete is idempotent server-side (unknown keys ignored); here the
    // remaining list carries a DIFFERENT row — the mirror adopts it as-is.
    mockedApi.deleteUserInterests.mockResolvedValue([FULL_AFTER_ADD[1]!]);
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    const chip = screen.getByRole('button', { name: /Велосипед/ });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    await chip.click();
    await waitFor(() =>
      expect(mockedApi.deleteUserInterests).toHaveBeenCalledWith(ROOM, ME, [13])
    );
    await waitFor(() =>
      expect(
        JSON.parse(localStorage.getItem('bleak.interests') ?? '{}')['0xroom|0xme']
      ).toEqual([FULL_AFTER_ADD[1]])
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Кофе/ }).getAttribute('aria-pressed')).toBe('true')
    );
  });

  it('a failed write shows the inline error copy and keeps the mirror untouched', async () => {
    mockedApi.addUserInterests.mockRejectedValue(new ApiError(400, '/x', 'interests bad'));
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    await screen.getByRole('button', { name: /Велосипед/ }).click();
    await waitFor(() => expect(screen.getByText(ru['profile.interests.error'])).toBeTruthy());
    expect(localStorage.getItem('bleak.interests')).toBeNull();
    await waitFor(() =>
      expect(
        (screen.getByRole('button', { name: /Велосипед/ }) as HTMLButtonElement).disabled
      ).toBe(false)
    );
  });

  it('at the 50-row mirror cap the unselected chips disable (client-side 1..50 rows, no request needed)', async () => {
    // 50 mirrored rows with keys 2..51: Чай (key 2) is mirrored/selected,
    // Кофе (key 1) is not — at the cap the unselected chip must disable.
    const full = Array.from({ length: 50 }, (_, i) => ({
      title: `Ряд ${i + 2}`,
      group: i % 5,
      key: i + 2,
      user_address: ME
    }));
    localStorage.setItem('bleak.interests', JSON.stringify({ '0xroom|0xme': full }));
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    // A mirrored chip (Чай, key 2) stays enabled; an unselected one (Кофе)
    // is disabled at the cap — and clicking nothing means no add call.
    const selected = screen.getByRole('button', { name: /Чай/ }) as HTMLButtonElement;
    expect(selected.disabled).toBe(false);
    const unselected = screen.getByRole('button', { name: /Кофе/ }) as HTMLButtonElement;
    expect(unselected.disabled).toBe(true);
    expect(mockedApi.addUserInterests).not.toHaveBeenCalled();
  });
});

describe('contact card field (DESIGN §4.13.3 item 1 — purely local, no API)', () => {
  it('the persona section carries the contact-card row; the editor prefills from bleak.contactCard', async () => {
    localStorage.setItem(
      'bleak.contactCard',
      JSON.stringify({ '0xroom|0xme': 'telegram: @me' })
    );
    await renderPage();
    expect(screen.getByRole('button', { name: ru['profile.contact.edit'] })).toBeTruthy();
    await screen.getByRole('button', { name: ru['profile.contact.edit'] }).click();
    await tick();
    const input = screen.getByLabelText(ru['profile.contact.label']) as HTMLInputElement;
    expect(input.value).toBe('telegram: @me');
    expect(input.maxLength).toBe(255);
    // caption + counter rendered
    expect(screen.getByText(ru['profile.contact.note'])).toBeTruthy();
    expect(screen.getByText('13/255')).toBeTruthy();
  });

  it('saving persists locally per room|user and returns to the rows — NO API call', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.contact.edit'] }).click();
    await tick();
    const input = screen.getByLabelText(ru['profile.contact.label']) as HTMLInputElement;
    input.value = '  telegram: @handle  ';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['common.save'] }).click();
    await tick();
    expect(JSON.parse(localStorage.getItem('bleak.contactCard') ?? '{}')).toMatchObject({
      '0xroom|0xme': 'telegram: @handle' // trimmed by the store
    });
    // back to the rows with the saved flash; mockedApi untouched
    await waitFor(() =>
      expect(screen.getByText(ru['profile.saved'], { exact: false })).toBeTruthy()
    );
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
  });

  it('cancel returns without changing the stored card', async () => {
    localStorage.setItem(
      'bleak.contactCard',
      JSON.stringify({ '0xroom|0xme': 'telegram: @me' })
    );
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.contact.edit'] }).click();
    await tick();
    const input = screen.getByLabelText(ru['profile.contact.label']) as HTMLInputElement;
    input.value = 'changed but not saved';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(JSON.parse(localStorage.getItem('bleak.contactCard') ?? '{}')).toMatchObject({
      '0xroom|0xme': 'telegram: @me'
    });
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
  });
});

// DESIGN §4.14.2: the §4.13.3 minimal "Shared with you" list was REMOVED
// from the settings page — the /contacts footer tab is the PRIMARY surface
// (tests: tests/contacts-page.test.ts).
describe('token rotation (AC 15, moved from /profile)', () => {
  function seedVault(): void {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        { roomAddress: ROOM, userAddress: ME, token: TOKEN, name: 'Трамвайщик', savedAt: '2026-11-15T10:00:00Z' },
        { roomAddress: '0xother', userAddress: '0xold', token: 'OTHER', name: 'Прошлая', savedAt: '2026-11-01T10:00:00Z' }
      ])
    );
  }

  it('rotate updates identity + the matching vault entry IN PLACE, only after the 2xx (AC 15)', async () => {
    seedVault();
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.rotate.row'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['profile.rotate.cta'] }).click();

    await waitFor(() => expect(mockedApi.rotateUserToken).toHaveBeenCalledTimes(1));
    // Bearer = the CURRENT token (auto-injected by the api context — the
    // page passes only the room, address and the new raw body token).
    expect(mockedApi.rotateUserToken).toHaveBeenCalledWith(ROOM, ME, 'N'.repeat(43));
    // Identity + vault rewritten ONLY after the 2xx:
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: 'N'.repeat(43) });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? '{}')).toEqual({
      roomAddress: ROOM,
      userAddress: ME,
      token: 'N'.repeat(43)
    });
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault[0]).toMatchObject({ roomAddress: ROOM, userAddress: ME, token: 'N'.repeat(43), name: 'Трамвайщик' });
    expect(vault[1]).toMatchObject({ token: 'OTHER' }); // untouched
  });

  it('a 403 keeps the identity and shows the inline server text (no client writes)', async () => {
    mockedApi.rotateUserToken.mockRejectedValue(
      new ApiError(403, '/api/room/0xroom/user/0xme/token', 'token belongs to another record')
    );
    seedVault();
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.rotate.row'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['profile.rotate.cta'] }).click();
    await waitFor(() => expect(screen.getByText(/token belongs to another record/)).toBeTruthy());
    // Identity + vault unchanged (written only after 2xx).
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')[0]).toMatchObject({ token: TOKEN });
  });
});

describe('leave room (AC 7, moved from /profile; Concept §11.1.1 local-only exit)', () => {
  function seedVault(): void {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        {
          roomAddress: ROOM,
          userAddress: ME,
          token: TOKEN,
          name: 'Трамвайщик',
          savedAt: '2026-11-18T10:00:00Z'
        }
      ])
    );
  }

  it('asks the confirmation question BEFORE leaving — local-leave copy, no server delete', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    // The question is asked before any action — the dialog shows the
    // local-leave copy (no longer implying server-side deletion, §4.12.1).
    expect(screen.getByText(ru['profile.leave.confirm_body'])).toBeTruthy();
    expect(mockedApi.deleteRoomUser).not.toHaveBeenCalled();
  });

  it('confirms, clears identity + the one-time mutual code, and navigates to / — purely local, NO server delete (Concept §11.1.1)', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mutualCode.set({ userAddress: ME, code: 'LIVE' });
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    // NO delete anywhere in the attendee exit path (hard or soft) — the
    // persona stays on the server; the backend DELETE endpoint is only for
    // explicit deletion elsewhere (host drill-down).
    expect(mockedApi.deleteRoomUser).not.toHaveBeenCalled();
    await waitFor(() => expect(get(identity)).toBeNull());
    await waitFor(() => expect(localStorage.getItem('bleak.mutualCode')).toBeNull());
    expect(get(mutualCode)).toBeNull();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
  });

  it('owner round-trip (§11.1.1 + §10.1.1): the vault entry survives the leave; the return-to-event pick validates the stored token and restores the identity', async () => {
    seedVault();
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(get(identity)).toBeNull());
    // clearIdentity does NOT touch the vault — the entry is untouched.
    const stored = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    // The return-to-event pick: verifyVaultEntry succeeds because the
    // persona was never deleted — the Bearer token equals the stored one.
    mockedApi.getRoomUser.mockResolvedValue(userFixture());
    const returned = await verifyVaultEntry(stored[0]);
    expect(returned.address).toBe(ME);
    expect(mockedApi.getRoomUser).toHaveBeenCalledWith(ROOM, ME, { token: TOKEN });
    // Identity restore from the entry fields (the JoinFlow enter path;
    // navigation to /room is covered by tests/join-flow.test.ts).
    saveIdentity({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  });
});

/**
 * Outline-style leave (Concept §8.1.3, DESIGN §4.9.3): the exit-room action
 * renders red font + red border ONLY on the transparent surface — no filled
 * red background (the v2.1 §4.8.4 filled style is retired). tokens.css is
 * parsed as the palette source of truth, same approach as
 * tests/bubble-contrast.test.ts.
 */
const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
const TOKENS_CSS = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');
const PAGE_SOURCE = readFileSync(join(WEB_ROOT, 'src/routes/profile/settings/+page.svelte'), 'utf8');

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

function luminance(hex: string): number {
  const lin = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
  const sorted = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  const hi = sorted[0] ?? 0;
  const lo = sorted[1] ?? 0;
  return (hi + 0.05) / (lo + 0.05);
}

describe('outline-style leave button (Concept §8.1.3, DESIGN §4.9.3)', () => {
  it('the exit button is red font + red border on a transparent background — NO filled red', () => {
    // tokens.css defines --color-danger: #c53030 (v2.1 §4.8.4 token, unchanged)
    // and the font-role companion --color-danger-text: #e05252 (architect
    // consult on the v2.2 outline style).
    expect(TOKENS_CSS).toMatch(/--color-danger:\s*#c53030\s*;/);
    expect(TOKENS_CSS).toMatch(/--color-danger-text:\s*#e05252\s*;/);
    // The standalone .leave rule (not the shared .rotate/.leave one) wires
    // the border role to --color-danger and the font role to
    // --color-danger-text, over a transparent background (no fill).
    const leaveBlocks = [...PAGE_SOURCE.matchAll(/\.leave\s*\{[^}]*\}/g)].map((m) => m[0]);
    const outline = leaveBlocks.find((block) => block.includes('var(--color-danger'));
    expect(outline, 'standalone outline-style .leave rule').toBeTruthy();
    expect(outline).toMatch(/border-color:\s*var\(--color-danger\)/);
    expect(outline).toMatch(/(?<!border-)color:\s*var\(--color-danger-text\)/);
    expect(outline).not.toMatch(/background:\s*var\(--color-danger\)/);
  });

  it('numeric contrast — font #e05252 on the surface ≥4.5:1 AA; border #c53030 on the surface ≥3:1 non-text', () => {
    // Font role: --color-danger-text (#e05252) on the card surface (#101213)
    // = 4.92:1 — WCAG 1.4.3 normal-text AA ≥4.5:1 holds.
    expect(contrast('#e05252', '#101213')).toBeGreaterThanOrEqual(4.5);
    // Border role: --color-danger (#c53030) on the same surface = 3.43:1 —
    // WCAG 1.4.11 non-text ≥3:1 holds (the 3.43 value recorded here
    // supersedes the earlier 4.5 note; see tokens.css lineage comment).
    expect(contrast('#c53030', '#101213')).toBeGreaterThanOrEqual(3);
  });
});
