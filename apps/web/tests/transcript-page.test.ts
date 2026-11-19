/** /chats/[address] transcript page tests — LEAN suite (2026-11-17 slimming
 * pass, owner directive): one block per distinct behavior, micro/scroll
 * asserts removed (recorded in docs/verification-v2.md). Covers: oldest-first
 * render + header (public bio replaces theme chips), 2 s live poll, network
 * banner + recovery, poller teardown, warming row, 404 state, the §4.13.3
 * contact-share slide (isChatDone gate, 201/409 shared state, no-card
 * disabled state, inline error), the permanent NO-COMPOSER check (owner
 * ruling 4; the kickoff button left the dialog view — Concept §8.1.9), the
 * v2.2 polish (hh:mm times, date label, no kickoff, public info header),
 * and the viewer fallback (room-token retry, host-401 gate replication,
 * no-token 401). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, NetworkError, type Chat, type Message, type Summary, type User } from '@bleak/api-client';

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

const apiRawMock = vi.hoisted(() => ({
  getChat: vi.fn(),
  listChatMessages: vi.fn()
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getChat: vi.fn(),
    listChatMessages: vi.fn(),
    listRoomUsers: vi.fn(),
    shareContact: vi.fn(),
    hardMatch: vi.fn()
  },
  apiRaw: apiRawMock,
  HOST_RESET_KEY: 'bleak.hostReset'
}));

import { goto } from '$app/navigation';
import { api, apiRaw } from '#lib/api/client';
import { saveHostRoom, clearHostRoom } from '#lib/stores/hostSession';
import { identity } from '#lib/stores/identity';
import { codeHue } from '../src/lib/avatar/traits';
import { ringScoreOffset } from '../src/lib/chats/summary';
import Page from '../src/routes/chats/[address]/+page.svelte';
import { ru } from '../src/lib/i18n/ru';
import { en } from '../src/lib/i18n/en';

const ME = '0xme';
const ROOM = '0xroom';
const CHAT = '0xchat1';
const mockedApi = vi.mocked(api, true);
const mockedApiRaw = vi.mocked(apiRaw, true);

const fixture = {
  chat: null as Chat | null,
  users: [] as User[],
  messages: [] as Message[]
};

function secondsAgo(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

function person(address: string, name: string): User {
  return {
    address,
    room: ROOM,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: secondsAgo(600),
    updated_at: secondsAgo(600),
    deleted_at: null
  };
}

function baseChat(): Chat {
  return {
    address: CHAT,
    room: ROOM,
    phase: 'networking',
    phase_started_at: secondsAgo(300),
    scenario: 'ai-future',
    language: 'ru',
    created_at: secondsAgo(300),
    participants: [
      { chat: CHAT, user: ME },
      { chat: CHAT, user: '0xa' }
    ]
  };
}

function message(txId: string, from: string, content: string, seconds: number): Message {
  return {
    tx_id: txId,
    chat: CHAT,
    from,
    to: from === ME ? '0xa' : ME,
    content,
    created_at: secondsAgo(seconds)
  };
}

/** A hard-match Summary fixture (§4.13.5): 5 checkpoints, given score. */
function summaryFixture(score: number): Summary {
  return {
    chat: CHAT,
    checkpoints: [
      { key: 'introductions', label: 'Both introduced themselves', closed: true },
      { key: 'goals', label: 'Goals were exchanged', closed: true },
      { key: 'details', label: 'Project details were discussed', closed: false },
      { key: 'next_step', label: 'A next step was agreed', closed: false },
      { key: 'contact', label: 'Contact details were exchanged', closed: false }
    ],
    created_at: secondsAgo(30),
    description: 'You discussed ceramics and agreed to exchange contacts.',
    room: ROOM,
    score,
    user_a: ME,
    user_b: '0xa'
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
  fixture.messages = [];
  mockedApi.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApi.listRoomUsers.mockImplementation(async () => structuredClone(fixture.users));
  mockedApi.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApiRaw.getChat.mockImplementation(async () => structuredClone(fixture.chat ?? baseChat()));
  mockedApiRaw.listChatMessages.mockImplementation(async () => structuredClone(fixture.messages));
  mockedApi.hardMatch.mockResolvedValue({ summary: summaryFixture(66), created: true });
});

