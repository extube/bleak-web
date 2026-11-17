/** /profile page tests — LEAN suite (2026-11-17 slimming pass, owner
 * directive): one block per distinct behavior, micro/aria asserts removed
 * (recorded in docs/verification-v2.md). Covers: badge render (with the
 * live-flag no-registration assert), live QR registration/rotation/failure
 * (hash-only bodies — raw never sent), persona editor, greeting editor
 * (question rule + regenerate), interests (no network), token rotation
 * (identity+vault written only after 2xx; 403 keeps them), leave room
 * (clears identity + mutual code; failure keeps identity), persona 404. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, type Chat, type Handshake, type User } from '@bleak/api-client';
import { identity } from '../src/lib/stores/identity';
import { mutualCode } from '../src/lib/stores/mutualCode';
import { tokenVault } from '../src/lib/stores/tokenVault';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route.replace('[address]', '0xchat')
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoomUser: vi.fn(),
    listHandshakesOfUser: vi.fn(),
    listChatsOfUser: vi.fn(),
    updateRoomUser: vi.fn(),
    getUserGreeting: vi.fn(),
    putUserGreeting: vi.fn(),
    regenerateGreeting: vi.fn(),
    deleteRoomUser: vi.fn(),
    registerMutualCode: vi.fn(),
    rotateUserToken: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  // Deterministic fakes: the raw mutual code is fixed and the SHA-256 hash
  // is a CONSTANT (independent of its input), so hash-only registration is
  // assertable — the raw value appears in no hashed output either.
  generateMutualCode: () => 'MUTUALRAWCODE',
  generateTokenSecret: () => 'N'.repeat(43),
  sha256Hex: async () => 'FAKEHASH'
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/profile/+page.svelte';
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

function handshake(from: string, to: string): Handshake {
  return {
    tx_id: `${from}->${to}`,
    from_address: from,
    to_address: to,
    room: ROOM,
    status: 1,
    value: 1,
    created_at: new Date().toISOString()
  };
}

function chat(address: string, participants: string[]): Chat {
  return {
    address,
    room: ROOM,
    phase: 'networking',
    phase_started_at: new Date().toISOString(),
    scenario: 'ai-future',
    language: 'ru',
    created_at: new Date().toISOString(),
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  // The page hydrates the stores from localStorage defensively (initIdentity
  // + initMutualCode), so storage AND the stores must carry the identity.
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: TOKEN })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: true }));
  mockedApi.listHandshakesOfUser.mockResolvedValue([]);
  mockedApi.listChatsOfUser.mockResolvedValue([]);
  mockedApi.getUserGreeting.mockResolvedValue({ address: ME, greeting: 'Привет! Я про трамваи.' });
  mockedApi.registerMutualCode.mockResolvedValue(undefined);
  mockedApi.rotateUserToken.mockResolvedValue(undefined);
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

describe('badge card (AC 1, 9, 11)', () => {
  it('renders name, greeting, bios, language meta, interests and stats; a live stored code re-renders WITHOUT a registration call', async () => {
    localStorage.setItem('bleak.interests', JSON.stringify(['coffee', 'books']));
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.listHandshakesOfUser.mockResolvedValue([
      handshake(ME, '0xa'),
      handshake('0xb', ME)
    ]);
    mockedApi.listChatsOfUser.mockResolvedValue([chat('0xchat1', [ME, '0xa'])]);

    await renderPage();

    expect(screen.getByText('Трамвайщик')).toBeTruthy();
    expect(screen.getByText('Привет! Я про трамваи.')).toBeTruthy();
    expect(screen.getByText('Поттер из Питера')).toBeTruthy();
    expect(screen.getByText('Кофе')).toBeTruthy();
    expect(screen.getByText(ru['profile.stats.handshakes_label'])).toBeTruthy();
    // the stored code is LIVE → no registration call (fresh registration is
    // covered by the next block)
    expect(mockedApi.registerMutualCode).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: ru['profile.qr.aria'] })).toBeTruthy();
  });
});

describe('live badge QR (AC 14)', () => {
  it('first load with no code: registers a fresh code sending the HASH only, never the raw', async () => {
    await renderPage();
    await waitFor(() => expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1));
    // body = the SHA-256 hash of the generated code — the raw code value
    // (MUTUALRAWCODE) appears in NO argument of the registration call
    expect(mockedApi.registerMutualCode).toHaveBeenCalledWith(ROOM, ME, 'FAKEHASH');
    for (const call of mockedApi.registerMutualCode.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('MUTUALRAWCODE');
    }
    // the raw code persists client-side for the badge QR re-render
    expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'MUTUALRAWCODE' });
    expect(localStorage.getItem('bleak.mutualCode')).toContain('MUTUALRAWCODE');
  });

  it('a burned flag (mutual_code_live=false) rotates: fresh code, hash-only body, note auto-hides after 2 s', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'OLD' }));
      mutualCode.set({ userAddress: ME, code: 'OLD' });
      mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: false }));
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1);
      expect(mockedApi.registerMutualCode).toHaveBeenCalledWith(ROOM, ME, 'FAKEHASH');
      expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'MUTUALRAWCODE' });
      // The transient note announces the swap and auto-hides after 2 s.
      await vi.advanceTimersByTimeAsync(2000);
      await tick();
      expect(screen.queryByText(ru['profile.qr.refreshed'], { exact: false })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('registration failure keeps the last QR and retries on the next 4 s tick', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'OLD' }));
      mutualCode.set({ userAddress: ME, code: 'OLD' });
      mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: false }));
      mockedApi.registerMutualCode
        .mockRejectedValueOnce(new ApiError(500, '/x', 'db locked'))
        .mockResolvedValueOnce(undefined);
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1);
      // The old code is untouched while the registration fails.
      expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'OLD' });
      // Next 4 s tick: the flag still reads false → retry succeeds.
      await vi.advanceTimersByTimeAsync(4100);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(2);
      expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'MUTUALRAWCODE' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('persona editor (AC 2)', () => {
  it('saves all three fields via PUT updateRoomUser and reflects them', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.updateRoomUser.mockResolvedValue(
      userFixture({ name: 'Стеклодув', public_bio: 'Новое био', private_bio: 'Секрет' })
    );
    await renderPage();

    await screen
      .getByRole('button', { name: ru['profile.persona.edit'] })
      .click();
    await tick();

    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
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
    await waitFor(() => expect(screen.getByText('Стеклодув')).toBeTruthy());
  });

  it('cancel returns to the badge without a PUT', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.persona.edit'] }).click();
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
    expect(screen.getByText('Трамвайщик')).toBeTruthy();
  });
});

describe('greeting editor (AC 3, 4)', () => {
  it('blocks saving when the text contains a question mark — half-width or full-width — with the rule copy', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
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

  it('saves via PUT putUserGreeting when question-free (AC 3)', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
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
    await waitFor(() => expect(screen.getByText('Новый оффлайн-режим')).toBeTruthy());
  });

  it('regenerate fills the editor without saving until Save (AC 4)', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
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
    // the badge still shows the old greeting
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(screen.getByText('Привет! Я про трамваи.')).toBeTruthy();
  });
});

describe('interests editor (AC 5)', () => {
  it('toggling chips persists locally and NEVER issues a network request', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    const callsBefore = mockedApi.getRoomUser.mock.calls.length;
    const chip = screen.getByRole('button', { name: /Велосипед/ });
    await chip.click();
    await tick();

    expect(JSON.parse(localStorage.getItem('bleak.interests') ?? '[]')).toEqual(['cycling']);
    // no api call was made by editing interests
    expect(mockedApi.getRoomUser.mock.calls.length).toBe(callsBefore);

    // the badge re-reads the store when returning to it
    await screen.getByRole('button', { name: ru['profile.interests.done'] }).click();
    await tick();
    expect(screen.getByText('Велосипед')).toBeTruthy();
  });
});

describe('token rotation (AC 15)', () => {
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
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
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
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
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

describe('leave room (AC 7)', () => {
  it('confirms, DELETEs, clears identity AND the one-time mutual code, and navigates to /', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.deleteRoomUser.mockResolvedValue(undefined);
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(mockedApi.deleteRoomUser).toHaveBeenCalledWith(ROOM, ME));
    await waitFor(() => expect(get(identity)).toBeNull());
    await waitFor(() => expect(localStorage.getItem('bleak.mutualCode')).toBeNull());
    expect(get(mutualCode)).toBeNull();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
  });

  it('keeps the identity and shows the server text on failure', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.deleteRoomUser.mockRejectedValue(
      new ApiError(409, '/api/room/0xroom/user/0xme', 'income must exceed outcome')
    );
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(screen.getByText(/income must exceed outcome/)).toBeTruthy());
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  });
});

describe('persona 404 (AC 8)', () => {
  it('renders the not-found card and the exit clears identity', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.getRoomUser.mockRejectedValue(new ApiError(404, '/api/room/0xroom/user/0xme', 'user not found'));
    await renderPage();
    expect(screen.getByText(ru['profile.not_found'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['profile.exit'] }).click();
    await waitFor(() => expect(get(identity)).toBeNull());
  });
});
