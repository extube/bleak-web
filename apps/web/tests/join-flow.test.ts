/** JoinFlow component tests (TZ-03 + TZ2-06 Part B, DESIGN §3.1 rev. 3):
 * DigitInput → resolve → preview hand-off, deep-link auto-submit, inline 404
 * with preserved digits, persona creation with the client-generated token
 * (exact v2 body; identity + vault written only after 2xx), the §2.9
 * invite-code rejection state, 409, the vault-driven import (list from
 * bleak.tokenVault, stored-token read, re-create with a NEW token, dead
 * entry, empty vault), and the scanner mount (QrScanner public API). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, NetworkError, type Room, type User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route }));

vi.mock('#lib/api/invite-resolve', () => {
  class InviteResolveError extends Error {
    readonly kind: 'malformed' | 'not_found';
    constructor(kind: 'malformed' | 'not_found') {
      super(kind);
      this.name = 'InviteResolveError';
      this.kind = kind;
    }
  }
  return { InviteResolveError, resolveInviteCode: vi.fn() };
});

vi.mock('#lib/crypto/secrets', () => ({ generateTokenSecret: vi.fn(() => 'generated-raw-token') }));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    getRoomUser: vi.fn(),
    createRoomUser: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { InviteResolveError, resolveInviteCode } from '#lib/api/invite-resolve';
import { api } from '#lib/api/client';
import { identity } from '#lib/stores/identity';
import JoinFlow from '../src/lib/components/join/JoinFlow.svelte';
import { ru } from '../src/lib/i18n/ru';

const mockedResolve = vi.mocked(resolveInviteCode);
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

function user(address: string, name: string, privateBio = ''): User {
  return {
    address,
    room: room.address,
    name,
    greeting: '',
    public_bio: '',
    private_bio: privateBio,
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

/**
 * Submit the active join form the way a browser does when the CTA (or Enter
 * in a cell) is used: click the CTA, then dispatch the form submit event
 * (happy-dom does not dispatch `submit` on programmatic button clicks; a
 * second dispatch is a no-op while `resolving` guards double submits).
 */
async function submitViaCta(): Promise<void> {
  await screen.getByRole('button', { name: ru['join.enter'] }).click();
  fireEvent.submit(document.querySelector('form') as HTMLFormElement);
}

function seedVault(entries: unknown[]): void {
  localStorage.setItem('bleak.tokenVault', JSON.stringify(entries));
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
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([user('0xa', 'Алиса')]);

    render(JoinFlow, { props: {} });

    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledWith('123456');
    expect(screen.getByText('Митап по пиксель-арту')).toBeTruthy();
    expect(screen.getByText(/Язык агентов: ru/)).toBeTruthy();
    expect(screen.getByText(/Участников: 1/)).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.create_persona'] })).toBeTruthy();
    // v2: the import option is the device vault.
    expect(screen.getByRole('button', { name: ru['join.import.title'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.change_code'] })).toBeTruthy();
  });

  it('?code=NNNNNN deep link prefills the cells and auto-submits (AC 4)', async () => {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);

    render(JoinFlow, { props: { deepLinkCode: '654321' } });

    expect(cells().map((c) => c.value).join('')).toBe('654321');
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledTimes(1);
  });

  it('unknown code shows the 404 copy inline, keeps the digits, does not navigate (AC 5)', async () => {
    mockedResolve.mockRejectedValue(new InviteResolveError('not_found'));

    render(JoinFlow, { props: {} });
    pasteCode('999999');
    await submitViaCta();
    await tick();
    await screen.findByText(ru['join.error.unknown']);
    expect(cells().map((c) => c.value).join('')).toBe('999999');
    expect(screen.queryByText(room.name)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
  });

  it('seam unreachable shows the NetworkError banner and preserves the code (AC 6)', async () => {
    mockedResolve.mockRejectedValue(new NetworkError('/api/invite/111111', new Error('offline')));

    render(JoinFlow, { props: {} });
    pasteCode('111111');
    await submitViaCta();
    await screen.findByText(ru['common.error.network']);
    expect(cells().map((c) => c.value).join('')).toBe('111111');
    // Retry re-runs the resolution with the preserved digits.
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await screen.findByText(room.name);
  });

  it('change-code returns to a clean code entry', async () => {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);

    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.change_code'] }).click();
    await screen.findByText(ru['join.title']);
    expect(cells().map((c) => c.value).join('')).toBe('');
  });
});