afterEach(() => {
  cleanup();
  clearHostRoom();
  identity.set(null);
  localStorage.clear();
  sessionStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.listChatMessages).toHaveBeenCalled());
  await tick();
  await tick();
}

function withMessages(...messages: Message[]): void {
  fixture.messages = messages;
}

describe('transcript rendering + live updates (§3.5 AC 1–4, 9, 12)', () => {
  it('renders oldest-first with mine/theirs alignment, speakers and the public-info header', async () => {
    fixture.users = [
      person(ME, 'Я'),
      { ...person('0xa', 'Алиса'), public_bio: 'Работаю с глиной' }
    ];
    withMessages(
      message('tx1', '0xa', 'Привет, я твой новый контакт.', 120),
      message('tx2', ME, 'Привет! Чем занимаешься?', 60),
      message('tx3', '0xa', 'Я работаю с глиной — делаю чашки и свистки.', 30)
    );
    await renderPage();
    const rows = document.querySelectorAll('ol.transcript > li');
    expect(rows).toHaveLength(3);
    expect(rows[0]?.getAttribute('aria-label')).toBe(
      `Алиса: ${'Привет, я твой новый контакт.'}`
    );
    expect(rows[0]?.classList.contains('mine')).toBe(false);
    expect(rows[1]?.classList.contains('mine')).toBe(true);
    expect(rows[0]?.textContent).toContain('Алиса');
    // header: counterpart name + the public info in place of theme chips
    expect(document.querySelector('h1')?.textContent).toBe('Алиса');
    expect(screen.getByText('Работаю с глиной')).toBeTruthy();
    expect(screen.queryByText('networking')).toBeNull();
    expect(screen.queryByText('ai-future')).toBeNull();
    // §4.10.5 color coding: THEIR bubbles carry the speaker's Deepa hue
    // (full opacity); OWN bubbles are muted — no deepa-* class at all.
    const bubbles = document.querySelectorAll('.bubble');
    expect(bubbles[0]?.classList.contains(codeHue('0xa'))).toBe(true);
    expect(bubbles[1]?.classList.contains('mine')).toBe(true);
    expect(bubbles[1]?.classList.contains(codeHue(ME))).toBe(false);
    expect(bubbles[1]?.className).not.toMatch(/deepa-[1-5]/);
    expect(bubbles[2]?.classList.contains(codeHue('0xa'))).toBe(true);
  });

  it('new messages appear within one 2 s poll tick without reload (AC 3)', async () => {
    await renderPage();
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(0);

    withMessages(message('tx1', '0xa', 'Агенты начали говорить.', 5));
    await screen.findByText('Агенты начали говорить.', undefined, { timeout: 4000 });
    expect(document.querySelectorAll('ol.transcript > li')).toHaveLength(1);
  });

  it('network failure shows the banner while keeping the last transcript; recovery auto-dismisses (AC 9)', async () => {
    withMessages(message('tx1', '0xa', 'Первое сообщение.', 60));
    let fail = false;
    mockedApi.listChatMessages.mockImplementation(async () => {
      if (fail) throw new NetworkError('/api/chat/x/message', new Error('offline'));
      return structuredClone(fixture.messages);
    });

    await renderPage();
    expect(screen.getByText('Первое сообщение.')).toBeTruthy();

    fail = true;
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 5000 });
    expect(screen.getByText('Первое сообщение.')).toBeTruthy();

    fail = false;
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('leaving the page stops the 2 s poller (AC 12)', async () => {
    vi.useFakeTimers();
    try {
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(10);
      const callsAtMount = mockedApi.listChatMessages.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      cleanup();
      await vi.advanceTimersByTimeAsync(10_000);
      expect(mockedApi.listChatMessages.mock.calls.length).toBe(callsAtMount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('v2.2 dialog polish (Concept §8.1.8/9/10, DESIGN §4.9.8/9/10)', () => {
  it('message times render as absolute 24-hour hh:mm (active locale), not relative', async () => {
    withMessages(message('tx1', '0xa', 'Первое сообщение.', 60));
    await renderPage();
    const time = document.querySelector('.time')?.textContent ?? '';
    expect(time).toMatch(/^\d{2}:\d{2}$/);
    expect(time).not.toContain('мин');
    const expected = new Intl.DateTimeFormat('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).format(new Date(fixture.messages[0]?.created_at ?? ''));
    expect(time).toBe(expected);
  });

  it('a locale day+month date label sits centered above the first message; none while warming up', async () => {
    await renderPage();
    expect(document.querySelector('.date-label')).toBeNull();

    withMessages(message('tx1', '0xa', 'Первое сообщение.', 60));
    await screen.findByText('Первое сообщение.', undefined, { timeout: 4000 });
    const label = document.querySelector('.date-label');
    expect(label).toBeTruthy();
    const expected = new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'long'
    }).format(new Date(fixture.messages[0]?.created_at ?? ''));
    expect(label?.textContent).toBe(expected);
  });

  it('the kickoff button and its confirm are GONE from the dialog view (§8.1.9)', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    await renderPage();
    expect(document.querySelector('.kickoff')).toBeNull();
    expect(screen.queryByText(ru['chat.kickoff.confirm_title'] ?? '')).toBeNull();
    // The retired keys are gone from BOTH dictionaries (RU/EN parity kept).
    expect(ru).not.toHaveProperty('chat.kickoff');
    expect(ru).not.toHaveProperty('chat.kickoff.speaker');
    expect(en).not.toHaveProperty('chat.kickoff');
    expect(en).not.toHaveProperty('chat.kickoff.speaker');
  });

  it('the header shows the counterpart public bio when present and nothing extra when absent', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    // No public bio (fixture default) → no extra header line.
    await renderPage();
    expect(document.querySelector('.public-bio')).toBeNull();

    cleanup();
    fixture.users = [person(ME, 'Я'), { ...person('0xa', 'Алиса'), public_bio: 'Глинодел' }];
    render(Page, { props: {} });
    await screen.findByText('Привет.', undefined, { timeout: 4000 });
    await tick();
    const bio = document.querySelector('.public-bio');
    expect(bio?.textContent).toBe('Глинодел');
  });
});

describe('dialog finished state (CONCEPT §13 R2, DESIGN §4.13.2 — Chat.done is authoritative)', () => {
  it('done → the subtle finished indicator beside the header name', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    await renderPage();
    const indicator = document.querySelector('.finished-indicator');
    expect(indicator).toBeTruthy();
    // reuses the list's status wording (existing keys — RU/EN parity kept)
    expect(indicator?.textContent).toContain(ru['chats.status.finished']);
    expect(indicator?.querySelector('svg')).toBeTruthy();
    // and it must not appear for an ACTIVE dialog (see next test)
  });

  it('done missing/false → NO finished indicator (the default dialog state)', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    await renderPage(); // fixture.chat = baseChat() carries no done field
    expect(document.querySelector('.finished-indicator')).toBeNull();

    cleanup();
    fixture.chat = { ...baseChat(), done: false };
    render(Page, { props: {} });
    await screen.findByText('Привет.', undefined, { timeout: 4000 });
    await tick();
    expect(document.querySelector('.finished-indicator')).toBeNull();
  });
});

describe('summary sheet (CONCEPT §13.1.5, DESIGN §4.13.5 — hard-match on finished open)', () => {
  it('opening a FINISHED chat fires the once-only hardMatch(room, me, counterpart) and opens the sheet; a poll tick never re-fires it', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    await renderPage();

    expect(mockedApi.hardMatch).toHaveBeenCalledTimes(1);
    expect(mockedApi.hardMatch).toHaveBeenCalledWith(ROOM, ME, '0xa');
    expect(document.querySelector('[role="dialog"]')).toBeTruthy();

    // one more poll tick (a new message arrives) — still exactly one call
    withMessages(
      message('tx1', '0xa', 'Прощальный ответ агентов.', 60),
      message('tx2', ME, 'Спасибо!', 5)
    );
    await screen.findByText('Спасибо!', undefined, { timeout: 4000 });
    expect(mockedApi.hardMatch).toHaveBeenCalledTimes(1);
  });

  it('an ACTIVE chat never triggers the hard match nor opens the sheet', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    await renderPage(); // baseChat() carries no done field
    expect(mockedApi.hardMatch).not.toHaveBeenCalled();
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it('the sheet renders the score ring from the Summary score and the checklist closed/open verbatim', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    mockedApi.hardMatch.mockResolvedValue({ summary: summaryFixture(66), created: true });
    await renderPage();
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });

    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toContain('Алиса'); // the interlocutor's name
    // ring (§4.15.C-5): the arc's dashoffset target is c × (1 − score/100)
    const arc = dialog?.querySelector('.ring .arc');
    expect(arc).toBeTruthy();
    const match = arc?.getAttribute('style')?.match(/--ring-target:\s*([\d.]+)/);
    expect(Number(match?.[1])).toBeCloseTo(ringScoreOffset(66), 6);
    // the tally lands exactly on the ceil integer (§4.14.4, rAF count-up)
    await waitFor(() =>
      expect(dialog?.querySelector('.ring .score')?.textContent).toBe('66')
    );
    // description as a muted paragraph + server-provided labels verbatim
    expect(dialog?.textContent).toContain('You discussed ceramics');
    expect(dialog?.textContent).toContain('Both introduced themselves');
    const items = dialog?.querySelectorAll('.checkpoint');
    expect(items).toHaveLength(5);
    // closed → the check glyph; open → muted, no glyph
    expect(items?.[0]?.classList.contains('closed')).toBe(true);
    expect(items?.[0]?.querySelector('svg')).toBeTruthy();
    expect(items?.[2]?.classList.contains('closed')).toBe(false);
    expect(items?.[2]?.querySelector('svg')).toBeNull();
    // §4.15.C-1: the sheet background is the owner-locked arcade scope —
    // the Deepa-hue pairing is superseded (Concept §15.4, recorded)
    expect(dialog?.classList.contains('arcade-sheet')).toBe(true);
    expect(dialog?.className).not.toMatch(/deepa-[1-5]/);
  });

  it('X close dismisses the sheet and the dialog renders normally afterwards', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    await renderPage();
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });

    await (document.querySelector('[role="dialog"] .close') as HTMLButtonElement).click();
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeNull());
    // the transcript + the footer slide are untouched underneath
    expect(screen.getByText('Прощальный ответ агентов.')).toBeTruthy();
    expect(document.querySelector('.slide')).toBeTruthy();
    expect(mockedApi.hardMatch).toHaveBeenCalledTimes(1);
  });

  it('§4.15.C-6 (the 80/50 re-cut): score >= 80 adds the celebration class; < 80 does not', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    mockedApi.hardMatch.mockResolvedValue({ summary: summaryFixture(90), created: true });
    await renderPage();
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });
    const sheet = document.querySelector('[role="dialog"]');
    expect(sheet?.classList.contains('celebrate')).toBe(true);
    expect(sheet?.querySelectorAll('.spark').length).toBeGreaterThan(0);

    cleanup();
    // GREAT is inclusive of 80 (owner revision, 2026-11-20)
    mockedApi.hardMatch.mockResolvedValue({ summary: summaryFixture(80), created: true });
    render(Page, { props: {} });
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });
    expect(document.querySelector('[role="dialog"]')?.classList.contains('celebrate')).toBe(true);

    cleanup();
    mockedApi.hardMatch.mockResolvedValue({ summary: summaryFixture(79), created: true });
    render(Page, { props: {} });
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });
    expect(document.querySelector('[role="dialog"]')?.classList.contains('celebrate')).toBe(false);
  });

  it('the share-contact slide is embedded in the sheet sharing to the counterpart', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    localStorage.setItem('bleak.contactCard', JSON.stringify({ '0xroom|0xme': 'telegram: @me' }));
    await renderPage();
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });

    const dialog = document.querySelector('[role="dialog"]');
    const sheetSlide = dialog?.querySelector('.slide');
    expect(sheetSlide).toBeTruthy();
    // the SHEET-variant hint is the sheet's own copy (§4.15.C-8/§4.15.E)
    expect(sheetSlide?.textContent).toContain(ru['chat.contact_share.sheet_label']);
    // completing the EMBEDDED slide fires the same share (to = counterpart)
    mockedApi.shareContact.mockResolvedValue({
      content: 'telegram: @me',
      created_at: new Date().toISOString(),
      from: ME,
      to: '0xa'
    });
    await (sheetSlide?.querySelector('.thumb') as HTMLButtonElement).click();
    await waitFor(() =>
      expect(mockedApi.shareContact).toHaveBeenCalledWith('0xa', 'telegram: @me', ME)
    );
  });

  it('a hardMatch failure surfaces inline with retry and never crashes the transcript', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    mockedApi.hardMatch.mockRejectedValue(new NetworkError('/api/hard-match', new Error('offline')));
    await renderPage();
    await screen.findByText(ru['common.error.network'], undefined, { timeout: 4000 });
    expect(document.querySelector('.ring')).toBeNull();
    // retry affordance re-issues the call; the transcript stays intact
    mockedApi.hardMatch.mockResolvedValue({ summary: summaryFixture(66), created: true });
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await screen.findByText(ru['chat.summary.checklist'], undefined, { timeout: 4000 });
    expect(screen.getByText('Прощальный ответ агентов.')).toBeTruthy();
  });
});

