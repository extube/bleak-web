/** People page + PersonCard tests — LEAN suite (2026-11-17 slimming pass,
 * owner directive; reworked §4.15.4.2/4.15.4.3, Concept §19.2+§19.3).
 * Covers: state-pill mapping (parametrized; the chatting badge is REPLACED
 * by the Open-chat button), card actions (send / expanded incoming panel /
 * outgoing-none), the deterministic bucket sort (no filter chips — v3.6),
 * mount auto-open of the first card's handshake-back panel (ONLY the
 * first), the §4.15.4.3 addendum tap contracts (tapping an added-you card
 * toggles ITS form — single-expanded; non-added-you rows are inert;
 * dismissal intact), «Привет!» copy, page render order + pills + chats-badge
 * write-through, skeleton→cards→poll mutation, «+» send flip, §2.9 income
 * rejection, dismiss (local only, never re-opened by polls), search,
 * empty room, error banners, poller teardown + visibility regain,
 * relationships module contract. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { readFileSync, readdirSync } from 'node:fs';
import { join, sep } from 'node:path';
import { ApiError, NetworkError, type Chat, type Handshake, type User } from '@bleak/api-client';
import { goto } from '$app/navigation';
import { chatsUnseen, markChatsSeen } from '../src/lib/stores/chatsSeen';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? route.replace('[address]', params.address) : route
}));

vi.mock('#lib/api/client', () => ({
  api: {
    listRoomUsers: vi.fn(),
    listHandshakesOfUser: vi.fn(),
    listChatsOfUser: vi.fn(),
    createHandshake: vi.fn()
  }
}));

import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import Page from '../src/routes/people/+page.svelte';
import PersonCard from '../src/lib/components/people/PersonCard.svelte';
import { deriveRelationship, deriveRelationships } from '../src/lib/room/relationships';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';

const mockedApi = vi.mocked(api, true);

/** Mutable polled-data fixture: action handlers update it, then the forced
 * refresh reflects the change in place (mirrors the server). */
