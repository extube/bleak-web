/** /contacts page tests (DESIGN §4.14.2, Concept §14.1.2): the PRIMARY
 * "shared with you" surface — recipient-only listContactsSharedWith rows
 * (sharer name resolved from the room roster, raw address as the fallback;
 * content + relative time; the endpoint's newest-first order preserved),
 * the empty state, the per-persona contactsSeen write-through on visit
 * (the TabBar dot clears), the identity guard, the error banner with the
 * dimmed last-known list, poller teardown, and the contactsSeen store
 * unit behavior (chatsSeen pattern). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, NetworkError, type Contact, type User } from '@bleak/api-client';
import {
  contactsUnseen,
  evaluateContactsUnseen,
  getContactsSeen,
  hasNewerContact,
  markContactsSeen
} from '../src/lib/stores/contactsSeen';
import { identity } from '../src/lib/stores/identity';
import { ru } from '../src/lib/i18n/ru';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route
}));

vi.mock('#lib/api/client', () => ({
  api: {
    listContactsSharedWith: vi.fn(),
    listRoomUsers: vi.fn()
  }
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/contacts/+page.svelte';

const ME = '0xme';
const ROOM = '0xroom';
const mockedApi = vi.mocked(api, true);

const fixture = {
  contacts: [] as Contact[],
  users: [] as User[]
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function person(address: string, name: string): User {
  return {
    active: true,
    address,
    room: ROOM,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: minutesAgo(30),
    updated_at: minutesAgo(30),
    deleted_at: null
  };
}

function contact(from: string, content: string, ageMinutes: number): Contact {
  return { content, created_at: minutesAgo(ageMinutes), from, to: ME };
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
  contactsUnseen.set(false);
  fixture.contacts = [];
  fixture.users = [];
  mockedApi.listContactsSharedWith.mockImplementation(async () => structuredClone(fixture.contacts));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
  contactsUnseen.set(false);
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.listContactsSharedWith).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('/contacts — rows (§4.14.2)', () => {
  it('renders newest-first rows: roster name, content, relative time', async () => {
    fixture.users = [person('0xa', 'Алиса'), person('0xb', 'Борис')];
    fixture.contacts = [
      contact('0xa', 'telegram: @alice', 2),
      contact('0xb', 'phone: +7…', 90)
    ];
    await renderPage();
    const rows = [...document.querySelectorAll('.row')];
    expect(rows).toHaveLength(2);
    // order preserved — the endpoint answers newest first
    expect(rows[0]?.querySelector('.sharer')?.textContent).toBe('Алиса');
    expect(rows[0]?.querySelector('.content')?.textContent).toBe('telegram: @alice');
    expect(rows[0]?.querySelector('.time')?.textContent).toBe('2 мин');
    expect(rows[1]?.querySelector('.sharer')?.textContent).toBe('Борис');
    expect(rows[1]?.querySelector('.content')?.textContent).toBe('phone: +7…');
    expect(rows[1]?.querySelector('.time')?.textContent).toBe('1 ч');
  });

  it('an address the roster does not know falls back to the raw address', async () => {
    fixture.users = [person('0xa', 'Алиса')];
    fixture.contacts = [contact('0xstranger', '@ghost', 5)];
    await renderPage();
    const row = document.querySelector('.row');
    expect(row?.querySelector('.sharer')?.textContent).toBe('0xstranger');
    expect(row?.querySelector('.content')?.textContent).toBe('@ghost');
  });

  it('the page polls both the contacts list and the roster every 4 s (§2.2)', async () => {
    vi.useFakeTimers();
    try {
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const listAtMount = mockedApi.listContactsSharedWith.mock.calls.length;
      expect(listAtMount).toBeGreaterThan(0);
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockedApi.listContactsSharedWith.mock.calls.length).toBeGreaterThan(listAtMount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('a removed contact disappears in place on the next poll', async () => {
    fixture.contacts = [contact('0xa', 'one', 2), contact('0xb', 'two', 1)];
    await renderPage();
    expect(document.querySelectorAll('.row')).toHaveLength(2);
    fixture.contacts = [contact('0xb', 'two', 1)];
    await waitFor(() => expect(document.querySelectorAll('.row')).toHaveLength(1), {
      timeout: 6000
    });
    expect(screen.getByText('two')).toBeTruthy();
  });
});

describe('/contacts — states (§4.14.2)', () => {
  it('two skeleton rows before the first arrival, then they swap away', async () => {
    let resolveList: ((contacts: Contact[]) => void) | undefined;
    mockedApi.listContactsSharedWith.mockImplementation(
      () => new Promise<Contact[]>((resolve) => (resolveList = resolve))
    );
    mockedApi.listRoomUsers.mockImplementation(async () => []);
    render(Page, { props: {} });
    expect(document.querySelectorAll('.skeleton-row')).toHaveLength(2);
    resolveList?.([contact('0xa', 'привет', 1)]);
    await screen.findByText('привет');
    expect(document.querySelectorAll('.skeleton-row')).toHaveLength(0);
  });

  it('no contacts → the empty state with the §4.14.2 copy', async () => {
    await renderPage();
    expect(screen.getByText(ru['contacts.empty'])).toBeTruthy();
  });

  it('network failure shows the banner and preserves the last-known list dimmed', async () => {
    fixture.contacts = [contact('0xa', 'one', 2)];
    let fail = false;
    mockedApi.listContactsSharedWith.mockImplementation(async () => {
      if (fail) throw new NetworkError('/api/contact/x', new Error('offline'));
      return structuredClone(fixture.contacts);
    });

    await renderPage();
    expect(screen.getByText('one')).toBeTruthy();

    fail = true;
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 5000 });
    expect(document.querySelector('.rows')?.classList.contains('dimmed')).toBe(true);

    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(document.querySelector('.rows')?.classList.contains('dimmed')).toBe(false);
  });

  it('an API failure shows the server body under the banner', async () => {
    mockedApi.listContactsSharedWith.mockRejectedValue(
      new ApiError(500, '/api/contact/0xme', 'boom')
    );
    await renderPage();
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0));
    // the server body surfaces under the server-error title (§2.1 mapping)
    expect(screen.getByText(/boom/)).toBeTruthy();
  });
});

describe('/contacts — unseen marker on visit (§4.14.2, §1.2 dot)', () => {
  it('visiting /contacts writes the per-persona contactsSeen and clears the dot', async () => {
    contactsUnseen.set(true);
    await renderPage();
    expect(localStorage.getItem('bleak.contactsSeen')).not.toBeNull();
    expect(getContactsSeen(ROOM, ME)).toBeGreaterThan(0);
    expect(get(contactsUnseen)).toBe(false);
  });

  it('the marker is per persona: another persona on the same device keeps its own timestamp', async () => {
    await renderPage();
    const firstSeen = getContactsSeen(ROOM, ME);
    expect(getContactsSeen('0xother-room', '0xother-user')).toBe(0);
    expect(firstSeen).toBeGreaterThan(0);
  });
});

describe('/contacts — guard (TZ-03)', () => {
  it('no identity → redirect to the join entry /income (tz12-02) and no data fetch', async () => {
    const { goto } = await import('$app/navigation');
    identity.set(null);
    localStorage.removeItem('bleak.identity');
    render(Page, { props: {} });
    await tick();
    await tick();
    expect(goto).toHaveBeenCalledWith('/income');
    expect(mockedApi.listContactsSharedWith).not.toHaveBeenCalled();
  });

  it('stops the 4 s poller on unmount — no network requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const callsAtMount = mockedApi.listContactsSharedWith.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      cleanup();
      await vi.advanceTimersByTimeAsync(16_000);
      expect(mockedApi.listContactsSharedWith.mock.calls.length).toBe(callsAtMount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('contactsSeen store (chatsSeen pattern, per persona)', () => {
  it('treats empty storage as never-seen', () => {
    expect(getContactsSeen(ROOM, ME)).toBe(0);
  });

  it('newer-than-seen ⇒ dot; markContactsSeen clears it', () => {
    const rows = [{ created_at: '2026-11-19T12:00:00Z' }];
    expect(get(contactsUnseen)).toBe(false);
    // no seen marker → anything exists ⇒ unseen
    localStorage.setItem('bleak.contactsSeen', JSON.stringify({ [`${ROOM}|${ME}`]: 0 }));
    expect(hasNewerContact(rows, 0)).toBe(true);
    expect(evaluateContactsUnseen(ROOM, ME, rows)).toBe(true);
    expect(get(contactsUnseen)).toBe(true);

    markContactsSeen(ROOM, ME, Date.parse('2026-11-19T13:00:00Z'));
    expect(get(contactsUnseen)).toBe(false);
    expect(hasNewerContact(rows, getContactsSeen(ROOM, ME))).toBe(false);
  });

  it('corrupt storage values are ignored (fall back to never-seen)', () => {
    localStorage.setItem('bleak.contactsSeen', 'not-json');
    expect(getContactsSeen(ROOM, ME)).toBe(0);
  });

  it('invalid timestamps never count as newer', () => {
    markContactsSeen(ROOM, ME, Date.parse('2026-11-19T12:00:00Z'));
    expect(hasNewerContact([{ created_at: 'garbage' }], getContactsSeen(ROOM, ME))).toBe(false);
    expect(evaluateContactsUnseen(ROOM, ME, [{ created_at: 'garbage' }])).toBe(false);
  });

  it('handles empty contact lists', () => {
    expect(evaluateContactsUnseen(ROOM, ME, [])).toBe(false);
    expect(get(contactsUnseen)).toBe(false);
  });
});