describe('v2.3 chat colors (Concept §9.1.5, DESIGN §4.10.5 — Deepa palette)', () => {
  it('their bubbles keep the full-opacity Deepa hue background; own bubbles are muted (no Deepa hue)', async () => {
    withMessages(
      message('tx1', '0xa', 'Привет, я твой новый контакт.', 60),
      message('tx2', ME, 'Привет! Чем занимаешься?', 30)
    );
    await renderPage();
    const bubbles = document.querySelectorAll('.bubble');
    // theirs: the speaker's Deepa hue (the class IS the hue name)
    expect(bubbles[0]?.classList.contains(codeHue('0xa'))).toBe(true);
    // mine: the muted neutral surface — never MY Deepa hue
    expect(bubbles[1]?.classList.contains('mine')).toBe(true);
    expect(bubbles[1]?.classList.contains(codeHue(ME))).toBe(false);
    expect(bubbles[1]?.className).not.toMatch(/deepa-[1-5]/);
  });
});

describe('states: 404, contact share (§3.5 AC 7, 8; §4.13.3)', () => {
  it('404 chat renders the not-found state with a working link back to /chats (AC 8)', async () => {
    mockedApi.getChat.mockRejectedValue(new ApiError(404, `/api/chat/${CHAT}`, 'chat not found'));
    render(Page, { props: {} });
    await screen.findByText(ru['chat.not_found'], undefined, { timeout: 4000 });
    await screen.getByRole('button', { name: ru['chat.back_to_list'] }).click();
    expect(goto).toHaveBeenCalledWith('/chats');
  });

  it('the dialog not finished → the slide is disabled with the locked hint (the isChatDone gate, tz5-03)', async () => {
    withMessages(message('tx1', '0xa', 'Привет.', 60));
    await renderPage(); // baseChat() carries no done field
    const slide = document.querySelector('.slide');
    expect(slide).toBeTruthy();
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    expect(slide?.textContent).toContain(ru['chat.contact_share.locked']);
    const thumb = slide?.querySelector('.thumb') as HTMLButtonElement | null;
    expect(thumb?.disabled).toBe(true);
    expect(mockedApi.shareContact).not.toHaveBeenCalled();
  });

  it('finished dialog + no local card → the slide stays disabled with the no-card hint', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    await renderPage();
    const slide = document.querySelector('.slide');
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    expect(slide?.textContent).toContain(ru['chat.contact_share.no_card']);
    expect((slide?.querySelector('.thumb') as HTMLButtonElement | null)?.disabled).toBe(true);
    expect(mockedApi.shareContact).not.toHaveBeenCalled();
  });

  it('finished dialog + a stored card → completing the slide shares it (to=counterpart, from=me) and lands the shared state (201)', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    localStorage.setItem(
      'bleak.contactCard',
      JSON.stringify({ '0xroom|0xme': 'telegram: @me' })
    );
    mockedApi.shareContact.mockResolvedValue({
      content: 'telegram: @me',
      created_at: new Date().toISOString(),
      from: ME,
      to: '0xa'
    });
    await renderPage();
    const slide = document.querySelector('.slide');
    expect(slide?.getAttribute('aria-disabled')).toBe('false');
    expect(slide?.textContent).toContain(ru['chat.contact_share.label']);
    await (slide?.querySelector('.thumb') as HTMLButtonElement).click();
    await waitFor(() =>
      expect(mockedApi.shareContact).toHaveBeenCalledWith('0xa', 'telegram: @me', ME)
    );
    // The 201 lands the shared state + the local pair mark.
    await waitFor(() =>
      expect(document.querySelector('.slide')?.textContent).toContain(
        ru['chat.contact_share.shared']
      )
    );
    expect(document.querySelector('.slide')?.querySelector('svg')).toBeTruthy(); // done glyph
    // §4.14.1: the shared TRANSITION plays the confetti from the top of the
    // slide — 12 CSS-only Deepa flakes
    const confetti = document.querySelector('.slide')?.querySelector('.confetti');
    expect(confetti).toBeTruthy();
    expect(confetti?.querySelectorAll('.flake')).toHaveLength(12);
    expect(
      JSON.parse(localStorage.getItem('bleak.contactShared') ?? '{}')
    ).toMatchObject({ '0xroom|0xme': { '0xa': expect.any(String) } });
  });

  it('a repeated share answers 409 — the shared state, NEVER an error (once per pair)', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    localStorage.setItem(
      'bleak.contactCard',
      JSON.stringify({ '0xroom|0xme': 'telegram: @me' })
    );
    mockedApi.shareContact.mockRejectedValue(
      new ApiError(409, '/api/contact', 'contact already shared')
    );
    await renderPage();
    await (document.querySelector('.slide')?.querySelector('.thumb') as HTMLButtonElement).click();
    await waitFor(() =>
      expect(mockedApi.shareContact).toHaveBeenCalledWith('0xa', 'telegram: @me', ME)
    );
    await waitFor(() =>
      expect(document.querySelector('.slide')?.textContent).toContain(
        ru['chat.contact_share.shared']
      )
    );
    expect(screen.queryByRole('alert')).toBeNull(); // 409 is not an error
    // §4.14.1: 409 lands the shared state too — the confetti plays on it as
    // well (the server's answer is the success moment)
    expect(document.querySelector('.slide')?.querySelector('.confetti')).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem('bleak.contactShared') ?? '{}')
    ).toMatchObject({ '0xroom|0xme': { '0xa': expect.any(String) } });
  });

  it('a locally marked pair renders the shared state WITHOUT any share call', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    localStorage.setItem(
      'bleak.contactCard',
      JSON.stringify({ '0xroom|0xme': 'telegram: @me' })
    );
    localStorage.setItem(
      'bleak.contactShared',
      JSON.stringify({ '0xroom|0xme': { '0xa': '2026-11-19T10:00:00.000Z' } })
    );
    await renderPage();
    expect(document.querySelector('.slide')?.textContent).toContain(
      ru['chat.contact_share.shared']
    );
    expect(mockedApi.shareContact).not.toHaveBeenCalled();
    // §4.14.1: an already-shared hydration does NOT replay the confetti —
    // it celebrates only a completion gesture followed by the shared state
    expect(document.querySelector('.slide')?.querySelector('.confetti')).toBeNull();
  });

  it('a failed share (400) surfaces inline; the control stays armed', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    localStorage.setItem(
      'bleak.contactCard',
      JSON.stringify({ '0xroom|0xme': 'telegram: @me' })
    );
    mockedApi.shareContact.mockRejectedValue(
      new ApiError(400, '/api/contact', 'content must be 1..255 symbols')
    );
    await renderPage();
    await (document.querySelector('.slide')?.querySelector('.thumb') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.getByRole('alert')?.textContent).toContain('content must be 1..255 symbols');
    // The control stays armed — the pair was NOT marked shared.
    expect(localStorage.getItem('bleak.contactShared')).toBeNull();
    expect(
      (document.querySelector('.slide')?.querySelector('.thumb') as HTMLButtonElement).disabled
    ).toBe(false);
    // §4.14.1: a failed share is never celebrated — no confetti, and the
    // candy-cane stripes return with the armed state
    expect(document.querySelector('.slide')?.querySelector('.confetti')).toBeNull();
    expect(document.querySelector('.slide')?.querySelector('.candy')).toBeTruthy();
  });
});