const fixture = {
  users: [] as User[],
  handshakes: [] as Handshake[],
  chats: [] as Chat[]
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function person(address: string, name: string, createdMinutesAgo: number, bio = ''): User {
  return {
    active: true,
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

function handshake(from: string, to: string, minutesAgoValue: number): Handshake {
  return {
    tx_id: `${from}->${to}`,
    from_address: from,
    to_address: to,
    room: ROOM,
    status: 1,
    value: 1,
    created_at: minutesAgo(minutesAgoValue)
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
  localStorage.clear();
  markChatsSeen(0);
  chatsUnseen.set(false);
  identity.set({ roomAddress: ROOM, userAddress: ME, token: 'p-tok' });

  fixture.users = [];
  fixture.handshakes = [];
  fixture.chats = [];

  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  mockedApi.listHandshakesOfUser.mockImplementation(async () => structuredClone(fixture.handshakes));
  mockedApi.listChatsOfUser.mockImplementation(async () => structuredClone(fixture.chats));
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  // first poll tick resolves (or settles) before assertions
  await waitFor(() => expect(mockedApi.listRoomUsers).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('PersonCard — pills, actions, expanded panel (§3.3, §4.15.4.3)', () => {
  const alice = person('0xa', 'Алиса', 2, 'Поттер из Питера');

  it.each([
    {
      state: 'none',
      handshakes: [] as Handshake[],
      chats: [] as Chat[],
      pill: null,
      time: '2 мин'
    },
    {
      state: 'outgoing',
      handshakes: [handshake(ME, '0xa', 5)],
      chats: [] as Chat[],
      pill: ru['hs.sent'],
      time: '5 мин'
    },
    {
      state: 'incoming',
      handshakes: [handshake('0xa', ME, 7)],
      chats: [] as Chat[],
      pill: ru['hs.added_you'],
      time: '7 мин'
    },
    {
      state: 'chat',
      handshakes: [] as Handshake[],
      chats: [chat('0xchat1', [ME, '0xa'], 9)],
      pill: null,
      time: '9 мин'
    }
  ])('$state: pill + timestamp derive correctly', ({ handshakes, chats, pill, time }) => {
    const relationship = deriveRelationship('0xa', ME, handshakes, chats);
    const { container } = render(PersonCard, { props: { user: alice, relationship } });
    if (pill === null) {
      expect(container.querySelector('.chip')).toBeNull();
    } else {
      expect(screen.getByText(pill)).toBeTruthy();
    }
    expect(screen.getByText(time)).toBeTruthy();
    // §4.15.4.3 item layout: the chatting badge is GONE — the chat state
    // carries the Open-chat button instead; other states never do.
    if (relationship.state === 'chat') {
      expect(screen.getByText(ru['people.action.open_chat'])).toBeTruthy();
    } else {
      expect(screen.queryByText(ru['people.action.open_chat'])).toBeNull();
    }
    // the right-edge action column exists ONLY for the direct «+» send
    if (relationship.state === 'none') {
      expect(container.querySelector('.action')).toBeTruthy();
    } else {
      expect(container.querySelector('.action')).toBeNull();
    }
  });

  it('«+» action fires onsend with a person-named label and disables while sending; outgoing has NO card action', async () => {
    const onsend = vi.fn();
    const { rerender } = render(PersonCard, {
      props: { user: alice, relationship: deriveRelationship('0xa', ME, [], []), onsend }
    });
    const plus = screen.getByRole('button', {
      name: ru['people.action.send'].replace('{name}', 'Алиса')
    });
    await plus.click();
    expect(onsend).toHaveBeenCalledTimes(1);
    await rerender({ sending: true });
    expect(
      (screen.getByRole('button', {
        name: ru['people.action.send'].replace('{name}', 'Алиса')
      }) as HTMLButtonElement).disabled
    ).toBe(true);

    // outgoing state: no card-level action at all (waiting for theirs)
    cleanup();
    render(PersonCard, {
      props: { user: alice, relationship: deriveRelationship('0xa', ME, [handshake(ME, '0xa', 5)], []) }
    });
    expect(document.querySelectorAll('.action button, .action a')).toHaveLength(0);
  });

  it('tap target (§4.15.4.3 addendum): the incoming row is role=button with aria-expanded + ontoggle; non-incoming rows are inert', async () => {
    const ontoggle = vi.fn();
    render(PersonCard, {
      props: {
        user: alice,
        relationship: deriveRelationship('0xa', ME, [handshake('0xa', ME, 7)], []),
        ontoggle
      }
    });
    const row = document.querySelector('.row[role="button"]') as HTMLElement;
    expect(row).toBeTruthy();
    expect(row.getAttribute('aria-expanded')).toBe('false');
    row.click();
    await tick();
    expect(ontoggle).toHaveBeenCalledTimes(1);
    // keyboard parity: Enter activates the row's tap toggle
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(ontoggle).toHaveBeenCalledTimes(2);

    cleanup();
    // non-incoming ("none"): no tap target at all — nothing new happens
    const untouchedToggle = vi.fn();
    render(PersonCard, {
      props: {
        user: alice,
        relationship: deriveRelationship('0xa', ME, [], []),
        ontoggle: untouchedToggle
      }
    });
    expect(document.querySelector('.row[role="button"]')).toBeNull();
    (document.querySelector('.row') as HTMLElement).click();
    await tick();
    expect(untouchedToggle).not.toHaveBeenCalled();
  });

  it('incoming panel is expanded-prop driven: «Привет!» + «Закрыть»; no toggle icon exists (v3.6)', async () => {
    const onback = vi.fn();
    const { rerender } = render(PersonCard, {
      props: {
        user: alice,
        relationship: deriveRelationship('0xa', ME, [handshake('0xa', ME, 7)], []),
        onback,
        expanded: false
      }
    });
    // the handshake-form toggle icon is removed — the panel is closed and
    // there is NO right-edge affordance to open it
    expect(screen.queryByRole('button', { name: ru['people.action.back'] })).toBeNull();
    expect(document.querySelectorAll('.action button')).toHaveLength(0);

    await rerender({ expanded: true });
    await screen.getByRole('button', { name: ru['people.action.back'] }).click();
    expect(onback).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: ru['people.dismiss'] })).toBeTruthy();
  });
});

describe('/people — rendering, order, badge (§3.3, §4.15.4.2)', () => {
  it('one card per attendee (excluding me) in bucket order, pills present, badge write-through', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 10, 'Поттер'),
      person('0xb', 'Борис', 2, 'Трамвайщик'),
      { ...person(ME, 'Я', 20) }
    ];
    fixture.handshakes = [handshake('0xa', ME, 6)];
    fixture.chats = [chat('0xchat1', [ME, '0xb'], 0)];

    await renderPage();

    const names = screen.getAllByText(/Алиса|Борис/).map((el) => el.textContent);
    // §4.15.4.2 bucket sort: who added you (Алиса) BEFORE chatting (Борис) —
    // the old newest-first roster order no longer rules the list
    expect(names.indexOf('Алиса')).toBeLessThan(names.indexOf('Борис'));
    expect(screen.queryByText('Я')).toBeNull();
    expect(screen.getByText('Участников: 3')).toBeTruthy();
    // state pills live on the cards; the chatting badge is GONE (§4.15.4.3)
    expect(document.querySelector('.cards')?.textContent?.includes(ru['hs.added_you'])).toBe(true);
    expect(document.querySelector('.cards')?.textContent?.includes(ru['hs.chatting'])).toBe(false);
    expect(screen.getByText(ru['people.action.open_chat'])).toBeTruthy();
    // chat newness writes through to the chatsSeen store (badge dot)
    await waitFor(() => expect(get(chatsUnseen)).toBe(true));
  });

  it('skeleton cards before the first arrival; poll updates mutate in place and deleted users disappear (AC 8)', async () => {
    let resolveUsers: ((users: User[]) => void) | undefined;
    mockedApi.listRoomUsers.mockImplementation(
      () => new Promise<User[]>((resolve) => (resolveUsers = resolve))
    );
    render(Page, { props: {} });
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(3);
    fixture.users = [person('0xa', 'Алиса', 1), person('0xb', 'Борис', 2)];
    resolveUsers?.(structuredClone(fixture.users));
    // later poll ticks read the mutable fixture directly
    mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
    await screen.findByText('Алиса');
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);

    fixture.users = [person('0xa', 'Алиса', 1)];
    // next 4 s poll tick reflects the deletion (in place, no reload)
    await waitFor(() => expect(screen.queryByText('Борис')).toBeNull(), { timeout: 5000 });
    expect(screen.getAllByText('Алиса')).toHaveLength(1);
  });
});

