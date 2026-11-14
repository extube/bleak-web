/** People page + PersonCard tests (TZ-06, DESIGN §3.3): card rendering with
 * the state-pill mapping, per-card actions (send / handshake-back / dismiss =
 * LOCAL collapse, ruling 2 / open dialog), search + chips, empty states,
 * error banner with dimmed last-known list, poller teardown (fake timers),
 * chats-badge write-through. */
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
  identity.set({ roomAddress: ROOM, userAddress: ME });

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

describe('PersonCard — state pill + timestamp mapping (§3.3)', () => {
  const alice = person('0xa', 'Алиса', 2, 'Поттер из Питера');

  it('none: no pill, muted joined time from User.created_at', () => {
    const relationship = deriveRelationship('0xa', ME, [], []);
    const { container } = render(PersonCard, {
      props: { user: alice, relationship }
    });
    expect(container.querySelector('.chip')).toBeNull();
    expect(screen.getByText('2 мин')).toBeTruthy();
  });

  it('outgoing: outline-muted «Хендшейк отправлен» + handshake time', () => {
    const relationship = deriveRelationship(
      '0xa',
      ME,
      [handshake(ME, '0xa', 5)],
      []
    );
    render(PersonCard, { props: { user: alice, relationship } });
    const chip = screen.getByText(ru['hs.sent']).closest('.chip');
    expect(chip?.classList.contains('outline-muted')).toBe(true);
    expect(screen.getByText('5 мин')).toBeTruthy();
  });

  it('incoming: accent-filled «Добавил вас» + handshake time', () => {
    const relationship = deriveRelationship(
      '0xa',
      ME,
      [handshake('0xa', ME, 7)],
      []
    );
    render(PersonCard, { props: { user: alice, relationship } });
    const chip = screen.getByText(ru['hs.added_you']).closest('.chip');
    expect(chip?.classList.contains('fill-accent')).toBe(true);
    expect(screen.getByText('7 мин')).toBeTruthy();
  });

  it('chat: outline-accent «Общаемся» + chat time, ▤ opens the dialog', () => {
    const chats = [chat('0xchat1', [ME, '0xa'], 9)];
    const relationship = deriveRelationship('0xa', ME, [], chats);
    render(PersonCard, { props: { user: alice, relationship } });
    const chip = screen.getByText(ru['hs.chatting']).closest('.chip');
    expect(chip?.classList.contains('outline-accent')).toBe(true);
    expect(screen.getByText('9 мин')).toBeTruthy();
    const link = screen.getByRole('link', {
      name: ru['people.action.dialog'].replace('{name}', 'Алиса')
    });
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
  });

  it('none: «+» action with a person-named aria-label; sending disables it', async () => {
    const relationship = deriveRelationship('0xa', ME, [], []);
    const onsend = vi.fn();
    const { rerender } = render(PersonCard, {
      props: { user: alice, relationship, onsend }
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
  });

  it('outgoing has no card-level action (waiting for theirs)', () => {
    const relationship = deriveRelationship('0xa', ME, [handshake(ME, '0xa', 5)], []);
    const { container } = render(PersonCard, { props: { user: alice, relationship } });
    expect(container.querySelectorAll('.action button, .action a')).toHaveLength(0);
  });

  it('incoming expand: «Ответить хендшейком» + «Закрыть»; keyboard toggles via aria-expanded', async () => {
    const relationship = deriveRelationship('0xa', ME, [handshake('0xa', ME, 7)], []);
    const ontoggle = vi.fn();
    const { rerender } = render(PersonCard, {
      props: { user: alice, relationship, ontoggle, expanded: false }
    });
    const toggle = screen.getByRole('button', {
      name: ru['people.action.expand'].replace('{name}', 'Алиса')
    });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await toggle.click();
    expect(ontoggle).toHaveBeenCalledTimes(1);

    await rerender({ expanded: true });
    expect(screen.getByRole('button', { name: ru['hs.back'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['people.dismiss'] })).toBeTruthy();
    const openToggle = screen.getByRole('button', {
      name: ru['people.action.collapse'].replace('{name}', 'Алиса')
    });
    expect(openToggle.getAttribute('aria-expanded')).toBe('true');
  });
});

describe('/people — rendering and stable order', () => {
  it('renders one card per attendee (excluding me), newest first, correct pills', async () => {
    fixture.users = [
      person('0xa', 'Алиса', 10, 'Поттер'),
      person('0xb', 'Борис', 2, 'Трамвайщик'),
      { ...person(ME, 'Я', 20) }
    ];
    fixture.handshakes = [handshake('0xa', ME, 6)];
    fixture.chats = [chat('0xchat1', [ME, '0xb'], 4)];

    await renderPage();

    const names = screen.getAllByText(/Алиса|Борис/).map((el) => el.textContent);
    // newest created_at first: Борис (2 min) before Алиса (10 min)
    expect(names.indexOf('Борис')).toBeLessThan(names.indexOf('Алиса'));
    expect(screen.queryByText('Я')).toBeNull();
    // state pills live on the cards (scope: the filter chip «Общаемся» shares the word)
    expect(document.querySelector('.cards')?.textContent?.includes(ru['hs.added_you'])).toBe(true);
    expect(document.querySelector('.cards')?.textContent?.includes(ru['hs.chatting'])).toBe(true);
    // muted member count includes everyone
    expect(screen.getByText('Участников: 3')).toBeTruthy();
  });

  it('shows skeleton cards before the first arrival, then swaps in place', async () => {
    let resolveUsers: ((users: User[]) => void) | undefined;
    mockedApi.listRoomUsers.mockImplementation(
      () => new Promise<User[]>((resolve) => (resolveUsers = resolve))
    );
    mockedApi.listHandshakesOfUser.mockResolvedValue([]);
    mockedApi.listChatsOfUser.mockResolvedValue([]);
    render(Page, { props: {} });
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(3);
    resolveUsers?.([person('0xa', 'Алиса', 1)]);
    await screen.findByText('Алиса');
    expect(document.querySelectorAll('.skeleton-card')).toHaveLength(0);
  });

  it('poll updates mutate in place and deleted users disappear (AC 8)', async () => {
    fixture.users = [person('0xa', 'Алиса', 1), person('0xb', 'Борис', 2)];
    await renderPage();
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(screen.getByText('Борис')).toBeTruthy();

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
    // no reorder: the only card is still the only card
    expect(document.querySelectorAll('.person-card')).toHaveLength(1);
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

    // the card becomes «Общаемся» with a dialog link (scoped to the card list —
    // the filter chip «Общаемся» shares the wording)
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
    // collapsed again: the expanded actions are gone; the card itself remains
    // with its pill — the request still exists server-side and may reappear
    // on a later poll tick (a newer incoming) or on page re-entry; nothing in
    // the copy or state implies it was declined (ruling 2)
    expect(screen.queryByRole('button', { name: ru['hs.back'] })).toBeNull();
    expect(screen.getByText(ru['hs.added_you'])).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ru['people.action.expand'].replace('{name}', 'Алиса') })
    ).toBeTruthy();
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
    expect(screen.getByRole('button', { name: ru['people.reset'] })).toBeTruthy();

    await screen.getByRole('button', { name: ru['people.reset'] }).click();
    await waitFor(() => expect(screen.getByText('Борис')).toBeTruthy());
  });

  it('filter chips reduce the list to the selected state; active chip is accent-filled', async () => {
    await renderPage();
    await screen.getByRole('radio', { name: ru['people.filter.added'] }).click();
    await waitFor(() => expect(screen.queryByText('Борис')).toBeNull());
    // no incoming handshakes in this fixture → only the empty state remains
    expect(screen.queryByText('Алиса')).toBeNull();
    const active = screen.getByRole('radio', { name: ru['people.filter.added'] });
    expect(active.getAttribute('aria-checked')).toBe('true');
    expect(active.classList.contains('active')).toBe(true);

    await screen.getByRole('radio', { name: ru['people.filter.sent'] }).click();
    await waitFor(() => expect(screen.getByText('Вера')).toBeTruthy());
    expect(screen.queryByText('Алиса')).toBeNull();
  });
});

