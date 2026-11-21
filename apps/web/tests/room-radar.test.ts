/**
 * /room radar route tests (TZ-05, DESIGN §3.2): Me chip + per-attendee
 * nodes with relationship-driven actions, soft-deleted users disappear,
 * the >14 cap + «+N ещё», live member count on polls, handshake send
 * (idempotent, inline network recovery, incoming → open-dialog), empty
 * room copy, network banner + recovery, poller stop on unmount (fake
 * timers), chatsSeen write-through and the scanner mount/close refresh.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
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
    // §4.8.3c + §4.9.1/4.9.2: nodes live in the rotating orbit layer —
    // since the v2.2 amendment each node rides its own per-ring orbit unit
    // (distinct speeds, upright counter-rotated content — see the v2.2
    // motion describe block below).
    const orbit = document.querySelector('.nodes-orbit');
    expect(orbit).toBeTruthy();
    for (const node of nodeButtons()) expect(orbit?.contains(node)).toBe(true);
    // Markers keep working (§4.9.11): outgoing → accent dot, no incoming
    // ring element remains (the incoming marker is the top-right dot).
    expect(document.querySelector('button.node .out-dot')).toBeTruthy();
    expect(document.querySelector('button.node .in-ring')).toBeNull();
    expect(document.querySelector('button.node .in-dot')).toBeNull();
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

describe('/room — v2.2 radar motion (DESIGN §4.9.1/4.9.2/4.9.12)', () => {
  /**
   * Component CSS is NOT injected under happy-dom (external stylesheets),
   * so the CSS contracts below are pinned against the component sources —
   * the same readFileSync pattern the sweep suite uses (sweep.test.ts).
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }

  it('each node rides a per-ring orbit layer with a distinct duration (§4.9.2)', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText('3 вокруг вас'); // wait until data has loaded

    // ring semantics (radar.ts ringFor): chat → 0, pending → 1, none → 2.
    const expected: Array<[string, string, string]> = [
      [ru['room.node.chat'].replace('{name}', 'Алиса'), 'ring-0', '90s'],
      [ru['room.node.outgoing'].replace('{name}', 'Боб'), 'ring-1', '135s'],
      [ru['room.node.none'].replace('{name}', 'Кэрол'), 'ring-2', '30s']
    ];
    const durations = new Set<string>();
    for (const [label, ringClass, duration] of expected) {
      const node = screen.getByRole('button', { name: label });
      const unit = node.closest('.orbit-unit');
      expect(unit).toBeTruthy();
      expect(unit?.classList.contains(ringClass)).toBe(true);
      const style = unit?.getAttribute('style') ?? '';
      expect(style).toContain(`--orbit-duration: ${duration}`);
      durations.add(duration);
      // Phase-lock: the negative delay back-dates the unit's spin to the
      // radar's common epoch, so later-mounted units stay rigid with their
      // ring group.
      expect(style).toMatch(/--orbit-delay: -\d/);
      // The unit lives in the static nodes layer.
      expect(document.querySelector('.nodes-orbit')?.contains(unit as Node)).toBe(true);
    }
    expect(durations.size).toBe(3); // distinct speeds per ring (§4.9.2)
  });

  it('the ring lines spin at their rings\u2019 distinct speeds (§4.9.2)', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText('3 вокруг вас'); // wait until data has loaded

    const groups = document.querySelectorAll('svg.rings g');
    expect(groups).toHaveLength(3);
    const durations = Array.from(groups).map((g) => g.getAttribute('style') ?? '');
    expect(durations[0]).toContain('animation-duration: 90s');
    expect(durations[1]).toContain('animation-duration: 135s');
    expect(durations[2]).toContain('animation-duration: 30s');
    for (const g of groups) expect(g.classList.contains('animate')).toBe(true); // spin after data
  });

  it('v3 tuning: the node hit circle is 48px — 40px avatar + 2×4px padding (§4.13.6, §2.6)', () => {
    // Smaller icons per Concept §13.1.6 / DESIGN §4.13.6: the avatar drops
    // 44 → 40px and the circular button (hit area) drops 52 → 48px —
    // exactly the §2.6 touch target. Component CSS is not injected under
    // happy-dom, so the size contract is pinned against the source.
    const nodeCss = source('src/lib/components/radar/RadarNode.svelte');
    expect(nodeCss).toMatch(/\.node[^{]*\{[^}]*width:\s*48px/);
    expect(nodeCss).toMatch(/\.node[^{]*\{[^}]*height:\s*48px/);
    expect(nodeCss).toMatch(/NODE_AVATAR_PX \(40\)/);
  });

  it('node content counter-rotates so icons stay upright (§4.9.1)', async () => {
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText('3 вокруг вас'); // wait until data has loaded

    // The content wrapper runs the reverse spin with the inherited orbit
    // duration/delay vars — phase-locked with its unit at mount ⇒ upright.
    const nodeCss = source('src/lib/components/radar/RadarNode.svelte');
    expect(nodeCss).toMatch(/@keyframes orbit-counter\b/);
    expect(nodeCss).toMatch(
      /\.avatar-box[^{]*\{[^}]*orbit-counter[^}]*var\(--orbit-duration[^}]*\}/
    );
    expect(nodeCss).toMatch(/\.avatar-box[^{]*\{[^}]*animation-delay:\s*var\(--orbit-delay/);
    // Every rendered node carries the counter-rotated content wrapper.
    for (const btn of nodeButtons()) {
      expect(btn.querySelector('.avatar-box')).toBeTruthy();
    }
  });

  it('the «+N ещё» counter rides the outer-ring orbit and stays upright (§4.9.1/4.9.2)', async () => {
    const crowd = Array.from({ length: 20 }, (_, i) => user(`0xuser-${i}`, `Человек ${i}`));
    setState({ users: [user(ME, 'Я'), ...crowd], handshakes: [], chats: [] });
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText('20 вокруг вас');

    const counter = screen.getByText('+6 ещё');
    const unit = counter.closest('.orbit-unit');
    expect(unit?.classList.contains('ring-2')).toBe(true);
    expect(unit?.getAttribute('style')).toContain('--orbit-duration: 30s');
    expect(document.querySelector('.nodes-orbit')?.contains(unit as Node)).toBe(true);
    // Composed counter-rotation keyframes keep the centering translate.
    const pageCss = source('src/routes/room/+page.svelte');
    expect(pageCss).toMatch(/@keyframes orbit-counter-tx\b/);
    expect(pageCss).toMatch(
      /\.more-counter[^{]*\{[^}]*orbit-counter-tx[^}]*var\(--orbit-duration[^}]*\}/
    );
  });

  it('a ring-level change keeps the node element and glides via CSS transition (§4.9.12)', async () => {
    mountIdentity();
    vi.useFakeTimers();
    render(RoomPage, { props: {} });
    await vi.advanceTimersByTimeAsync(0); // initial refresh

    // The button transitions its position (left/top, ~600-900ms ease).
    const nodeCss = source('src/lib/components/radar/RadarNode.svelte');
    expect(nodeCss).toMatch(/\.node[^{]*\{[^}]*transition:[^}]*left[^}]*top/);

    const carolBefore = screen.getByRole('button', {
      name: ru['room.node.none'].replace('{name}', 'Кэрол')
    });
    const unitBefore = carolBefore.closest('.orbit-unit');
    expect(unitBefore?.classList.contains('ring-2')).toBe(true);

    // Carol handshake-back → mutual → chat: outer ring → inner ring.
    data.handshakes = [hs(carol.address, ME), hs(ME, carol.address)];
    data.chats = [chat('0xchat-carol', carol.address)];
    await vi.advanceTimersByTimeAsync(4000); // one poll tick

    // The SAME button element (keyed stable) — so the button's CSS left/top
    // transition animates the move to the new radius/angle instead of
    // remounting (which would jump).
    const carolAfter = screen.getByRole('button', {
      name: ru['room.node.chat'].replace('{name}', 'Кэрол')
    });
    expect(carolAfter).toBe(carolBefore);
    expect(carolAfter.closest('.orbit-unit')).toBe(unitBefore);
    // The unit now carries the inner ring's speed (90s).
    expect(unitBefore?.classList.contains('ring-0')).toBe(true);
    expect(unitBefore?.getAttribute('style')).toContain('--orbit-duration: 90s');
    vi.useRealTimers();
  });

  it('unchanged data between polls does not move nodes (deterministic, no jitter)', async () => {
    mountIdentity();
    vi.useFakeTimers();
    render(RoomPage, { props: {} });
    await vi.advanceTimersByTimeAsync(0); // initial refresh

    const before = nodeButtons();
    const stylesBefore = before.map((b) => b.getAttribute('style'));
    const unitStylesBefore = before.map((b) => b.closest('.orbit-unit')?.getAttribute('style'));

    await vi.advanceTimersByTimeAsync(4000); // one poll tick, same data

    const after = nodeButtons();
    expect(after).toHaveLength(before.length);
    after.forEach((el, i) => {
      expect(el).toBe(before[i]); // same elements, stable order
      expect(el.getAttribute('style')).toBe(stylesBefore[i]);
      expect(el.closest('.orbit-unit')?.getAttribute('style')).toBe(unitStylesBefore[i]);
    });
    vi.useRealTimers();
  });
});

describe('/room — max-dimension radar stage (§4.10.1, Concept §9.1.3)', () => {
  /**
   * Component CSS is NOT injected under happy-dom (external stylesheets),
   * so layout contracts are pinned two ways: the measured stage square is
   * asserted on the rendered DOM (a getBoundingClientRect stub provides the
   * viewport box), and the clipping/centering CSS contract is pinned
   * against the component source (same readFileSync pattern as above).
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function pageSource(): string {
    return readFileSync(join(WEB_ROOT, 'src/routes/room/+page.svelte'), 'utf8');
  }

  function stubViewportBox(width: number, height: number): void {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width,
      height,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: width,
      bottom: height,
      toJSON: () => ({})
    } as DOMRect);
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [320, 640, 'portrait phone 320×640: stage = 640'],
    [640, 320, 'landscape 640×320: stage = 640']
  ])('%s — the stage element is sized to the max dimension, centered', async (w, h, label) => {
    stubViewportBox(w, h);
    mountIdentity();
    render(RoomPage, { props: {} });
    await screen.findByText('3 вокруг вас'); // data loaded ⇒ measure effect ran

    const stage = document.querySelector('.radar-stage');
    expect(stage, label).toBeTruthy();
    const style = stage?.getAttribute('style') ?? '';
    expect(style).toContain('width: 640px');
    expect(style).toContain('height: 640px');
  });

  it('the clipping wrapper hides the overflow: no horizontal scrollbar', () => {
    const pageCss = pageSource();
    // The wrapper (flex child of the 100dvh page) clips the oversized square.
    expect(pageCss).toMatch(/\.stage\s*\{[^}]*overflow:\s*hidden/);
    // The square stage is centered on the page.
    expect(pageCss).toMatch(/\.radar-stage\s*\{[^}]*left:\s*50%/);
    expect(pageCss).toMatch(/\.radar-stage\s*\{[^}]*top:\s*50%/);
    expect(pageCss).toMatch(/\.radar-stage\s*\{[^}]*transform:\s*translate\(-50%,\s*-50%\)/);
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
    // §4.9.11 marker: incoming pending renders the top-right accent dot
    // inside the counter-rotating avatar box; the former ring is gone.
    const carolBox = carolNode.querySelector('.avatar-box');
    expect(carolBox?.querySelector('.in-dot')).toBeTruthy();
    expect(document.querySelector('button.node .in-ring')).toBeNull();
    expect(document.querySelector('button.node .out-dot')).toBeNull();
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

  it('without an identity the guard redirects to the join entry /income (tz12-02) and renders nothing', async () => {
    localStorage.clear();
    identity.set(null);
    render(RoomPage, { props: {} });
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income'));
    expect(screen.queryByText(room.name)).toBeNull();
  });
});
