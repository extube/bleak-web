/** /host console tests (TZ-09, DESIGN §3.7): token gate (masked, persisted,
 * rejected-token state), create-room flow via the helper, share kit
 * (code + QR + invite link, restored from bleak.hostRoom), live room view
 * (5 s poller, teardown, empty state), on-demand member drill-down (never
 * polled), room settings + danger-zone delete, getRoom-404 → deleted state. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, type Chat, type Handshake, type Room, type User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? `/chats/${params.address}` : route
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn()
  },
  hostApi: {
    createRoomWithInvite: vi.fn(),
    updateRoom: vi.fn(),
    deleteRoom: vi.fn(),
    listHandshakesOfUser: vi.fn(),
    listChatsOfRoomUser: vi.fn()
  }
}));

import { api, hostApi } from '#lib/api/client';
import Page from '../src/routes/host/+page.svelte';
import { handshakeCounts, parseHelperErrorText, spelledDigits } from '../src/lib/components/host/hostLogic';
import { ru } from '../src/lib/i18n/ru';

const mockedApi = vi.mocked(api, true);
const mockedHostApi = vi.mocked(hostApi, true);
const mockedCreate = mockedHostApi.createRoomWithInvite;

const ROOM: Room = {
  address: '0xroom',
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

function person(address: string, name: string, createdMinutesAgo: number, bio = ''): User {
  return {
    address,
    room: ROOM.address,
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
    room: ROOM.address,
    status: 1,
    value: 1,
    created_at: minutesAgo(minutesAgoValue)
  };
}

function chat(address: string, participants: string[], createdMinutesAgo: number): Chat {
  return {
    address,
    room: ROOM.address,
    phase: 'networking',
    phase_started_at: minutesAgo(createdMinutesAgo),
    scenario: 'ai-future',
    language: 'ru',
    created_at: minutesAgo(createdMinutesAgo),
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

const PAYLOAD = {
  room: ROOM,
  code: '123456'
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  localStorage.removeItem('bleak.hostToken');
  localStorage.removeItem('bleak.hostRoom');
  mockedApi.getRoom.mockResolvedValue(structuredClone(ROOM));
  mockedApi.listRoomUsers.mockResolvedValue([]);
  mockedHostApi.updateRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.deleteRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.listHandshakesOfUser.mockResolvedValue([]);
  mockedHostApi.listChatsOfRoomUser.mockResolvedValue([]);
  mockedCreate.mockResolvedValue(structuredClone(PAYLOAD));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await tick();
  await tick();
}

/** Put a full host session into storage so the page boots into share mode. */
function storeSession(): void {
  localStorage.setItem('bleak.hostToken', 'good-token');
  localStorage.setItem(
    'bleak.hostRoom',
    JSON.stringify({
      code: '123456',
      roomAddress: ROOM.address,
      roomToken: 'stored-room-token',
      roomName: ROOM.name,
      inviteUrl: '/?code=123456'
    })
  );
}

async function submitToken(value: string): Promise<void> {
  const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await screen.getByRole('button', { name: ru['host.token.continue'] }).click();
  await tick();
  await tick();
}

describe('pure helpers (hostLogic)', () => {
  it('handshakeCounts splits sent/received strictly by from_address direction', () => {
    const member = '0xa';
    const list = [
      handshake(member, '0xb', 1),
      handshake('0xb', member, 2),
      handshake('0xc', '0xd', 3), // unrelated pair
      handshake(member, '0xd', 4)
    ];
    expect(handshakeCounts(list, member)).toEqual({ sent: 2, received: 1 });
    expect(handshakeCounts([], member)).toEqual({ sent: 0, received: 0 });
  });

  it('parseHelperErrorText extracts the JSON error message, passes plain text', () => {
    expect(parseHelperErrorText('{"error":"name is required"}')).toBe('name is required');
    expect(parseHelperErrorText('plain text body')).toBe('plain text body');
    expect(parseHelperErrorText('{"other":1}')).toBe('{"other":1}');
  });

  it('spelledDigits spaces the code for the screen-reader aria-label', () => {
    expect(spelledDigits('123456')).toBe('1 2 3 4 5 6');
  });
});

