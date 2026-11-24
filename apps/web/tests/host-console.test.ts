/** /host console v2 tests — LEAN suite (2026-11-17 slimming pass, owner
 * directive): one block per distinct state, micro-DOM/copy asserts removed
 * (recorded in docs/verification-v2.md). Covers: creation-token gate
 * (masked, never persisted, rejected), create+store, revisit restore,
 * server-text failure, invite list/mint/revoke/failure, live view members +
 * 5 s poller lifecycle + deleted-room state, 6.9a-blocked honest drill-down,
 * settings save, room-token rotation in place, danger-zone delete, host
 * reset (401/403). Pure hostLogic helpers keep their logic assertions. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

import { ApiError, type Invite, type Room, type User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? `/chats/${params.address}` : route
}));

vi.mock('#lib/api/client', () => ({
  HOST_NOTICE_KEY: 'bleak.hostNotice',
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn()
  },
  hostApi: {
    createRoomWithInvite: vi.fn(),
    updateRoom: vi.fn(),
    deleteRoom: vi.fn(),
    listInvites: vi.fn(),
    mintInvite: vi.fn(),
    revokeInvite: vi.fn(),
    rotateRoomToken: vi.fn(),
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    listChatsOfRoomUser: vi.fn(),
    listRoomUserChatMessages: vi.fn(),
    clearChatHistory: vi.fn(),
    kickoffChat: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  generateTokenSecret: () => 'R'.repeat(43),
  generateMutualCode: () => 'M'.repeat(22),
  sha256Hex: async () => 'FAKEHASH'
}));

import { api, hostApi } from '#lib/api/client';
import { clearHostRoom, hostRoom } from '../src/lib/stores/hostSession';
import { identity } from '../src/lib/stores/identity';
import Page from '../src/routes/host/+page.svelte';
import {
  activeInvites,
  customExpiry,
  expiresIn,
  inviteLink,
  presetExpiry,
  spelledDigits
} from '../src/lib/components/host/hostLogic';
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

const CREATE_TOKEN = 'ctok-one-time';

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function minutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

function person(address: string, name: string, createdMinutesAgo: number, bio = ''): User {
  return {
    active: true,
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

function invite(code: string, expiresInMinutes: number): Invite {
  return {
    room: ROOM.address,
    code,
    created_at: minutesAgo(5),
    expires_at: minutesFromNow(expiresInMinutes)
  };
}

const PAYLOAD = { room: ROOM, code: '123456' };

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  identity.set(null);
  mockedApi.getRoom.mockResolvedValue(structuredClone(ROOM));
  mockedApi.listRoomUsers.mockResolvedValue([]);
  mockedHostApi.getRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.listRoomUsers.mockResolvedValue([]);
  mockedHostApi.updateRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.deleteRoom.mockResolvedValue(structuredClone(ROOM));
  mockedHostApi.listInvites.mockResolvedValue([]);
  mockedHostApi.mintInvite.mockResolvedValue(invite('654321', 24 * 60));
  mockedHostApi.revokeInvite.mockResolvedValue(undefined);
  mockedHostApi.rotateRoomToken.mockResolvedValue(undefined);
  mockedHostApi.clearChatHistory.mockResolvedValue({ chat: '0xchat1', cleared: 3 });
  mockedHostApi.kickoffChat.mockResolvedValue({ chat: '0xchat1', cleared: 3, speaker: '0xa' });
  mockedCreate.mockResolvedValue(structuredClone(PAYLOAD));
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
  await tick();
  await tick();
}

/** Seed a full host session so the page boots into share mode. */
function storeSession(): void {
  localStorage.setItem(
    'bleak.hostRoom',
    JSON.stringify({ code: '123456', roomAddress: ROOM.address, roomToken: 'stored-room-token' })
  );
  hostRoom.set({ code: '123456', roomAddress: ROOM.address, roomToken: 'stored-room-token' });
}

async function submitToken(value: string): Promise<void> {
  const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await screen.getByRole('button', { name: ru['host.gate.continue'] }).click();
  await tick();
  await tick();
}

async function fillRoomName(name: string): Promise<void> {
  const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
  nameInput.value = name;
  nameInput.dispatchEvent(new Event('input', { bubbles: true }));
}