describe('JoinFlow — persona creation (v2, token in the body)', () => {
  async function openForm(): Promise<void> {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.create_persona'] }).click();
    await screen.findByText(ru['join.form.name']);
  }

  it('blocks the empty-name submit client-side with the field error (AC 7)', async () => {
    await openForm();
    await submitViaCta();
    await tick();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
  });

  it('success sends the exact v2 body (name, bios, invite_code, generated token; no auth header), saves identity + vault, navigates (AC 8)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    await openForm();

    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await submitViaCta();

    await waitFor(() => expect(mockedApi.createRoomUser).toHaveBeenCalled());
    // invite_code = the entered code; token = the client-generated secret.
    expect(mockedApi.createRoomUser).toHaveBeenCalledWith(room.address, {
      name: 'Я',
      invite_code: '123456',
      token: 'generated-raw-token'
    });
    // Flush the createRoomUser promise continuation (identity + vault + goto).
    await tick();
    await tick();
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual({
      roomAddress: room.address,
      userAddress: '0xme',
      token: 'generated-raw-token'
    });
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault).toHaveLength(1);
    expect(vault[0]).toMatchObject({
      roomAddress: room.address,
      userAddress: '0xme',
      token: 'generated-raw-token',
      name: 'Я'
    });
    expect(goto).toHaveBeenCalledWith('/room');
  });

  it('creation rejected over the invite code shows the §2.9 copy inline, writes no identity/vault (AC 9)', async () => {
    mockedApi.createRoomUser.mockRejectedValue(
      new ApiError(401, '/api/room/r/user', 'invite code invalid or expired')
    );
    await openForm();
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await submitViaCta();
    await screen.findByText(ru['join.error.invite']);
    // No identity, no vault entry, form state kept.
    expect(localStorage.getItem('bleak.identity')).toBeNull();
    expect(localStorage.getItem('bleak.tokenVault')).toBeNull();
    expect((screen.getByLabelText(ru['join.form.name']) as HTMLInputElement).value).toBe('Я');
  });

  it('server 409 surfaces the name-taken copy and keeps the form state (AC 10)', async () => {
    mockedApi.createRoomUser.mockRejectedValue(
      new ApiError(409, '/api/room/r/user', 'name taken')
    );
    await openForm();
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Дубль' } });
    await submitViaCta();
    await screen.findByText(ru['join.error.name_taken']);
    expect((screen.getByLabelText(ru['join.form.name']) as HTMLInputElement).value).toBe('Дубль');
  });
});

