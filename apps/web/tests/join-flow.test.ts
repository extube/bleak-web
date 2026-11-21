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

describe('JoinFlow — persona creation via the creation wizard (v3.9 + §23.2 amendments, token in the body)', () => {
  /**
   * v3.9 (Concept §22.3 item 2, DESIGN §4.16.2; §23.2 5.1–5.9): the single
   * form is the chat-style CreationWizard now — the drive helper walks it:
   * intro → name → (public/private bios via the iOS-Messages composer:
   * send on Enter or the button, no Next) → contact (skippable) → the
   * THEMES loop (badge → topics → back to badges; Ready ends it) →
   * creating (the loading step while JoinFlow POSTs the persona with the
   * UNCHANGED v2 body).
   */
  const send = (): HTMLElement => screen.getByRole('button', { name: ru['join.wizard.send'] });

  /** §24 item 2: an EMPTY composer input shows the revert arrow (no send
   * button) — an empty bio is sent via Enter (the composer form submit). */
  function submitComposer(): void {
    const form = document.querySelector<HTMLFormElement>('.input-row')!;
    fireEvent.submit(form);
  }

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
    await tick();
    await tick(); // the send button only exists once the typed value is in state
    await send().click();
    await screen.findByText(ru['join.wizard.public.question']);
  }

  /** Walk bios empty (Enter — the swap slot holds the arrow when empty)
   * + skip contact + Ready → the creating step. */
  async function skipToInterviewEnd(): Promise<void> {
    submitComposer(); // public bio (empty allowed)
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private bio (empty allowed)
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
  }

  it('blocks the empty-name submit client-side with the field error (AC 7)', async () => {
    await openWizard();
    submitComposer(); // empty name — Enter still submits (the arrow occupies the swap slot)
    await tick();
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
    // §23.2 5.9: goto follows the card's fade-out (the boundary into /room).
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'));
  });

  it('creation rejected over the invite code shows the §2.9 copy inline at the loading step, writes no identity/vault (AC 9)', async () => {    mockedApi.createRoomUser.mockRejectedValue(
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

  it('the contact value input is local-only and nothing contact-bearing is stored before the 2xx (§4.14.3; §24 item 10 — the hint is gone)', async () => {
    await openWizard();
    await answerName('Я');
    submitComposer(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    // Choose the TYPE first (phone), then enter the value.
    await screen.getByRole('radio', { name: ru['join.wizard.contact.phone'] }).click();
    const valueInput = screen.getByLabelText(ru['join.wizard.contact.phone']) as HTMLInputElement;
    expect(valueInput.value).toBe('');
    // §24 item 10: the device-storage footer note is removed from the chat.
    expect(screen.queryByText(/Хранится только на этом устройстве/)).toBeNull();
    // Nothing contact-bearing typed yet → the store is untouched.
    expect(localStorage.getItem('bleak.contactCard')).toBeNull();
  });

  it('success persists the composed contact ONLY to bleak.contactCard — the API body carries no contact (§4.14.3)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    await openWizard();
    await answerName('Я');
    submitComposer(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.phone'] }).click();
    const valueInput = screen.getByLabelText(ru['join.wizard.contact.phone']) as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: '  +7 999 123-45-67  ' } });
    await tick();
    await tick(); // the send button only exists once the typed value is in state
    await send().click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
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
    submitComposer(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('radio', { name: ru['join.wizard.contact.phone'] }).click();
    const valueInput = screen.getByLabelText(ru['join.wizard.contact.phone']) as HTMLInputElement;
    fireEvent.input(valueInput, { target: { value: '+7 999' } });
    await tick();
    await tick(); // the send button only exists once the typed value is in state
    await send().click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    await screen.findByText(ru['join.error.invite']);
    expect(localStorage.getItem('bleak.contactCard')).toBeNull();
  });

  // §13.1.1 + §23.2 5.5: the interview's topics are flushed AFTER the
  // persona 2xx — one bulk addUserInterests (the saved identity carries
  // the Bearer) with the THEMES title composition `<theme>:<topic>`; the
  // 201 FULL list mirrors into the local store.
  it('success flushes the selected topics through ONE post-2xx addUserInterests with the theme:topic titles (§13.1.1 + §23.2 5.5)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    const full: unknown = [
      { title: 'sport:hockey', group: 1, key: 7, user_address: '0xme' },
      { title: 'sport:running', group: 1, key: 8, user_address: '0xme' }
    ];
    mockedApi.addUserInterests.mockResolvedValue(full as never);
    await openWizard();
    await answerName('Я');
    submitComposer(); // public
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.1'] }).click();
    await screen.findByText(
      ru['join.wizard.interests.pick_question'].replace('{group}', ru['interests.group.1'])
    );
    await screen.getByRole('button', { name: ru['interests.k7'] }).click();
    await screen.getByRole('button', { name: ru['interests.k8'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    await screen.findByText(ru['join.wizard.creating']);

    await waitFor(() => expect(mockedApi.addUserInterests).toHaveBeenCalled());
    // The rows are the §23.2 5.5 theme/topic composition over the numeric
    // (group, key) server contract.
    expect(mockedApi.addUserInterests).toHaveBeenCalledWith(room.address, '0xme', [
      { title: 'sport:hockey', group: 1, key: 7 },
      { title: 'sport:running', group: 1, key: 8 }
    ]);
    await tick();
    await tick();
    // The 201 FULL list is mirrored per room|user.
    const mirror = JSON.parse(localStorage.getItem('bleak.interests') ?? '{}');
    expect(mirror[`${room.address}|0xme`]).toEqual(full);
    // §23.2 5.9: goto follows the card's fade-out (the boundary into /room).
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'));
    // The createPersona body stays unchanged (interests ride separately).
    expect(mockedApi.createRoomUser.mock.calls[0]?.[1]).not.toHaveProperty('interests');
  });

  it('a failed interests flush does NOT undo the creation — the flow still enters the room (§13.1.1)', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    mockedApi.addUserInterests.mockRejectedValue(new ApiError(500, '/api/interest', 'boom'));
    await openWizard();
    await answerName('Я');
    submitComposer(); // public (empty)
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private (empty)
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('radio', { name: ru['interests.group.1'] }).click();
    await screen.findByText(
      ru['join.wizard.interests.pick_question'].replace('{group}', ru['interests.group.1'])
    );
    await screen.getByRole('button', { name: ru['interests.k7'] }).click();
    await screen.getByRole('button', { name: ru['join.wizard.interests.done'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
    await waitFor(() => expect(mockedApi.addUserInterests).toHaveBeenCalled());
    await tick();
    await tick();
    // The persona IS created and the flow navigates; no mirror row written.
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? 'null')).toMatchObject({
      userAddress: '0xme'
    });
    expect(localStorage.getItem('bleak.interests')).toBeNull();
    // §23.2 5.9: goto follows the card's fade-out (the boundary into /room).
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'));
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
      let css = source(file);
      // tz11-08 (task 109): the persona-scoped :global wrapper rule is the
      // Concept §25 conduit — the page-level .join wrapper is bounded and
      // made a full-width, gutter-free flex conduit ONLY while the creation
      // chat is mounted (the :has(> .persona-step) gate; the other join
      // steps keep their content-driven wrapper geometry). It is exempt
      // from the phone-only chrome check below by design.
      css = css.replace(
        /:global\(\.app-shell > \.join:has\(> \.persona-step\)\)\s*\{[^}]*\}/,
        ''
      );
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

describe('JoinFlow — §23.2 5.9 fade on every creation step boundary (owner amendment, DESIGN §4.15.6.4)', () => {
  /**
   * happy-dom runs no CSS animation engine, so the fade contract is pinned
   * the established way — source reads (the kit's CSS-contract pattern).
   * The owner amendment: the fade treatment covers EVERY step boundary of
   * the whole creation path — form → intro theme → chat (interview) →
   * "creating your profile" loading → app main page — one opacity-only
   * treatment everywhere (the sheets' established fade); §24 item 5
   * slows it to 400ms.
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }

  it('the card content fades in on every join-step swap (form → wizard intro included)', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    // The card content remounts per flow step ({#key}) inside the fading
    // stage — covering the code ⇄ preview ⇄ wizard ⇄ vault swaps.
    expect(css).toMatch(/\{#key flow\.step\}/);
    expect(css).toMatch(/<div class="stage">/);
    expect(css).toMatch(/\.stage\s*\{[^}]*animation:\s*fade-in\s+400ms\s+ease-out/);
    expect(css).toMatch(/@keyframes fade-in\s*\{[\s\S]*?opacity:\s*0[\s\S]*?opacity:\s*1/);
    // The composer-card flex chain survives the wrapper (log scrolls,
    // composer pins to the bottom).
    expect(css).toMatch(
      /\.card\.composer-card\s+\.stage\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/
    );
  });

  it('the loading → /room boundary: the card fades OUT (same treatment) before the route hand-off, skipped under reduced motion', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    expect(css).toMatch(/class:leaving=\{enteringRoom\}/);
    expect(css).toMatch(/\.card\.leaving\s*\{[^}]*animation:\s*fade-out\s+400ms\s+ease-out/);
    expect(css).toMatch(/@keyframes fade-out\s*\{[\s\S]*?opacity:\s*1[\s\S]*?opacity:\s*0/);
    // The goto waits out the fade; prefers-reduced-motion navigates
    // immediately (the base.css catch-all collapses the animation).
    expect(css).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    expect(css).toMatch(/if\s*\(!reducedMotion\)\s*await[^;]*FADE_MS/);
  });

  it('behavior: after the creation 2xx the card takes the leaving fade, then the flow enters /room', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
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
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await tick();
    await tick(); // the send button only exists once the typed value is in state
    await screen.getByRole('button', { name: ru['join.wizard.send'] }).click();
    await screen.findByText(ru['join.wizard.public.question']);
    fireEvent.submit(document.querySelector('form.input-row') as HTMLFormElement); // public (empty)
    await screen.findByText(ru['join.wizard.private.question']);
    fireEvent.submit(document.querySelector('form.input-row') as HTMLFormElement); // private (empty)
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    await screen.getByRole('button', { name: ru['join.wizard.themes.ready'] }).click();
    await screen.findByText(ru['join.wizard.creating']);
    await waitFor(() => expect(mockedApi.createRoomUser).toHaveBeenCalled());
    // The boundary OUT of the loading step: the card fades out first...
    await waitFor(() =>
      expect(document.querySelector('section.card')?.className).toMatch(/leaving/)
    );
    // ...then the route hand-off into /room.
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'));
  });
});

describe('JoinFlow — creation-chat geometry (tz11-06 bug round, task 107 + Concept §25 / DESIGN §4.17)', () => {
  /**
   * Owner bug report (docs/bugs/wizard-autoscroll-1.log): the creation
   * chat stayed scrolled to the TOP and the newest message was partially
   * cut off behind the input bar. Root cause: the height chain was broken
   * — `.join` (a flex item of the min-height:100dvh app-shell) grew with
   * the chat's content via its automatic minimum size, so the card was
   * content-sized, the log's flex:1 never engaged (logEl.scrollTo was a
   * no-op — the PAGE was the scroll container) and the sticky composer
   * overlayed the log's bottom. happy-dom runs no layout engine, so the
   * geometry is pinned the established way — source reads + the rendered
   * DOM structure.
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }

  it('the persona step bounds the height chain so the LOG scrolls, not the page (source pins)', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    // `.join` must not grow with the chat's content (flex-item auto
    // minimum size) — scoped to the persona step only: the other join
    // steps keep their content-driven block layout.
    expect(css).toMatch(/\.join\.persona-step\s*\{[^}]*min-height:\s*0/);
    // The card fills the bounded height (flex: 1, min-height: 0) — the
    // composer then sits below the log in normal flow.
    expect(css).toMatch(/\.card\.composer-card\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.card\.composer-card\s*\{[^}]*min-height:\s*0/);
  });

  it('tz11-08 (task 109, bug round 2): the page-level .join wrapper link ABOVE JoinFlow is bounded for the persona step — the task-107 recurrence root cause', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    // Task 107 bounded this component's own links; routes/+page.svelte
    // still renders JoinFlow inside its own padded 480px <div class="join">
    // wrapper whose automatic minimum size grew with the transcript — the
    // shell then outgrew the viewport, the PAGE scrolled and logEl.scrollTo
    // stayed a visual no-op. The wrapper is outside this component's DOM:
    // :global + :has is the only parent-reach a child stylesheet has, and
    // the persona-step gate leaves the other join steps' wrapper geometry
    // untouched.
    expect(css).toMatch(
      /:global\(\.app-shell > \.join:has\(> \.persona-step\)\)\s*\{[^}]*min-height:\s*0[^}]*\}/
    );
    // The gate never leaks to the wrapper's base state: exactly ONE
    // wrapper rule exists and it is keyed on the persona step, not on
    // `.join` unconditionally.
    const wrapperRules = css.match(/:global\(\.app-shell > \.join[^{]*\{/g) ?? [];
    expect(wrapperRules).toHaveLength(1);
    expect(wrapperRules[0]).toContain(':has(> .persona-step)');
  });

  it('desktop (Concept §25 / DESIGN §4.17): a 750–850px centered column spanning the FULL screen height; the other join steps untouched', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    const desktop = css.slice(css.indexOf('@media (min-width: 720px)'));
    const phoneStart = desktop.indexOf('@media (max-width: 719px)');
    const desktopOnly = phoneStart === -1 ? desktop : desktop.slice(0, phoneStart);
    // Explicit width target (supersedes the 640px §24 7b approximation).
    const match = desktopOnly.match(/\.join\.persona-step\s*\{[^}]*max-width:\s*(\d+)px/);
    expect(match).toBeTruthy();
    const width = Number(match?.[1]);
    expect(width).toBeGreaterThanOrEqual(750);
    expect(width).toBeLessThanOrEqual(850);
    // Full screen height: no vertical gutter around the chat box (the
    // base .join padding is dropped on the persona step — the box reaches
    // the window's top and bottom edges).
    expect(desktopOnly).toMatch(/\.join\.persona-step\s*\{[^}]*padding:\s*0/);
    // The other join steps keep the narrow centered card (untouched).
    expect(desktopOnly).toMatch(/\.join\s*\{[^}]*max-width:\s*480px/);
    // Size/proportions only: no color/hex overrides anywhere in the file.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('structure: in the rendered persona step the composer follows the log — the input bar cannot cover the newest message', async () => {
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
    const log = document.querySelector('ul.log') as HTMLElement;
    const composer = document.querySelector('.composer') as HTMLElement;
    expect(log).toBeTruthy();
    expect(composer).toBeTruthy();
    // Not inside the scrollport — no overlay of log content is possible;
    // after the log in the flex column (composer at the bottom edge).
    expect(log.contains(composer)).toBe(false);
    expect(log.parentElement).toBe(composer.parentElement);
    expect(log.parentElement?.firstElementChild).toBe(log);
    expect(log.parentElement?.lastElementChild).toBe(composer);
  });
});

describe('JoinFlow — creation-chat REAL-GEOMETRY cascade contract (tz11-08, task 109)', () => {
  /**
   * THE bug-round-2 lesson (owner report docs/bugs/wizard-autoscroll-2.log):
   * the task-107 contract passed while the real app misbehaved, because
   * happy-dom runs no layout engine AND — verified empirically — the test
   * environment does not even inject component CSS (0 <style> tags), so
   * scrollTo-spy assertions never saw geometry or cascade. This is the
   * strongest layout-capable contract available WITHOUT new deps (no
   * headless browser exists in the toolchain; none is authorized):
   *
   *   1. the components' REAL <style> blocks are read from source at test
   *      time (no transcription) and injected into the document;
   *   2. the REAL app-shell + page-level .join wrapper structure is seeded
   *      exactly as routes/+layout.svelte + routes/+page.svelte render it;
   *   3. the real JoinFlow is mounted into that fixture and driven to the
   *      persona step;
   *   4. the COMPUTED cascade of the actual rendered chain is asserted
   *      (happy-dom resolves stylesheet cascade incl. :has()).
   *
   * happy-dom still computes no box metrics (getBoundingClientRect stays
   * all-zero), so real-px layout assertions are impossible here — the
   * cascade contract below is what this environment can genuinely verify;
   * the real-browser manual smoke is documented in docs/verification-v311.md.
   * Fidelity caveat: raw pre-scope injection applies both components' `.join`
   * rules to both elements — every property asserted below has the same
   * winning value under Svelte scoping too (checked against the real rules).
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');
  function source(relativePath: string): string {
    return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
  }
  function styleBlock(relativePath: string): string {
    const match = source(relativePath).match(/<style[^>]*>([\s\S]*)<\/style>/);
    expect(match, `<style> block not found in ${relativePath}`).toBeTruthy();
    return match?.[1] ?? '';
  }
  /** Svelte's :global(X) → X (raw injection needs unscoped selectors). */
  function unscope(css: string): string {
    let out = '';
    let i = 0;
    for (;;) {
      const at = css.indexOf(':global(', i);
      if (at === -1) return out + css.slice(i);
      out += css.slice(i, at);
      let depth = 1;
      let j = at + ':global('.length;
      while (j < css.length && depth > 0) {
        if (css[j] === '(') depth += 1;
        else if (css[j] === ')') depth -= 1;
        j += 1;
      }
      out += css.slice(at + ':global('.length, j - 1);
      i = j;
    }
  }

  const injected: HTMLStyleElement[] = [];
  let shell: HTMLElement | null = null;
  const parsedFixtures: HTMLElement[] = [];

  function injectCascadeFixtureCss(): void {
    for (const file of [
      'src/routes/+layout.svelte',
      'src/routes/+page.svelte',
      'src/lib/components/join/JoinFlow.svelte',
      'src/lib/components/join/CreationWizard.svelte'
    ]) {
      const style = document.createElement('style');
      style.setAttribute('data-cascade-contract', file);
      style.textContent = unscope(styleBlock(file));
      document.head.appendChild(style);
      injected.push(style);
    }
  }

  function seedShellAndWrapper(): HTMLElement {
    // The exact rendered ancestor chain of JoinFlow on `/`
    // (routes/+layout.svelte → routes/+page.svelte → JoinFlow).
    shell = document.createElement('div');
    shell.className = 'app-shell';
    const wrapper = document.createElement('div');
    wrapper.className = 'join';
    shell.appendChild(wrapper);
    document.body.appendChild(shell);
    return wrapper;
  }

  function isZeroMin(min: string): boolean {
    return min === '0' || min === '0px';
  }

  afterEach(() => {
    for (const style of injected) style.remove();
    injected.length = 0;
    if (shell) shell.remove();
    shell = null;
    for (const fixture of parsedFixtures) fixture.remove();
    parsedFixtures.length = 0;
  });

  it('the computed chain from ul.log to the app-shell is a bounded flex column ending in the log as the single scroll container', async () => {
    injectCascadeFixtureCss();
    const wrapper = seedShellAndWrapper();
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    // Svelte mount options: mount INTO the seeded wrapper (the page-level
    // .join wrapper is JoinFlow's real DOM parent on `/`).
    render(JoinFlow, { props: {}, target: wrapper });

    // GATE, off-state: at the code step the wrapper does not match the
    // persona gate (the other join steps keep their content-driven
    // geometry — no min-height: 0). The REAL code-step markup is captured
    // now; its computed off-state proof runs below, after the drive (the
    // fixtures are attached only once every screen query is done — an
    // attached fixture would duplicate the flow's UI for the screen*).
    await screen.findByText(ru['join.enter']);
    const wrap = document.querySelector('.app-shell > .join') as HTMLElement;
    expect(wrap).toBeTruthy();
    expect(wrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(false);
    const offHtml = (shell as HTMLElement).outerHTML;

    // Drive to the persona step (the creation chat).
    pasteCode('123456');
    await submitViaCta();
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.create_persona'] }).click();
    await screen.findByText(ru['join.wizard.intro.title']);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const log = document.querySelector('ul.log') as HTMLElement;
    expect(log).toBeTruthy();

    // GATE, on-state on the LIVE rendered tree: the wrapper matches the
    // :has gate once the persona step is mounted.
    expect(wrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(true);

    // THE COMPUTED CASCADE runs on the REAL rendered markup round-tripped
    // through the HTML parser (shell.outerHTML → fresh tree). Reason: the
    // live Svelte-mount-built tree carries a happy-dom :has() evaluation
    // quirk (the combined `.app-shell > .join:has(> .persona-step)` fails
    // in the cascade/matches path when nodes were attached by mount,
    // verified empirically), while an innerHTML-parsed tree — the SAME
    // markup, real classes incl. the Svelte scope hashes — evaluates it
    // correctly. No transcription: every selector below matches the real
    // rendered classes, and the CSS is the real component source. The
    // parsed trees must be CONNECTED: happy-dom resolves computed styles
    // only for elements in the document (detached reads return '').
    function parsedShellOf(html: string): HTMLElement {
      const fixture = document.createElement('div');
      fixture.innerHTML = html;
      document.body.appendChild(fixture);
      parsedFixtures.push(fixture);
      return fixture.children[0] as HTMLElement;
    }
    // Off-state: the code-step markup — the gate is off and the wrapper
    // keeps its content-driven geometry (min-height unset).
    const offShell = parsedShellOf(offHtml);
    const offWrap = offShell.children[0] as HTMLElement;
    expect(offWrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(false);
    expect(isZeroMin(getComputedStyle(offWrap).minHeight)).toBe(false);
    // On-state: the persona-step markup — the gate is on, the wrapper is
    // a bounded, full-width, gutter-free conduit.
    const pShell = parsedShellOf((shell as HTMLElement).outerHTML);
    // The wrapper is the shell's only element child on `/` (no TabBar).
    const pWrap = pShell.children[0] as HTMLElement;
    const pLog = pShell.querySelector('ul.log') as HTMLElement;
    expect(pWrap).toBeTruthy();
    expect(pLog).toBeTruthy();
    expect(pWrap.className).toContain('join');
    expect(pWrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(true);
    expect(getComputedStyle(pWrap).minHeight).toBe('0');
    expect(getComputedStyle(pWrap).maxWidth).toBe('none');

    // THE CHAIN: every flex-item link from the log up to (exclusive) the
    // shell is a flex column with min-height: 0 — one unbounded link is
    // the recurrence bug; the shell provides the 100dvh definite height.
    const bounded: HTMLElement[] = [];
    for (let el = pLog.parentElement; el && el !== pShell; el = el.parentElement) {
      bounded.push(el);
    }
    expect(bounded.length).toBeGreaterThanOrEqual(6); // stage→wizard→stage→card→join→wrapper
    for (const el of bounded) {
      const cs = getComputedStyle(el);
      expect(cs.display, `${el.className} display`).toBe('flex');
      expect(cs.flexDirection, `${el.className} direction`).toBe('column');
      expect(cs.minHeight, `${el.className} min-height`).toBe('0');
    }
    const shellCs = getComputedStyle(pShell);
    expect(shellCs.display).toBe('flex');
    expect(shellCs.flexDirection).toBe('column');
    expect(shellCs.minHeight).toContain('dvh');

    // THE LOG is the scroll container: overflow-y engages on it and on
    // NOTHING else in the whole rendered chain.
    expect(getComputedStyle(pLog).overflowY).toBe('auto');
    expect(getComputedStyle(pLog).flexGrow).toBe('1');
    const scrollers = Array.from(
      pShell.querySelectorAll<HTMLElement>('*')
    ).filter((el) => getComputedStyle(el).overflowY === 'auto');
    expect(scrollers).toEqual([pLog]);
  });
});