function storageDump(): string {
  let out = '';
  for (let i = 0; i < localStorage.length; i += 1) out += localStorage.getItem(localStorage.key(i) ?? '') ?? '';
  for (let i = 0; i < sessionStorage.length; i += 1) out += sessionStorage.getItem(sessionStorage.key(i) ?? '') ?? '';
  return out;
}

describe('pure helpers (hostLogic v2)', () => {
  it('link/expiry computation: inviteLink, presets, custom validation, digit spelling', () => {
    expect(inviteLink('123456', 'http://localhost:5173')).toBe('http://localhost:5173/?code=123456');
    expect(inviteLink('123456', 'https://bleak.example/app/')).toBe(
      'https://bleak.example/app/?code=123456'
    );
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    expect(presetExpiry('1h', now)).toBe(new Date(now + 3_600_000).toISOString());
    expect(presetExpiry('24h', now)).toBe(new Date(now + 24 * 3_600_000).toISOString());
    expect(presetExpiry('7d', now)).toBe(new Date(now + 7 * 24 * 3_600_000).toISOString());
    expect(customExpiry('2026-11-15T09:00', now)).toBeNull();
    expect(customExpiry('not-a-date', now)).toBeNull();
    expect(customExpiry('2026-11-15T12:00', now)).toBe(new Date(Date.UTC(2026, 10, 15, 12, 0)).toISOString());
    expect(expiresIn(new Date(now + 30 * 60_000).toISOString(), now)).toBe('30');
    expect(expiresIn(new Date(now + 5 * 3_600_000).toISOString(), now)).toBe('5');
    expect(expiresIn(new Date(now + 3 * 24 * 3_600_000).toISOString(), now)).toBe('3');
    expect(spelledDigits('123456')).toBe('1 2 3 4 5 6');
  });

  it('activeInvites filters expired codes and sorts newest first (revoked/expired never render)', () => {
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    const list = [
      { code: '111111', created_at: new Date(now - 120_000).toISOString(), expires_at: new Date(now - 60_000).toISOString() },
      { code: '222222', created_at: new Date(now - 10_000).toISOString(), expires_at: new Date(now + 60_000).toISOString() },
      { code: '333333', created_at: new Date(now - 5_000).toISOString(), expires_at: new Date(now + 120_000).toISOString() }
    ];
    expect(activeInvites(list, now).map((i) => i.code)).toEqual(['333333', '222222']);
  });
});

