/** /chats list page tests (TZ-07, DESIGN §3.4): one card per chat with the
 * counterpart (participants minus me), verbatim phase/scenario chips, «+N»,
 * relative time, no message preview, empty state CTA → /people, skeletons,
 * in-place poll updates (removed chats disappear), chatsSeen write-through
 * on visit, error banner with dimmed last-known list, poller teardown. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { NetworkError, type Chat, type User } from '@bleak/api-client';
import { chatsUnseen } from '../src/lib/stores/chatsSeen';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? route.replace('[address]', params.address) : route
}));

vi.mock('#lib/api/client', () => ({
  api: {
    listChatsOfUser: vi.fn(),
    listRoomUsers: vi.fn()
  }
}));

import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import Page from '../src/routes/chats/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';
const mockedApi = vi.mocked(api, true);

const fixture = {
  chats: [] as Chat[],
  users: [] as User[]
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function person(address: string, name: string, createdMinutesAgo: number, bio = ''): User {
  return {
    address,
    room: ROOM,
    name,
    greeting: '',
    public_bio: bio,
    private_bio: '',
    language: 'ru',
    created_at: minutesAgo(createdMinutesAgo),
    updated_at: minutesAgo(createdMinutesAgo),
    deleted_at: null
  };
}

function chat(address: string, participants: string[], createdMinutesAgo: number): Chat {
  return {
    address,
    room: ROOM,
    phase: 'networking',
    phase_started_at: minutesAgo(createdMinutesAgo),
    scenario: 'ai-future',
    language: 'ru',
    created_at: minutesAgo(createdMinutesAgo),
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // The page hydrates the store from localStorage defensively (initIdentity),
  // so both the storage and the store must carry the identity before render.
  localStorage.clear();
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: 'p-tok' })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: 'p-tok' });
  chatsUnseen.set(false);
  fixture.chats = [];
  fixture.users = [];
  mockedApi.listChatsOfUser.mockImplementation(async () => structuredClone(fixture.chats));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.listChatsOfUser).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('/chats — cards (§3.4 AC 1–4)', () => {
  beforeEach(() => {
    fixture.users = [person(ME, 'Я', 30), person('0xa', 'Алиса', 10, 'Поттер')];
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 5)];
  });

  it('renders one card per chat: counterpart name + avatar + verbatim chips, no preview', async () => {
    await renderPage();
    const link = screen.getByRole('link', {
      name: ru['chats.card.aria']
        .replace('{name}', 'Алиса')
        .replace('{phase}', 'networking')
        .replace('{scenario}', 'ai-future')
    });
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
    // verbatim server values as outline chips
    expect(screen.getByText('networking')).toBeTruthy();
    expect(screen.getByText('ai-future')).toBeTruthy();
    // my own name is not the counterpart
    expect(link.textContent).not.toContain('Я');
    // no message preview: the card shows only name/chips/time — no bubble copy
    expect(link.textContent?.includes('сообщение')).toBe(false);
  });


  it('counterpart derived from participants minus me; a ≠2 chat shows first counterpart + «+N» (AC 2)', async () => {
    fixture.users.push(person('0xb', 'Борис', 8), person('0xc', 'Вера', 6));
    fixture.chats = [chat('0xchat3', ['0xb', ME, '0xa', '0xc'], 2)];
    await renderPage();
    // the copy template renders «Диалог с {name}» verbatim
    const link = screen.getByRole('link', { name: /Диалог с Борис/ });
    expect(link.textContent).toContain('Борис');
    expect(screen.getByText('+2')).toBeTruthy();
  });
});

describe('/chats — states (§3.4 AC 5, 7, 8)', () => {
  it('two skeleton cards before the first arrival, then they swap away', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    let resolveChats: ((chats: Chat[]) => void) | undefined;
    mockedApi.listChatsOfUser.mockImplementation(
      () => new Promise<Chat[]>((resolve) => (resolveChats = resolve))
    );
    mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
    render(Page, { props: {} });
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(2);
    resolveChats?.([chat('0xchat1', [ME, '0xa'], 1)]);
    await screen.findByText('Алиса');
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);
  });

  it('zero chats → the empty state with the specified copy and a Find-people CTA (AC 5)', async () => {
    await renderPage();
    expect(screen.getByText(ru['chats.empty'])).toBeTruthy();
    const cta = screen.getByRole('link', { name: ru['chats.find_people'] });
    expect(cta.getAttribute('href')).toBe('/people');
  });

  it('the list refreshes in place every 4 s; a removed chat disappears without a reload (AC 7)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10), person('0xb', 'Борис', 8)];
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 5), chat('0xchat2', [ME, '0xb'], 3)];
    await renderPage();
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(screen.getByText('Борис')).toBeTruthy();

    fixture.chats = [chat('0xchat2', [ME, '0xb'], 3)];
    await waitFor(() => expect(screen.queryByText('Алиса')).toBeNull(), { timeout: 5000 });
    expect(screen.getByText('Борис')).toBeTruthy();
  });

  it('network failure shows the banner and preserves the last-known list dimmed (AC 8)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 5)];
    let fail = false;
    mockedApi.listChatsOfUser.mockImplementation(async () => {
      if (fail) throw new NetworkError('/api/user/x/chat', new Error('offline'));
      return structuredClone(fixture.chats);
    });

    await renderPage();
    expect(screen.getByText('Алиса')).toBeTruthy();

    fail = true;
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 5000 });
    expect(document.querySelector('.cards')?.classList.contains('dimmed')).toBe(true);

    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(document.querySelector('.cards')?.classList.contains('dimmed')).toBe(false);
  });

});

describe('/chats — badge + poller (§1.2, §2.2)', () => {
  it('visiting /chats writes chatsSeen and clears the badge dot (AC 6)', async () => {
    chatsUnseen.set(true);
    await renderPage();
    expect(localStorage.getItem('bleak.chatsSeen')).not.toBeNull();
    expect(get(chatsUnseen)).toBe(false);
  });


  it('stops the 4 s poller on unmount — no network requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const callsAtMount = mockedApi.listChatsOfUser.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      cleanup();
      await vi.advanceTimersByTimeAsync(16_000);
      expect(mockedApi.listChatsOfUser.mock.calls.length).toBe(callsAtMount);
    } finally {
      vi.useRealTimers();
    }
  });
});