describe('/people — card actions', () => {
  it('«+» sends POST /api/handshake (from = me) and flips the card in place (AC 4)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    mockedApi.createHandshake.mockImplementation(async (request) => {
      expect(request).toEqual({ from_address: ME, to_address: '0xa', status: 1 });
      fixture.handshakes = [handshake(ME, '0xa', 0)];
      return handshake(ME, '0xa', 0);
    });

    await renderPage();
    await screen
      .getByRole('button', { name: ru['people.action.send'].replace('{name}', 'Алиса') })
      .click();

    await waitFor(() => expect(screen.getByText(ru['hs.sent'])).toBeTruthy());
    expect(document.querySelectorAll('.person-card')).toHaveLength(1);
  });

  it('a 403 income-rule rejection on «+» shows the §2.9 state inline in the card, no flip, no auto-retry (AC 13)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    mockedApi.createHandshake.mockRejectedValue(
      new ApiError(403, '/api/handshake', 'income must exceed outcome')
    );

    await renderPage();
    await screen
      .getByRole('button', { name: ru['people.action.send'].replace('{name}', 'Алиса') })
      .click();

    await waitFor(() => expect(screen.getByText(ru['hs.income_limit'])).toBeTruthy());
    expect(screen.getByText(/income must exceed outcome/)).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ru['people.action.send'].replace('{name}', 'Алиса') })
    ).toBeTruthy();
    expect(screen.queryByText(ru['hs.sent'])).toBeNull();
    expect(mockedApi.createHandshake).toHaveBeenCalledTimes(1);
  });

  it('incoming first card: the handshake-back panel auto-opens (§4.15.4.3); «Привет!» sends the reverse POST, the card becomes Open chat (AC 5)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    fixture.handshakes = [handshake('0xa', ME, 6)];
    mockedApi.createHandshake.mockImplementation(async (request) => {
      expect(request).toEqual({ from_address: ME, to_address: '0xa', status: 1 });
      fixture.handshakes = [handshake('0xa', ME, 6), handshake(ME, '0xa', 0)];
      fixture.chats = [chat('0xchat9', [ME, '0xa'], 0)];
      return handshake(ME, '0xa', 0);
    });

    await renderPage();
    // auto-open: the panel is already expanded on mount — no click needed
    expect(screen.getByRole('button', { name: ru['people.action.back'] })).toBeTruthy();
    await screen.getByRole('button', { name: ru['people.action.back'] }).click();

    await waitFor(() => expect(screen.getByText(ru['people.action.open_chat'])).toBeTruthy());
    // the chatting badge is gone (v3.6); no right-edge icon remains
    expect(screen.queryByText(ru['hs.chatting'])).toBeNull();
    expect(document.querySelector('.action')).toBeNull();
    expect(
      screen.getByRole('link', { name: ru['people.action.open_chat'] })
    ).toBeTruthy();
  });

  it('auto-open applies ONLY to the FIRST card of the sorted list; non-first incoming cards stay closed (§4.15.4.3)', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 2),
      person('0xb', 'Борис', 10)
    ];
    fixture.handshakes = [handshake('0xa', ME, 6), handshake('0xb', ME, 7)];

    await renderPage();

    const cards = document.querySelectorAll('.person-card');
    expect(cards).toHaveLength(2);
    expect(cards[0]?.textContent).toContain('Алиса');
    expect(cards[0]?.querySelector('.expanded-actions')).toBeTruthy();
    expect(cards[1]?.querySelector('.expanded-actions')).toBeNull();
  });

  it('no auto-open when the first card is not an incoming request (§4.15.4.3)', async () => {
    fixture.users = [person('0xa', 'Алиса', 2)];
    await renderPage();
    expect(document.querySelector('.expanded-actions')).toBeNull();
  });

  it('dismiss collapses the auto-opened card, sends NOTHING to the server (ruling 2, AC 6) and is never re-opened by polls', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    fixture.handshakes = [handshake('0xa', ME, 6)];

    await renderPage();
    // the panel is open on mount (first card, who added you)
    expect(screen.getByRole('button', { name: ru['people.action.back'] })).toBeTruthy();
    await screen.getByRole('button', { name: ru['people.dismiss'] }).click();
    await tick();

    expect(mockedApi.createHandshake).not.toHaveBeenCalled();
    // collapsed again: the expanded actions are gone; the card remains with
    // its pill (nothing in the copy or state implies it was declined —
    // ruling 2)
    expect(screen.queryByRole('button', { name: ru['people.action.back'] })).toBeNull();
    expect(screen.getByText(ru['hs.added_you'])).toBeTruthy();

    // the auto-open is one-shot: a later poll tick never re-opens the
    // dismissed card (no toggle exists anymore to re-open it either)
    const callsBefore = mockedApi.listRoomUsers.mock.calls.length;
    await waitFor(
      () => expect(mockedApi.listRoomUsers.mock.calls.length).toBeGreaterThan(callsBefore),
      { timeout: 5000 }
    );
    await tick();
    expect(document.querySelector('.expanded-actions')).toBeNull();
  });
});