describe('creation gate + create + share kit', () => {
  it('happy path: masked gate (token never persisted) → create with generated room token → code + storage + revisit restore', async () => {
    await renderPage();
    const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(input.type).toBe('password');
    await submitToken(CREATE_TOKEN);
    expect(screen.queryByLabelText(ru['host.gate.label'])).toBeNull();
    expect(storageDump()).not.toContain(CREATE_TOKEN);

    await fillRoomName('Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const requestBody = mockedCreate.mock.calls[0]?.[0];
    expect(requestBody).toEqual({ name: 'Митап', language: 'ru', token: 'R'.repeat(43) });
    expect(mockedCreate.mock.calls[0]?.[1]).toBe(CREATE_TOKEN); // header arg, never body
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
      code: '123456',
      roomAddress: ROOM.address,
      roomToken: 'R'.repeat(43)
    });

    // Revisit restores from bleak.hostRoom without re-creating (AC 5).
    cleanup();
    await renderPage();
    await waitFor(() => expect(mockedHostApi.getRoom).toHaveBeenCalledWith(ROOM.address));
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    expect(mockedCreate).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: ru['host.join_attendee'] }).getAttribute('href')).toBe(
      '/income?code=123456'
    );
  });

  it('a rejected/consumed token (401/403 on create) shows «Токен отклонён.» + server text, value kept masked, nothing stored (AC 2)', async () => {
    mockedCreate.mockRejectedValue(
      new ApiError(403, '/api/room', 'creation token invalid or already used')
    );
    await renderPage();
    await submitToken('wrong-token');
    await fillRoomName('Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText(/Токен отклонён/)).toBeTruthy());

    const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('wrong-token');
    expect(screen.getByText(/creation token invalid/)).toBeTruthy();
    expect(storageDump()).not.toContain('wrong-token');
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it('create 400/409 surfaces the server text under the form', async () => {
    mockedCreate.mockRejectedValue(new ApiError(400, '/api/room', 'duplicate name'));
    await renderPage();
    await submitToken(CREATE_TOKEN);
    await fillRoomName('Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText('duplicate name')).toBeTruthy());
  });
});

describe('invite management', () => {
  it('lists active codes via room-token authority and minting (24 h preset) joins the new code (AC 7)', async () => {
    storeSession();
    mockedHostApi.listInvites
      .mockResolvedValueOnce([invite('111111', 60), invite('999999', -30)])
      .mockResolvedValue([invite('111111', 60), invite('654321', 24 * 60)]);
    await renderPage();
    await screen.findByText('111111');
    // The expired code never rendered (AC 8; logic covered by activeInvites too).
    expect(screen.queryByText('999999')).toBeNull();

    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    const confirm = document.querySelector('.mint-confirm') as HTMLButtonElement;
    await confirm.click();
    await waitFor(() => expect(mockedHostApi.mintInvite).toHaveBeenCalledTimes(1));
    const iso = (mockedHostApi.mintInvite.mock.calls[0]?.[1] as { expires_at: string }).expires_at;
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(new Date(iso).getTime()).toBeLessThan(Date.now() + 25 * 3_600_000);
    await waitFor(() => expect(screen.getByText('654321')).toBeTruthy());
  });

  it('revoke calls DELETE …/invite/{code}, refreshes the list and shows «Код отозван.» (AC 8)', async () => {
    storeSession();
    mockedHostApi.listInvites
      .mockResolvedValueOnce([invite('111111', 60)])
      .mockResolvedValueOnce([]);
    await renderPage();
    await screen.findByText('111111');

    await screen
      .getByRole('button', { name: ru['host.invites.revoke_aria'].replace('{code}', '111111') })
      .click();
    await waitFor(() => expect(mockedHostApi.revokeInvite).toHaveBeenCalledWith(ROOM.address, '111111'));
    await waitFor(() => expect(screen.getByText(ru['host.invites.revoked'])).toBeTruthy());
    await waitFor(() => expect(screen.queryByText('111111')).toBeNull());
  });

  it('invite failure renders inline with retry; the share kit is unaffected', async () => {
    storeSession();
    mockedHostApi.listInvites.mockRejectedValue(new ApiError(500, '/x', 'db locked'));
    await renderPage();
    await waitFor(() => expect(screen.getByText(/db locked/)).toBeTruthy());
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
    expect(screen.getByText('123456')).toBeTruthy();
  });
});

describe('live room view', () => {
  it('renders member rows and the members tile against max_user; empty room shows the honest empty state (AC 9, 15)', async () => {
    storeSession();
    mockedHostApi.listRoomUsers.mockResolvedValue([
      person('0xa', 'Алиса', 2),
      person('0xb', 'Борис', 5)
    ]);
    await renderPage();
    await waitFor(() => expect(mockedHostApi.getRoom).toHaveBeenCalledWith(ROOM.address));
    await screen.findByText('Алиса');
    await screen.findByText('Борис');
    expect(document.body.textContent).toContain('2/50');

    cleanup();
    mockedHostApi.listRoomUsers.mockResolvedValue([]);
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.empty_live'])).toBeTruthy());
  });

  it('runs the 5 s cadence while mounted and stops the poller on unmount — no requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      storeSession();
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      const callsAtMount = mockedHostApi.getRoom.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      await vi.advanceTimersByTimeAsync(5100);
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.getRoom.mock.calls.length).toBeGreaterThan(callsAtMount);

      const callsBeforeUnmount = mockedHostApi.getRoom.mock.calls.length;
      cleanup();
      await vi.advanceTimersByTimeAsync(21_000);
      expect(mockedHostApi.getRoom.mock.calls.length).toBe(callsBeforeUnmount);
    } finally {
      vi.useRealTimers();
    }
  });

  it('getRoom 404 (deleted elsewhere) → «Комната удалена.» + reset to the create form (AC 15)', async () => {
    mockedHostApi.getRoom.mockRejectedValue(new ApiError(404, '/api/room/0xroom', 'room not found'));
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.room_deleted'])).toBeTruthy());
    await screen.getByRole('button', { name: ru['host.create_another'] }).click();
    await tick();
    expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });
});