describe('NO-COMPOSER (owner ruling 4, permanent — §3.5 AC 13)', () => {
  it('the transcript UI contains no input/textarea/send control; outside the §4.13.5 sheet the only buttons are the back control and the share thumb', async () => {
    withMessages(message('tx1', '0xa', 'Прощальный ответ агентов.', 60));
    fixture.chat = { ...baseChat(), done: true };
    await renderPage();

    const root = document.querySelector('.page');
    expect(root).toBeTruthy();
    // no composer of any kind, in any state (the contact slide is NOT one)
    expect(root?.querySelector('input, textarea, [contenteditable="true"]')).toBeNull();
    expect(root?.querySelector('form')).toBeNull();
    // The summary sheet is a dialog overlay, not a composer — its own
    // controls (X close, its embedded slide thumb) sit INSIDE it and are
    // excluded from the page-level count.
    const dialog = document.querySelector('[role="dialog"]');
    const buttons = Array.from(root?.querySelectorAll('button') ?? []).filter(
      (button) => !(dialog && dialog.contains(button))
    );
    const thumb = document.querySelector('.thumb');
    const labels = buttons.map(
      (button) =>
        button.textContent?.trim() || button.getAttribute('aria-label') || ''
    );
    expect(labels).toContain(ru['common.back']);
    // every button is the back control or the share slide thumb
    expect(buttons.filter((button) => button !== thumb)).toHaveLength(1);
    // POST /api/message is not wired: the api mock exposes no sendMessage usage
    expect(mockedApi).not.toHaveProperty('sendMessage');
  });
});