describe('/people — tap on an added-you item opens the form (§4.15.4.3 addendum, Concept §19.3)', () => {
  it('tapping a non-first added-you card opens ITS form (the form moves — single-expanded); tapping the expanded card collapses it', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 2),
      person('0xb', 'Борис', 10)
    ];
    fixture.handshakes = [handshake('0xa', ME, 6), handshake('0xb', ME, 7)];

    await renderPage();

    // auto-open stays: the FIRST added-you card starts expanded
    const cards = () => document.querySelectorAll('.person-card');
    expect(cards()[0]?.querySelector('.expanded-actions')).toBeTruthy();
    expect(cards()[1]?.querySelector('.expanded-actions')).toBeNull();

    // only the two incoming rows are button-role tap targets
    const rows = document.querySelectorAll('.row[role="button"]');
    expect(rows).toHaveLength(2);

    // tap Борис → the open form MOVES from Алиса to Борис (single-expanded)
    (rows[1] as HTMLElement).click();
    await tick();
    expect(cards()[1]?.querySelector('.expanded-actions')).toBeTruthy();
    expect(cards()[1]?.querySelector('.expanded-actions')?.textContent).toContain(
      ru['people.action.back']
    );
    expect(cards()[0]?.querySelector('.expanded-actions')).toBeNull();

    // tap Борис again → the tap toggle collapses the form
    (rows[1] as HTMLElement).click();
    await tick();
    expect(document.querySelector('.expanded-actions')).toBeNull();

    // keyboard parity on the page too: Enter on Алиса's row re-opens it
    (rows[0] as HTMLElement).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    await tick();
    expect(cards()[0]?.querySelector('.expanded-actions')).toBeTruthy();
  });

  it('tapping a non-added-you row opens NO handshake form (none / outgoing / chat)', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 20), // none
      person('0xb', 'Борис', 10), // outgoing
      person('0xc', 'Вера', 2) // chat
    ];
    fixture.handshakes = [handshake(ME, '0xb', 8)];
    fixture.chats = [chat('0xchat1', [ME, '0xc'], 3)];

    await renderPage();

    expect(document.querySelectorAll('.row[role="button"]')).toHaveLength(0);
    for (const row of document.querySelectorAll('.person-card .row')) {
      (row as HTMLElement).click();
    }
    await tick();
    expect(document.querySelector('.expanded-actions')).toBeNull();
    // the non-added-you surfaces are unchanged: Open chat link + sent pill
    expect(screen.getByRole('link', { name: ru['people.action.open_chat'] })).toBeTruthy();
    expect(screen.getByText(ru['hs.sent'])).toBeTruthy();
  });

  it('tap-opened form keeps the dismissal flow intact: local collapse only, and a dismissed card never re-opens (ruling 2)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10), person('0xb', 'Борис', 2)];
    fixture.handshakes = [handshake('0xa', ME, 6), handshake('0xb', ME, 7)];

    await renderPage();

    const rows = document.querySelectorAll('.row[role="button"]');
    (rows[0] as HTMLElement).click(); // toggle the auto-opened first card closed
    await tick();
    (rows[1] as HTMLElement).click(); // tap-open the second added-you card
    await tick();
    const cards = document.querySelectorAll('.person-card');
    expect(cards[1]?.querySelector('.expanded-actions')).toBeTruthy();

    await (cards[1]?.querySelector('.dismiss') as HTMLButtonElement).click();
    await tick();
    expect(mockedApi.createHandshake).not.toHaveBeenCalled();
    expect(document.querySelector('.expanded-actions')).toBeNull();

    // a dismissed card is never re-opened by tapping it either
    (rows[1] as HTMLElement).click();
    await tick();
    expect(document.querySelector('.expanded-actions')).toBeNull();
  });
});