describe('token gate (AC 1, AC 9)', () => {
  it('shows the masked gate without a stored token; entry persists bleak.hostToken and the gate does not reappear', async () => {
    await renderPage();
    const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(screen.getByText(ru['host.token.note'])).toBeTruthy();

    await submitToken('good-token');

    expect(localStorage.getItem('bleak.hostToken')).toBe('good-token');
    // Gate gone: the create form is the visible surface now.
    expect(screen.queryByLabelText(ru['host.gate.label'])).toBeNull();
    expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy();
  });

  it('a rejected token returns to the gate with «Токен отклонён.» under the field, value kept masked', async () => {
    mockedCreate.mockRejectedValue(
      new ApiError(403, '/api/room', '{"error":"host token required to create rooms"}')
    );
    await renderPage();
    await submitToken('wrong-token');
    // Fill the required name so the submit reaches the helper (403).
    const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
    nameInput.value = 'Митап';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    // Form appears, create fails on 403 → back to the gate with the error.
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText(/Токен отклонён/)).toBeTruthy());

    const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('wrong-token');
    expect(screen.getByText(/Токен отклонён/)).toBeTruthy();
    expect(screen.getByText(/host token required/)).toBeTruthy();
  });

  it('forget token clears bleak.hostToken and re-shows the gate', async () => {
    await renderPage();
    await submitToken('good-token');
    await screen.getByRole('button', { name: ru['host.token.forget'] }).click();
    expect(localStorage.getItem('bleak.hostToken')).toBeNull();
    expect(screen.getByLabelText(ru['host.gate.label'])).toBeTruthy();
  });
});

describe('create room + share kit (AC 2, AC 3, AC 4, AC 5)', () => {
  it('empty name is prevented client-side (helper not called)', async () => {
    await renderPage();
    await submitToken('good-token');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await tick();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
  });

  it('creates via the v2 client (room token generated client-side, creation token header) and shows the share kit', async () => {
    await renderPage();
    await submitToken('good-token');

    const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
    nameInput.value = 'Митап';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['host.create'] }).click();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const requestBody = mockedCreate.mock.calls[0]?.[0];
    expect(requestBody).toEqual({ name: 'Митап', language: 'ru', token: expect.any(String) });
    // The room token is client-generated (32 random bytes → 43 base64url chars).
    expect((requestBody as { token: string }).token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(mockedCreate.mock.calls[0]?.[1]).toBe('good-token');

    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    // Persisted for the revisit restore — including the generated room token.
    const stored = JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}');
    expect(stored).toMatchObject({
      code: '123456',
      roomAddress: ROOM.address
    });
    expect(stored.roomToken).toBe((requestBody as { token: string }).token);
    // Invite link computed client-side from the code (§10.9; $app/paths mocked → '/').
    expect(screen.getByText('/?code=123456')).toBeTruthy();
    // QR <img> from the stateless helper URL builder.
    const img = document.querySelector('.qr-frame img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe(ru['host.qr.alt']);
    expect(img.getAttribute('src')).toBe('/h/rooms/123456/qr');
    // Live view starts polling the created room.
    await waitFor(() => expect(mockedApi.getRoom).toHaveBeenCalledWith(ROOM.address));
  });

  it('create 400/409 surfaces the server text under the form', async () => {
    mockedCreate.mockRejectedValue(new ApiError(400, '/api/room', '{"error":"duplicate name"}'));
    await renderPage();
    await submitToken('good-token');
    const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
    nameInput.value = 'Митап';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText('duplicate name')).toBeTruthy());
  });

  it('revisit restores the share kit from bleak.hostRoom without re-creating (AC 4)', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: ru['host.join_attendee'] }).getAttribute('href')).toBe(
      '/?code=123456'
    );
    // «Создать другую комнату» returns to the form.
    await screen.getByRole('button', { name: ru['host.create_another'] }).click();
    await tick();
    expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy();
  });
});

describe('live room view (AC 6, AC 10)', () => {
  it('renders member rows and the members tile against max_user', async () => {
    storeSession();
    mockedApi.listRoomUsers.mockResolvedValue([person('0xa', 'Алиса', 2), person('0xb', 'Борис', 5)]);
    await renderPage();
    await waitFor(() => expect(mockedApi.getRoom).toHaveBeenCalledWith(ROOM.address));
    await screen.findByText('Алиса');
    await screen.findByText('Борис');
    expect(document.body.textContent).toContain('2/50');
    expect(screen.getByText(ru['host.stats.language_only'])).toBeTruthy();
  });

  it('runs the 5 s cadence while mounted and stops the poller on unmount — no requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      storeSession();
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      const callsAtMount = mockedApi.getRoom.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      // one full 5 s tick: the poll runs again without user action (AC 6)
      await vi.advanceTimersByTimeAsync(5100);
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedApi.getRoom.mock.calls.length).toBeGreaterThan(callsAtMount);

      const callsBeforeUnmount = mockedApi.getRoom.mock.calls.length;
      cleanup();
      await vi.advanceTimersByTimeAsync(21_000);
      expect(mockedApi.getRoom.mock.calls.length).toBe(callsBeforeUnmount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('empty room shows «Пока никто не присоединился.» (AC 10)', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.empty_live'])).toBeTruthy());
  });

  it('getRoom 404 (deleted elsewhere) → «Комната удалена.» + reset to the create form (AC 12)', async () => {
    mockedApi.getRoom.mockRejectedValue(new ApiError(404, '/api/room/0xroom', 'room not found'));
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.room_deleted'])).toBeTruthy());
    await screen.getByRole('button', { name: ru['host.create_another'] }).click();
    await tick();
    expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });
});

