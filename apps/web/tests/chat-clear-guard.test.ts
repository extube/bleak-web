/** Attendee chat CLEAR GUARD (Concept §7.1.4, owner change request P4):
 * the attendee /chats/[address] view must never expose a clear-history
 * control — attendees never clear chats. This regression guard pins the
 * page's interactive controls (button/a) to the exact allowed set per
 * state and asserts that NO control triggers or labels a history clear
 * (no clearChatHistory call through either credential context, no
 * «Очистить историю» / "Clear history" label anywhere). The HOST
 * drill-down clear (MemberDrillDown + hostApi.clearChatHistory) is
 * intentionally unaffected by the owner request — the last row proves it
 * is still present and wired. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, type Chat, type Message, type User } from '@bleak/api-client';

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

const apiMock = vi.hoisted(() => ({
  getChat: vi.fn(),
  listChatMessages: vi.fn(),
  listRoomUsers: vi.fn(),
  kickoffChat: vi.fn(),
  clearChatHistory: vi.fn()
}));

const apiRawMock = vi.hoisted(() => ({
  getChat: vi.fn(),
  listChatMessages: vi.fn(),
  kickoffChat: vi.fn(),
  clearChatHistory: vi.fn()
}));

vi.mock('#lib/api/client', () => ({
  api: apiMock,
  apiRaw: apiRawMock,
  HOST_RESET_KEY: 'bleak.hostReset'
}));

import { api, apiRaw } from '#lib/api/client';
import { saveHostRoom } from '#lib/stores/hostSession';
import { identity } from '#lib/stores/identity';
import Page from '../src/routes/chats/[address]/+page.svelte';
import MemberDrillDown from '../src/lib/components/host/MemberDrillDown.svelte';
import { ru } from '../src/lib/i18n/ru';
import { en } from '../src/lib/i18n/en';

const ME = '0xme';
const ROOM = '0xroom';
const CHAT = '0xchat1';
const mockedApi = vi.mocked(api, true);
const mockedApiRaw = vi.mocked(apiRaw, true);

/** The exact clear strings the owner removed (ru + en; host.drill keys). */
const CLEAR_LABELS = [ru['host.drill.clear'], en['host.drill.clear']];

/** Allowed interactive-control labels per attendee state (Concept §7.1.4). */
const PINS = {
  transcript: [ru['common.back'], ru['chat.kickoff']],
  confirmOpen: [
    ru['common.back'],
    ru['chat.kickoff'],
    ru['chat.kickoff.confirm_run'],
    ru['common.cancel']
  ],
  chip: [ru['common.back'], ru['chat.kickoff'], ru['chat.scroll_bottom']],
  // The footer (kickoff + stub) renders in every state, not-found included.
  notFound: [ru['common.back'], ru['chat.kickoff'], ru['chat.back_to_list']],
  hostView: [ru['common.back'], ru['chat.kickoff']]
};

const fixture = {
  chat: null as Chat | null,
  users: [] as User[],
  messages: [] as Message[]
};

function person(address: string, name: string): User {
  return {
    address,
    room: ROOM,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: new Date(Date.now() - 600_000).toISOString(),
    updated_at: new Date(Date.now() - 600_000).toISOString(),
    deleted_at: null
  };
}

function baseChat(): Chat {
  return {
    address: CHAT,
    room: ROOM,
    phase: 'networking',
    phase_started_at: new Date(Date.now() - 300_000).toISOString(),
    scenario: 'ai-future',
    language: 'ru',
    created_at: new Date(Date.now() - 300_000).toISOString(),
    participants: [
      { chat: CHAT, user: ME },
      { chat: CHAT, user: '0xa' }
    ]
  };
}