describe('/people — search (AC 2; filter chips are gone — v3.6)', () => {
  beforeEach(() => {
    fixture.users = [
      person('0xa', 'Алиса', 10, 'Поттер из Питера'),
      person('0xb', 'Борис', 2, 'Трамвайщик'),
      person('0xc', 'Вера', 30, 'Диджей')
    ];
    fixture.handshakes = [handshake(ME, '0xc', 8)];
  });

  it('search filters by name and bio, echo + reset restore the list', async () => {
    await renderPage();
    const input = screen.getByLabelText(ru['people.search.label']) as HTMLInputElement;
    input.value = 'поттер';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(screen.queryByText('Борис')).toBeNull());
    expect(screen.getByText('Алиса')).toBeTruthy();

    input.value = 'хоккей';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() =>
      expect(screen.getByText(ru['people.empty_search'].replace('{q}', 'хоккей'))).toBeTruthy()
    );
    await screen.getByRole('button', { name: ru['people.reset'] }).click();
    await waitFor(() => expect(screen.getByText('Борис')).toBeTruthy());
  });

  it('no filter chips render and every card stays listed (the list is just sorted)', async () => {
    await renderPage();
    expect(screen.queryByRole('radio')).toBeNull();
    expect(document.querySelectorAll('.person-card')).toHaveLength(3);
  });
});

