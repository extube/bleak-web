/** JoinFlow component tests (TZ-03): DigitInput → resolve → preview hand-off,
 * deep-link auto-submit, inline 404 with preserved digits, persona form
 * client-side prevention + success (identity saved, navigates to /room),
 * scanner mount (QrScanner public API, context *a*). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, NetworkError, type Room, type User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route }));

vi.mock('#lib/api/helper', () => {
  class HelperError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = 'HelperError';
      this.status = status;
    }
  }
  return { HelperError, resolveInvite: vi.fn() };
});

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRooms: vi.fn(),
    listRoomUsers: vi.fn(),
    getRoomUser: vi.fn(),
    createRoomUser: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { HelperError, resolveInvite } from '#lib/api/helper';
import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import JoinFlow from '../src/lib/components/join/JoinFlow.svelte';
import { ru } from '../src/lib/i18n/ru';

const mockedResolve = vi.mocked(resolveInvite);
const mockedApi = vi.mocked(api);

const room: Room = {
  address: '0xroom123',
  name: 'Хостел «Пиксель»',
  description: 'Митап по пиксель-арту',
  language: 'ru',
  max_user: 50,
  created_at: '',
  updated_at: '',
  deleted_at: null
};

function user(address: string, name: string): User {
  return {
    address,
    room: room.address,
    name,
    greeting: '',
    public_bio: '',
    private_bio: '',
    language: 'ru',
    created_at: '',
    updated_at: '',
    deleted_at: null
  };
}

function cells(): HTMLInputElement[] {
  return screen.getAllByRole('textbox') as HTMLInputElement[];
}

function pasteCode(code: string): void {
  fireEvent.paste(cells()[0] as HTMLInputElement, {
    clipboardData: { getData: () => code }
  });
}

beforeEach(() => {
  localStorage.clear();
  identity.set(null);
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  identity.set(null);
});

describe('JoinFlow — DigitInput → resolve → preview hand-off', () => {
  it('resolves a typed code and shows the room preview without a reload', async () => {
    mockedResolve.mockResolvedValue({ code: '123456', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([user('0xa', 'Алиса')]);

    render(JoinFlow, { props: {} });

    pasteCode('123456');
    // All six cells filled (AC 11)…
    expect(cells().map((c) => c.value).join('')).toBe('123456');
    // …the CTA submits, the helper resolves, and the room card replaces
    // the code entry (AC 2) — same document, no navigation.
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledWith('123456');
    expect(screen.getByText('Митап по пиксель-арту')).toBeTruthy();
    expect(screen.getByText(/Язык агентов: ru/)).toBeTruthy();
    expect(screen.getByText(/Участников: 1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.create_persona'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.import'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.change_code'] })).toBeTruthy();
  });

  it('?code=NNNNNN deep link prefills the cells and auto-submits (AC 3)', async () => {
    mockedResolve.mockResolvedValue({ code: '654321', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);

    render(JoinFlow, { props: { deepLinkCode: '654321' } });

    expect(cells().map((c) => c.value).join('')).toBe('654321');
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledTimes(1);
  });

  it('unknown code shows the 404 copy inline, keeps the digits, does not navigate (AC 4)', async () => {
    mockedResolve.mockRejectedValue(new HelperError(404, 'unknown code'));

    render(JoinFlow, { props: {} });
    pasteCode('999999');
    await screen.getByRole('button', { name: ru['join.enter'] }).click();
    await tick();
    await screen.findByText(ru['join.error.unknown']);
    expect(cells().map((c) => c.value).join('')).toBe('999999');
    expect(screen.queryByText(room.name)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
  });

  it('helper unreachable shows the NetworkError banner and preserves the code (AC 5)', async () => {
    mockedResolve.mockRejectedValue(new NetworkError('/rooms/111111', new Error('offline')));

    render(JoinFlow, { props: {} });
    pasteCode('111111');
    await screen.getByRole('button', { name: ru['join.enter'] }).click();
    await screen.findByText(ru['common.error.network']);
    expect(cells().map((c) => c.value).join('')).toBe('111111');
    // Retry re-runs the resolution with the preserved digits.
    mockedResolve.mockResolvedValue({ code: '111111', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await screen.findByText(room.name);
  });

  it('change-code returns to a clean code entry', async () => {
    mockedResolve.mockResolvedValue({ code: '123456', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);

    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.change_code'] }).click();
    await screen.findByText(ru['join.title']);
    expect(cells().map((c) => c.value).join('')).toBe('');
  });
});

describe('JoinFlow — persona form', () => {
  async function openForm(): Promise<void> {
    mockedResolve.mockResolvedValue({ code: '123456', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.create_persona'] }).click();
    await screen.findByText(ru['join.form.name']);
  }

  it('blocks the empty-name submit client-side with the field error (AC 6)', async () => {
    await openForm();
    await screen.getByRole('button', { name: ru['join.enter'] }).click();
    await tick();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
  });

  it('success saves the identity and navigates to /room (AC 7)', async () => {
    const me = user('0xme', 'Я');
    mockedApi.createRoomUser.mockResolvedValue(me);
    await openForm();

    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await screen.getByRole('button', { name: ru['join.enter'] }).click();

    await waitFor(() => expect(mockedApi.createRoomUser).toHaveBeenCalled());
    expect(mockedApi.createRoomUser).toHaveBeenCalledWith(room.address, { name: 'Я' });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual({
      roomAddress: room.address,
      userAddress: '0xme'
    });
    expect(goto).toHaveBeenCalledWith('/room');
  });

  it('server 409 surfaces the name-taken copy', async () => {
    mockedApi.createRoomUser.mockRejectedValue(
      new ApiError(409, '/api/room/r/user', 'name taken')
    );
    await openForm();
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Дубль' } });
    await screen.getByRole('button', { name: ru['join.enter'] }).click();
    await screen.findByText(ru['join.error.name_taken']);
  });
});

describe('JoinFlow — scanner mount (context *a*, QrScanner public API)', () => {
  it('the scan button opens the overlay; the manual fallback closes it and refocuses the cells (AC 12)', async () => {
    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await screen.getByRole('button', { name: ru['join.scan.open'] }).click();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Manual fallback inside the placeholder panel.
    await screen.getByRole('button', { name: ru['common.close'] }).click();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(cells()[0]);
    // Digits intact.
    expect(cells().map((c) => c.value).join('')).toBe('123456');
  });

  it('after closing the scanner the normal code flow still resolves unchanged (AC 13 wiring)', async () => {
    mockedResolve.mockResolvedValue({ code: '123456', room_address: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);

    render(JoinFlow, { props: {} });
    await screen.getByRole('button', { name: ru['join.scan.open'] }).click();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The placeholder never fires onInviteCode; the close/fallback path must
    // leave the join flow intact so a detected code (TZ-04) enters Step 1 as
    // if typed. Manual entry continues to work identically.
    await screen.getByRole('button', { name: ru['common.close'] }).click();
    pasteCode('123456');
    await screen.getByRole('button', { name: ru['join.enter'] }).click();
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledWith('123456');
  });
});
