/** /host console v2 tests (TZ2-07 Part B, DESIGN rev. 3 §3.7 AC 1–16):
 * one-time creation-token gate (masked, NEVER persisted, rejected state),
 * create room (client-generated room token, creation token header), share
 * kit (code + QR + client-computed invite link, restored from
 * bleak.hostRoom), invite management (room-token authority: list / mint
 * with expiry presets / revoke — no counts anywhere), live room view (5 s
 * poller, teardown, empty state), member drill-down (6.9a-blocked: honest
 * empty state + hint, never invented listings), room settings +
 * room-token rotation (in-place) + danger-zone delete, host reset state,
 * getRoom-404 → deleted state. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, type Invite, type Room, type User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { address?: string }) =>
    params?.address ? `/chats/${params.address}` : route
}));

vi.mock('#lib/api/client', () => ({
  HOST_RESET_KEY: 'bleak.hostReset',
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
  it('inviteLink computes {base}/?code={code} client-side (§10.9)', () => {
    expect(inviteLink('123456', 'http://localhost:5173')).toBe('http://localhost:5173/?code=123456');
    expect(inviteLink('123456', 'https://bleak.example/app/')).toBe(
      'https://bleak.example/app/?code=123456'
    );
  });

  it('presetExpiry computes the 1h/24h/7d ISO instants from now', () => {
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    expect(presetExpiry('1h', now)).toBe(new Date(now + 3_600_000).toISOString());
    expect(presetExpiry('24h', now)).toBe(new Date(now + 24 * 3_600_000).toISOString());
    expect(presetExpiry('7d', now)).toBe(new Date(now + 7 * 24 * 3_600_000).toISOString());
  });

  it('customExpiry rejects past/garbage values and accepts a future datetime-local', () => {
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    expect(customExpiry('2026-11-15T09:00', now)).toBeNull();
    expect(customExpiry('not-a-date', now)).toBeNull();
    expect(customExpiry('2026-11-15T12:00', now)).toBe(new Date(Date.UTC(2026, 10, 15, 12, 0)).toISOString());
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

  it('expiresIn humanizes the remaining time in minute/hour/day buckets', () => {
    const now = Date.UTC(2026, 10, 15, 10, 0, 0);
    expect(expiresIn(new Date(now + 30 * 60_000).toISOString(), now)).toBe('30');
    expect(expiresIn(new Date(now + 5 * 3_600_000).toISOString(), now)).toBe('5');
    expect(expiresIn(new Date(now + 3 * 24 * 3_600_000).toISOString(), now)).toBe('3');
  });

  it('spelledDigits spaces the code for the screen-reader aria-label', () => {
    expect(spelledDigits('123456')).toBe('1 2 3 4 5 6');
  });
});

describe('creation-token gate (AC 1, AC 2)', () => {
  it('shows the masked gate without a stored room; the token is NEVER persisted (AC 1)', async () => {
    await renderPage();
    const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.getAttribute('autocomplete')).toBe('off');
    expect(screen.getByText(ru['host.gate.note'])).toBeTruthy();

    await submitToken(CREATE_TOKEN);
    // Gate gone: the create form is the visible surface now.
    expect(screen.queryByLabelText(ru['host.gate.label'])).toBeNull();
    expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy();
    // The creation token lives in memory only — no storage write anywhere.
    expect(storageDump()).not.toContain(CREATE_TOKEN);
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

  it('the mount consumes the bleak.hostReset flag and shows the reset notice above the gate', async () => {
    sessionStorage.setItem('bleak.hostReset', '1');
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.session_reset'])).toBeTruthy());
    expect(sessionStorage.getItem('bleak.hostReset')).toBeNull();
    expect(screen.getByLabelText(ru['host.gate.label'])).toBeTruthy();
  });
});

describe('create room + share kit (AC 3, 4, 5, 6)', () => {
  it('empty name is prevented client-side (client not called)', async () => {
    await renderPage();
    await submitToken(CREATE_TOKEN);
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await tick();
    expect(mockedCreate).not.toHaveBeenCalled();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
  });

  it('creates with a client-generated room token (creation token in the header) and stores {roomAddress, roomToken, code} (AC 3)', async () => {
    await renderPage();
    await submitToken(CREATE_TOKEN);
    await fillRoomName('Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const requestBody = mockedCreate.mock.calls[0]?.[0];
    expect(requestBody).toEqual({ name: 'Митап', language: 'ru', token: 'R'.repeat(43) });
    // The one-time creation token travels as the second argument (the
    // header in the delivered TZ2-02 transport) — never in the body.
    expect(mockedCreate.mock.calls[0]?.[1]).toBe(CREATE_TOKEN);
    expect(JSON.stringify(requestBody)).not.toContain(CREATE_TOKEN);

    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    const stored = JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}');
    expect(stored).toEqual({ code: '123456', roomAddress: ROOM.address, roomToken: 'R'.repeat(43) });
    expect(get(hostRoom)).toEqual({ code: '123456', roomAddress: ROOM.address, roomToken: 'R'.repeat(43) });
  });

  it('the share kit renders the code, the stateless-helper QR and the client-computed invite link (AC 4)', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    expect(
      screen.getByRole('img', { name: ru['host.code.aria'].replace('{code}', spelledDigits('123456')) })
    ).toBeTruthy();
    expect(screen.getByText(ru['host.invite_link'])).toBeTruthy();
    // Invite link computed client-side from the code (base = the SPA origin).
    expect(screen.getByText(`${window.location.origin}/?code=123456`)).toBeTruthy();
    // QR <img> from the stateless helper URL builder.
    const img = document.querySelector('.qr-frame img') as HTMLImageElement;
    expect(img).toBeTruthy();
    expect(img.getAttribute('alt')).toBe(ru['host.qr.alt']);
    expect(img.getAttribute('src')).toBe('/h/rooms/123456/qr');
    // Both copy controls exist (code chip + link row).
    expect(screen.getAllByRole('button', { name: ru['common.copy'] }).length).toBeGreaterThanOrEqual(2);
  });

  it('create 400/409 surfaces the server text under the form', async () => {
    mockedCreate.mockRejectedValue(new ApiError(400, '/api/room', 'duplicate name'));
    await renderPage();
    await submitToken(CREATE_TOKEN);
    await fillRoomName('Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText('duplicate name')).toBeTruthy());
  });

  it('revisit restores the share kit from bleak.hostRoom without re-creating; room name via public getRoom (AC 5)', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(mockedHostApi.getRoom).toHaveBeenCalledWith(ROOM.address));
    await waitFor(() => expect(screen.getByText('123456')).toBeTruthy());
    expect(screen.getByText(ROOM.name)).toBeTruthy();
    expect(mockedCreate).not.toHaveBeenCalled();
    // «Присоединиться как участник» deep-links the join flow (AC 6).
    expect(screen.getByRole('link', { name: ru['host.join_attendee'] }).getAttribute('href')).toBe(
      '/?code=123456'
    );
    // «Создать другую комнату» returns to the form.
    await screen.getByRole('button', { name: ru['host.create_another'] }).click();
    await tick();
    expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy();
  });
});

describe('invite management (AC 7, AC 8)', () => {
  it('lists active codes via room-token listInvites with expiry display (AC 7)', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60), invite('222222', 30)]);
    await renderPage();
    await waitFor(() => expect(mockedHostApi.listInvites).toHaveBeenCalledWith(ROOM.address));
    expect(screen.getByText('111111')).toBeTruthy();
    expect(screen.getByText('222222')).toBeTruthy();
    expect(screen.getAllByText(/истекает через/).length).toBe(2);
    // Hint copy from the block header.
    expect(screen.getByText(ru['host.invites.hint'])).toBeTruthy();
  });

  it('minting with the 24 h preset calls mintInvite and the new code joins the list (AC 7)', async () => {
    storeSession();
    mockedHostApi.listInvites
      .mockResolvedValueOnce([invite('111111', 60)])
      .mockResolvedValue([invite('111111', 60), invite('654321', 24 * 60)]);
    await renderPage();
    await screen.findByText('111111');

    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    // The chooser presets: 24 h pre-selected by default.
    const preset24 = screen.getByRole('button', { name: ru['host.invites.preset.24h'] });
    expect(preset24.getAttribute('aria-pressed')).toBe('true');
    // Confirm the mint (the chooser's confirm button carries the same label).
    const confirm = document.querySelector('.mint-confirm') as HTMLButtonElement;
    await confirm.click();

    await waitFor(() => expect(mockedHostApi.mintInvite).toHaveBeenCalledTimes(1));
    const call = mockedHostApi.mintInvite.mock.calls[0];
    const address = call?.[0];
    const request = call?.[1];
    expect(address).toBe(ROOM.address);
    const iso = (request as { expires_at: string }).expires_at;
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(new Date(iso).getTime()).toBeLessThan(Date.now() + 25 * 3_600_000);
    // The minted code appears in the refreshed list with its own actions.
    await waitFor(() => expect(screen.getByText('654321')).toBeTruthy());
    expect(
      screen.getByRole('button', { name: ru['host.invites.revoke_aria'].replace('{code}', '654321') })
    ).toBeTruthy();
  });

  it('the custom expiry chooser reveals a datetime-local input (min = now) and mints the custom instant', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([]);
    mockedHostApi.mintInvite.mockResolvedValue(invite('777777', 120));
    await renderPage();
    await screen.findByRole('button', { name: ru['host.invites.mint'] });
    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();

    await screen.getByRole('button', { name: ru['host.invites.preset.custom'] }).click();
    await tick();
    const input = document.querySelector('#invite-expires') as HTMLInputElement;
    expect(input.type).toBe('datetime-local');
    expect(input.min).toBeTruthy();

    const future = new Date(Date.now() + 90 * 60_000);
    const pad = (n: number): string => String(n).padStart(2, '0');
    input.value = `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}`;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const confirm = document.querySelector('.mint-confirm') as HTMLButtonElement;
    await confirm.click();

    await waitFor(() => expect(mockedHostApi.mintInvite).toHaveBeenCalledTimes(1));
    const iso = (mockedHostApi.mintInvite.mock.calls[0]?.[1] as { expires_at: string }).expires_at;
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now());
  });

  it('an empty custom value blocks the mint inline (no request)', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([]);
    await renderPage();
    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['host.invites.preset.custom'] }).click();
    await tick();
    const confirm = document.querySelector('.mint-confirm') as HTMLButtonElement;
    await confirm.click();
    await tick();
    expect(mockedHostApi.mintInvite).not.toHaveBeenCalled();
  });

  it('revoke calls DELETE …/invite/{code}, refreshes the list and shows «Код отозван.»; expired codes never render (AC 8)', async () => {
    storeSession();
    mockedHostApi.listInvites
      .mockResolvedValueOnce([invite('111111', 60), invite('999999', -30)])
      .mockResolvedValueOnce([]);
    await renderPage();
    await screen.findByText('111111');
    // The expired code never rendered (AC 8).
    expect(screen.queryByText('999999')).toBeNull();

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

describe('live room view (AC 9, AC 15)', () => {
  it('renders member rows and the members tile against max_user', async () => {
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
    expect(screen.getByText(ru['host.stats.language_only'])).toBeTruthy();
  });

  it('runs the 5 s cadence while mounted and stops the poller on unmount — no requests after teardown', async () => {
    vi.useFakeTimers();
    try {
      storeSession();
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      const callsAtMount = mockedHostApi.getRoom.mock.calls.length;
      expect(callsAtMount).toBeGreaterThan(0);

      // one full 5 s tick: the poll runs again without user action (AC 9)
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

  it('empty room shows «Пока никто не присоединился.» (AC 15)', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.empty_live'])).toBeTruthy());
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

describe('member drill-down (AC 10, AC 11 — counts-less, 6.9a-blocked)', () => {
  it('opens on demand with NO counts and the honest 6.9a hint state — no invented listings (AC 10, 11)', async () => {
    storeSession();
    mockedHostApi.listRoomUsers.mockResolvedValue([person('0xa', 'Алиса', 2, 'Поттер')]);
    await renderPage();
    await screen.findByText('Алиса');

    await screen.getByRole('button', { name: 'Алиса — открыть карточку' }).click();
    await tick();

    expect(screen.getByText(ru['host.drill.empty'])).toBeTruthy();
    expect(screen.getByText(ru['host.drill.pending_amendment'])).toBeTruthy();
    // NO handshake counts anywhere in the console (AC 11).
    expect(document.body.textContent).not.toContain('Отправлено хендшейков');
    expect(document.body.textContent).not.toContain('Получено хендшейков');
    // The 6.9a-blocked room-scoped listing is never called (no invented data)
    // and the drill-down fetches NOTHING on open in v2 (no discovery).
    expect(mockedHostApi.listChatsOfRoomUser).not.toHaveBeenCalled();
    expect(mockedHostApi.clearChatHistory).not.toHaveBeenCalled();
    expect(mockedHostApi.kickoffChat).not.toHaveBeenCalled();

    // On demand only: the sheet does not re-fetch on its own.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(mockedHostApi.listChatsOfRoomUser).not.toHaveBeenCalled();
  });
});

describe('room settings + rotation + danger zone (AC 12, AC 13)', () => {
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
    expect(screen.getByText(ru['host.rotate_room.title'])).toBeTruthy();
    expect(screen.getByText(ru['host.rotate_room.body'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['host.rotate_room.cta'] }).click();

    await waitFor(() =>
      expect(mockedHostApi.rotateRoomToken).toHaveBeenCalledWith(ROOM.address, 'R'.repeat(43))
    );
    await waitFor(() =>
      expect(screen.getByText(ru['host.rotate_room.done'], { exact: false })).toBeTruthy()
    );
    // The stored entry's roomToken is replaced in place — code/address kept.
    const stored = JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}');
    expect(stored).toEqual({ code: '123456', roomAddress: ROOM.address, roomToken: 'R'.repeat(43) });
  });

  it('danger zone is separated by a warning heading; delete confirms, calls DELETE, clears the stored room and returns to the create form (AC 12)', async () => {
    storeSession();
    await renderPage();
    await screen.findByText(ROOM.name);

    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();
    expect(screen.getByText(ru['host.danger.title'])).toBeTruthy();

    await screen.getByRole('button', { name: ru['host.delete_room'] }).click();
    await tick();
    expect(screen.getByText(ru['host.delete_warning'])).toBeTruthy();
    const confirm = document.querySelector('.scrim .actions .confirm') as HTMLButtonElement;
    await confirm.click();

    await waitFor(() => expect(mockedHostApi.deleteRoom).toHaveBeenCalledWith(ROOM.address));
    await waitFor(() => expect(localStorage.getItem('bleak.hostRoom')).toBeNull());
    await waitFor(() => expect(screen.getByRole('button', { name: ru['host.create'] })).toBeTruthy());
    expect(screen.getByText(ru['host.room_deleted'])).toBeTruthy();
  });
});

describe('host session reset (AC 14)', () => {
  it.each([401, 403])(
    'a %i on a room-token call clears bleak.hostRoom, resets the console to the gate and shows the notice — attendee identity untouched',
    async (status) => {
      storeSession();
      localStorage.setItem(
        'bleak.identity',
        JSON.stringify({ roomAddress: ROOM.address, userAddress: '0xme', token: 'p-tok' })
      );
      identity.set({ roomAddress: ROOM.address, userAddress: '0xme', token: 'p-tok' });
      mockedHostApi.updateRoom.mockImplementation(async () => {
        // The real hostApi gate clears the room session (store AND storage)
        // + sets the flag before rethrowing — the mock replicates both.
        clearHostRoom();
        sessionStorage.setItem('bleak.hostReset', '1');
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
      // The attendee identity is NEVER touched by the host reset.
      expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual({
        roomAddress: ROOM.address,
        userAddress: '0xme',
        token: 'p-tok'
      });
    }
  );

  it('the reset notice is announced politely and the flag is consumed (no repeat on the next mount)', async () => {
    storeSession();
    mockedHostApi.updateRoom.mockImplementation(async () => {
      clearHostRoom();
      sessionStorage.setItem('bleak.hostReset', '1');
      throw new ApiError(401, '/api/room/0xroom', 'room token invalid');
    });
    await renderPage();
    await screen.findByText(ROOM.name);
    await screen.getByRole('button', { name: ru['host.settings.title'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['common.save'] }).click();
    await waitFor(() => expect(screen.getByText(ru['host.session_reset'])).toBeTruthy());
    const notice = screen.getByText(ru['host.session_reset']);
    expect(notice.getAttribute('aria-live')).toBe('polite');
    expect(sessionStorage.getItem('bleak.hostReset')).toBeNull();
  });
});

describe('layout (AC 16)', () => {
  it('renders the two-column shell; the sticky-left rule is a ≥900px media query (spot-checked in DOM)', async () => {
    storeSession();
    await renderPage();
    await waitFor(() => expect(document.querySelector('.columns')).toBeTruthy());
    expect(document.querySelector('.left')).toBeTruthy();
    expect(document.querySelector('.right')).toBeTruthy();
  });
});
