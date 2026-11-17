/** People page + PersonCard tests — LEAN suite (2026-11-17 slimming pass,
 * owner directive): one block per distinct behavior, micro asserts removed
 * (recorded in docs/verification-v2.md). Covers: state-pill mapping
 * (parametrized), card actions (send/expand/outgoing-none), page render
 * order + pills + chats-badge write-through, skeleton→cards→poll mutation,
 * «+» send flip, §2.9 income rejection, handshake-back, dismiss (local
 * only), search + filter chips, empty room, error banners, poller teardown
 * + visibility regain, relationships module contract. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, NetworkError, type Chat, type Handshake, type User } from '@bleak/api-client';
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

describe('PersonCard — pills, actions, expand (§3.3)', () => {
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
      pill: ru['hs.chatting'],
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

  it('incoming expand: «Ответить хендшейком» + «Закрыть»; collapse collapses back', async () => {
    const ontoggle = vi.fn();
    const { rerender } = render(PersonCard, {
      props: {
        user: alice,
        relationship: deriveRelationship('0xa', ME, [handshake('0xa', ME, 7)], []),
        ontoggle,
        expanded: false
      }
    });
    await screen
      .getByRole('button', { name: ru['people.action.expand'].replace('{name}', 'Алиса') })
      .click();
    expect(ontoggle).toHaveBeenCalledTimes(1);

    await rerender({ expanded: true });
    expect(screen.getByRole('button', { name: ru['hs.back'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['people.dismiss'] })).toBeTruthy();
  });
});

describe('/people — rendering, order, badge (§3.3)', () => {
  it('one card per attendee (excluding me), newest first, pills present, badge write-through', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 10, 'Поттер'),
      person('0xb', 'Борис', 2, 'Трамвайщик'),
      { ...person(ME, 'Я', 20) }
    ];
    fixture.handshakes = [handshake('0xa', ME, 6)];
    fixture.chats = [chat('0xchat1', [ME, '0xb'], 0)];

    await renderPage();

    const names = screen.getAllByText(/Алиса|Борис/).map((el) => el.textContent);
    // newest created_at first: Борис (2 min) before Алиса (10 min)
    expect(names.indexOf('Борис')).toBeLessThan(names.indexOf('Алиса'));
    expect(screen.queryByText('Я')).toBeNull();
    expect(screen.getByText('Участников: 3')).toBeTruthy();
    // state pills live on the cards (the filter chip «Общаемся» shares wording)
    expect(document.querySelector('.cards')?.textContent?.includes(ru['hs.added_you'])).toBe(true);
    expect(document.querySelector('.cards')?.textContent?.includes(ru['hs.chatting'])).toBe(true);
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

  it('incoming card: handshake back sends the reverse POST, card becomes «Общаемся» (AC 5)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    fixture.handshakes = [handshake('0xa', ME, 6)];
    mockedApi.createHandshake.mockImplementation(async (request) => {
      expect(request).toEqual({ from_address: ME, to_address: '0xa', status: 1 });
      fixture.handshakes = [handshake('0xa', ME, 6), handshake(ME, '0xa', 0)];
      fixture.chats = [chat('0xchat9', [ME, '0xa'], 0)];
      return handshake(ME, '0xa', 0);
    });

    await renderPage();
    await screen
      .getByRole('button', { name: ru['people.action.expand'].replace('{name}', 'Алиса') })
      .click();
    await screen.getByRole('button', { name: ru['hs.back'] }).click();

    await waitFor(() =>
      expect(
        document.querySelector('.cards')?.textContent?.includes(ru['hs.chatting'])
      ).toBe(true)
    );
    expect(
      screen.getByRole('link', { name: ru['people.action.dialog'].replace('{name}', 'Алиса') })
    ).toBeTruthy();
  });

  it('dismiss collapses the card and sends NOTHING to the server (ruling 2, AC 6)', async () => {
    fixture.users = [person('0xa', 'Алиса', 10)];
    fixture.handshakes = [handshake('0xa', ME, 6)];

    await renderPage();
    await screen
      .getByRole('button', { name: ru['people.action.expand'].replace('{name}', 'Алиса') })
      .click();
    await screen.getByRole('button', { name: ru['people.dismiss'] }).click();
    await tick();

    expect(mockedApi.createHandshake).not.toHaveBeenCalled();
    // collapsed again: the expanded actions are gone; the card remains with
    // its pill (nothing in the copy or state implies it was declined —
    // ruling 2)
    expect(screen.queryByRole('button', { name: ru['hs.back'] })).toBeNull();
    expect(screen.getByText(ru['hs.added_you'])).toBeTruthy();
  });
});

describe('/people — search + filter chips (AC 2, AC 3)', () => {
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

  it('filter chips reduce the list to the selected state (AC 3)', async () => {
    await renderPage();
    await screen.getByRole('radio', { name: ru['people.filter.added'] }).click();
    await waitFor(() => expect(screen.queryByText('Борис')).toBeNull());
    expect(screen.queryByText('Алиса')).toBeNull();

    await screen.getByRole('radio', { name: ru['people.filter.sent'] }).click();
    await waitFor(() => expect(screen.getByText('Вера')).toBeTruthy());
    expect(screen.queryByText('Алиса')).toBeNull();
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