describe('/people — states + poller (§3.3, §2.2)', () => {
  it('empty room shows the pixel-glyph empty state (AC 9)', async () => {
    fixture.users = [{ ...person(ME, 'Я', 1) }];
    await renderPage();
    expect(screen.getByText(ru['people.empty'])).toBeTruthy();
    expect(document.querySelectorAll('.person-card')).toHaveLength(0);
  });

  it('network failure: banner + dimmed list + retry; ApiError surfaces the server body (AC 10)', async () => {
    fixture.users = [person('0xa', 'Алиса', 1)];
    let fail = false;
    mockedApi.listHandshakesOfUser.mockImplementation(async () => {
      if (fail) throw new NetworkError('/api/handshake/user/x', new Error('offline'));
      return structuredClone(fixture.handshakes);
    });

    await renderPage();
    expect(screen.getByText('Алиса')).toBeTruthy();

    fail = true;
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 5000 });
    expect(document.querySelector('.cards')?.classList.contains('dimmed')).toBe(true);
    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());

    // ApiError flavor: the server body surfaces as an api banner.
    mockedApi.listRoomUsers.mockRejectedValue(
      new ApiError(500, '/api/room/0xroom/user', 'db locked')
    );
    cleanup();
    await renderPage();
    await screen.findByText(ru['common.error.api']);
    expect(screen.getByText(/db locked/)).toBeTruthy();
  });

  it('refreshes on visibility regain; stops the 4 s poller on unmount — no requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      fixture.users = [person('0xa', 'Алиса', 1)];
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const callsAtMount = mockedApi.listRoomUsers.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      // visibility regain forces a refresh
      Object.defineProperty(document, 'visibilityState', {
        value: 'visible',
        configurable: true
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedApi.listRoomUsers.mock.calls.length).toBeGreaterThan(callsAtMount);

      const callsBeforeUnmount = mockedApi.listRoomUsers.mock.calls.length;
      cleanup();
      await vi.advanceTimersByTimeAsync(16_000);
      expect(mockedApi.listRoomUsers.mock.calls.length).toBe(callsBeforeUnmount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('relationships module contract (TZ-02)', () => {
  it('skips me and derives exactly one state per attendee', () => {
    fixture.users = [
      person('0xa', 'Алиса', 1),
      person('0xb', 'Борис', 2),
      { ...person(ME, 'Я', 3) }
    ];
    fixture.handshakes = [handshake('0xa', ME, 5)];
    const map = deriveRelationships(ME, fixture.users, fixture.handshakes, []);
    expect(map.size).toBe(2);
    expect(map.get('0xa')?.state).toBe('incoming');
    expect(map.get('0xb')?.state).toBe('none');
    expect(map.has(ME)).toBe(false);
  });
});

// Raw .svelte/.css source helper for source-level CSS assertions (the
// creation-wizard suite pattern — component styles are scoped, so the
// compiled DOM cannot carry them).
const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

describe('/people — §4.38 searching new contacts badge, inner redesign (Concept §52; placement/footprint per §4.37)', () => {
  it('renders FIRST in ul.cards when the SELF roster entry is active=true — PersonCard footprint, blinking bubble + muted title + settings link; absent when active=false (AC 1)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10), { ...person(ME, 'Я', 20) }];
    await renderPage();

    const list = document.querySelector('ul.cards') as HTMLElement;
    const badge = list.querySelector(':scope > .searching-badge') as HTMLElement;
    expect(badge).toBeTruthy();
    // §4.37.B: the first visual entry of the card list — above every
    // PersonCard, pinned first in DOM order
    expect(list.firstElementChild).toBe(badge);
    const firstCard = list.querySelector('.person-card');
    expect(firstCard).toBeTruthy();
    expect(badge.compareDocumentPosition(firstCard as Node) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
    // the §3.3 card family footprint marker; token-level CSS below
    expect(badge.classList.contains('pixel-corners')).toBe(true);
    // content (§4.38.1): the blinking bubble (aria-hidden) + the muted title
    const bubble = badge.querySelector('.bubble') as HTMLElement;
    expect(bubble).toBeTruthy();
    expect(bubble.getAttribute('aria-hidden')).toBe('true');
    // the registry glyph rendered (§4.38.1 — a PixelIcon SVG inside .bubble)
    expect(bubble.querySelector('svg')).toBeTruthy();
    expect(badge.querySelector('.title')?.textContent).toBe(ru['people.searching']);
    // the §4.38.C settings remark — the FULL line is ONE anchor
    const remark = badge.querySelector('a.remark') as HTMLAnchorElement;
    expect(remark).toBeTruthy();
    expect(remark.getAttribute('href')).toBe('/profile/settings');
    expect(remark.textContent).toBe(ru['people.searching_settings']);
    // the §4.38.1 bubble glyph is the final construction: no legacy loader in the DOM
    expect(badge.querySelector('.loader')).toBeNull();
    // NEW negative (§4.38.1): the superseded bulb construction is gone from
    // the rendered DOM — no .bulb anywhere
    expect(badge.querySelector('.bulb')).toBeNull();
    expect(document.querySelectorAll('.bulb')).toHaveLength(0);
    // NOT a user: the badge's ONLY text is title + remark — no self name,
    // no real user data, no avatar
    const text = (badge.textContent ?? '').replace(/\s+/g, ' ').trim();
    expect(text).toBe(`${ru['people.searching']} ${ru['people.searching_settings']}`);

    // the same roster with active: false → NO badge; the card list itself
    // is untouched (§4.37.A: self entry absent or active: false → absent)
    cleanup();
    fixture.users = [person('0xa', 'Алиса', 10), { ...person(ME, 'Я', 20), active: false }];
    await renderPage();
    expect(document.querySelector('.searching-badge')).toBeNull();
    expect(document.querySelectorAll('.person-card')).toHaveLength(1);
  });

  it('is absent while the self entry is absent from the roster and during the initial skeleton state (AC 2)', async () => {
    // no self entry in the roster → no badge (every pre-existing fixture
    // stays green unchanged — no false badge)
    fixture.users = [person('0xa', 'Алиса', 10)];
    await renderPage();
    expect(document.querySelector('.searching-badge')).toBeNull();

    // initial skeleton: the badge is ABSENT — the skeleton branch replaces
    // the list and `active` is not reliably present before the first tick;
    // no separate skeleton node (§4.37.C)
    cleanup();
    let resolveUsers: ((users: User[]) => void) | undefined;
    mockedApi.listRoomUsers.mockImplementation(
      () => new Promise<User[]>((resolve) => (resolveUsers = resolve))
    );
    render(Page, { props: {} });
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(3);
    expect(document.querySelector('.searching-badge')).toBeNull();
    // first tick lands (self entry active: true) → the badge follows the flag
    fixture.users = [person('0xa', 'Алиса', 1), { ...person(ME, 'Я', 2) }];
    resolveUsers?.(structuredClone(fixture.users));
    await waitFor(() => expect(document.querySelector('.searching-badge')).toBeTruthy());
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);
  });

  it('stays pinned first under a matching search; the empty-search and empty-room states render WITHOUT the badge (§4.37.C, AC 5)', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 10, 'Поттер из Питера'),
      person('0xb', 'Борис', 2, 'Трамвайщик'),
      { ...person(ME, 'Я', 20) }
    ];
    await renderPage();

    const badgeIndex = () => {
      const list = document.querySelector('ul.cards') as HTMLElement;
      return Array.from(list.children).indexOf(list.querySelector('.searching-badge') as Element);
    };
    expect(badgeIndex()).toBe(0);

    // a query that still matches users: the badge is NEVER filtered out,
    // NEVER reordered (§4.37.C — a SYSTEM state ignores the search)
    const input = screen.getByLabelText(ru['people.search.label']) as HTMLInputElement;
    input.value = 'поттер';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(screen.queryByText('Борис')).toBeNull());
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(document.querySelector('.searching-badge')).toBeTruthy();
    expect(badgeIndex()).toBe(0);

    // a query matching nobody → the empty-search branch REPLACES the <ul>
    // (the badge's single render site) → no badge
    input.value = 'хоккей';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() =>
      expect(screen.getByText(ru['people.empty_search'].replace('{q}', 'хоккей'))).toBeTruthy()
    );
    expect(document.querySelector('.searching-badge')).toBeNull();

    // the empty-room state likewise renders without the badge (§4.37.G.2)
    cleanup();
    fixture.users = [{ ...person(ME, 'Я', 1) }];
    await renderPage();
    expect(screen.getByText(ru['people.empty'])).toBeTruthy();
    expect(document.querySelector('.searching-badge')).toBeNull();
  });

  it('is NOT a user entry: the ONLY interactive element is the §4.38.C settings link — no button/role=button/tabindex, no second anchor, no navigation on tap; the bubble is aria-hidden and title + remark are the only announced text (AC 7)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10), { ...person(ME, 'Я', 20) }];
    await renderPage();

    const badge = document.querySelector('.searching-badge') as HTMLElement;
    // the §4.38.C link is the badge's ONLY interactive element: EXACTLY
    // ONE anchor, href = /profile/settings, full-line remark text
    const anchors = badge.querySelectorAll('a');
    expect(anchors).toHaveLength(1);
    const remark = anchors[0] as HTMLAnchorElement;
    expect(remark.getAttribute('href')).toBe('/profile/settings');
    expect(remark.textContent).toBe(ru['people.searching_settings']);
    // non-interactive guarantees (§4.38.C supersedes §4.37.A everywhere
    // else): no button, no role="button", no tabindex, no PersonCard
    // behavior of any kind
    expect(badge.querySelector('button, [role="button"], [tabindex]')).toBeNull();
    expect(badge.querySelector('.chip, .expanded-actions, .action')).toBeNull();
    expect(badge.querySelector('.row[role="button"]')).toBeNull();
    // the bubble is decoration; the visible title + remark are the only
    // announced text
    expect(badge.querySelector('.bubble')?.getAttribute('aria-hidden')).toBe('true');

    // tapping the full-width row (anywhere outside the link) does NOTHING
    // (goto is the app-wide nav seam)
    await badge.click();
    await tick();
    expect(goto).not.toHaveBeenCalled();
  });

  it('footprint + bubble are token/source-level exact (§4.38.1, AC 3–8): PersonCard tokens, 56px slot, 32px registry glyph, opacity-only blink, .main stack, underlined .remark; reduced motion = the base.css catch-all static full-opacity, no cursor: pointer', () => {
    const css = source('src/lib/components/people/SearchingBadge.svelte');

    // the root is the first-<li> badge with pixel-corners (§4.37.B)
    expect(css).toMatch(/<li class="searching-badge pixel-corners">/);
    // the .person-card footprint (§4.37.F item 6 — tokens only)
    expect(css).toMatch(/\.searching-badge\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(css).toMatch(/\.searching-badge\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
    expect(css).toMatch(/\.searching-badge\s*\{[^}]*padding:\s*var\(--space-4\)/);
    // the 56px PixelAvatar slot — bubble centered in it (§4.38.1)
    expect(css).toMatch(/\.slot\s*\{[^}]*width:\s*56px/);
    expect(css).toMatch(/\.slot\s*\{[^}]*height:\s*56px/);
    // §4.38.1 anatomy: the .main stack mirroring PersonCard (lines 231–234)
    expect(css).toMatch(/\.main\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.main\s*\{[^}]*min-width:\s*0/);
    // the §4.38.1 bubble: span.bubble (aria-hidden) wrapping the registry glyph
    // at the exact 2× of the 16-grid
    expect(css).toMatch(/<span class="bubble" aria-hidden="true">/);
    expect(css).toMatch(/<PixelIcon name="bubble" size=\{32\} \/>/);
    // the superseded §4.38.B bulb construction is GONE (source-level, AC 3):
    // no 'bulb' anywhere under apps/web/src (§4.38.1 removal)
    expect(css).not.toMatch(/bulb/);
    expect(css).not.toMatch(/loader/);
    expect(css).not.toMatch(/loader-spin/);
    // the blink: component-scoped keyframes, opacity-only (§4.6) — the
    // "off" phase dips to 0.3; no color swap, no glow, no transform
    expect(css).toMatch(/\.bubble\s*\{[^}]*display:\s*inline-flex/);
    expect(css).toMatch(/\.bubble\s*\{[^}]*animation:\s*bubble-blink 1\.2s ease-in-out infinite/);
    const keyframes = css.match(/@keyframes bubble-blink\s*\{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(keyframes).toBeTruthy();
    expect(keyframes).toMatch(/opacity:\s*1/);
    expect(keyframes).toMatch(/opacity:\s*0\.3/);
    expect(keyframes.match(/opacity/g)?.length).toBe(2);
    expect(keyframes).not.toMatch(/box-shadow|filter|transform|color|background|border/);
    // §4.38.C: the FULL remark line is ONE anchor (resolve from $app/paths —
    // the app's internal-link convention), styled in the .bio family
    // (PersonCard lines 241–248) plus the RoomPreview underline precedent
    // (lines 90–97) — 14px muted underlined
    expect(css).toMatch(/import \{ resolve \} from '\$app\/paths'/);
    expect(css).toMatch(/<a class="remark" href=\{resolve\('\/profile\/settings'\)\}>/);
    expect(css).toMatch(/\.remark\s*\{[^}]*font-size:\s*14px/);
    expect(css).toMatch(/\.remark\s*\{[^}]*color:\s*var\(--color-text-muted\)/);
    expect(css).toMatch(/\.remark\s*\{[^}]*text-decoration:\s*underline/);
    // the muted title — the .name family in --color-text-muted (§4.37.A)
    expect(css).toMatch(/\.title\s*\{[^}]*font-size:\s*16px/);
    expect(css).toMatch(/\.title\s*\{[^}]*font-weight:\s*600/);
    expect(css).toMatch(/\.title\s*\{[^}]*color:\s*var\(--color-text-muted\)/);

    // the bubble glyph in the pixel-rect registry (§4.38.1): the IconName
    // union entry + the 6-rect geometry (rounded-rect body, chamfered
    // corners, stepped tail) — same construction rules as the `gear` pattern
    const registry = source('src/lib/components/icons/registry.ts');
    expect(registry).toMatch(/\| 'bubble';/);
    const bubbleRects = registry.match(/bubble: \[([\s\S]*?)\]\s*\n\};/)?.[1] ?? '';
    expect(bubbleRects).toBeTruthy();
    expect(bubbleRects.match(/\[\d+, \d+, \d+, \d+\]/g)).toHaveLength(6);

    // NEW negative (§4.38.1): NO file under apps/web/src references 'bulb'
    // anymore (union, ICON_RECTS, comments, markup, CSS — the removal is
    // complete at source level)
    const sweep = (dir: string): string[] => {
      const out: string[] = [];
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const path = join(dir, entry.name);
        if (entry.isDirectory()) out.push(...sweep(path));
        else out.push(path);
      }
      return out;
    };
    const srcFiles = sweep(join(WEB_ROOT, 'src'));
    expect(srcFiles.length).toBeGreaterThan(0);
    for (const file of srcFiles) {
      expect(readFileSync(file, 'utf8')).not.toMatch(/bulb/);
    }

    // NOT clickable on the root even though the row width equals a
    // tappable PersonCard's (the link's own pointer cursor is the browser
    // default, §4.38.C); reduced motion: NO component-scoped @media and NO
    // animation-fill-mode — the base.css catch-all completes the pulse
    // instantly and the bubble rests STATIC at full opacity (§4.38.1;
    // asserted source-level like §4.36.D.4). Comments are excluded (the
    // sweep precedent — naming a rule in prose is allowed; actual styles
    // are not).
    const stylesOnly = css
      .slice(css.indexOf('<style>'))
      .replaceAll(/\/\*[\s\S]*?\*\//g, '');
    expect(stylesOnly).not.toMatch(/cursor:\s*pointer/);
    expect(stylesOnly).not.toMatch(/prefers-reduced-motion/);
    expect(stylesOnly).not.toMatch(/animation-fill-mode/);
    const base = source('src/lib/styles/base.css');
    expect(base).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(base).toMatch(/animation-duration:\s*0\.01ms\s*!important/);
  });
});