describe('member drill-down (AC 7 — on demand, never polled)', () => {
  it('shows sent/received counts and dialogs, fetched once on open; dialog rows link to /chats/{address}', async () => {
    storeSession();
    mockedApi.listRoomUsers.mockResolvedValue([person('0xa', 'Алиса', 2, 'Поттер')]);
    mockedHostApi.listHandshakesOfUser.mockResolvedValue([
      handshake('0xa', '0xb', 3),
      handshake('0xb', '0xa', 4),
      handshake('0xc', '0xd', 5)
    ]);
    mockedHostApi.listChatsOfRoomUser.mockResolvedValue([chat('0xchat1', ['0xa', '0xb'], 6)]);

    await renderPage();
    await screen.findByText('Алиса');

    await screen.getByRole('button', { name: 'Алиса — открыть карточку' }).click();

    await waitFor(() => expect(screen.getByText('Отправлено хендшейков: 1')).toBeTruthy());
    expect(screen.getByText('Получено хендшейков: 1')).toBeTruthy();
    expect(screen.getByText(ru['host.drill.dialogs'])).toBeTruthy();
    const dialogLink = document.querySelector('.dialogs a') as HTMLAnchorElement;
    expect(dialogLink.getAttribute('href')).toBe('/chats/0xchat1');

    // On demand only: no repeated drill-down fetches while the sheet is open.
    const handshakeCalls = mockedHostApi.listHandshakesOfUser.mock.calls.length;
    const chatCalls = mockedHostApi.listChatsOfRoomUser.mock.calls.length;
    // Give the page a moment: the sheet does NOT re-fetch on its own.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockedHostApi.listHandshakesOfUser.mock.calls.length).toBe(handshakeCalls);
    expect(mockedHostApi.listChatsOfRoomUser.mock.calls.length).toBe(chatCalls);
  });

  it('drill-down data is never polled — the poller only re-runs getRoom/listRoomUsers', async () => {
    vi.useFakeTimers();
    try {
      storeSession();
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      // two full 5 s ticks: members/room re-polled, drill-down endpoints silent
      await vi.advanceTimersByTimeAsync(5100);
      await vi.advanceTimersByTimeAsync(30);
      await vi.advanceTimersByTimeAsync(5100);
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedApi.getRoom.mock.calls.length).toBeGreaterThanOrEqual(3);
      expect(mockedHostApi.listHandshakesOfUser.mock.calls.length).toBe(0);
      expect(mockedHostApi.listChatsOfRoomUser.mock.calls.length).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('drill-down fetch failure shows the inline muted error with retry', async () => {
    storeSession();
    mockedApi.listRoomUsers.mockResolvedValue([person('0xa', 'Алиса', 2)]);
    mockedHostApi.listHandshakesOfUser.mockRejectedValue(
      new ApiError(500, '/x', 'db locked')
    );
    await renderPage();
    await screen.findByText('Алиса');
    await screen.getByRole('button', { name: 'Алиса — открыть карточку' }).click();
    await waitFor(() => expect(screen.getByText(/Ошибка сервера/)).toBeTruthy());
    expect(screen.getByText(/db locked/)).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
  });
});

describe('room settings + danger zone (AC 8, AC 12)', () => {
  it('settings save via PUT updateRoom and reflect immediately', async () => {
    storeSession();
    const updated = structuredClone(ROOM);
    updated.name = 'Митап 2';
    mockedHostApi.updateRoom.mockResolvedValue(updated);
    await renderPage();
    await screen.findByText('Митап');

    const toggle = screen.getByRole('button', { name: ru['host.settings.title'] });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await toggle.click();
    await tick();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
    nameInput.value = 'Митап 2';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['common.save'] }).click();

    await waitFor(() => expect(mockedHostApi.updateRoom).toHaveBeenCalledWith(ROOM.address, { name: 'Митап 2', description: ROOM.description }));
    await waitFor(() => expect(screen.getByText('Митап 2')).toBeTruthy());
  });

  it('danger zone is separated by a warning heading; delete confirms, calls DELETE, clears the stored room and returns to the form', async () => {
    storeSession();
    await renderPage();
    await screen.findByText(ROOM.name);

    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();
    expect(screen.getByText(ru['host.danger.title'])).toBeTruthy();

    await screen.getByRole('button', { name: ru['host.delete_room'] }).click();
    await tick();
    // Confirm dialog with the warning copy.
    expect(screen.getByText(ru['host.delete_warning'])).toBeTruthy();
    const confirm = document.querySelector('.scrim .actions .confirm') as HTMLButtonElement;
    await confirm.click();

    await waitFor(() => expect(mockedHostApi.deleteRoom).toHaveBeenCalledWith(ROOM.address));
    await waitFor(() => expect(localStorage.getItem('bleak.hostRoom')).toBeNull());
    // Back to the create form with the deleted notice.
    await waitFor(() => expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy());
    expect(screen.getByText(ru['host.room_deleted'])).toBeTruthy();
  });
});
