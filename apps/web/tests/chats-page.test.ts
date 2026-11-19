/** /chats list page tests (TZ-07 as amended by DESIGN §4.11.5–7 / Concept
 * §10.1.5–7): one card per chat with the counterpart (participants minus
 * me), the v2.4 item content — theme chips REMOVED, last-message preview
 * (fetched per chat from the listChatMessages endpoint into the
 * lastMessages cache, muted + single-line ellipsis truncation) + the last
 * message's time — the v3.4 COLOR DOT (DESIGN §4.15.2.2: the §4.11.7
 * status marks and the §10.1.7-era rotated-dots loading indicator are
 * REMOVED; one state-agnostic dot in the interlocutor's Deepa hue
 * replaces them; the §4.13.4 circular loader stays), derived from the
 * AUTHORITATIVE Chat.done (CONCEPT §13 R2 / DESIGN §4.13.2), «+N»,
 * empty state CTA → /people,
 * skeletons, in-place poll updates (removed chats disappear), the §4.12.2
 * restyle (neutral LIST surface — the Deepa hue moved from the card to
 * the color dot in the chat's message color; the avatar carries the
 * coding like /people), chatsSeen write-through on visit, error banner
 * with dimmed last-known list, poller teardown. */
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
    listChatMessages: vi.fn(),
    matchV2: vi.fn()
  }
}));

import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import { matchScores } from '#lib/stores/matchScores';
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
  matchScores.set(new Map());
  fixture.chats = [];
  fixture.users = [];
  mockedApi.listChatsOfUser.mockImplementation(async () => structuredClone(fixture.chats));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  // Default: no transcripts fetched yet → cards render without a preview.
  mockedApi.listChatMessages.mockImplementation(async () => []);
  // Default: every finished pair grades 50 (individual tests override).
  mockedApi.matchV2.mockImplementation(async () => ({
    points: 50,
    exact_interest_matches: 0,
    shared_groups: 0,
    handshake: false,
    mutual_handshake: false
  }));
});

