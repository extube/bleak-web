/** /chats/[address] transcript page tests — LEAN suite (2026-11-17 slimming
 * pass, owner directive): one block per distinct behavior, micro/scroll
 * asserts removed (recorded in docs/verification-v2.md). Covers: oldest-first
 * render + header chips, 2 s live poll, network banner + recovery, poller
 * teardown, kickoff confirm (cancel + confirm + clear + speaker note),
 * warming row, kickoff failure, 404 state, contact stub, the permanent
 * NO-COMPOSER check (owner ruling 4), and the viewer fallback (room-token
 * retry, host-401 gate replication, host-view kickoff, no-token 401). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, NetworkError, type Chat, type Message, type User } from '@bleak/api-client';

const { mockPage } = vi.hoisted(() => ({
  mockPage: {
    params: {} as Record<string, string | undefined>,
    url: new URL('http://localhost/chats/0xchat1')
  }
}));
vi.mock('$app/state', () => ({ page: mockPage }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? route.replace('[address]', params.address) : route
}));

const apiRawMock = vi.hoisted(() => ({
  getChat: vi.fn(),
  listChatMessages: vi.fn(),
  kickoffChat: vi.fn()
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getChat: vi.fn(),
    listChatMessages: vi.fn(),
    listRoomUsers: vi.fn(),
    kickoffChat: vi.fn()
  },
  apiRaw: apiRawMock,
  HOST_RESET_KEY: 'bleak.hostReset'
}));

import { goto } from '$app/navigation';
import { api, apiRaw } from '#lib/api/client';
import { saveHostRoom, clearHostRoom } from '#lib/stores/hostSession';
import { identity } from '#lib/stores/identity';
import { codeHue } from '../src/lib/avatar/traits';
import Page from '../src/routes/chats/[address]/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';
const CHAT = '0xchat1';
const mockedApi = vi.mocked(api, true);
const mockedApiRaw = vi.mocked(apiRaw, true);

const fixture = {
  chat: null as Chat | null,
  users: [] as User[],
  messages: [] as Message[]
};

function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function person(address: string, name: string): User {
  return {
    address,
    room: ROOM,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: secondsAgo(600),
    updated_at: secondsAgo(600),
    deleted_at: null
  };
}

function baseChat(): Chat {
  return {
    address: CHAT,
    room: ROOM,
    phase: 'networking',
    phase_started_at: secondsAgo(300),
    scenario: 'ai-future',
    language: 'ru',
    created_at: secondsAgo(300),
    participants: [
      { chat: CHAT, user: ME },
      { chat: CHAT, user: '0xa' }
    ]
  };
}

function message(txId: string, from: string, content: string, seconds: number): Message {
  return {
    tx_id: txId,
    chat: CHAT,
    from,
    to: from === ME ? '0xa' : ME,
    content,
    created_at: secondsAgo(seconds)
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPage.params = { address: CHAT };
  localStorage.clear();
  sessionStorage.clear();
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: 'p-tok' })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: 'p-tok' });
  fixture.chat = baseChat();
  fixture.users = [person(ME, 'Я'), person('0xa', 'Алиса')];
  fixture.messages = [];
  mockedApi.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  mockedApi.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApi.kickoffChat.mockResolvedValue({ chat: CHAT, cleared: 2, speaker: '0xa' });
  mockedApiRaw.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApiRaw.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApiRaw.kickoffChat.mockResolvedValue({ chat: CHAT, cleared: 2, speaker: '0xa' });
});

afterEach(() => {
  cleanup();
  clearHostRoom();
  identity.set(null);
  localStorage.clear();
  sessionStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.listChatMessages).toHaveBeenCalled());
  await tick();
  await tick();
}

function withMessages(...messages: Message[]): void {
  fixture.messages = messages;
}

describe('transcript rendering + live updates (§3.5 AC 1–4, 9, 12)', () => {
  it('renders oldest-first with mine/theirs alignment, speakers and header chips', async () => {
    withMessages(
      message('tx1', '0xa', 'Привет, я твой новый контакт.', 120),
      message('tx2', ME, 'Привет! Чем занимаешься?', 60),
      message('tx3', '0xa', 'Я работаю с глиной — делаю чашки и свистки.', 30)
    );
    await renderPage();
    const rows = document.querySelectorAll('ol.transcript > li');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.getAttribute('aria-label')).toBe(
      `Алиса: ${'Привет, я твой новый контакт.'}`
    );
    expect(rows[0]?.classList.contains('mine')).toBe(false);
    expect(rows[1]?.classList.contains('mine')).toBe(true);
    expect(rows[0]?.textContent).toContain('Алиса');
    expect(rows[0]?.textContent).toContain('2 мин');
    // header: counterpart name + verbatim phase/scenario/language chips
    expect(document.querySelector('h1')?.textContent).toBe('Алиса');
    expect(screen.getByText('networking')).toBeTruthy();
    expect(screen.getByText('ai-future')).toBeTruthy();
    expect(screen.getByText('ru')).toBeTruthy();
    // §4.8.1 color coding: each bubble carries its speaker's code hue.
    const bubbles = document.querySelectorAll('.bubble');
    expect(bubbles[0]?.classList.contains(`code-${codeHue('0xa')}`)).toBe(true);
    expect(bubbles[1]?.classList.contains(`code-${codeHue(ME)}`)).toBe(true);
    expect(bubbles[2]?.classList.contains(`code-${codeHue('0xa')}`)).toBe(true);
  });

  it('new messages appear within one 2 s poll tick without reload (AC 3)', async () => {
    await renderPage();
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(0);

    withMessages(message('tx1', '0xa', 'Агенты начали говорить.', 5));
    await screen.findByText('Агенты начали говорить.', undefined, { timeout: 4000 });
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(1);
  });

  it('network failure shows the banner while keeping the last transcript; recovery auto-dismisses (AC 9)', async () => {
    withMessages(message('tx1', '0xa', 'Первое сообщение.', 60));
    let fail = false;
    mockedApi.listChatMessages.mockImplementation(async () => {
      if (fail) throw new NetworkError('/api/chat/x/message', new Error('offline'));
      return structuredClone(fixture.messages);
    });

    await renderPage();
    expect(screen.getByText('Первое сообщение.')).toBeTruthy();

    fail = true;
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 5000 });
    expect(screen.getByText('Первое сообщение.')).toBeTruthy();

    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('leaving the page stops the 2 s poller (AC 12)', async () => {
    vi.useFakeTimers();
    try {
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const callsAtMount = mockedApi.listChatMessages.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      cleanup();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockedApi.listChatMessages.mock.calls.length).toBe(callsAtMount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('kickoff flow (§3.5 AC 5, 6)', () => {
  beforeEach(() => {
    withMessages(message('tx1', '0xa', 'Раз.', 200), message('tx2', ME, 'Два.', 100));
    mockedApi.kickoffChat.mockImplementation(async () => {
      fixture.messages = [];
      return { chat: CHAT, cleared: 2, speaker: '0xa' };
    });
  });

  it('cancel closes without effects; confirm POSTs kickoff, clears the transcript, shows the speaker note and the warming row until the next message', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await tick();
    expect(screen.getByText(ru['chat.kickoff.confirm_title'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(mockedApi.kickoffChat).not.toHaveBeenCalled();
    expect(screen.getByText('Раз.')).toBeTruthy(); // transcript untouched

    // Confirm path.
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();
    await waitFor(() => expect(mockedApi.kickoffChat).toHaveBeenCalledWith(CHAT));
    await waitFor(() =>
      expect(
        screen.getByText(ru['chat.kickoff.speaker'].replace('{name}', 'Алиса'))
      ).toBeTruthy()
    );
    await screen.findByText(ru['chat.warming_up'], undefined, { timeout: 4000 });

    // The first polled message clears the warming row.
    withMessages(message('tx9', '0xa', 'Начнём заново.', 2));
    await screen.findByText('Начнём заново.', undefined, { timeout: 4000 });
    expect(screen.queryByText(ru['chat.warming_up'])).toBeNull();
  });

  it('kickoff failure surfaces the error and keeps the transcript', async () => {
    mockedApi.kickoffChat.mockRejectedValue(
      new NetworkError(`/api/chat/${CHAT}/kickoff`, new Error('offline'))
    );
    await renderPage();
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();

    await screen.findByText(ru['common.error.network'], undefined, { timeout: 4000 });
    expect(screen.getByText('Раз.')).toBeTruthy();
  });
});

describe('states: 404, contact stub (§3.5 AC 7, 8)', () => {
  it('404 chat renders the not-found state with a working link back to /chats (AC 8)', async () => {
    mockedApi.getChat.mockRejectedValue(new ApiError(404, `/api/chat/${CHAT}`, 'chat not found'));
    render(Page, { props: {} });
    await screen.findByText(ru['chat.not_found'], undefined, { timeout: 4000 });
    await screen.getByRole('button', { name: ru['chat.back_to_list'] }).click();
    expect(goto).toHaveBeenCalledWith('/chats');
  });

  it('the contact-exchange stub is always visible, disabled and non-interactive (AC 7)', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    await renderPage();
    const stub = document.querySelector('.contact-stub');
    expect(stub).toBeTruthy();
    expect(stub?.getAttribute('aria-disabled')).toBe('true');
    expect(stub?.textContent).toContain(ru['chat.contact_stub']);
    expect(stub?.querySelector('button, a, input')).toBeNull();
  });
});

describe('NO-COMPOSER (owner ruling 4, permanent — §3.5 AC 13)', () => {
  it('the transcript UI contains no input/textarea/send control; only back, kickoff (+confirm), contact stub', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    await renderPage();

    const root = document.querySelector('.page');
    expect(root).toBeTruthy();
    // no composer of any kind, in any state
    expect(root?.querySelector('input, textarea, [contenteditable="true"]')).toBeNull();
    expect(root?.querySelector('form')).toBeNull();
    const buttons = Array.from(root?.querySelectorAll('button') ?? []);
    const labels = buttons.map(
      (button) =>
        button.textContent?.trim() || button.getAttribute('aria-label') || ''
    );
    expect(labels).toContain(ru['common.back']);
    expect(labels).toContain(ru['chat.kickoff']);
    expect(buttons).toHaveLength(2);
    // POST /api/message is not wired: the api mock exposes no sendMessage usage
    expect(mockedApi).not.toHaveProperty('sendMessage');
  });
});

describe('transcript viewer fallback (§3.5 AC 14, ARCHITECTURE §10.3)', () => {
  function storeHostSession(): void {
    saveHostRoom({
      code: '123456',
      roomAddress: ROOM,
      roomToken: 'r-tok'
    });
  }

  it('persona read 403 + a stored room token → room-token retries via apiRaw; host-view persists for the session', async () => {
    storeHostSession();
    mockedApi.getChat.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}`, 'not a participant')
    );
    mockedApi.listChatMessages.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}/message`, 'not a participant')
    );

    await renderPage();

    await waitFor(() => expect(mockedApiRaw.getChat).toHaveBeenCalled());
    await waitFor(() => expect(mockedApiRaw.listChatMessages).toHaveBeenCalled());
    // Every retry carries the stored room token (never a second persona flavor).
    for (const call of mockedApiRaw.getChat.mock.calls) {
      expect(call[1]).toEqual({ token: 'r-tok' });
    }
    expect(screen.getByText(ru['chat.host_view'])).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toMatchObject({
      userAddress: ME
    });

    // A later poll tick: no new persona attempt, room token used directly.
    const callsAfterFirstTick = mockedApiRaw.listChatMessages.mock.calls.length;
    withMessages(message('tx1', '0xa', 'Наблюдаем.', 5));
    await screen.findByText('Наблюдаем.', undefined, { timeout: 4000 });
    const laterCall =
      mockedApiRaw.listChatMessages.mock.calls[
        mockedApiRaw.listChatMessages.mock.calls.length - 1
      ];
    expect(mockedApiRaw.listChatMessages.mock.calls.length).toBeGreaterThan(callsAfterFirstTick);
    expect(laterCall?.[1]).toEqual({ token: 'r-tok' });
  });

  it('a host-context 401 on the retry replicates the hostApi gate: host room cleared + hostReset flag, identity untouched', async () => {
    storeHostSession();
    mockedApi.getChat.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}`, 'not a participant')
    );
    mockedApiRaw.getChat.mockRejectedValue(
      new ApiError(401, `/api/chat/${CHAT}`, 'room token revoked')
    );

    render(Page, { props: {} });

    await waitFor(() =>
      expect(sessionStorage.getItem('bleak.hostReset')).toBe('1')
    );
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toMatchObject({
      userAddress: ME
    });
    expect(goto).not.toHaveBeenCalled();
  });

  it('kickoff in host-view mode goes through the room token', async () => {
    storeHostSession();
    withMessages(message('tx1', '0xa', 'Раз.', 200), message('tx2', ME, 'Два.', 100));
    mockedApi.getChat.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}`, 'not a participant')
    );
    mockedApi.listChatMessages.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}/message`, 'not a participant')
    );
    mockedApiRaw.kickoffChat.mockImplementation(async () => {
      fixture.messages = [];
      return { chat: CHAT, cleared: 2, speaker: '0xa' };
    });

    await renderPage();
    await screen.findByText(ru['chat.host_view']);
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();

    await waitFor(() =>
      expect(mockedApiRaw.kickoffChat).toHaveBeenCalledWith(CHAT, { token: 'r-tok' })
    );
    expect(mockedApi.kickoffChat).not.toHaveBeenCalled();
  });

  it('without a stored room token a 401 renders NO transcript error UI (the §2.8 global gate owns it — AC 15)', async () => {
    mockedApi.getChat.mockRejectedValue(new ApiError(401, `/api/chat/${CHAT}`, 'no token'));
    mockedApi.listChatMessages.mockRejectedValue(
      new ApiError(401, `/api/chat/${CHAT}/message`, 'no token')
    );

    render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getChat).toHaveBeenCalled());
    await tick();
    await tick();
    expect(screen.queryByText(ru['common.error.network'])).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // The fallback never engaged (no room token to retry with).
    expect(mockedApiRaw.getChat).not.toHaveBeenCalled();
    expect(screen.queryByText(ru['chat.host_view'])).toBeNull();
  });
});
