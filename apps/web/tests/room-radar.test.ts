/**
 * /room radar route tests (TZ-05, DESIGN §3.2): Me chip + per-attendee
 * nodes with relationship-driven actions, soft-deleted users disappear,
 * the >14 cap + «+N ещё», live member count on polls, handshake send
 * (idempotent, inline network recovery, incoming → open-dialog), empty
 * room copy, network banner + recovery, poller stop on unmount (fake
 * timers), chatsSeen write-through and the scanner mount/close refresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { get } from 'svelte/store';
import { ApiError, NetworkError } from '@bleak/api-client';
import type { Chat, Handshake, Room, User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route }));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    listHandshakesOfUser: vi.fn(),
    listChatsOfUser: vi.fn(),
    createHandshake: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import { chatsUnseen } from '#lib/stores/chatsSeen';
import RoomPage from '../src/routes/room/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';

const room: Room = {
  address: '0xroom',
  name: 'Хостел «Пиксель»',
  description: 'Митап по пиксель-арту',
  language: 'ru',
  max_user: 50,
  created_at: '',
  updated_at: '',
  deleted_at: null
};

function user(address: string, name: string, deleted = false): User {
  return {
    address,
    room: room.address,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: deleted ? '2026-11-14T00:00:00Z' : null
  };
}

function hs(from: string, to: string): Handshake {
  return {
    tx_id: `${from}-${to}`,
    from_address: from,
    to_address: to,
    room: room.address,
    status: 1,
    value: 1,
    created_at: '2026-11-14T10:00:00Z'
  };
}

function chat(address: string, counterpart: string): Chat {
  return {
    address,
    room: room.address,
    phase: 'networking',
    phase_started_at: '',
    scenario: 'ai-future',
    language: 'ru',
    created_at: '2026-11-14T10:05:00Z',
    participants: [
      { chat: address, user: ME },
      { chat: address, user: counterpart }
    ]
  };
}

const alice = user('0xalice', 'Алиса');
const bob = user('0xbob', 'Боб');
const carol = user('0xcarol', 'Кэрол');
const gone = user('0xgone', 'Ушедший', true);

// Mutable backend snapshot; the api mocks read it on every poll tick.
const data = {
  users: [] as User[],
  handshakes: [] as Handshake[],
  chats: [] as Chat[]
};

function setState(next: { users?: User[]; handshakes?: Handshake[]; chats?: Chat[] }): void {
  data.users = next.users ?? [];
  data.handshakes = next.handshakes ?? [];
  data.chats = next.chats ?? [];
}

function mountIdentity(): void {
  // The page hydrates the store from localStorage defensively (initIdentity),
  // so both the storage and the store must carry the identity before render.
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: room.address, userAddress: ME, token: 'p-tok' })
  );
  identity.set({ roomAddress: room.address, userAddress: ME, token: 'p-tok' });
}

const mockedApi = vi.mocked(api, true);

beforeEach(() => {
  localStorage.clear();
  identity.set(null);
  chatsUnseen.set(false);
  vi.clearAllMocks();
  // Default scene: alice = chat (inner), bob = outgoing pending (middle),
  // carol = untouched (outer), + one soft-deleted user that must not render.
  setState({
    users: [user(ME, 'Я'), alice, bob, carol, gone],
    handshakes: [hs(ME, bob.address)],
    chats: [chat('0xchat-alice', alice.address)]
  });
  mockedApi.getRoom.mockResolvedValue(room);
  mockedApi.listRoomUsers.mockImplementation(() => Promise.resolve(data.users));
  mockedApi.listHandshakesOfUser.mockImplementation(() => Promise.resolve(data.handshakes));
  mockedApi.listChatsOfUser.mockImplementation(() => Promise.resolve(data.chats));
  mockedApi.createHandshake.mockResolvedValue({} as Handshake);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  identity.set(null);
  chatsUnseen.set(false);
});

function nodeButtons(): HTMLElement[] {
  return Array.from(document.querySelectorAll('button.node'));
}

describe('/room — radar composition (AC 1, 3, 8)', () => {
  it('renders the Me chip, header room name + count, and one node per other attendee', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });

    expect(await screen.findByText(room.name)).toBeTruthy();
    // The polled data lands a few microtask batches after the header name —
    // await the first data-driven element, then assert the rest synchronously.
    expect(await screen.findByText('3 вокруг вас')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy(); // live member count in the top bar

    const labels = nodeButtons().map((b) => b.getAttribute('aria-label'));
    expect(labels).toHaveLength(3); // exactly one node per other attendee
    expect(labels).toContain(ru['room.node.chat'].replace('{name}', 'Алиса'));
    expect(labels).toContain(ru['room.node.outgoing'].replace('{name}', 'Боб'));
    expect(labels).toContain(ru['room.node.none'].replace('{name}', 'Кэрол'));
    // §4.8.3a: NO visible name labels on other users' icons — the
    // accessible name alone carries the relationship state; only the
    // "you" chip keeps its name.
    expect(nodeButtons().map((b) => b.textContent?.trim())).toEqual(['', '', '']);
    expect(screen.getByText('Я')).toBeTruthy();
    // §4.8.3c: nodes live in the rotating orbit layer (same spin as the
    // rings — one rigid layer, no counter-rotation).
    const orbit = document.querySelector('.nodes-orbit');
    expect(orbit).toBeTruthy();
    for (const node of nodeButtons()) expect(orbit?.contains(node)).toBe(true);
    // Markers keep working (§3.2): outgoing → accent dot, no incoming ring.
    expect(document.querySelector('button.node .out-dot')).toBeTruthy();
    expect(document.querySelector('button.node .in-ring')).toBeNull();
  });

  it('a soft-deleted attendee (left the room) renders no node', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText(room.name);
    expect(nodeButtons().map((b) => b.textContent)).not.toContain('Ушедший');
  });

  it('the live member count updates on the next poll without user action (AC 3)', async () => {
    mountIdentity();
    vi.useFakeTimers();
    render(RoomPage, { props: {} });
    await vi.advanceTimersByTimeAsync(0); // initial refresh
    expect(screen.getByText('3 вокруг вас')).toBeTruthy();

    data.users = [...data.users, user('0xdave', 'Дэйв')];
    await vi.advanceTimersByTimeAsync(4000); // one poll tick
    expect(screen.getByText('4 вокруг вас')).toBeTruthy();
    vi.useRealTimers();
  });

  it('no other attendees: empty copy shows and no nodes render (AC 8)', async () => {
    setState({ users: [user(ME, 'Я')], handshakes: [], chats: [] });
    mountIdentity();
    render(RoomPage, { props: {} });
    expect(await screen.findByText(ru['room.empty'])).toBeTruthy();
    expect(nodeButtons()).toHaveLength(0);
  });
});

describe('/room — >14 cap (AC 10, TZ §7.3)', () => {
  it('renders exactly 14 nodes and the «+N ещё» counter', async () => {
    const crowd = Array.from({ length: 20 }, (_, i) => user(`0xuser-${i}`, `Человек ${i}`));
    setState({ users: [user(ME, 'Я'), ...crowd], handshakes: [], chats: [] });
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText('20 вокруг вас'); // wait until data has loaded
    await waitFor(() => expect(nodeButtons()).toHaveLength(14));
    // The counter rides the same rotating orbit layer as the nodes (§4.8.3c).
    const orbit = document.querySelector('.nodes-orbit');
    expect(orbit?.contains(screen.getByText('+6 ещё'))).toBe(true);
  });
});

describe('/room — HandshakeSheet per-state actions (AC 4–7)', () => {
  it('no handshake: tapping a node opens the sheet; send POSTs from me and refreshes', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText(room.name);

    const carolNode = await screen.findByRole('button', {
      name: ru['room.node.none'].replace('{name}', 'Кэрол')
    });
    await carolNode.click();
    const send = await screen.findByRole('button', { name: ru['hs.send'] });
    await send.click();

    expect(mockedApi.createHandshake).toHaveBeenCalledWith({
      from_address: ME,
      to_address: carol.address,
      status: 1
    });
    // The node moves within one refresh: listHandshakesOfUser was re-fetched.
    await waitFor(() => expect(mockedApi.listHandshakesOfUser.mock.calls.length).toBeGreaterThan(1));
  });


  it('incoming pending: handshake-back sends the reverse direction; success offers Open dialog (AC 6)', async () => {
    setState({ users: [user(ME, 'Я'), carol], handshakes: [hs(carol.address, ME)], chats: [] });
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText(room.name);

    const carolNode = await screen.findByRole('button', {
      name: ru['room.node.incoming'].replace('{name}', 'Кэрол')
    });
    expect(document.querySelector('button.node .in-ring')).toBeTruthy(); // §3.2 marker
    await carolNode.click();
    expect(await screen.findByText(ru['hs.added_you'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['hs.back'] }).click();

    expect(mockedApi.createHandshake).toHaveBeenCalledWith({
      from_address: ME,
      to_address: carol.address,
      status: 1
    });
    // The (mock) server creates the chat; after the forced refresh the
    // relationship becomes mutual and the sheet offers the dialog link.
    data.handshakes = [hs(carol.address, ME), hs(ME, carol.address)];
    data.chats = [chat('0xchat-carol', carol.address)];
    await waitFor(() =>
      expect(screen.getByRole('link', { name: ru['hs.open_dialog'] })).toBeTruthy()
    );
  });

  it('network error during POST: inline recovery copy, button returns to active', async () => {
    mockedApi.createHandshake.mockRejectedValue(new NetworkError('/api/handshake', new Error('offline')));
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText(room.name);

    const carolNode = await screen.findByRole('button', {
      name: ru['room.node.none'].replace('{name}', 'Кэрол')
    });
    await carolNode.click();
    await screen.getByRole('button', { name: ru['hs.send'] }).click();

    expect(await screen.findByText(ru['hs.error.network'])).toBeTruthy();
    const active = screen.getByRole('button', { name: ru['hs.send'] });
    expect(active.hasAttribute('disabled')).toBe(false);
  });

  it('a 403 income-rule rejection shows the §2.9 state inline in the sheet (AC 15)', async () => {
    mockedApi.createHandshake.mockRejectedValue(
      new ApiError(403, '/api/handshake', 'income must exceed outcome')
    );
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText(room.name);

    const carolNode = await screen.findByRole('button', {
      name: ru['room.node.none'].replace('{name}', 'Кэрол')
    });
    await carolNode.click();
    await screen.getByRole('button', { name: ru['hs.send'] }).click();

    await screen.findByText(ru['hs.income_limit']);
    // Server text appended muted (§2.9).
    expect(screen.getByText(/income must exceed outcome/)).toBeTruthy();
    // The button returns to its active state — no optimistic "sent" flip;
    // the node stays on its (outer) ring.
    const active = screen.getByRole('button', { name: ru['hs.send'] });
    expect(active.hasAttribute('disabled')).toBe(false);
    expect(screen.queryByRole('button', { name: ru['hs.sent'] })).toBeNull();
    expect(
      screen.getByRole('button', { name: ru['room.node.none'].replace('{name}', 'Кэрол') })
    ).toBeTruthy();
  });

});

describe('/room — error banner (AC 9)', () => {
  it('poll failure shows the NetworkError banner with retry; recovery dismisses it', async () => {
    mockedApi.listRoomUsers.mockRejectedValue(new NetworkError('/api/room/0xroom/user', new Error('offline')));
    mountIdentity();
    render(RoomPage, { props: {} });

    const banner = await screen.findByText(ru['common.error.network']);
    expect(banner).toBeTruthy();
    // The recovery mock must be in place BEFORE the retry click: the click
    // handler starts the refresh tick synchronously.
    mockedApi.listRoomUsers.mockImplementation(() => Promise.resolve(data.users));
    await screen.getByRole('button', { name: ru['common.retry'] }).click();

    await waitFor(() => expect(screen.queryByText(ru['common.error.network'])).toBeNull());
  });
});

describe('/room — poller lifecycle (AC 12) + chatsSeen write-through', () => {
  it('stops polling after unmount — no network requests afterwards', async () => {
    mountIdentity();
    vi.useFakeTimers();
    const mounted = render(RoomPage, { props: {} });
    await vi.advanceTimersByTimeAsync(0); // initial refresh → 1 tick
    await vi.advanceTimersByTimeAsync(4000); // interval tick → 2 ticks
    const callsAfterTwoTicks = mockedApi.listRoomUsers.mock.calls.length;
    expect(callsAfterTwoTicks).toBeGreaterThanOrEqual(2);

    mounted.unmount();
    await vi.advanceTimersByTimeAsync(20000);
    expect(mockedApi.listRoomUsers.mock.calls.length).toBe(callsAfterTwoTicks);
    vi.useRealTimers();
  });

  it('each chats poll writes through to the chatsSeen badge store', async () => {
    data.chats = [{ ...chat('0xchat-alice', alice.address), created_at: new Date().toISOString() }];
    mountIdentity();
    render(RoomPage, { props: {} });
    await waitFor(() => expect(get(chatsUnseen)).toBe(true));
  });
});

describe('/room — scanner mount (AC 13) + identity guard', () => {
  it('the top-bar scan button opens the QrScanner overlay; closing forces a refresh', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText(room.name);
    const ticksBefore = mockedApi.listRoomUsers.mock.calls.length;

    await screen.getByRole('button', { name: ru['room.scan.open'] }).click();
    expect(await screen.findByRole('dialog', { name: ru['scan.aria'] })).toBeTruthy();

    await screen.getByRole('button', { name: ru['scan.close'] }).click();
    expect(screen.queryByRole('dialog', { name: ru['scan.aria'] })).toBeNull();
    await waitFor(() =>
      expect(mockedApi.listRoomUsers.mock.calls.length).toBeGreaterThan(ticksBefore)
    );
  });

  it('without an identity the guard redirects to / and renders nothing', async () => {
    localStorage.clear();
    identity.set(null);
    render(RoomPage, { props: {} });
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
    expect(screen.queryByText(room.name)).toBeNull();
  });
});
