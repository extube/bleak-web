/** /chats/[address] transcript page tests (TZ-07, DESIGN §3.5): oldest-first
 * render with mine-right/theirs-left alignment, speaker names + relative
 * times, accessible bubble names, header chips, live 2 s polls, auto-scroll
 * chip, kickoff confirm flow (cancel/confirm/speaker note/warming row),
 * contact stub (always disabled), 404 not-found state, error banner,
 * poller teardown — and the permanent NO-COMPOSER check (owner ruling 4). */
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

vi.mock('#lib/api/client', () => ({
  api: {
    getChat: vi.fn(),
    listChatMessages: vi.fn(),
    listRoomUsers: vi.fn(),
    kickoffChat: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import Page from '../src/routes/chats/[address]/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';
const CHAT = '0xchat1';
const mockedApi = vi.mocked(api, true);

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
  // The page hydrates the store from localStorage defensively (initIdentity),
  // so both the storage and the store must carry the identity before render.
  localStorage.clear();
  localStorage.setItem('bleak.identity', JSON.stringify({ roomAddress: ROOM, userAddress: ME }));
  identity.set({ roomAddress: ROOM, userAddress: ME });
  fixture.chat = baseChat();
  fixture.users = [person(ME, 'Я'), person('0xa', 'Алиса')];
  fixture.messages = [];
  mockedApi.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  mockedApi.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApi.kickoffChat.mockResolvedValue({ chat: CHAT, cleared: 2, speaker: '0xa' });
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.listChatMessages).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('transcript rendering (§3.5 AC 1, 2, 4)', () => {
  beforeEach(() => {
    fixture.messages = [
      message('tx1', '0xa', 'Привет, я твой новый контакт.', 120),
      message('tx2', ME, 'Привет! Чем занимаешься?', 60),
      message('tx3', '0xa', 'Я работаю с глиной — делаю чашки и свистки.', 30)
    ];
  });

  it('renders all messages oldest-first; mine right, theirs left per message.from', async () => {
    await renderPage();
    const container = document;
    const rows = container.querySelectorAll('ol.transcript > li');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.getAttribute('aria-label')).toBe(
      `Алиса: ${'Привет, я твой новый контакт.'}`
    );
    expect(rows[0]?.classList.contains('mine')).toBe(false);
    expect(rows[1]?.classList.contains('mine')).toBe(true);
    expect(rows[2]?.classList.contains('mine')).toBe(false);
    // speaker names resolved from the roster
    expect(rows[1]?.textContent).toContain('Я');
    expect(rows[0]?.textContent).toContain('Алиса');
    // relative times present
    expect(rows[0]?.textContent).toContain('2 мин');
  });

  it('the header shows the counterpart name and verbatim phase/scenario/language chips (AC 4)', async () => {
    await renderPage();
    // the counterpart name is the header h1 (also spoken by bubble speakers)
    expect(screen.getAllByText('Алиса').length).toBeGreaterThanOrEqual(1);
    expect(document.querySelector('h1')?.textContent).toBe('Алиса');
    expect(screen.getByText('networking')).toBeTruthy();
    expect(screen.getByText('ai-future')).toBeTruthy();
    expect(screen.getByText('ru')).toBeTruthy();
  });
});

describe('live updates (§3.5 AC 3, 9, 12)', () => {
  it('new messages appear within one 2 s poll tick without reload (AC 3)', async () => {
    await renderPage();
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(0);

    fixture.messages = [message('tx1', '0xa', 'Агенты начали говорить.', 5)];
    await screen.findByText('Агенты начали говорить.', undefined, { timeout: 4000 });
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(1);
  });

  it('network failure shows the banner while keeping the last transcript; recovery auto-dismisses (AC 9)', async () => {
    fixture.messages = [message('tx1', '0xa', 'Первое сообщение.', 60)];
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

describe('auto-scroll (§3.5 AC 3)', () => {
  beforeEach(() => {
    fixture.messages = [
      message('tx1', '0xa', 'Раз.', 200),
      message('tx2', ME, 'Два.', 100),
      message('tx3', '0xa', 'Три.', 10)
    ];
  });

  function scrollArea(): HTMLElement {
    const el = document.querySelector('main.scroll');
    if (!el) throw new Error('scroll area not found');
    return el as HTMLElement;
  }

  it('auto-scrolls to the bottom by default; scrolling up shows a working chip', async () => {
    await renderPage();
    const el = scrollArea();
    Object.defineProperty(el, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(el, 'clientHeight', { value: 400, configurable: true });
    // simulate the near-bottom state → no chip
    el.scrollTop = 620;
    el.dispatchEvent(new Event('scroll'));
    await tick();
    expect(screen.queryByRole('button', { name: ru['chat.scroll_bottom'] })).toBeNull();

    // scrolled up → the floating chip appears
    el.scrollTop = 0;
    el.dispatchEvent(new Event('scroll'));
    await tick();
    const chip = screen.getByRole('button', { name: ru['chat.scroll_bottom'] });
    chip.click();
    await tick();
    expect(el.scrollTop).toBeGreaterThan(500); // scrolled back toward the bottom
    expect(screen.queryByRole('button', { name: ru['chat.scroll_bottom'] })).toBeNull();
  });
});

describe('kickoff flow (§3.5 AC 5, 6)', () => {
  beforeEach(() => {
    fixture.messages = [
      message('tx1', '0xa', 'Раз.', 200),
      message('tx2', ME, 'Два.', 100)
    ];
    // the server clears the history on kickoff; the poll then returns none
    mockedApi.kickoffChat.mockImplementation(async () => {
      fixture.messages = [];
      return { chat: CHAT, cleared: 2, speaker: '0xa' };
    });
  });

  it('opens a focus-trapped confirm dialog with the exact copy; Cancel closes without effects', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await tick();

    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText(ru['chat.kickoff.confirm_title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.kickoff.confirm_body'])).toBeTruthy();
    // focus moved into the dialog (kit focus trap)
    expect(dialog.contains(document.activeElement)).toBe(true);

    await screen.getByRole('button', { name: ru['common.cancel'] }).click();
    await tick();
    expect(mockedApi.kickoffChat).not.toHaveBeenCalled();
    expect(screen.getByText('Раз.')).toBeTruthy(); // transcript untouched
  });

  it('Confirm POSTs kickoff, clears the transcript and shows the speaker note (AC 5)', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();

    await waitFor(() => expect(mockedApi.kickoffChat).toHaveBeenCalledWith(CHAT));
    await waitFor(() =>
      expect(
        screen.getByText(ru['chat.kickoff.speaker'].replace('{name}', 'Алиса'))
      ).toBeTruthy()
    );
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(0);
  });

  it('after kickoff the warming row shows until the first polled message (AC 6)', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();

    await screen.findByText(ru['chat.warming_up'], undefined, { timeout: 4000 });

    // the first new message arrives → the row disappears
    fixture.messages = [message('tx9', '0xa', 'Начнём заново.', 2)];
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

describe('empty, not-found, stub, back (§3.5 AC 7, 8, 11)', () => {
  it('empty chat (zero messages) → the warming-up state (AC: empty state)', async () => {
    await renderPage();
    expect(screen.getByText(ru['chat.warming_up'])).toBeTruthy();
  });

  it('404 chat renders the not-found state with a working link back to /chats (AC 8)', async () => {
    mockedApi.getChat.mockRejectedValue(new ApiError(404, `/api/chat/${CHAT}`, 'chat not found'));
    render(Page, { props: {} });
    await screen.findByText(ru['chat.not_found'], undefined, { timeout: 4000 });
    await screen.getByRole('button', { name: ru['chat.back_to_list'] }).click();
    expect(goto).toHaveBeenCalledWith('/chats');
  });

  it('the contact-exchange stub is always visible, disabled and non-interactive (AC 7)', async () => {
    fixture.messages = [message('tx1', '0xa', 'Привет.', 60)];
    await renderPage();
    const stub = document.querySelector('.contact-stub');
    expect(stub).toBeTruthy();
    expect(stub?.getAttribute('aria-disabled')).toBe('true');
    expect(stub?.textContent).toContain(ru['chat.contact_stub']);
    expect(stub?.querySelector('button, a, input')).toBeNull();
  });

  it('back control without meaningful history goes to /chats (AC 11)', async () => {
    // pin history.length → the §1.3 fallback branch (list) is deterministic
    Object.defineProperty(window.history, 'length', { value: 1, configurable: true });
    try {
      await renderPage();
      await screen.getByRole('button', { name: ru['common.back'] }).click();
      expect(goto).toHaveBeenCalledWith('/chats');
    } finally {
      delete (window.history as { length?: unknown }).length;
    }
  });
});

describe('NO-COMPOSER (owner ruling 4, permanent — §3.5 AC 13)', () => {
  it('the transcript UI contains no input/textarea/send control; only back, kickoff (+confirm), contact stub', async () => {
    fixture.messages = [message('tx1', '0xa', 'Привет.', 60)];
    await renderPage();

    const root = document.querySelector('.page');
    expect(root).toBeTruthy();
    // no composer of any kind, in any state
    expect(root?.querySelector('input, textarea, [contenteditable="true"]')).toBeNull();
    expect(root?.querySelector('form')).toBeNull();
    // the only interactive elements: back, kickoff, (dialog hidden) —
    // the contact stub renders no control at all
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
