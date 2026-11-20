/** JoinFlow component tests (TZ-03 + TZ2-06 Part B, DESIGN §3.1 rev. 3):
 * DigitInput → resolve → preview hand-off, deep-link auto-submit, inline 404
 * with preserved digits, persona creation with the client-generated token
 * (exact v2 body; identity + vault written only after 2xx), the §2.9
 * invite-code rejection state, 409, the RETURN-TO-EVENT vault screen
 * (Concept §10.1.1 / DESIGN §4.11.1 — amends §6.2 import semantics: the
 * Step-1 entry point, stored-token validation, identity restore → /room,
 * dead/stale entry handling, the copy flow REMOVED), the empty-vault state,
 * and the scanner mount (QrScanner public API). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
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
    createRoomUser: vi.fn(),
    addUserInterests: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { InviteResolveError, resolveInviteCode } from '#lib/api/invite-resolve';
import { api } from '#lib/api/client';
import { clearIdentity, identity, saveIdentity } from '#lib/stores/identity';
import JoinFlow from '../src/lib/components/join/JoinFlow.svelte';
import VaultList from '../src/lib/components/join/VaultList.svelte';
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
    // v2.4 (§4.11.1): the copy-flow import option is REMOVED from the room
    // preview — the vault screen is return-to-event, reachable from Step 1.
    expect(screen.queryByRole('button', { name: ru['join.import.title'] })).toBeNull();
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

});

describe('JoinFlow — persona creation via the creation wizard (v3.9, token in the body)', () => {
  /**
   * v3.9 (Concept §22.3 item 2, DESIGN §4.16.2): the single form is the
   * chat-style CreationWizard now — the drive helper walks it: intro →
   * name → (public/private bios) → contact (skippable) → interests
   * (skippable) → creating (the loading step while JoinFlow POSTs the
   * persona with the UNCHANGED v2 body).
   */
  const next = (): HTMLElement => screen.getByRole('button', { name: ru['join.wizard.next'] });

  async function openWizard(): Promise<void> {
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    render(JoinFlow, { props: {} });
    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.create_persona'] }).click();
    await screen.findByText(ru['join.wizard.intro.title']);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
  }

  async function answerName(value: string): Promise<void> {
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value } });
    await next().click();
    await screen.findByText(ru['join.wizard.public.question']);
  }

  /** Walk bios empty + skip contact + skip interests → the creating step. */
  async function skipToInterviewEnd(): Promise<void> {
    await next().click(); // public bio (empty allowed)
    await screen.findByText(ru['join.wizard.private.question']);
    await next().click(); // private bio (empty allowed)
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.interests.skip'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
  }

  it('blocks the empty-name submit client-side with the field error (AC 7)', async () => {
    await openWizard();
    await next().click();
    await tick();
    expect(screen.getByText(ru['join.error.name_required'])).toBeTruthy();
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
  });

  it('success sends the exact v2 body (name, bios, invite_code, generated token; no auth header), saves identity + vault, navigates (AC 8)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    await openWizard();
    await answerName('Я');
    await skipToInterviewEnd();

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

  it('creation rejected over the invite code shows the §2.9 copy inline at the loading step, writes no identity/vault (AC 9)', async () => {
    mockedApi.createRoomUser.mockRejectedValue(
      new ApiError(401, '/api/room/r/user', 'invite code invalid or expired')
    );
    await openWizard();
    await answerName('Я');
    await skipToInterviewEnd();
    await screen.findByText(ru['join.error.invite']);
    // No identity, no vault entry; the draft state survives for a retry.
    expect(localStorage.getItem('bleak.identity')).toBeNull();
    expect(localStorage.getItem('bleak.tokenVault')).toBeNull();
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
  });

  it('server 409 surfaces the name-taken copy with the retry affordance (AC 10)', async () => {
    mockedApi.createRoomUser.mockRejectedValue(
      new ApiError(409, '/api/room/r/user', 'name taken')
    );
    await openWizard();
    await answerName('Дубль');
    await skipToInterviewEnd();
    await screen.findByText(ru['join.error.name_taken']);
    // The retry re-submits the SAME draft (the name value is preserved).
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Дубль'));
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(mockedApi.createRoomUser).toHaveBeenCalledTimes(2));
    expect(mockedApi.createRoomUser.mock.calls[1]?.[1]).toMatchObject({ name: 'Дубль' });
  });

  // §4.14.3 (Concept §14.1.3): the contact question — client-LOCAL data,
  // persisted to bleak.contactCard AFTER the persona 2xx, never sent.
  it('the contact value input carries the §14.1.3 hint and nothing contact-bearing is stored before the 2xx (§4.14.3)', async () => {
    await openWizard();
    await answerName('Я');
    await next().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await next().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    // Choose the TYPE first (phone), then enter the value.
    await screen.getByRole('radio', { name: ru['join.wizard.contact.phone'] }).click();
    const valueInput = screen.getByLabelText(ru['join.wizard.contact.phone']) as HTMLInputElement;
    expect(valueInput.value).toBe('');
    expect(screen.getByText(ru['join.form.contact_hint'])).toBeTruthy();
    // Nothing contact-bearing typed yet → the store is untouched.
    expect(localStorage.getItem('bleak.contactCard')).toBeNull();
  });

  it('success persists the composed contact ONLY to bleak.contactCard — the API body carries no contact (§4.14.3)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    await openWizard();
    await answerName('Я');
    await next().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await next().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.phone'] }).click();
    const valueInput = screen.getByLabelText(ru['join.wizard.contact.phone']) as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: '  +7 999 123-45-67  ' } });
    await next().click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.interests.skip'] }).click();
    await screen.findByText(ru['join.wizard.creating']);

    await waitFor(() => expect(mockedApi.createRoomUser).toHaveBeenCalled());
    // NOTHING contact-bearing over the wire: the exact v2 body stays
    // name + bios + invite_code + token.
    const body = mockedApi.createRoomUser.mock.calls[0]?.[1] as unknown as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty('contact');
    expect(JSON.stringify(body)).not.toContain('+7 999');

    // Flush the continuation (identity + contactCard + vault + goto).
    await tick();
    await tick();
    const card = JSON.parse(localStorage.getItem('bleak.contactCard') ?? '{}') as Record<
      string,
      string
    >;
    // Composed as "<kind label>: <value>" — trimmed, the kind first.
    expect(card[`${room.address}|0xme`]).toBe('Телефон: +7 999 123-45-67');
  });

  it('failed creation (§2.9 invite rejection) persists NO contact card (§4.14.3)', async () => {
    mockedApi.createRoomUser.mockRejectedValue(
      new ApiError(401, '/api/room/r/user', 'invite code invalid or expired')
    );
    await openWizard();
    await answerName('Я');
    await next().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await next().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.phone'] }).click();
    const valueInput = screen.getByLabelText(ru['join.wizard.contact.phone']) as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: '+7 999' } });
    await next().click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.interests.skip'] }).click();
    await screen.findByText(ru['join.error.invite']);
    expect(localStorage.getItem('bleak.contactCard')).toBeNull();
  });

  // §13.1.1: the interview's interests are flushed AFTER the persona 2xx —
  // one bulk addUserInterests (the saved identity carries the Bearer), the
  // 201 FULL list mirrors into the local store.
  it('success flushes the selected interests through ONE post-2xx addUserInterests and mirrors the 201 list (§13.1.1)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    const full: unknown = [
      { title: 'Бег', group: 2, key: 12, user_address: '0xme' },
      { title: 'Велосипед', group: 2, key: 13, user_address: '0xme' }
    ];
    mockedApi.addUserInterests.mockResolvedValue(full as never);
    await openWizard();
    await answerName('Я');
    await next().click(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    await next().click(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.2'] }).click();
    await screen.findByText(
      ru['join.wizard.interests.pick_question'].replace('{group}', ru['interests.group.2'])
    );
    await screen.getByRole('button', { name: ru['interests.k12'] }).click();
    await screen.getByRole('button', { name: ru['interests.k13'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.creating']);

    await waitFor(() => expect(mockedApi.addUserInterests).toHaveBeenCalled());
    // The rows are the tz5-02 catalog entries with the current-locale titles.
    expect(mockedApi.addUserInterests).toHaveBeenCalledWith(room.address, '0xme', [
      { title: 'Бег', group: 2, key: 12 },
      { title: 'Велосипед', group: 2, key: 13 }
    ]);
    await tick();
    await tick();
    // The 201 FULL list is mirrored per room|user.
    const mirror = JSON.parse(localStorage.getItem('bleak.interests') ?? '{}');
    expect(mirror[`${room.address}|0xme`]).toEqual(full);
    expect(goto).toHaveBeenCalledWith('/room');
    // The createPersona body stays unchanged (interests ride separately).
    expect(mockedApi.createRoomUser.mock.calls[0]?.[1]).not.toHaveProperty('interests');
  });

  it('a failed interests flush does NOT undo the creation — the flow still enters the room (§13.1.1)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    mockedApi.addUserInterests.mockRejectedValue(new ApiError(500, '/api/interest', 'boom'));
    await openWizard();
    await answerName('Я');
    await next().click();
    await screen.findByText(ru['join.wizard.private.question']);
    await next().click();
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.2'] }).click();
    await screen.findByText(
      ru['join.wizard.interests.pick_question'].replace('{group}', ru['interests.group.2'])
    );
    await screen.getByRole('button', { name: ru['interests.k12'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
    await waitFor(() => expect(mockedApi.addUserInterests).toHaveBeenCalled());
    await tick();
    await tick();
    // The persona IS created and the flow navigates; no mirror row written.
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toMatchObject({
      userAddress: '0xme'
    });
    expect(localStorage.getItem('bleak.interests')).toBeNull();
    expect(goto).toHaveBeenCalledWith('/room');
  });
});

describe('JoinFlow — return-to-event vault screen (Concept §10.1.1, §4.11.1)', () => {
  function vaultRow(name: string): string {
    return ru['join.import.row_aria'].replace('{name}', name);
  }

  function seedVault(entries: unknown[]): void {
    localStorage.setItem('bleak.tokenVault', JSON.stringify(entries));
  }

  const savedEntry = {
    roomAddress: '0xoldroom',
    userAddress: '0xold',
    token: 'stored-vault-token',
    name: 'Старая персона',
    savedAt: '2026-11-14T10:00:00Z'
  };

  async function openVault(): Promise<void> {
    seedVault([savedEntry]);
    render(JoinFlow, { props: {} });
    // The Step-1 entry point: shown when the device vault is non-empty —
    // the path BACK after "join another event".
    await screen.getByRole('button', { name: ru['join.import.title'] }).click();
    await screen.findByText(ru['join.import.subtitle']);
  }

  it('an empty vault shows NO Step-1 return entry (nothing to return to)', async () => {
    render(JoinFlow, { props: {} });
    expect(screen.queryByRole('button', { name: ru['join.import.title'] })).toBeNull();
  });

  it('the picker lists ONLY bleak.tokenVault entries — no server room listing call (AC 11)', async () => {
    await openVault();
    expect(screen.getByText('Старая персона')).toBeTruthy();
    // Concept §7.1.7: the room address is no longer displayed on the row —
    // the muted line shows only the saved date.
    expect(screen.queryByText(/комната/)).toBeNull();
    expect(screen.getByText(/Сохранено/)).toBeTruthy();
    // The row is visually marked as RETURN (badge + aria-label, §4.11.1).
    expect(screen.getByText(ru['join.import.return'])).toBeTruthy();
    expect(screen.getByRole('button', { name: vaultRow('Старая персона') })).toBeTruthy();
    // The picker never talks to the server: no GET /api/room at all — the
    // screen is reachable directly from Step 1, without resolving a code.
    expect(mockedApi.getRoom).not.toHaveBeenCalled();
    expect(mockedApi.listRoomUsers).not.toHaveBeenCalled();
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
  });

  it('picking an entry validates the STORED token and ENTERS that room: identity restore → /room, NO re-creation (AC 12 amended)', async () => {
    mockedApi.getRoomUser.mockResolvedValue(
      user('0xold', 'Старая персона', 'секрет')
    );

    await openVault();
    await screen.getByRole('button', { name: vaultRow('Старая персона') }).click();

    // Validation read: the Bearer token equals the vault entry's stored one.
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    expect(mockedApi.getRoomUser).toHaveBeenCalledWith('0xoldroom', '0xold', {
      token: 'stored-vault-token'
    });
    await tick();
    await tick();
    // Identity restore from the entry fields (saveIdentity), then the same
    // post-join path a normal join takes. No persona POST anywhere.
    expect(get(identity)).toEqual({
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token'
    });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toEqual({
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token'
    });
    expect(goto).toHaveBeenCalledWith('/room');
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
    // The vault entry is untouched (append-only; no re-creation appended).
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault).toHaveLength(1);
  });

  it('a dead persona (404 on the credentialed read) shows the dead-entry state, does NOT enter, keeps the entry (AC 13)', async () => {
    mockedApi.getRoomUser.mockRejectedValue(
      new ApiError(404, '/api/room/0xoldroom/user/0xold', 'user not found')
    );

    await openVault();
    await screen.getByRole('button', { name: vaultRow('Старая персона') }).click();
    // Dead-entry copy with the server text appended muted (§3.1 state table).
    await screen.findByText(/Этот профиль больше не существует/);
    expect(screen.getByText(/user not found/)).toBeTruthy();
    await tick();
    // No identity restore, no navigation, no creation.
    expect(get(identity)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
    // The vault entry is NOT removed (append-only).
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault).toHaveLength(1);
  });

  it('a stale stored token (401) shows the dead-note treatment and does NOT enter (§4.11.1; the §2.8 global gate fires underneath)', async () => {
    mockedApi.getRoomUser.mockRejectedValue(
      new ApiError(401, '/api/room/0xoldroom/user/0xold', 'token expired')
    );

    await openVault();
    await screen.getByRole('button', { name: vaultRow('Старая персона') }).click();
    await screen.findByText(/Этот профиль больше не существует/);
    expect(screen.getByText(/token expired/)).toBeTruthy();
    await tick();
    expect(get(identity)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
    expect(mockedApi.createRoomUser).not.toHaveBeenCalled();
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault).toHaveLength(1);
  });

  it('the owner round-trip after a local leave (Concept §11.1.1 + §10.1.1): clearIdentity — the whole client-side leave — keeps the vault entry; the pick validates the stored token and enters the room', async () => {
    // Join-time device state: the active identity + the saved vault entry.
    seedVault([savedEntry]);
    saveIdentity({
      roomAddress: savedEntry.roomAddress,
      userAddress: savedEntry.userAddress,
      token: savedEntry.token
    });
    mockedApi.getRoomUser.mockResolvedValue(user('0xold', 'Старая персона'));
    // The leave is PURELY LOCAL (§11.1.1): its entire client-side effect is
    // clearIdentity (identity + the one-time mutual code) — no server
    // delete call anywhere, so the vault entry (and thus the return path)
    // stays intact.
    clearIdentity();
    expect(get(identity)).toBeNull();
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')).toEqual([savedEntry]);

    // The return-to-event pick (the owner's exact repro: import screen →
    // the persona STILL EXISTS on the server) → identity restore → /room.
    await openVault();
    await screen.getByRole('button', { name: vaultRow('Старая персона') }).click();
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    expect(mockedApi.getRoomUser).toHaveBeenCalledWith('0xoldroom', '0xold', {
      token: 'stored-vault-token'
    });
    await tick();
    await tick();
    expect(get(identity)).toEqual({
      roomAddress: '0xoldroom',
      userAddress: '0xold',
      token: 'stored-vault-token'
    });
    expect(goto).toHaveBeenCalledWith('/room');
    // The vault entry is untouched (append-only).
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')).toEqual([savedEntry]);
  });

  it('the empty-vault state shows the specified copy with a way back (VaultList direct render; the Step-1 entry is gated on a non-empty vault)', async () => {
    render(VaultList, { props: { entries: [] } });
    expect(screen.getByText(ru['join.import.empty'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    // No persona-creation escape hatch on the return screen — creation
    // lives behind the code entry (the back link leaves the screen).
    expect(screen.queryByRole('button', { name: ru['join.create_persona'] })).toBeNull();
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

});

describe('JoinFlow — digit-row layout inside the card at 320/360/390 (Concept §12.2, DESIGN §4.12.1 item 6)', () => {
  /**
   * happy-dom runs no layout engine (component CSS is not applied — the
   * same limitation the radar orbit tests document), so the width
   * regression is verified BEHAVIORALLY as the flex layout math the
   * browser runs, over every required phone width (320/360/390), driven
   * by the real tokens and the real DOM structure (render JoinFlow, count
   * the row's cells).
   *
   * Root cause of the re-fix (task 56): the task-53 cell flexibility
   * (flex 1 1 0 / min-width 0 / max-width 56px) never ENGAGED —
   * `.digit-input` sat inside CodeEntry's `.cells` flex row as an
   * unconstrained flex item (min-width: auto): it sized to its capped
   * content (6×56px + 5×gap = 376px) and never shrank, so the row
   * overflowed the card's content box at ALL THREE widths (224/264/294px
   * at 320/360/390). Fix: `.cells` is a plain block and `.digit-input` is
   * width-constrained (width: 100%; min-width: 0) — the row tracks the
   * content box and the cells then grow/shrink inside it.
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }
  function token(name: string): number {
    const match = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8').match(
      new RegExp(`--${name}:\\s*(\\d+)px`)
    );
    if (!match?.[1]) throw new Error(`token --${name} (px) not found in tokens.css`);
    return Number(match[1]);
  }

  const GAP = token('space-2'); // cell gap (var(--space-2))
  const PADDING = token('space-5'); // join container AND card padding
  const CELL_CAP = 56; // the design cell size (max-width)
  /** Card content box at viewport W: join side padding ×2 + card padding ×2. */
  function contentBox(viewport: number): number {
    return viewport - 2 * PADDING - 2 * PADDING;
  }
  /**
   * The browser's flex algorithm for this row: container = content box,
   * items flex-basis 0 / grow 1 / max-width 56, gap between items. Under
   * the width-constrained row the cells grow to fill the box, clamped at
   * the cap; the row is the items + gaps. Returns { cell, row }.
   */
  function flexRow(viewport: number): { cell: number; row: number } {
    const box = contentBox(viewport);
    const free = box - 5 * GAP; // space after the fixed gaps
    const cell = Math.min(CELL_CAP, free / 6); // grow: free / 6 each, capped
    return { cell, row: 6 * cell + 5 * GAP };
  }

  it('diagnosis: the 376px content-locked row overflowed ALL THREE required widths', () => {
    const locked = 6 * CELL_CAP + 5 * GAP;
    expect(locked).toBe(376);
    for (const viewport of [320, 360, 390]) {
      expect(locked).toBeGreaterThan(contentBox(viewport));
    }
    expect(contentBox(320)).toBe(224);
    expect(contentBox(360)).toBe(264);
    expect(contentBox(390)).toBe(294);
  });

  it('behavior: the row fits the card content box at 320px, 360px AND 390px', () => {
    for (const viewport of [320, 360, 390]) {
      const { cell, row } = flexRow(viewport);
      const box = contentBox(viewport);
      expect(row, `viewport ${viewport}px`).toBeLessThanOrEqual(box);
      // Exactly fits — the row tracks the content box (no dead side gaps
      // that could hide a lock), cells stay a usable digit target.
      expect(row, `viewport ${viewport}px`).toBe(box);
      expect(cell, `viewport ${viewport}px`).toBeGreaterThanOrEqual(24);
      expect(cell, `viewport ${viewport}px`).toBeLessThanOrEqual(CELL_CAP);
    }
    // Wide screens unchanged: the cells cap at the 56px design size.
    expect(flexRow(720).cell).toBe(CELL_CAP);
  });

  it('structure: the rendered JoinFlow row is the 6-cell flex row the math applies to', () => {
    render(JoinFlow, { props: {} });
    const group = screen.getByRole('group', { name: ru['join.code.label'] });
    expect(group.className).toMatch(/digit-input/);
    expect(group.querySelectorAll('input')).toHaveLength(6);
  });

  it('CSS contract: the row is width-constrained and NOT nested in a flex container', () => {
    // The re-fix: .digit-input tracks the content box (no min-content lock).
    const digitCss = source('src/lib/components/DigitInput.svelte');
    expect(digitCss).toMatch(/\.digit-input\s*\{[^}]*width:\s*100%/);
    expect(digitCss).toMatch(/\.digit-input\s*\{[^}]*min-width:\s*0/);
    // Cells: flexible, capped, height (touch target) preserved, token gap.
    expect(digitCss).not.toMatch(/(?<![-\w])width:\s*56px/);
    expect(digitCss).toMatch(/input\s*\{[^}]*flex:\s*1 1 0/);
    expect(digitCss).toMatch(/input\s*\{[^}]*min-width:\s*0/);
    expect(digitCss).toMatch(/input\s*\{[^}]*max-width:\s*56px/);
    expect(digitCss).toMatch(/input\s*\{[^}]*height:\s*56px/);
    expect(digitCss).toMatch(/gap:\s*var\(--space-2\)/);
    expect(digitCss).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // The lock's enabler: CodeEntry's .cells is no longer a flex container —
    // .digit-input must never again sit in it as an unconstrained flex item.
    const entryCss = source('src/lib/components/join/CodeEntry.svelte');
    expect(entryCss).not.toMatch(/\.cells\s*\{[^}]*display:\s*flex/);
    // Long words (title, gone-card room names) wrap instead of overflowing.
    expect(entryCss).toMatch(/h1\s*\{[^}]*overflow-wrap:\s*anywhere/);
    const flowCss = source('src/lib/components/join/JoinFlow.svelte');
    expect(flowCss).toMatch(/\.gone-card h2\s*\{[^}]*overflow-wrap:\s*anywhere/);
  });
});

describe('JoinFlow — phone full-screen forms (Concept §12, DESIGN §4.12.1 item 5)', () => {
  /**
   * happy-dom runs no layout engine and no media-query evaluation, so the
   * phone (<720px) contract is verified the way the repo's established
   * CSS-contract tests do — source reads. Growth reason: new phone
   * breakpoint behavior (v2.6). The contract: at <720px the join card
   * becomes the page — full width/height, no rounded floating chrome, no
   * pixel-corner clip — and the overrides live ONLY inside the
   * `max-width: 719px` query, so desktop (min-width: 720px) rendering is
   * untouched. One treatment covers every surface rendered in the join
   * card: enter-code (CodeEntry + DigitInput), import profile and
   * return-to-event (the §10.1.1 vault screen); the route-level resume
   * card shares it (same join screen).
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }
  /** The phone media block (it is the LAST block in each style). */
  function phoneBlock(css: string): string {
    const match = css.match(/@media \(max-width:\s*719px\)\s*\{([\s\S]*)<\/style>/);
    expect(match, 'phone (max-width: 719px) block not found').toBeTruthy();
    const block = match?.[1] ?? '';
    expect(block, 'empty phone (max-width: 719px) block').not.toBe('');
    return block;
  }
  /** Everything BEFORE the phone query — the desktop rendering contract. */
  function baseCss(css: string): string {
    return css.replace(/@media \(max-width:\s*719px\)[\s\S]*$/, '');
  }

  it('enter-code / import / return: the join card becomes the page at phone widths', () => {
    const phone = phoneBlock(source('src/lib/components/join/JoinFlow.svelte'));
    // Container drops its width cap and gutter — the card spans the viewport.
    expect(phone).toMatch(/\.join\s*\{[^}]*max-width:\s*none/);
    expect(phone).toMatch(/\.join\s*\{[^}]*padding:\s*0/);
    // The card loses the floating chrome (radius + pixel-corner clip) and
    // fills the viewport height; its --space-5 padding stays the gutter.
    expect(phone).toMatch(/\.card\s*\{[^}]*border-radius:\s*0/);
    expect(phone).toMatch(/\.card\s*\{[^}]*clip-path:\s*none/);
    expect(phone).toMatch(/\.card\s*\{[^}]*flex:\s*1/);
    // Tokens only (sweep discipline).
    expect(phone).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // The task-56 fix is preserved underneath: the digit row stays
    // width-constrained, so it is in bounds at EVERY phone width.
    const digitCss = source('src/lib/components/DigitInput.svelte');
    expect(digitCss).toMatch(/\.digit-input\s*\{[^}]*width:\s*100%/);
    expect(digitCss).toMatch(/\.digit-input\s*\{[^}]*min-width:\s*0/);
  });

  it('the resume card (the same join screen) carries the identical treatment', () => {
    const phone = phoneBlock(source('src/routes/+page.svelte'));
    expect(phone).toMatch(/\.join\s*\{[^}]*max-width:\s*none/);
    expect(phone).toMatch(/\.join\s*\{[^}]*padding:\s*0/);
    expect(phone).toMatch(/\.resume\s*\{[^}]*border-radius:\s*0/);
    expect(phone).toMatch(/\.resume\s*\{[^}]*clip-path:\s*none/);
    expect(phone).toMatch(/\.resume\s*\{[^}]*flex:\s*1/);
    expect(phone).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('desktop is untouched: the overrides exist only inside the phone query', () => {
    for (const file of [
      'src/lib/components/join/JoinFlow.svelte',
      'src/routes/+page.svelte'
    ]) {
      const css = source(file);
      // The desktop block is intact.
      expect(css, file).toMatch(/@media \(min-width:\s*720px\)/);
      // Each chrome-dropping declaration appears exactly once in the file —
      // inside the 719px query, never in the base (desktop) rules.
      for (const decl of ['border-radius: 0', 'clip-path: none', 'max-width: none']) {
        expect(css.split(decl).length - 1, `${file}: "${decl}"`).toBe(1);
      }
      const base = baseCss(css);
      expect(base).not.toContain('border-radius: 0');
      expect(base).not.toContain('clip-path: none');
      expect(base).not.toContain('max-width: none');
    }
  });
});