afterEach(() => {
  cleanup();
  identity.set(null);
  localStorage.clear();
  lastMessages.set(new Map());
  matchScores.set(new Map());
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

  it('color dot: one state-agnostic dot in the interlocutor\'s hue replaces the status marks (§4.15.2.2)', async () => {
    await renderPage();
    const link = screen.getByRole('link', {
      name: ru['chats.card.aria']
        .replace('{name}', 'Алиса')
        .replace('{status}', ru['chats.status.active'])
    });
    const dot = link.querySelector('.dot');
    expect(dot).toBeTruthy();
    // state-agnostic: no per-state icon classes on the dot anymore
    expect(dot?.classList.contains('active')).toBe(false);
    expect(dot?.classList.contains('finished')).toBe(false);
    // the §4.12.2 treatment carries over: the dot wears the interlocutor's hue
    expect(dot?.classList.contains(codeHue('0xa'))).toBe(true);
    // the glyphs are gone from the card (no svg marks inside the dot)
    expect(dot?.querySelector('svg')).toBeNull();
    expect(link.querySelector('.status')).toBeNull();
    // the dot is decoration: the accessible name carries the status
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
  });

  it('color dot per Chat.done (§4.13.2): done → the SAME dot (state-agnostic), no override passed', async () => {
    // The AUTHORITATIVE signal flows straight from the polled payload —
    // the route passes no presentation override.
    fixture.chats = [{ ...chat('0xchat1', [ME, '0xa'], 5), done: true }];
    await renderPage();
    const link = screen.getByRole('link', {
      name: ru['chats.card.aria']
        .replace('{name}', 'Алиса')
        .replace('{status}', ru['chats.status.finished'])
    });
    const dot = link.querySelector('.dot');
    expect(dot).toBeTruthy();
    expect(dot?.classList.contains(codeHue('0xa'))).toBe(true);
  });

  it('color dot per Chat.done (§4.13.2): the SAME dot follows a poll flip (aria wording flips, the dot does not change shape)', async () => {
    await renderPage();
    const link = () => screen.getByRole('link', { name: /Диалог с Алиса/ });
    expect(link().querySelector('.dot')).toBeTruthy();
    const activeAria = ru['chats.card.aria']
      .replace('{name}', 'Алиса')
      .replace('{status}', ru['chats.status.active']);
    const finishedAria = ru['chats.card.aria']
      .replace('{name}', 'Алиса')
      .replace('{status}', ru['chats.status.finished']);
    expect(screen.getByRole('link', { name: activeAria })).toBeTruthy();
    // kickoff reset semantics server-side: done flips true → the aria
    // wording flips; the dot stays (state-agnostic marker)
    fixture.chats = [{ ...chat('0xchat1', [ME, '0xa'], 4), done: true }];
    await waitFor(
      () => expect(screen.getByRole('link', { name: finishedAria })).toBeTruthy(),
      { timeout: 6000 }
    );
    expect(link().querySelector('.dot')).toBeTruthy();
    // …and back (a kickoff reset the false field server-side)
    fixture.chats = [{ ...chat('0xchat1', [ME, '0xa'], 4), done: false }];
    await waitFor(
      () => expect(screen.getByRole('link', { name: activeAria })).toBeTruthy(),
      { timeout: 6000 }
    );
    expect(link().querySelector('.dot')).toBeTruthy();
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

  it('§4.12.2 neutral list role: the card drops the Deepa background; the INTERLOCUTOR\'S hue (fnv1a % 5) moves to the color dot and stays stable across polls', async () => {
    await renderPage();
    // the address-hash contract: fnv1a(counterpart address) % 5 → the hue
    expect(codeHue('0xa')).toBe(CODE_HUES[fnv1a('0xa') % CODE_HUES.length]);
    const link = screen.getByRole('link', { name: /Диалог с Алиса/ });
    // neutral LIST surface (§4.12.2 / Concept §11.1.2): no hue class on the
    // card itself — the Deepa background left with §4.11.5
    expect(link.className).not.toMatch(/deepa-[1-5]/);
    // the chat's message color lives on the color dot instead (§4.15.2.2)
    const dot = link.querySelector('.dot');
    expect(dot?.classList.contains(codeHue('0xa'))).toBe(true);
    // the avatar carries the color-coding like /people: plain PixelAvatar,
    // no extra hue wrapper around it
    expect(link.querySelectorAll('.deepa-1, .deepa-2, .deepa-3, .deepa-4, .deepa-5')).toHaveLength(1);
    // cross-visit determinism: a fresh poll (new snapshot) keeps the hue
    fixture.chats = [chat('0xchat1', [ME, '0xa'], 4)];
    await waitFor(() =>
      expect(
        screen
          .getByRole('link', { name: /Диалог с Алиса/ })
          .querySelector('.dot')
          ?.classList.contains(codeHue('0xa'))
      ).toBe(true)
    );
  });

  it('§4.12.2 + §4.15.2.2 CSS: neutral surface, no Deepa card background, the dot in the chat\'s hue, the old marks/rotated-dots loader gone, the circle loader kept', async () => {
    const cardCss = source('src/lib/components/chats/ChatCard.svelte');
    // neutral surface stays the card background; no Deepa hue is ever a
    // card background anymore (the LIST role amendment)
    expect(cardCss).toMatch(/\.chat-card\s*\{[^}]*background:\s*var\(--color-surface\)/);
    expect(cardCss).not.toMatch(/\.chat-card\.deepa-\d/);
    // the color dot takes the chat's message color: every Deepa hue maps
    // the dot to its token — and the danger red is gone
    for (let n = 1; n <= 5; n += 1) {
      expect(cardCss).toMatch(new RegExp(`\\.dot\\.deepa-${n}\\s*\\{[^}]*var\\(--color-deepa-${n}\\)`));
    }
    expect(cardCss).not.toMatch(/--color-danger/);
    // the OLD marks are gone: no .status span (line-anchored so the
    // i18n key `chats.status.*` never trips the check), no PixelIcon
    // glyph, no rotated-dots spin animation (chat-status-spin removed)
    expect(cardCss).not.toMatch(/^\s*\.status\b/m);
    expect(cardCss).not.toMatch(/PixelIcon/);
    expect(cardCss).not.toMatch(/chat-status-spin/);
    // the NEWER §4.13.4 circular loader stays untouched
    expect(cardCss).toMatch(/\.loader\s*\{[^}]*border-radius:\s*50%/);
    expect(cardCss).toMatch(/\.loader\s*\{[^}]*animation:\s*loader-spin/);
    expect(cardCss).toMatch(/@keyframes loader-spin\s*\{[^}]*rotate\(360deg\)/);
    // the dot itself is a small round element
    expect(cardCss).toMatch(/\.dot\s*\{[^}]*border-radius:\s*50%/);
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

describe('ChatCard — color dot per state (§4.15.2.2; the card directly, the route derives)', () => {
  const cardChat = chat('0xchat1', [ME, '0xa'], 5);
  const entry = { owner: ME, content: 'привет', from: '0xa', created_at: minutesAgo(2) };

  it('Chat.done drives the aria without an override (§4.13.2); the dot is STATE-AGNOSTIC (both states)', async () => {
    render(ChatCard, {
      props: {
        chat: { ...cardChat, done: true },
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    expect(document.querySelector('.dot')).toBeTruthy();
    const aria = ru['chats.card.aria']
      .replace('{name}', 'Алиса')
      .replace('{status}', ru['chats.status.finished']);
    expect(screen.getByRole('link', { name: aria })).toBeTruthy();
    cleanup();

    render(ChatCard, {
      props: {
        chat: { ...cardChat, done: false },
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    expect(document.querySelector('.dot')).toBeTruthy();
    const activeAria = ru['chats.card.aria']
      .replace('{name}', 'Алиса')
      .replace('{status}', ru['chats.status.active']);
    expect(screen.getByRole('link', { name: activeAria })).toBeTruthy();
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
    expect(document.querySelector('.dot')).toBeTruthy();
  });

  it('the dot carries the interlocutor\'s hue and no glyph; the old marks/rotated-dots loader are gone (§4.15.2.2)', async () => {
    render(ChatCard, {
      props: {
        chat: cardChat,
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry,
        status: 'active'
      }
    });
    const dot = document.querySelector('.dot');
    expect(dot?.classList.contains(codeHue('0xa'))).toBe(true);
    expect(dot?.querySelector('svg')).toBeNull();
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    // the §10.1.7-era rotated-dots loader (the animated glyph spin) left
    // with the marks: no .status element, no chat-status-spin keyframes
    expect(document.querySelector('.status')).toBeNull();
    const cardSource = readFileSync(
      join(WEB_ROOT, 'src/lib/components/chats/ChatCard.svelte'),
      'utf8'
    );
    expect(cardSource).not.toMatch(/chat-status-spin/);
    // the §4.13.4 circle spinner stays on the unfinished card
    expect(document.querySelector('.loader')).toBeTruthy();
    cleanup();

    render(ChatCard, {
      props: {
        chat: cardChat,
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry,
        status: 'finished'
      }
    });
    const finishedDot = document.querySelector('.dot');
    expect(finishedDot?.classList.contains(codeHue('0xa'))).toBe(true);
    expect(finishedDot?.querySelector('svg')).toBeNull();
    const aria = ru['chats.card.aria']
      .replace('{name}', 'Алиса')
      .replace('{status}', ru['chats.status.finished']);
    const link = screen.getByRole('link', { name: aria });
    expect(link.querySelector('.dot')).toBeTruthy();
    // the card itself stays neutral (no Deepa background class)
    expect(link.className).not.toMatch(/deepa-[1-5]/);
  });
});

describe('ChatCard — §4.13.4 unfinished treatment (Concept §13.1.4)', () => {
  const cardChat = chat('0xchat1', [ME, '0xa'], 5);
  const entry = { owner: ME, content: 'привет', from: '0xa', created_at: minutesAgo(2) };

  it('UNFINISHED (active) → the darker-with-opacity card class + the circular loader', () => {
    render(ChatCard, {
      props: {
        chat: { ...cardChat, done: false },
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    const link = document.querySelector('.chat-card');
    expect(link?.classList.contains('unfinished')).toBe(true);
    expect(link?.querySelector('.loader')).toBeTruthy();
    // the loader is decoration (the accessible name carries the status)
    expect(link?.querySelector('.loader')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('FINISHED → full emphasis: no unfinished class, no loader', () => {
    render(ChatCard, {
      props: {
        chat: { ...cardChat, done: true },
        counterpart: person('0xa', 'Алиса', 10),
        counterpartAddress: '0xa',
        lastMessage: entry
      }
    });
    const link = document.querySelector('.chat-card');
    expect(link?.classList.contains('unfinished')).toBe(false);
    expect(link?.querySelector('.loader')).toBeNull();
  });

  it('§4.13.4 CSS: the muted opacity treatment and the transform-only circular loader', () => {
    const cardCss = source('src/lib/components/chats/ChatCard.svelte');
    // darker with opacity (the owner's wording) on the unfinished card
    expect(cardCss).toMatch(/\.chat-card\.unfinished\s*\{[^}]*opacity:\s*0\.6/);
    // the standard spinning circle: a border ring, transform-only rotation
    expect(cardCss).toMatch(/\.loader\s*\{[^}]*border-radius:\s*50%/);
    expect(cardCss).toMatch(/\.loader\s*\{[^}]*animation:\s*loader-spin/);
    expect(cardCss).toMatch(/@keyframes loader-spin\s*\{[^}]*rotate\(360deg\)/);
    // no raw hex in the component (token discipline)
    expect(cardCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('/chats — §4.13.4 score-first sorting + score fetches (Concept §13.1.4)', () => {
  function finished(address: string, participants: string[], createdMinutesAgo: number): Chat {
    return { ...chat(address, participants, createdMinutesAgo), done: true };
  }

  function cardOrder(): string[] {
    return [...document.querySelectorAll('.chat-card')].map(
      (link) => link.getAttribute('href') ?? ''
    );
  }

  it('finished chats first by score DESCENDING; unfinished after, newest first', async () => {
    fixture.users = [
      person(ME, 'Я', 30),
      person('0xa', 'Алиса', 10),
      person('0xb', 'Борис', 9),
      person('0xc', 'Вера', 8),
      person('0xd', 'Гриша', 7)
    ];
    // scores arrive per finished pair: Алиса 40, Борис 90
    mockedApi.matchV2.mockImplementation(async (room: string, first: string, second: string) => ({
      points: second === '0xb' ? 90 : 40,
      exact_interest_matches: 0,
      shared_groups: 0,
      handshake: false,
      mutual_handshake: false
    }));
    fixture.chats = [
      chat('0xu1', [ME, '0xc'], 6), // unfinished, older
      finished('0xf1', [ME, '0xa'], 4), // score 40
      chat('0xu2', [ME, '0xd'], 2), // unfinished, newest
      finished('0xf2', [ME, '0xb'], 3) // score 90
    ];
    await renderPage();
    await waitFor(() => expect(mockedApi.matchV2).toHaveBeenCalled());
    await waitFor(() => expect(cardOrder()).toEqual(['/chats/0xf2', '/chats/0xf1', '/chats/0xu2', '/chats/0xu1']));
  });

  it('score fetches are bounded to FINISHED chats: me as first_user_address, unfinished never fetched', async () => {
    fixture.users = [person(ME, 'Я', 30), person('0xa', 'Алиса', 10), person('0xb', 'Борис', 9)];
    fixture.chats = [finished('0xf1', [ME, '0xa'], 4), chat('0xu1', [ME, '0xb'], 3)];
    await renderPage();
    await waitFor(() => expect(mockedApi.matchV2).toHaveBeenCalled());
    // the caller grades AS itself: first_user_address = me, its own Bearer
    expect(mockedApi.matchV2).toHaveBeenCalledWith(ROOM, ME, '0xa');
    // exactly one pair fetched — the unfinished dialog is never fetched
    expect(mockedApi.matchV2).toHaveBeenCalledTimes(1);
    expect(mockedApi.matchV2).not.toHaveBeenCalledWith(ROOM, ME, '0xb');
  });

  it('score fetches follow the poll cadence: a chat that flips to done enters the fetch set', async () => {
    fixture.users = [person(ME, 'Я', 30), person('0xa', 'Алиса', 10)];
    fixture.chats = [chat('0xu1', [ME, '0xa'], 5)];
    await renderPage();
    expect(mockedApi.matchV2).not.toHaveBeenCalled();
    // the farewell turn stamps done server-side → the next poll fetches it
    fixture.chats = [{ ...chat('0xu1', [ME, '0xa'], 4), done: true }];
    await waitFor(
      () => expect(mockedApi.matchV2).toHaveBeenCalledWith(ROOM, ME, '0xa'),
      { timeout: 6000 }
    );
  }, 20_000);

  it('a failing score fetch never crashes the page: the chat stays in place at the end of the finished group', async () => {
    fixture.users = [person(ME, 'Я', 30), person('0xa', 'Алиса', 10), person('0xb', 'Борис', 9)];
    mockedApi.matchV2.mockImplementation(
      async (room: string, first: string, second: string) =>
        second === '0xa'
          ? Promise.reject(new Error('score endpoint down'))
          : {
              points: 90,
              exact_interest_matches: 0,
              shared_groups: 0,
              handshake: false,
              mutual_handshake: false
            }
    );
    fixture.chats = [finished('0xf1', [ME, '0xa'], 4), finished('0xf2', [ME, '0xb'], 2)];
    await renderPage();
    await waitFor(() => expect(mockedApi.matchV2).toHaveBeenCalled());
    // no error banner, no crash — the failed chat simply renders unscored
    expect(screen.queryByRole('alert')).toBeNull();
    await waitFor(() => expect(cardOrder()).toEqual(['/chats/0xf2', '/chats/0xf1']));
  });

  it('a failing score fetch caches nothing: no error banner surfaces from the score round', async () => {
    fixture.users = [person(ME, 'Я', 30), person('0xa', 'Алиса', 10)];
    mockedApi.matchV2.mockImplementation(async () => {
      throw new Error('score endpoint down');
    });
    fixture.chats = [finished('0xf1', [ME, '0xa'], 4)];
    await renderPage();
    await waitFor(() => expect(mockedApi.matchV2).toHaveBeenCalled());
    expect(get(matchScores).get('0xf1')).toBeUndefined();
    expect(screen.queryByRole('alert')).toBeNull();
    // the card still renders (full emphasis — a finished chat)
    expect(document.querySelector('.chat-card.unfinished')).toBeNull();
  });
});