describe('JoinFlow — vault-driven import (Concept §6.2)', () => {
  async function openVault(): Promise<void> {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.import.title'] }).click();
    await screen.findByText(ru['join.import.subtitle']);
  }

  function vaultRow(name: string): string {
    return ru['join.import.row_aria'].replace('{name}', name);
  }

  it('the picker lists ONLY bleak.tokenVault entries — no server room listing call (AC 11)', async () => {
    seedVault([
      {
        roomAddress: '0xoldroom',
        userAddress: '0xold',
        token: 'stored-vault-token',
        name: 'Старая персона',
        savedAt: '2026-11-14T10:00:00Z'
      }
    ]);
    await openVault();
    expect(screen.getByText('Старая персона')).toBeTruthy();
    expect(screen.getByText(/комната 0xoldroom/)).toBeTruthy();
    // No GET /api/room beyond the preview: the picker never lists servers.
    expect(mockedApi.getRoom).toHaveBeenCalledTimes(1); // the room preview only
    expect(mockedApi.listRoomUsers).toHaveBeenCalledTimes(1); // the member count only
  });

  it('an empty vault shows the specified copy with a way back to persona creation (AC 14)', async () => {
    await openVault();
    expect(screen.getByText(ru['join.import.empty'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['join.create_persona'] }).click();
    await screen.findByText(ru['join.form.name']);
  });

  it('picking an entry reads the old persona with ITS STORED token, prefills, and re-creates with a NEW token (AC 12)', async () => {
    seedVault([
      {
        roomAddress: '0xoldroom',
        userAddress: '0xold',
        token: 'stored-vault-token',
        name: 'Старая персона',
        savedAt: '2026-11-14T10:00:00Z'
      }
    ]);
    mockedApi.getRoomUser.mockResolvedValue(user('0xold', 'Старая персона', 'секрет'));
    mockedApi.createRoomUser.mockResolvedValue(user('0xnew', 'Старая персона', 'секрет'));

    await openVault();
    await screen.getByRole('button', { name: vaultRow('Старая персона') }).click();

    // Credentialed read: the Bearer token equals the vault entry's stored one.
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    expect(mockedApi.getRoomUser).toHaveBeenCalledWith('0xoldroom', '0xold', {
      token: 'stored-vault-token'
    });
    // Prefilled form incl. the private bio + the copy notice.
    await screen.findByText(ru['join.import.notice']);
    expect((screen.getByLabelText(ru['join.form.name']) as HTMLInputElement).value).toBe(
      'Старая персона'
    );
    expect((screen.getByLabelText(ru['join.form.private_bio']) as HTMLInputElement).value).toBe(
      'секрет'
    );

    await submitViaCta();
    await waitFor(() => expect(mockedApi.createRoomUser).toHaveBeenCalled());
    expect(mockedApi.createRoomUser).toHaveBeenCalledWith(room.address, {
      name: 'Старая персона',
      private_bio: 'секрет',
      invite_code: '123456',
      token: 'generated-raw-token' // a NEWLY generated token
    });
    await tick();
    await tick();
    // Both vault entries remain: the old persona untouched, the new appended.
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]') as Array<{
      userAddress: string;
      roomAddress: string;
      token: string;
    }>;
    expect(vault).toHaveLength(2);
    expect(vault[0]).toMatchObject({
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token'
    });
    expect(vault[1]).toMatchObject({
      roomAddress: room.address,
      userAddress: '0xnew',
      token: 'generated-raw-token'
    });
  });

  it('a dead persona (404 on the credentialed read) shows the dead-entry state and keeps the entry (AC 13)', async () => {
    seedVault([
      {
        roomAddress: '0xoldroom',
        userAddress: '0xold',
        token: 'stored-vault-token',
        name: 'Старая персона',
        savedAt: '2026-11-14T10:00:00Z'
      }
    ]);
    mockedApi.getRoomUser.mockRejectedValue(
      new ApiError(404, '/api/room/0xoldroom/user/0xold', 'user not found')
    );

    await openVault();
    await screen.getByRole('button', { name: vaultRow('Старая персона') }).click();
    // Dead-entry copy with the server text appended muted (§3.1 state table).
    await screen.findByText(/Эта персона больше не существует/);
    expect(screen.getByText(/user not found/)).toBeTruthy();
    // The vault entry is NOT removed (append-only).
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault).toHaveLength(1);
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
  });
});

describe('JoinFlow — scanner mount (context *a*, QrScanner public API)', () => {
  it('the scan button opens the overlay; the manual fallback closes it and refocuses the cells (AC 18)', async () => {
    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await screen.getByRole('button', { name: ru['join.scan.open'] }).click();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Manual fallback (§3.8, context a): «Ввести код вручную».
    await screen.getByRole('button', { name: ru['scan.fallback.enter_code'] }).click();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(cells()[0]);
    // Digits intact.
    expect(cells().map((c) => c.value).join('')).toBe('123456');
  });

  it('after closing the scanner the normal code flow still resolves unchanged (AC 18 wiring)', async () => {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);

    render(JoinFlow, { props: {} });
    await screen.getByRole('button', { name: ru['join.scan.open'] }).click();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // The §3.8 manual fallback closes the overlay (the real scanner fires
    // onInviteCode itself); manual entry continues to work identically.
    await screen.getByRole('button', { name: ru['scan.fallback.enter_code'] }).click();
    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledWith('123456');
  });
});