describe('member drill-down (counts-less, 6.9a-blocked)', () => {
  it('opens on demand with NO counts and the honest 6.9a hint state — no invented listings (AC 10, 11)', async () => {
    storeSession();
    mockedHostApi.listRoomUsers.mockResolvedValue([person('0xa', 'Алиса', 2, 'Поттер')]);
    await renderPage();
    await screen.findByText('Алиса');

    await screen.getByRole('button', { name: 'Алиса — открыть карточку' }).click();
    await tick();

    expect(screen.getByText(ru['host.drill.empty'])).toBeTruthy();
    expect(screen.getByText(ru['host.drill.pending_amendment'])).toBeTruthy();
    expect(document.body.textContent).not.toContain('Отправлено хендшейков');
    // The 6.9a-blocked room-scoped listing is never called (no invented data).
    expect(mockedHostApi.listChatsOfRoomUser).not.toHaveBeenCalled();
    expect(mockedHostApi.clearChatHistory).not.toHaveBeenCalled();
    expect(mockedHostApi.kickoffChat).not.toHaveBeenCalled();
  });
});

describe('settings + rotation + danger zone', () => {
  it('settings save via PUT updateRoom and reflect immediately (AC 12)', async () => {
    storeSession();
    const updated = structuredClone(ROOM);
    updated.name = 'Митап 2';
    mockedHostApi.updateRoom.mockResolvedValue(updated);
    await renderPage();
    await screen.findByText('Митап');

    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();

    const nameInput = screen.getByLabelText(ru['host.form.name']) as HTMLInputElement;
    nameInput.value = 'Митап 2';
    nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    await screen.getByRole('button', { name: ru['common.save'] }).click();

    await waitFor(() =>
      expect(mockedHostApi.updateRoom).toHaveBeenCalledWith(ROOM.address, {
        name: 'Митап 2',
        description: ROOM.description
      })
    );
    await waitFor(() => expect(screen.getByText('Митап 2')).toBeTruthy());
  });

  it('«Сгенерировать ключ комнаты» confirms and rewrites the stored roomToken IN PLACE (AC 13)', async () => {
    storeSession();
    await renderPage();
    await screen.findByText(ROOM.name);

    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['host.rotate_room.row'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['host.rotate_room.cta'] }).click();

    await waitFor(() =>
      expect(mockedHostApi.rotateRoomToken).toHaveBeenCalledWith(ROOM.address, 'R'.repeat(43))
    );
    const stored = JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}');
    expect(stored).toEqual({ code: '123456', roomAddress: ROOM.address, roomToken: 'R'.repeat(43) });
  });

  it('delete confirms, calls DELETE, clears the stored room and returns to the create form (AC 12)', async () => {
    storeSession();
    await renderPage();
    await screen.findByText(ROOM.name);

    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['host.delete_room'] }).click();
    await tick();
    const confirm = document.querySelector('.scrim .actions .confirm') as HTMLButtonElement;
    await confirm.click();

    await waitFor(() => expect(mockedHostApi.deleteRoom).toHaveBeenCalledWith(ROOM.address));
    await waitFor(() => expect(localStorage.getItem('bleak.hostRoom')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy());
  });
});

describe('host session reset (AC 14)', () => {
  it.each([401, 403])(
    'a %i on a room-token call clears bleak.hostRoom, resets the console to the gate, shows the notice and consumes the flag — attendee identity untouched',
    async (status) => {
      storeSession();
      localStorage.setItem(
        'bleak.identity',
        JSON.stringify({ roomAddress: ROOM.address, userAddress: '0xme', token: 'p-tok' })
      );
      identity.set({ roomAddress: ROOM.address, userAddress: '0xme', token: 'p-tok' });
      mockedHostApi.updateRoom.mockImplementation(async () => {
        clearHostRoom();
        sessionStorage.setItem('bleak.hostNotice', '1');
        throw new ApiError(status, '/api/room/0xroom', 'room token invalid');
      });
      await renderPage();
      await screen.findByText(ROOM.name);
      await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
      await tick();
      await screen.getByRole('button', { name: ru['common.save'] }).click();

      await waitFor(() => expect(screen.getByText(ru['host.session_reset'])).toBeTruthy());
      await waitFor(() => expect(screen.getByLabelText(ru['host.gate.label'])).toBeTruthy());
      expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
      expect(sessionStorage.getItem('bleak.hostNotice')).toBeNull(); // consumed on mount
      // The attendee identity is NEVER touched by the host reset.
      expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual({
        roomAddress: ROOM.address,
        userAddress: '0xme',
        token: 'p-tok'
      });
    }
  );
});
