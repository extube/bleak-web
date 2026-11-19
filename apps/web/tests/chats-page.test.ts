/** /chats list page tests (TZ-07 as amended by DESIGN §4.11.5–7 / Concept
 * §10.1.5–7): one card per chat with the counterpart (participants minus
 * me), the v2.4 item content — theme chips REMOVED, last-message preview
 * (fetched per chat from the listChatMessages endpoint into the
 * lastMessages cache, muted + single-line ellipsis truncation) + the last
 * message's time — the status icon derived from the AUTHORITATIVE Chat.done
 * (CONCEPT §13 R2 / DESIGN §4.13.2: done → finished reminder mark, else the
 * animated ACTIVE loading glyph), «+N», empty state CTA → /people,
 * skeletons, in-place poll updates (removed chats disappear), the §4.12.2
 * restyle (neutral LIST surface — the Deepa hue moved from the card to the
 * status mark in the chat's message color; the avatar carries the coding
 * like /people), chatsSeen write-through on visit, error banner with
 * dimmed last-known list, poller teardown. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { NetworkError, type Chat, type Message, type User } from '@bleak/api-client';
import { chatsUnseen } from '../src/lib/stores/chatsSeen';
import { lastMessages } from '../src/lib/stores/lastMessage';
import { codeHue, fnv1a, CODE_HUES } from '../src/lib/avatar/traits';
import { ru } from '../src/lib/i18n/ru';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? route.replace('[address]', params.address) : route
}));

vi.mock('#lib/api/client', () => ({
  api: {
    listChatsOfUser: vi.fn(),
    listRoomUsers: vi.fn(),
    listChatMessages: vi.fn()
  }
}));

import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import Page from '../src/routes/chats/+page.svelte';
import ChatCard from '../src/lib/components/chats/ChatCard.svelte';

const ME = '0xme';
const ROOM = '0xroom';
const mockedApi = vi.mocked(api, true);

// Source-level CSS assertions (§4.12.2 restyle) read the component file —
// same pattern as the radar orbit tests (jsdom resolves no component CSS).
const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

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

function message(chatAddress: string, content: string, minutesAgoValue: number): Message {
  return {
    tx_id: `tx-${chatAddress}-${content}`,
    chat: chatAddress,
    from: '0xa',
    to: ME,
    content,
    created_at: minutesAgo(minutesAgoValue)
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
  lastMessages.set(new Map());
  fixture.chats = [];
  fixture.users = [];
  mockedApi.listChatsOfUser.mockImplementation(async () => structuredClone(fixture.chats));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  // Default: no transcripts fetched yet → cards render without a preview.
  mockedApi.listChatMessages.mockImplementation(async () => []);
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
  lastMessages.set(new Map());
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.listChatsOfUser).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('/chats — cards (§3.4 as amended by §4.11.5–7, §4.12.2)', () => {
  beforeEach(() => {
    fixture.users = [person(ME, 'Я', 30), person('0xa', 'Алиса', 10, 'Поттер')];
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 5)];
  });

  it('renders one card per chat: counterpart name + avatar, theme text REMOVED (§4.11.6)', async () => {
    mockedApi.listChatMessages.mockImplementation(async () => [
      message('0xchat1', 'Агенты обсудили книжный клуб', 1)
    ]);
    await renderPage();
    const link = screen.getByRole('link', {
      name: ru['chats.card.aria']
        .replace('{name}', 'Алиса')
        .replace('{status}', ru['chats.status.active'])
    });
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
    // the dialog-theme chips are gone from list items (§4.11.6)
    expect(screen.queryByText('networking')).toBeNull();
    expect(screen.queryByText('ai-future')).toBeNull();
    // my own name is not the counterpart
    expect(link.textContent).not.toContain('Я');
  });

  it('last-message preview: fetched per listed chat, muted + time in the preview line (§4.11.6)', async () => {
    mockedApi.listChatMessages.mockImplementation(async (address: string) =>
      address === '0xchat1' ? [message('0xchat1', 'Агенты обсудили книжный клуб', 1)] : []
    );
    await renderPage();
    // the transcript endpoint was queried for the visible chat
    expect(mockedApi.listChatMessages).toHaveBeenCalledWith('0xchat1');
    const link = await screen.findByRole('link', { name: /Диалог с Алиса/ });
    await waitFor(() => expect(link.querySelector('.preview')).toBeTruthy());
    expect(link.querySelector('.preview')?.textContent).toBe('Агенты обсудили книжный клуб');
    // the preview line carries the LAST message's absolute time (hh:mm)
    const line = link.querySelector('.preview-line');
    expect(line?.querySelector('.time')?.textContent).toMatch(/^\d{2}:\d{2}$/);
  });

  it('no preview while the transcript is not fetched (no placeholder spinner)', async () => {
    await renderPage();
    const link = screen.getByRole('link', { name: /Диалог с Алиса/ });
    expect(link.querySelector('.preview-line')).toBeNull();
  });

  it('preview comes from the lastMessages store cache, refreshed by the poll tick (§4.11.6)', async () => {
    await renderPage();
    const link = screen.getByRole('link', { name: /Диалог с Алиса/ });
    expect(link.querySelector('.preview-line')).toBeNull();
    // the poll tick fetched the visible chat's transcript into the cache
    await waitFor(() => expect(mockedApi.listChatMessages).toHaveBeenCalledWith('0xchat1'));
    // seeding the cache renders the preview without any page reload
    lastMessages.set(
      new Map([
        [
          '0xchat1',
          { owner: ME, content: 'Новое сообщение агентов', from: '0xa', created_at: minutesAgo(1) }
        ]
      ])
    );
    await waitFor(() =>
      expect(
        screen.getByRole('link', { name: /Диалог с Алиса/ }).querySelector('.preview')?.textContent
      ).toBe('Новое сообщение агентов')
    );
  });

  it('empty transcript (fresh/cleared chat) → the card shows without a preview', async () => {
    mockedApi.listChatMessages.mockImplementation(async () => []);
    await renderPage();
    await waitFor(() => expect(mockedApi.listChatMessages).toHaveBeenCalledWith('0xchat1'));
    const link = screen.getByRole('link', { name: /Диалог с Алиса/ });
    expect(link.querySelector('.preview-line')).toBeNull();
  });

  it('truncation approach: single-line CSS ellipsis on the preview (§4.11.6 «…»)', async () => {
    await renderPage();
    // the poll tick fetched (empty) transcripts first; seed the cache after
    await waitFor(() => expect(mockedApi.listChatMessages).toHaveBeenCalledWith('0xchat1'));
    lastMessages.set(
      new Map([
        [
          '0xchat1',
          { owner: ME, content: 'х'.repeat(255), from: '0xa', created_at: minutesAgo(1) }
        ]
      ])
    );
    await waitFor(() => expect(screen.getByText('х'.repeat(255))).toBeTruthy());
    const preview = screen.getByText('х'.repeat(255));
    // the full content is rendered verbatim; the CSS truncates the overflow
    // (white-space: nowrap + text-overflow: ellipsis → the «…» glyph).
    expect(preview.className).toContain('preview');
    expect(preview.getAttribute('title')).toBe('х'.repeat(255));
  });

  it('status icon: ACTIVE loading-style glyph by default, status in the accessible name (§4.11.7)', async () => {
    await renderPage();
    const link = screen.getByRole('link', {
      name: ru['chats.card.aria']
        .replace('{name}', 'Алиса')
        .replace('{status}', ru['chats.status.active'])
    });
    const status = link.querySelector('.status');
    expect(status?.classList.contains('active')).toBe(true);
    expect(status?.classList.contains('finished')).toBe(false);
    expect(status?.querySelector('svg')).toBeTruthy();
  });

  it('status icon per Chat.done (§4.13.2): done → the FINISHED reminder mark, no override passed', async () => {
    // The AUTHORITATIVE signal flows straight from the polled payload —
    // the route passes no presentation override.
    fixture.chats = [{ ...chat('0xchat1', [ME, '0xa'], 5), done: true }];
    await renderPage();
    const link = screen.getByRole('link', {
      name: ru['chats.card.aria']
        .replace('{name}', 'Алиса')
        .replace('{status}', ru['chats.status.finished'])
    });
    const status = link.querySelector('.status');
    expect(status?.classList.contains('finished')).toBe(true);
    expect(status?.classList.contains('active')).toBe(false);
    expect(status?.querySelector('svg')).toBeTruthy();
    // the §4.12.2 treatment is kept: the mark wears the interlocutor's hue
    expect(status?.classList.contains(codeHue('0xa'))).toBe(true);
  });

  it('status icon per Chat.done (§4.13.2): done missing/false → ACTIVE, and the state follows a poll', async () => {
    await renderPage();
    const active = screen.getByRole('link', { name: /Диалог с Алиса/ }).querySelector('.status');
    expect(active?.classList.contains('active')).toBe(true);
    // kickoff reset semantics server-side: done flips true → the mark swaps
    fixture.chats = [{ ...chat('0xchat1', [ME, '0xa'], 4), done: true }];
    await waitFor(
      () =>
        expect(
          screen.getByRole('link', { name: /Диалог с Алиса/ }).querySelector('.status.finished')
        ).toBeTruthy(),
      { timeout: 6000 }
    );
    // …and back (a kickoff reset the false field server-side)
    fixture.chats = [{ ...chat('0xchat1', [ME, '0xa'], 4), done: false }];
    await waitFor(
      () =>
        expect(
          screen.getByRole('link', { name: /Диалог с Алиса/ }).querySelector('.status.active')
        ).toBeTruthy(),
      { timeout: 6000 }
    );
  }, 20_000);

  it('counterpart derived from participants minus me; a ≠2 chat shows first counterpart + «+N» (AC 2)', async () => {
    fixture.users.push(person('0xb', 'Борис', 8), person('0xc', 'Вера', 6));
    fixture.chats = [chat('0xchat3', ['0xb', ME, '0xa', '0xc'], 2)];
    await renderPage();
    // the copy template renders «Диалог с {name}» verbatim
    const link = screen.getByRole('link', { name: /Диалог с Борис/ });
    expect(link.textContent).toContain('Борис');
    expect(screen.getByText('+2')).toBeTruthy();
  });

  it('§4.12.2 neutral list role: the card drops the Deepa background; the INTERLOCUTOR\'S hue (fnv1a % 5) moves to the status mark and stays stable across polls', async () => {
    await renderPage();
    // the address-hash contract: fnv1a(counterpart address) % 5 → the hue
    expect(codeHue('0xa')).toBe(CODE_HUES[fnv1a('0xa') % CODE_HUES.length]);
    const link = screen.getByRole('link', { name: /Диалог с Алиса/ });
    // neutral LIST surface (§4.12.2 / Concept §11.1.2): no hue class on the
    // card itself — the Deepa background left with §4.11.5
    expect(link.className).not.toMatch(/deepa-[1-5]/);
    // the chat's message color lives on the status mark instead
    const status = link.querySelector('.status');
    expect(status?.classList.contains(codeHue('0xa'))).toBe(true);
    // the avatar carries the color-coding like /people: plain PixelAvatar,
    // no extra hue wrapper around it
    expect(link.querySelectorAll('.deepa-1, .deepa-2, .deepa-3, .deepa-4, .deepa-5')).toHaveLength(1);
    // cross-visit determinism: a fresh poll (new snapshot) keeps the hue
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 4)];
    await waitFor(() =>
      expect(
        screen
          .getByRole('link', { name: /Диалог с Алиса/ })
          .querySelector('.status')
          ?.classList.contains(codeHue('0xa'))
      ).toBe(true)
    );
  });

  it('§4.12.2 restyle CSS: neutral surface, no Deepa card background, status marks in the chat\'s hue, animated loading glyph', async () => {
    const cardCss = source('src/lib/components/chats/ChatCard.svelte');
    // neutral surface stays the card background; no Deepa hue is ever a
    // card background anymore (the LIST role amendment)
    expect(cardCss).toMatch(/\.chat-card\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(cardCss).not.toMatch(/\.chat-card\.deepa-\d/);
    // status marks in the chat's message color: every Deepa hue maps the
    // status mark to its token — and the danger red is gone
    for (let n = 1; n <= 5; n += 1) {
      expect(cardCss).toMatch(new RegExp(`\\.status\\.deepa-${n}\\s*\\{[^}]*var\\(--color-deepa-${n}\\)`));
    }
    expect(cardCss).not.toMatch(/--color-danger/);
    // the ACTIVE loading mark is animated (transform-only spin; the
    // prefers-reduced-motion catch-all in base.css disables it)
    expect(cardCss).toMatch(/\.status\.active\s*\{[^}]*animation:\s*chat-status-spin/);
    expect(cardCss).toMatch(/@keyframes chat-status-spin\s*\{[^}]*rotate\(360deg\)/);
    // no raw hex in the component (token discipline)
    expect(cardCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
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

describe('ChatCard — status icon per state (§4.11.7; the card directly, the route derives)', () => {
  const cardChat = chat('0xchat1', [ME, '0xa'], 5);
  const entry = { owner: ME, content: 'привет', from: '0xa', created_at: minutesAgo(2) };

  it('Chat.done drives the state without an override (§4.13.2): done → FINISHED, missing/false → ACTIVE', async () => {
    render(ChatCard, {
      props: {
        chat: { ...cardChat, done: true },
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    expect(document.querySelector('.status.finished')).toBeTruthy();
    cleanup();

    render(ChatCard, {
      props: {
        chat: { ...cardChat, done: false },
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    expect(document.querySelector('.status.active')).toBeTruthy();
    cleanup();

    // missing done (fixture-compat optionality) means NOT finished
    render(ChatCard, {
      props: {
        chat: cardChat,
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    expect(document.querySelector('.status.active')).toBeTruthy();
  });

  it('ACTIVE → the loading-style glyph in the chat\'s hue, animated; status wording in the accessible name (§4.12.2)', async () => {
    render(ChatCard, {
      props: {
        chat: cardChat,
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry,
        status: 'active'
      }
    });
    const status = document.querySelector('.status');
    expect(status?.classList.contains('active')).toBe(true);
    // §4.12.2: the mark takes the INTERLOCUTOR'S Deepa hue (the chat's
    // message color) — the spin animation itself is asserted on the CSS
    expect(status?.classList.contains(codeHue('0xa'))).toBe(true);
    expect(status?.querySelector('svg')).toBeTruthy();
  });

  it('FINISHED → the reminder mark in the chat\'s hue, NOT the danger red (§4.12.2)', async () => {
    render(ChatCard, {
      props: {
        chat: cardChat,
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry,
        status: 'finished'
      }
    });
    const status = document.querySelector('.status');
    expect(status?.classList.contains('finished')).toBe(true);
    // §4.12.2: the red reminder mark became the Deepa-hue reminder mark —
    // the same codeHue class the active state carries; the CSS mapping
    // (and the absence of --color-danger) is asserted in the restyle test
    expect(status?.classList.contains(codeHue('0xa'))).toBe(true);
    expect(status?.querySelector('svg')).toBeTruthy();
    const aria = ru['chats.card.aria']
      .replace('{name}', 'Алиса')
      .replace('{status}', ru['chats.status.finished']);
    const link = screen.getByRole('link', { name: aria });
    expect(link.querySelector('.status.finished')).toBeTruthy();
    // the card itself stays neutral (no Deepa background class)
    expect(link.className).not.toMatch(/deepa-[1-5]/);
  });
});
