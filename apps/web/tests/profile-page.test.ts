/** /profile page tests — LEAN suite (2026-11-17 slimming pass, owner
 * directive): one block per distinct behavior, micro/aria asserts removed
 * (recorded in docs/verification-v2.md). Covers: badge render (with the
 * live-flag no-registration assert), live QR registration/rotation/failure
 * (hash-only bodies — raw never sent), persona editor, greeting editor
 * (question rule + regenerate), interests (no network), persona 404 — plus
 * the §8.1.3 settings relocation (the leave/rotate rows moved to
 * /profile/settings; this page renders only a nav affordance). The moved
 * settings logic itself is covered by tests/profile-settings.test.ts. The
 * v2.2 polish (Concept §8.1.4/8.1.5 — exactly-three renamed stat tiles and
 * the rounded avatar-change button) is covered at the bottom of the file. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
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

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');

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

describe('profile stats — exactly three (Concept §8.1.5, DESIGN §4.9.5)', () => {
  it('renders EXACTLY three stat tiles — Sent / Added you / Chatting — with the renamed RU labels', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.listHandshakesOfUser.mockResolvedValue([
      handshake(ME, '0xa'), // sent
      handshake('0xb', ME) // received → "Added you"
    ]);
    mockedApi.listChatsOfUser.mockResolvedValue([chat('0xchat1', [ME, '0xa'])]);

    const { container } = render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    await tick();
    await tick();

    // Exactly three tiles — no fourth metric on /profile, none hidden away.
    expect(container.querySelectorAll('.stats .stat-tile').length).toBe(3);
    // The renamed labels (RU) are all present, and the old ones are gone.
    expect(screen.getByText(ru['profile.stats.handshakes_label'])).toBeTruthy(); // «Отправлено»
    expect(screen.getByText(ru['profile.stats.added_label'])).toBeTruthy(); // «Добавили вас»
    expect(screen.getByText(ru['profile.stats.dialogs_label'])).toBeTruthy(); // «В диалогах»
    expect(screen.queryByText('Хендшейки')).toBeNull();
    expect(screen.queryByText('Диалоги')).toBeNull();
  });

  it('EN parity: the same three tiles read Sent / Added you / Chatting', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.listHandshakesOfUser.mockResolvedValue([handshake(ME, '0xa')]);
    mockedApi.listChatsOfUser.mockResolvedValue([]);
    const { container } = render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    await tick();
    await tick();

    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    setLocale('en');
    await tick();
    await tick();

    expect(container.querySelectorAll('.stats .stat-tile').length).toBe(3);
    expect(screen.getByText(en['profile.stats.handshakes_label'])).toBeTruthy(); // Sent
    expect(screen.getByText(en['profile.stats.added_label'])).toBeTruthy(); // Added you
    expect(screen.getByText(en['profile.stats.dialogs_label'])).toBeTruthy(); // Chatting
    setLocale('ru');
    await tick();
  });
});

describe('avatar-change button radius (Concept §8.1.4, DESIGN §4.9.4)', () => {
  it('the persona/avatar edit control on the badge is a rounded square — not a full circle', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const block = source.match(/\.icon-button\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('border-radius: var(--radius-md)');
    // The full-circle shapes are gone from the control (pill-on-square and
    // literal 50% would both render as a circle on the 48px touch target).
    expect(block).not.toMatch(/border-radius:\s*(?:var\(--radius-pill\)|50%)/);
  });
});

describe('private-bio heading (Concept §8.1.6, DESIGN §4.9.6)', () => {
  it('the «only your agent sees this» heading is styled DISTINCTLY from the private content below it', async () => {
    await renderPage();
    const heading = document.querySelector('.private-bio-heading');
    expect(heading?.textContent).toBe(ru['profile.private_bio.caption']);
    // Distinct hierarchy: pixel font like the section titles, uppercase,
    // muted — vs the 14px Inter bio text below it.
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const block = source.match(/\.private-bio-heading\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('font-family: var(--font-pixel)');
    expect(block).toContain('text-transform: uppercase');
    expect(block).toContain('var(--color-text-muted)');
    // The heading sits ABOVE the private content in the badge block.
    const bioBlock = source.match(/for_agent[\s\S]*?bio-text/)?.[0] ?? '';
    expect(bioBlock.indexOf('private-bio-heading')).toBeLessThan(
      bioBlock.indexOf('bio-text')
    );
  });
});

describe('settings relocation (Concept §8.1.3, DESIGN §4.9.3)', () => {
  it('the leave/rotate rows are GONE from /profile; a settings nav link renders instead (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    await renderPage();
    // No settings rows remain on the profile page itself.
    expect(screen.queryByRole('button', { name: ru['profile.rotate.row'] })).toBeNull();
    expect(screen.queryByRole('button', { name: ru['profile.leave'] })).toBeNull();
    expect(screen.queryByText(ru['common.locale'])).toBeNull();
    // The affordance is a real link to the new sub-page (§2.6).
    const link = screen.getByRole('link', { name: ru['profile.settings.title'] }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/profile/settings');
    // EN parity: the same link re-renders through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('link', { name: en['profile.settings.title'] })).toBeTruthy();
    setLocale('ru');
    await tick();
  });
});