describe('/people — states (§3.3)', () => {
  it('empty room shows the pixel-glyph empty state (AC 9)', async () => {
    fixture.users = [{ ...person(ME, 'Я', 1) }];
    await renderPage();
    expect(screen.getByText(ru['people.empty'])).toBeTruthy();
    expect(document.querySelectorAll('.person-card')).toHaveLength(0);
  });

  it('network failure: banner appears, list stays dimmed, retry forces refresh (AC 10)', async () => {
    fixture.users = [person('0xa', 'Алиса', 1)];
    let fail = false;
    mockedApi.listHandshakesOfUser.mockImplementation(async () => {
      if (fail) throw new NetworkError('/api/handshake/user/x', new Error('offline'));
      return structuredClone(fixture.handshakes);
    });

    await renderPage();
    expect(screen.getByText('Алиса')).toBeTruthy();

    // mid-session failure: banner + last-known list rendered dimmed
    fail = true;
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 5000 });
    expect(document.querySelector('.cards')?.classList.contains('dimmed')).toBe(true);

    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(document.querySelector('.cards')?.classList.contains('dimmed')).toBe(false);
  });

  it('ApiError surfaces the server body as an api banner', async () => {
    mockedApi.listRoomUsers.mockRejectedValue(
      new ApiError(500, '/api/room/0xroom/user', 'db locked')
    );
    await renderPage();
    await screen.findByText(ru['common.error.api']);
    expect(screen.getByText(/db locked/)).toBeTruthy();
  });
});

describe('/people — poller + badge (§2.2, §1.2)', () => {
  it('stops the 4 s poller on unmount — no network requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      fixture.users = [person('0xa', 'Алиса', 1)];
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const callsAtMount = mockedApi.listRoomUsers.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      cleanup();
      await vi.advanceTimersByTimeAsync(16_000);
      expect(mockedApi.listRoomUsers.mock.calls.length).toBe(callsAtMount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('refreshes on visibility regain', async () => {
    await renderPage();
    const callsBefore = mockedApi.listRoomUsers.mock.calls.length;
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true
    });
    document.dispatchEvent(new Event('visibilitychange'));
    await waitFor(() => expect(mockedApi.listRoomUsers.mock.calls.length).toBeGreaterThan(
      callsBefore
    ));
  });

  it('writes chat newness through to the chatsSeen store (badge dot)', async () => {
    fixture.users = [person('0xa', 'Алиса', 1)];
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 0)];
    await renderPage();
    await waitFor(() => expect(get(chatsUnseen)).toBe(true));
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
