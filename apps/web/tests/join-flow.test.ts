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
    createRoomUser: vi.fn()
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