describe('transcript viewer fallback (§3.5 AC 14, ARCHITECTURE §10.3)', () => {
  function storeHostSession(): void {
    saveHostRoom({
      code: '123456',
      roomAddress: ROOM,
      roomToken: 'r-tok'
    });
  }

  it('persona read 403 + a stored room token → room-token retries via apiRaw; host-view persists for the session', async () => {
    storeHostSession();
    mockedApi.getChat.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}`, 'not a participant')
    );
    mockedApi.listChatMessages.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}/message`, 'not a participant')
    );

    await renderPage();

    await waitFor(() => expect(mockedApiRaw.getChat).toHaveBeenCalled());
    await waitFor(() => expect(mockedApiRaw.listChatMessages).toHaveBeenCalled());
    // Every retry carries the stored room token (never a second persona flavor).
    for (const call of mockedApiRaw.getChat.mock.calls) {
      expect(call[1]).toEqual({ token: 'r-tok' });
    }
    expect(screen.getByText(ru['chat.host_view'])).toBeTruthy();
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toMatchObject({
      userAddress: ME
    });

    // A later poll tick: no new persona attempt, room token used directly.
    const callsAfterFirstTick = mockedApiRaw.listChatMessages.mock.calls.length;
    withMessages(message('tx1', '0xa', 'Наблюдаем.', 5));
    await screen.findByText('Наблюдаем.', undefined, { timeout: 4000 });
    const laterCall =
      mockedApiRaw.listChatMessages.mock.calls[
        mockedApiRaw.listChatMessages.mock.calls.length - 1
      ];
    expect(mockedApiRaw.listChatMessages.mock.calls.length).toBeGreaterThan(callsAfterFirstTick);
    expect(laterCall?.[1]).toEqual({ token: 'r-tok' });
  });

  it('a host-context 401 on the retry replicates the hostApi gate: host room cleared + hostReset flag, identity untouched', async () => {
    storeHostSession();
    mockedApi.getChat.mockRejectedValue(
      new ApiError(403, `/api/chat/${CHAT}`, 'not a participant')
    );
    mockedApiRaw.getChat.mockRejectedValue(
      new ApiError(401, `/api/chat/${CHAT}`, 'room token revoked')
    );

    render(Page, { props: {} });

    await waitFor(() =>
      expect(sessionStorage.getItem('bleak.hostReset')).toBe('1')
    );
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toMatchObject({
      userAddress: ME
    });
    expect(goto).not.toHaveBeenCalled();
  });

  it('without a stored room token a 401 renders NO transcript error UI (the §2.8 global gate owns it — AC 15)', async () => {
    mockedApi.getChat.mockRejectedValue(new ApiError(401, `/api/chat/${CHAT}`, 'no token'));
    mockedApi.listChatMessages.mockRejectedValue(
      new ApiError(401, `/api/chat/${CHAT}/message`, 'no token')
    );

    render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getChat).toHaveBeenCalled());
    await tick();
    await tick();
    expect(screen.queryByText(ru['common.error.network'])).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    // The fallback never engaged (no room token to retry with).
    expect(mockedApiRaw.getChat).not.toHaveBeenCalled();
    expect(screen.queryByText(ru['chat.host_view'])).toBeNull();
  });
});
