/** /profile page tests (TZ-08, DESIGN §3.6 AC 1–13): badge card rendering,
 * persona/greeting editors, regenerate, interests editing (no network),
 * leave room, 404 state, stats, skeleton + banner. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, NetworkError, type Chat, type Handshake, type User } from '@bleak/api-client';
import { identity } from '../src/lib/stores/identity';

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
    deleteRoomUser: vi.fn()
  }
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/profile/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';
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
  // The page hydrates the store from localStorage defensively (initIdentity),
  // so both the storage and the store must carry the identity before render.
  localStorage.setItem('bleak.identity', JSON.stringify({ roomAddress: ROOM, userAddress: ME }));
  identity.set({ roomAddress: ROOM, userAddress: ME });
  mockedApi.getRoomUser.mockResolvedValue(userFixture());
  mockedApi.listHandshakesOfUser.mockResolvedValue([]);
  mockedApi.listChatsOfUser.mockResolvedValue([]);
  mockedApi.getUserGreeting.mockResolvedValue({ address: ME, greeting: 'Привет! Я про трамваи.' });
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('badge card (AC 1, 9, 11)', () => {
  it('renders name, greeting, bios, read-only language, interests and stats', async () => {
    localStorage.setItem('bleak.interests', JSON.stringify(['coffee', 'books']));
    mockedApi.listHandshakesOfUser.mockResolvedValue([
      handshake(ME, '0xa'),
      handshake('0xb', ME)
    ]);
    mockedApi.listChatsOfUser.mockResolvedValue([chat('0xchat1', [ME, '0xa'])]);

    await renderPage();

    expect(screen.getByText('Трамвайщик')).toBeTruthy();
    expect(screen.getByText('Привет! Я про трамваи.')).toBeTruthy();
    expect(screen.getByText('Поттер из Питера')).toBeTruthy();
    expect(screen.getByText('Люблю глина и стеклодувное дело')).toBeTruthy();
    // read-only language meta (§6.3 — language cannot be set via the API)
    expect(screen.getByText(ru['profile.language.meta'].replace('{language}', 'ru'))).toBeTruthy();
    // interest chips from the mock store
    expect(screen.getByText('Кофе')).toBeTruthy();
    expect(screen.getByText('Книги')).toBeTruthy();
    // stat tiles computed from the lists
    expect(screen.getByText(ru['profile.stats.handshakes_label'])).toBeTruthy();
    expect(screen.getByText(ru['profile.stats.dialogs_label'])).toBeTruthy();
    // two always-visible tiles + the third («Добавили вас») behind the
    // ≥720px media rule (.added-tile) — happy-dom does no layout, so the
    // DOM carries all three; the media query hides the third on phones.
    const tiles = document.querySelectorAll('.stat-tile');
    expect(tiles).toHaveLength(3);
    expect(document.querySelector('.added-tile')).toBeTruthy();
  });

  it('stat tiles announce full values («Хендшейки: 7») (AC 9)', async () => {
    mockedApi.listHandshakesOfUser.mockResolvedValue(
      Array.from({ length: 7 }, () => handshake(ME, '0xa'))
    );
    await renderPage();
    const tile = screen.getByRole('img', { name: 'Хендшейки: 7' });
    expect(tile).toBeTruthy();
  });

  it('shows the personal QR block with caption (AC 11)', async () => {
    await renderPage();
    expect(screen.getByText(ru['profile.qr.caption'])).toBeTruthy();
    const qr = screen.getByRole('img', { name: ru['profile.qr.alt'] });
    expect(qr.querySelector('svg')).toBeTruthy();
    // no network request for the QR (client-side SVG)
    expect(mockedApi.getRoomUser).toHaveBeenCalledTimes(1);
  });

  it('empty interests show the placeholder + add chip (AC 1)', async () => {
    await renderPage();
    expect(screen.getByText(ru['profile.interests.empty'])).toBeTruthy();
    expect(screen.getByText(ru['profile.interests.add'])).toBeTruthy();
  });

  it('skeleton renders before the first fetch resolves', async () => {
    mockedApi.getRoomUser.mockImplementation(() => new Promise<User>(() => undefined));
    render(Page, { props: {} });
    // the page-level skeleton badge card (page direct child; the inner
    // SkeletonBlocks also carry the .skeleton class)
    expect(document.querySelectorAll('main > .skeleton')).toHaveLength(1);
    expect(screen.queryByText('Трамвайщик')).toBeNull();
  });
});

describe('persona editor (AC 2)', () => {
  it('saves all three fields via PUT updateRoomUser and reflects them', async () => {
    mockedApi.updateRoomUser.mockResolvedValue(
      userFixture({ name: 'Стеклодув', public_bio: 'Новое био', private_bio: 'Секрет' })
    );
    await renderPage();

    await screen
      .getByRole('button', { name: ru['profile.persona.edit'] })
      .click();
    await tick();

    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    expect((nameInput as HTMLInputElement).value).toBe('Трамвайщик');
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
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.persona.edit'] }).click();
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(mockedApi.updateRoomUser).not.toHaveBeenCalled();
    expect(screen.getByText('Трамвайщик')).toBeTruthy();
  });
});

describe('greeting editor (AC 3, 4)', () => {
  it('blocks saving when the text contains ?, with the exact rule copy', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.edit'] }).click();
    await waitFor(() => expect(mockedApi.getUserGreeting).toHaveBeenCalled());
    await tick();

    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = 'Кто здесь?';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();

    const save = screen.getByRole('button', { name: ru['common.save'] }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    expect(save.getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByText(ru['profile.greeting.no_questions'])).toBeTruthy();
    expect(mockedApi.putUserGreeting).not.toHaveBeenCalled();
  });

  it('blocks the full-width ？ too', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.edit'] }).click();
    await waitFor(() => expect(mockedApi.getUserGreeting).toHaveBeenCalled());
    await tick();
    const textarea = screen.getByLabelText(ru['profile.greeting.label']) as HTMLTextAreaElement;
    textarea.value = '你好？';
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect((screen.getByRole('button', { name: ru['common.save'] }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it('saves via PUT putUserGreeting when question-free (AC 3)', async () => {
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

  it('server 400 surfaces the no-questions copy (AC 3)', async () => {
    mockedApi.putUserGreeting.mockRejectedValue(
      new ApiError(400, '/api/room/0xroom/user/0xme/greeting', 'greeting contains ?')
    );
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.greeting.edit'] }).click();
    await waitFor(() => expect(mockedApi.getUserGreeting).toHaveBeenCalled());
    await tick();
    await screen.getByRole('button', { name: ru['common.save'] }).click();
    await waitFor(() =>
      expect(screen.getByText(ru['profile.greeting.no_questions'])).toBeTruthy()
    );
  });
});

describe('interests editor (AC 5)', () => {
  it('toggling chips persists locally and NEVER issues a network request', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.interests.edit'] }).click();
    await tick();

    const callsBefore = mockedApi.getRoomUser.mock.calls.length;
    const chip = screen.getByRole('button', { name: /Велосипед/ });
    await chip.click();
    await tick();

    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(JSON.parse(localStorage.getItem('bleak.interests') ?? '[]')).toEqual(['cycling']);
    // no api call was made by editing interests
    expect(mockedApi.getRoomUser.mock.calls.length).toBe(callsBefore);

    // the badge re-reads the store when returning to it
    await screen.getByRole('button', { name: ru['profile.interests.done'] }).click();
    await tick();
    expect(screen.getByText('Велосипед')).toBeTruthy();
  });
});

describe('locale switch (AC 6)', () => {
  it('the settings segmented control switches and persists app-wide', async () => {
    await renderPage();
    await screen.getByRole('radio', { name: 'EN' }).click();
    await tick();
    expect(localStorage.getItem('bleak.locale')).toBe('en');
    expect(screen.getByText('Profile')).toBeTruthy();
    await screen.getByRole('radio', { name: 'RU' }).click();
  });
});

describe('leave room (AC 7)', () => {
  it('confirms, DELETEs, clears identity and navigates to /', async () => {
    mockedApi.deleteRoomUser.mockResolvedValue(undefined);
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    expect(screen.getByText(ru['profile.leave.confirm_body'])).toBeTruthy();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(mockedApi.deleteRoomUser).toHaveBeenCalledWith(ROOM, ME));
    await waitFor(() => expect(get(identity)).toBeNull());
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
  });

  it('keeps the identity and shows the server text on failure', async () => {
    mockedApi.deleteRoomUser.mockRejectedValue(
      new ApiError(409, '/api/room/0xroom/user/0xme', 'income must exceed outcome')
    );
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(screen.getByText(/income must exceed outcome/)).toBeTruthy());
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME });
  });
});

describe('persona 404 (AC 8)', () => {
  it('renders the not-found card and the exit clears identity', async () => {
    mockedApi.getRoomUser.mockRejectedValue(new ApiError(404, '/api/room/0xroom/user/0xme', 'user not found'));
    await renderPage();
    expect(screen.getByText(ru['profile.not_found'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['profile.exit'] }).click();
    await waitFor(() => expect(get(identity)).toBeNull());
  });

  it('network failure shows the banner and recovery retries (§2.1)', async () => {
    let fail = true;
    mockedApi.getRoomUser.mockImplementation(async () => {
      if (fail) throw new NetworkError('/x', new Error('offline'));
      return userFixture();
    });
    render(Page, { props: {} });
    await screen.findByText(ru['common.error.network']);
    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.getByText('Трамвайщик')).toBeTruthy());
  });
});
