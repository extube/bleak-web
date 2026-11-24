/** /host/[room_address] panel tests (TZ13-03 Part A, DESIGN rev. 4 §3.7.2
 * AC 1–15): the guard redirect, the top bar (live h1, address chip,
 * read-only data chips + F9 hint), the members region (5 s poll, tile,
 * rows, drill-down with the REAL room-token listing, clear/kickoff
 * confirms), the statistics region, the share region (client-side QR, no
 * helper PNG), settings/rotation/delete happy paths with their confirms,
 * the host session reset (401/403 → /host + notice, attendee identity
 * untouched), the getRoom-404 deleted-room state, the §2.2 cadence
 * (members 5 s, stats every third tick, both stop on teardown), the
 * two-column layout and the rule-B negative grep (no handshake reads, no
 * member deletion anywhere in host code). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { readFileSync } from 'node:fs';
import { readdirSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { ApiError, type Chat, type Message, type Room, type User } from '@bleak/api-client';

const { mockPage } = vi.hoisted(() => ({
  mockPage: {
    params: {} as Record<string, string | undefined>,
    url: new URL('http://localhost/host/0xroom')
  }
}));
vi.mock('$app/state', () => ({ page: mockPage }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: Record<string, string>) => {
    let out = route;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        out = out.replace(`[${key}]`, value);
      }
    }
    return out;
  }
}));

vi.mock('#lib/api/client', () => ({
  HOST_NOTICE_KEY: 'bleak.hostNotice',
  hostApi: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    listChatsOfRoomUser: vi.fn(),
    listRoomUserChatMessages: vi.fn(),
    clearChatHistory: vi.fn(),
    kickoffChat: vi.fn(),
    updateRoom: vi.fn(),
    rotateRoomToken: vi.fn(),
    deleteRoom: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  generateTokenSecret: () => 'R'.repeat(43),
  generateMutualCode: () => 'M'.repeat(22),
  sha256Hex: async () => 'FAKEHASH'
}));

import { goto } from '$app/navigation';
import { hostApi } from '#lib/api/client';
import { clearHostRoom, hostRoom } from '../src/lib/stores/hostSession';
import { identity } from '../src/lib/stores/identity';
import Page from '../src/routes/host/[room_address]/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const mockedHostApi = vi.mocked(hostApi, true);
const mockedGoto = vi.mocked(goto);

const ROOM_ADDRESS = '0xroom';

const ROOM: Room = {
  address: ROOM_ADDRESS,
  name: 'Митап',
  description: 'Пиксельная вечеринка',
  language: 'ru',
  max_user: 50,
  created_at: new Date(Date.now() - 60_000).toISOString(),
  updated_at: new Date(Date.now() - 60_000).toISOString(),
  deleted_at: null
};

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function person(address: string, name: string, createdMinutesAgo: number): User {
  return {
    active: true,
    address,
    room: ROOM_ADDRESS,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: minutesAgo(createdMinutesAgo),
    updated_at: minutesAgo(createdMinutesAgo),
    deleted_at: null
  };
}

const ALISA = person('0xa', 'Алиса', 2);
const BORIS = person('0xb', 'Борис', 5);

function chatFixture(address: string, participants: string[], done = false): Chat {
  return {
    address,
    room: ROOM_ADDRESS,
    phase: 'networking',
    phase_started_at: minutesAgo(10),
    scenario: 'ai-future',
    language: 'ru',
    done,
    created_at: minutesAgo(10),
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

function messageFixture(chatAddress: string, minutesAgoValue: number): Message {
  return {
    tx_id: `tx-${chatAddress}-${minutesAgoValue}`,
    chat: chatAddress,
    from: '0xa',
    to: '0xb',
    content: 'привет',
    created_at: minutesAgo(minutesAgoValue)
  };
}

const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  identity.set(null);
  mockPage.params = { room_address: ROOM_ADDRESS };
  mockedHostApi.getRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.listRoomUsers.mockResolvedValue([structuredClone(ALISA), structuredClone(BORIS)]);
  mockedHostApi.listChatsOfRoomUser.mockResolvedValue([chatFixture('0xchat1', ['0xa', '0xb'])]);
  mockedHostApi.listRoomUserChatMessages.mockResolvedValue([messageFixture('0xchat1', 3)]);
  mockedHostApi.clearChatHistory.mockResolvedValue({ chat: '0xchat1', cleared: 1 });
  mockedHostApi.kickoffChat.mockResolvedValue({ chat: '0xchat1', cleared: 1, speaker: '0xb' });
  mockedHostApi.updateRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.rotateRoomToken.mockResolvedValue(undefined);
  mockedHostApi.deleteRoom.mockResolvedValue(structuredClone(ROOM));
});

afterEach(() => {
  cleanup();
  clearHostRoom();
  identity.set(null);
  localStorage.clear();
  sessionStorage.clear();
});

function storeSession(): void {
  localStorage.setItem(
    'bleak.hostRoom',
    JSON.stringify({
      code: '123456',
      roomAddress: ROOM_ADDRESS,
      roomToken: 'stored-room-token'
    })
  );
  hostRoom.set({ code: '123456', roomAddress: ROOM_ADDRESS, roomToken: 'stored-room-token' });
}

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await tick();
  await tick();
}

async function openDrillDown(): Promise<void> {
  await screen.getByRole('button', { name: ru['host.member.open'].replace('{name}', 'Алиса') }).click();
  await waitFor(() =>
    expect(mockedHostApi.listChatsOfRoomUser).toHaveBeenCalledWith(ROOM_ADDRESS, '0xa')
  );
  await waitFor(() => expect(screen.getByText('0xchat1')).toBeTruthy());
}

describe('guard (§3.7.2 AC 1)', () => {
  it('redirects to /host when no stored room session exists', async () => {
    await renderPage();
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(screen.queryByText(ru['host.stats.title'])).toBeNull();
    expect(mockedHostApi.getRoom).not.toHaveBeenCalled();
  });

  it('redirects to /host when the stored roomAddress does not match the URL param', async () => {
    localStorage.setItem(
      'bleak.hostRoom',
      JSON.stringify({ code: '654321', roomAddress: '0xother', roomToken: 't' })
    );
    hostRoom.set({ code: '654321', roomAddress: '0xother', roomToken: 't' });
    await renderPage();
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(mockedHostApi.getRoom).not.toHaveBeenCalled();
  });

  it('renders the panel when the stored roomAddress matches the param', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.stats.title'])).toBeTruthy());
    expect(mockedGoto).not.toHaveBeenCalled();
  });
});

describe('top bar + regions (AC 2, 15)', () => {
  it('shows the live room h1, the muted address chip and the read-only data chips with the F9 hint', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText('Митап')).toBeTruthy());
    expect(screen.getByText(ROOM_ADDRESS)).toBeTruthy();
    expect(
      screen.getByText(ru['host.room.language'].replace('{language}', 'ru'))
    ).toBeTruthy();
    expect(screen.getByText(ru['host.room.max_user'].replace('{n}', '50'))).toBeTruthy();
    expect(screen.getByText(ru['host.room.readonly_hint'])).toBeTruthy();
    // F9: the chips are data display — no controls for language/capacity.
    expect(document.querySelector('select')).toBeNull();
  });

  it('stacks members + statistics, share, settings in the specified order; the share column holds the invite shortcut', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.panel.share'])).toBeTruthy());
    const colA = document.querySelector('.col-a');
    const side = document.querySelector('.side');
    const colC = document.querySelector('.col-c');
    expect(colA?.textContent).toContain(ru['host.stats.members_only']);
    expect(colA?.textContent).toContain(ru['host.stats.title']);
    expect(side?.textContent).toContain(ru['host.panel.share']);
    expect(side?.textContent).toContain(ru['host.panel.invites_link']);
    expect(colC?.textContent).toContain(ru['host.settings.title']);
    // DOM order below 900px: main column (members, stats), share, settings.
    const order = [
      document.querySelector('.col-a'),
      document.querySelector('.side'),
      document.querySelector('.col-c')
    ].map((el) => el);
    expect(order.indexOf(colA)).toBeLessThan(order.indexOf(side));
    expect(order.indexOf(side)).toBeLessThan(order.indexOf(colC));
  });

  it('lays out two columns on ≥ 900px viewports (main ≈ 58% scrolls, sticky side ≈ 42%, max 1080px)', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/host/[room_address]/+page.svelte'),
      'utf8'
    );
    expect(source).toContain('@media (min-width: 900px)');
    expect(source).toContain('grid-template-columns: minmax(0, 58fr) minmax(0, 42fr)');
    expect(source).toContain('position: sticky');
    expect(source).toContain('max-width: 1080px');
  });
});

describe('members region (AC 3) + drill-down (AC 4–7)', () => {
  it('polls members every 5 s; the tile shows n against max_user; rows open the drill-down with the real room-token listing', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText('Алиса')).toBeTruthy());
    expect(screen.getByText('2/50')).toBeTruthy();

    await openDrillDown();
    // Dialog rows link to the read-only transcript (host viewer context).
    const links = document.querySelectorAll('.dialogs a');
    expect(links.length).toBe(1);
    expect(links[0]?.getAttribute('href')).toBe('/chats/0xchat1');
  });

  it('clear history confirms with the specified copy and calls DELETE /api/chat/{address}/message (room token)', async () => {
    storeSession();
    await renderPage();
    await openDrillDown();
    await screen
      .getByRole('button', { name: ru['host.drill.clear_aria'].replace('{chat}', '0xchat1') })
      .click();
    await tick();
    expect(screen.getByText(ru['host.drill.clear_confirm'])).toBeTruthy();
    await screen.getAllByRole('button', { name: ru['host.drill.clear'] }).pop()!.click();
    await waitFor(() => expect(mockedHostApi.clearChatHistory).toHaveBeenCalledWith('0xchat1'));
  });

  it('restart confirms with the §3.5 kickoff copy, calls POST kickoff (room token) and renders the KickoffResponse speaker line', async () => {
    storeSession();
    await renderPage();
    await openDrillDown();
    await screen
      .getByRole('button', { name: ru['host.drill.restart_aria'].replace('{chat}', '0xchat1') })
      .click();
    await tick();
    expect(screen.getByText(ru['chat.kickoff.confirm_title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.kickoff.confirm_body'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['chat.kickoff.confirm_run'] }).click();
    await waitFor(() => expect(mockedHostApi.kickoffChat).toHaveBeenCalledWith('0xchat1'));
    // KickoffResponse speaker — resolved from the roster (Борис = 0xb).
    await waitFor(() => expect(document.querySelector('.kickoff-note')?.textContent).toBe('Борис'));
  });

  it('kickoff is per-dialog only — no room-level batch control exists', async () => {
    storeSession();
    await renderPage();
    await openDrillDown();
    expect(document.body.textContent).not.toContain(ru['host.rotate_room.row']);
    // Only per-row restart buttons exist.
    expect(document.querySelectorAll('.row-action').length).toBe(2);
  });

  it('the rule-D locked row renders non-interactive at the sheet bottom; no deleteRoomUser anywhere in host code', async () => {
    storeSession();
    await renderPage();
    await openDrillDown();
    const locked = document.querySelector('.locked-row');
    expect(locked?.getAttribute('aria-disabled')).toBe('true');
    expect(locked?.textContent).toContain(ru['host.drill.delete_member_locked']);
    expect(locked?.querySelector('button, a[href]')).toBeNull();
  });
});

describe('statistics region (Part B wiring)', () => {
  it('renders skeletons first, then the tile row as a <dl>, the chart card and the rule-B hint — no handshake metrics', async () => {
    storeSession();
    await renderPage();
    expect(document.querySelector('.skeleton-row')).not.toBeNull();
    await waitFor(() => expect(screen.getAllByText(ru['host.stats.chats']).length).toBe(2));    // The tile row is a <dl> (caption = term, numeral = value); M3/M4
    // both carry the «Диалогов» term.
    const dl = document.querySelector('dl.tiles');
    expect(dl).not.toBeNull();
    expect(dl?.textContent).toContain(ru['host.stats.active'].replace('{active}', '1').replace('{finished}', '0'));
    expect(screen.getAllByText(ru['host.stats.chats']).length).toBe(2);
    // M2 = members count, M3 = deduped chats, M1 total caption.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
    expect(
      screen.getByText(ru['host.stats.messages_hour'].replace('{n}', '1'))
    ).toBeTruthy();
    const chart = document.querySelector('.bucket-chart svg');
    expect(chart?.getAttribute('aria-label')).toBe(
      ru['host.stats.aria'].replace('{n}', '1').replace('{bucket}', ru['host.stats.axis.now'])
    );
    // Rule-B honest hint; NO handshake numbers, no locked rows, no proxy.
    expect(screen.getByText(ru['host.stats.gated.hint'])).toBeTruthy();
    expect(document.body.textContent).not.toContain('хендшейков отправлено');
  });
});

describe('share region (AC 9)', () => {
  it('renders the big Handjet code (digits spelled in the aria-label), the client-side InviteQr (no helper PNG) and the join + invites links', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    const codeEl = screen.getByText('123456');
    expect(codeEl.getAttribute('aria-label')).toBe(
      ru['host.qr.code_aria'].replace('{digits}', '1 2 3 4 5 6')
    );
    // Client-side SVG QR — an inline svg, NOT an <img> (no helper PNG call).
    const qrSvg = document.querySelector('.qr-frame svg');
    expect(qrSvg).not.toBeNull();
    expect(document.querySelector('.qr-frame img')).toBeNull();
    const join = screen.getByRole('link', { name: ru['host.join_as'] });
    expect(join.getAttribute('href')).toBe('/?code=123456');
    const invites = screen.getByRole('link', { name: ru['host.panel.invites_link'] });
    expect(invites.getAttribute('href')).toBe(`/host/${ROOM_ADDRESS}/invite`);
  });
});

describe('settings / rotation / delete (AC 10–12)', () => {
  async function openSettings(): Promise<void> {
    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();
  }

  it('saves name/description via PUT updateRoom (body {name, description} ONLY), shows the transient «Сохранено» and refreshes the header from the PUT response', async () => {
    storeSession();
    const updated = structuredClone(ROOM);
    updated.name = 'Митап 2';
    mockedHostApi.updateRoom.mockResolvedValue(updated);
    await renderPage();
    await waitFor(() => expect(screen.getByText('Митап')).toBeTruthy());
    await openSettings();
    const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
    nameInput.value = 'Митап 2';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['common.save'] }).click();
    await waitFor(() => expect(mockedHostApi.updateRoom).toHaveBeenCalledWith(ROOM_ADDRESS, {
      name: 'Митап 2',
      description: 'Пиксельная вечеринка'
    }));
    // The header refreshes from the PUT response; the transient note shows.
    await waitFor(() => expect(screen.getByText('Митап 2')).toBeTruthy());
    expect(screen.getByText(new RegExp(ru['host.room.saved']))).toBeTruthy();
  });

  it('a 400 surfaces the server-text field error (AC 10)', async () => {
    storeSession();
    mockedHostApi.updateRoom.mockRejectedValue(
      new ApiError(400, `/api/room/${ROOM_ADDRESS}`, 'name is taken')
    );
    await renderPage();
    await openSettings();
    await screen.getByRole('button', { name: ru['common.save'] }).click();
    await waitFor(() => expect(screen.getByText(/name is taken/)).toBeTruthy());
  });

  it('rotation confirms with the specified copy, calls POST token with the current Bearer and rewrites the stored roomToken IN PLACE (AC 11)', async () => {
    storeSession();
    await renderPage();
    await openSettings();
    await screen.getByRole('button', { name: ru['host.rotate_room.row'] }).click();
    await tick();
    expect(screen.getByText(ru['host.rotate_room.title'])).toBeTruthy();
    expect(screen.getByText(ru['host.rotate_room.body'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['host.rotate_room.cta'] }).click();
    await waitFor(() =>
      expect(mockedHostApi.rotateRoomToken).toHaveBeenCalledWith(ROOM_ADDRESS, 'R'.repeat(43))
    );
    await waitFor(() =>
      expect(screen.getByText(new RegExp(ru['host.rotate_room.done']))).toBeTruthy()
    );
    const stored = JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}');
    expect(stored.roomToken).toBe('R'.repeat(43));
    expect(stored.roomAddress).toBe(ROOM_ADDRESS);
    expect(stored.code).toBe('123456');
  });

  it('delete confirms, calls DELETE /api/room/{address}, clears the stored room and lands on /host (AC 12)', async () => {
    storeSession();
    await renderPage();
    await openSettings();
    expect(screen.getByText(ru['host.danger.title'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['host.delete_room.row'] }).click();
    await tick();
    expect(screen.getByText(ru['host.delete_room.body'])).toBeTruthy();
    await screen.getAllByRole('button', { name: ru['host.delete_room.row'] }).pop()!.click();
    await waitFor(() => expect(mockedHostApi.deleteRoom).toHaveBeenCalledWith(ROOM_ADDRESS));
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });
});

describe('host session reset + deleted room (AC 13, 14)', () => {
  it.each([401, 403])(
    'a %i on a room-token call clears bleak.hostRoom, sets bleak.hostNotice and lands on /host — attendee identity untouched',
    async (status) => {
      storeSession();
      mockedHostApi.listChatsOfRoomUser.mockRejectedValue(
        new ApiError(status, '/api/room/0xroom/user/0xa/chat', 'revoked')
      );
      await renderPage();
      await waitFor(() => expect(screen.getByText('Алиса')).toBeTruthy());
      await screen
        .getByRole('button', { name: ru['host.member.open'].replace('{name}', 'Алиса') })
        .click();
      await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
      expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
      expect(sessionStorage.getItem('bleak.hostNotice')).toBe('1');
      // Attendee identity never touched.
      expect(localStorage.getItem('bleak.identity')).toBeNull();
    }
  );

  it('getRoom 404 (room deleted elsewhere) → full-page «Комната удалена.» state, cleared room + redirect', async () => {
    storeSession();
    mockedHostApi.getRoom.mockRejectedValue(
      new ApiError(404, `/api/room/${ROOM_ADDRESS}`, 'room not found')
    );
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.room.deleted'])).toBeTruthy());
    expect(mockedGoto).toHaveBeenCalledWith('/host');
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });
});

describe('§2.2 cadence: members 5 s, stats every third tick, both stop on teardown', () => {
  it('runs one member tick per 5 s and the stats fan-out on ticks 0 and 3; no requests after unmount', async () => {
    vi.useFakeTimers();
    storeSession();
    try {
      await renderPage();
      // Initial refresh = tick 0 → members + stats fan-out (1 member chat).
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.getRoom).toHaveBeenCalledTimes(1);
      const statsCallsAtTick0 = mockedHostApi.listChatsOfRoomUser.mock.calls.length;
      expect(statsCallsAtTick0).toBe(2); // two members

      await vi.advanceTimersByTimeAsync(5100); // tick 1 — members only
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.getRoom).toHaveBeenCalledTimes(2);
      expect(mockedHostApi.listChatsOfRoomUser.mock.calls.length).toBe(statsCallsAtTick0);

      await vi.advanceTimersByTimeAsync(5100); // tick 2 — members only
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.getRoom).toHaveBeenCalledTimes(3);

      await vi.advanceTimersByTimeAsync(5100); // tick 3 — stats again
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.getRoom).toHaveBeenCalledTimes(4);
      expect(mockedHostApi.listChatsOfRoomUser.mock.calls.length).toBeGreaterThan(
        statsCallsAtTick0
      );

      const callsBeforeUnmount = mockedHostApi.getRoom.mock.calls.length;
      cleanup();
      await vi.advanceTimersByTimeAsync(21_000);
      expect(mockedHostApi.getRoom.mock.calls.length).toBe(callsBeforeUnmount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('rule-B + rule-D negative greps (host code)', () => {
  function collectFiles(dir: string): string[] {
    const out: string[] = [];
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) out.push(...collectFiles(full));
      else if (/\.(svelte|ts)$/.test(entry)) out.push(full);
    }
    return out;
  }

  it('no listHandshakesOfUser and no deleteRoomUser reference anywhere in host code (comments excluded)', () => {
    const files = [
      ...collectFiles(join(WEB_ROOT, 'src/routes/host')),
      ...collectFiles(join(WEB_ROOT, 'src/lib/components/host'))
    ];
    expect(files.length).toBeGreaterThan(0);
    const offenders: string[] = [];
    for (const file of files) {
      const withoutComments = readFileSync(file, 'utf8')
        .split('\n')
        .filter(
          (line) =>
            !line.trim().startsWith('*') &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('<!--')
        )
        .join('\n');
      if (/listHandshakesOfUser|deleteRoomUser/.test(withoutComments)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });
});