function message(txId: string, from: string, content: string): Message {
  return {
    tx_id: txId,
    chat: CHAT,
    from,
    to: from === ME ? '0xa' : ME,
    content,
    created_at: new Date(Date.now() - 60_000).toISOString()
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
  fixture.messages = [message('tx1', '0xa', 'Привет.')];
  mockedApi.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  mockedApi.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApi.kickoffChat.mockResolvedValue({ chat: CHAT, cleared: 2, speaker: '0xa' });
  mockedApi.clearChatHistory.mockResolvedValue({ chat: CHAT, cleared: 2 });
  mockedApiRaw.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApiRaw.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApiRaw.kickoffChat.mockResolvedValue({ chat: CHAT, cleared: 2, speaker: '0xa' });
  mockedApiRaw.clearChatHistory.mockResolvedValue({ chat: CHAT, cleared: 2 });
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
  sessionStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await screen.findByText('Привет.', undefined, { timeout: 4000 });
  await tick();
  await tick();
}

/** Every interactive control label (visible text, else aria-label). */
function controlLabels(): string[] {
  return Array.from(document.querySelectorAll('.page button, .page a')).map((el) =>
    (el.textContent?.trim() || el.getAttribute('aria-label') || '').toLowerCase()
  );
}

/** The §7.1.4 assertion: no control labels or triggers a history clear. */
function expectNoClear(): void {
  const labels = controlLabels();
  for (const label of labels) {
    for (const clear of CLEAR_LABELS) {
      expect(label).not.toContain(clear.toLowerCase());
    }
  }
  // Generic sweep: no control label mentions clearing at all (future-proof).
  expect(labels.join(' | ')).not.toMatch(/очист|clear/);
  // No clear call went out through either credential context.
  expect(mockedApi.clearChatHistory).not.toHaveBeenCalled();
  expect(mockedApiRaw.clearChatHistory).not.toHaveBeenCalled();
}

/** Exact-pinned label set (order-agnostic) + the no-clear guarantee. */
function expectExactly(allowed: string[]): void {
  expect(controlLabels().sort()).toEqual([...allowed].map((l) => l.toLowerCase()).sort());
  expectNoClear();
}

describe('attendee chat clear guard (Concept §7.1.4 — no clear-history control)', () => {
  it.each([
    ['transcript view', 'transcript'],
    ['kickoff confirm dialog open', 'confirmOpen'],
    ['not-found state', 'notFound'],
    ['host-view (room-token observer) mode', 'hostView']
  ])('%s: interactive controls are pinned to the allowed set; none triggers or labels a clear', async (_name, state) => {
    if (state === 'notFound') {
      mockedApi.getChat.mockRejectedValue(new ApiError(404, `/api/chat/${CHAT}`, 'gone'));
      render(Page, { props: {} });
      await screen.findByText(ru['chat.not_found'], undefined, { timeout: 4000 });
    } else if (state === 'hostView') {
      saveHostRoom({ code: '123456', roomAddress: ROOM, roomToken: 'r-tok' });
      mockedApi.getChat.mockRejectedValue(
        new ApiError(403, `/api/chat/${CHAT}`, 'not a participant')
      );
      mockedApi.listChatMessages.mockRejectedValue(
        new ApiError(403, `/api/chat/${CHAT}/message`, 'not a participant')
      );
      render(Page, { props: {} });
      await screen.findByText(ru['chat.host_view'], undefined, { timeout: 4000 });
    } else {
      await renderPage();
      if (state === 'confirmOpen') {
        await screen.getByRole('button', { name: ru['chat.kickoff'] }).click();
        await tick();
        expect(screen.getByText(ru['chat.kickoff.confirm_title'])).toBeTruthy();
      }
    }

    expectExactly(PINS[state as keyof typeof PINS]);

    if (state !== 'notFound') {
      // The disabled contact stub is present and stays non-interactive.
      const stub = document.querySelector('.contact-stub');
      expect(stub?.getAttribute('aria-disabled')).toBe('true');
      expect(stub?.querySelector('button, a, input')).toBeNull();
    }
  });

  it('scrolled-up transcript: only the jump-to-bottom chip is added; still no clear', async () => {
    await renderPage();
    const scroller = document.querySelector('main.scroll');
    if (!scroller) throw new Error('transcript scroller not rendered');
    let scrollTop = 0;
    Object.defineProperty(scroller, 'scrollTop', {
      get: () => scrollTop,
      set: (value: number) => (scrollTop = value),
      configurable: true
    });
    Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
    Object.defineProperty(scroller, 'clientHeight', { value: 100, configurable: true });
    scrollTop = 0; // scrolled away from the bottom
    scroller.dispatchEvent(new Event('scroll'));
    await tick();

    expectExactly(PINS.chip);
  });

  it('host drill-down clear remains present and wired (unaffected by §7.1.4)', async () => {
    render(MemberDrillDown, {
      props: {
        member: person('0xa', 'Алиса'),
        chats: [{ address: '0xchat1', phase: 'networking', scenario: 'ai-future' }],
        error: null,
        errorMessage: null,
        onclear: vi.fn(),
        onkickoff: vi.fn()
      }
    });
    await tick();
    // The clear control the owner kept exists ONLY here — in the host UI,
    // behind its own confirm dialog.
    const clearButton = screen.getByRole('button', { name: ru['host.drill.clear'] });
    await clearButton.click();
    await tick();
    expect(screen.getByText(ru['host.drill.clear_confirm'])).toBeTruthy();
    // The host API surface still exposes the clear endpoint.
    expect(typeof mockedApi.clearChatHistory).toBe('function');
    expect(typeof mockedApiRaw.clearChatHistory).toBe('function');
  });
});
