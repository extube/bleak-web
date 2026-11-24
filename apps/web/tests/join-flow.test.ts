/** JoinFlow component tests (TZ-03 + TZ2-06 Part B, DESIGN §3.1 rev. 3;
 * §4.34 entry-flow amendment, Concept §48 owner bug batch 2026-11-23):
 * DigitInput → auto-advance on the 6th digit (§4.34.B — the completion
 * fires the resolve, the submit button stays redundant) → navigation to
 * the intro route, deep-link auto-submit (sharing the same path), inline
 * 404 with preserved digits, the intro route mode (§4.34.C — resolve on
 * mount, both actions, error treatments), the seeded create route
 * (§4.34.D — the param IS the 6-digit code, resolved on mount, NO ?code=;
 * clean create redirect; wizardBack → the intro route), persona creation
 * with the client-generated token (exact v2 body; identity + vault
 * written only after 2xx), the §2.9 invite-code rejection state, 409, the
 * RETURN-TO-EVENT vault screen (Concept §10.1.1 / DESIGN §4.11.1 — amends
 * §6.2 import semantics: the Step-1 entry point, stored-token validation,
 * identity restore → /room, dead/stale entry handling, the copy flow
 * REMOVED), the empty-vault state, and the scanner mount (QrScanner
 * public API). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, NetworkError, type Room, type User } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { income_code?: string }) =>
    params?.income_code ? route.replace('[income_code]', params.income_code) : route
}));

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

/**
 * §4.34 (Concept §48): the entry-flow route map — /income (6-digit entry,
 * auto-advance → navigates) → /income/[income_code] (the intro route,
 * `introParam` mode: resolve on mount, both actions) →
 * /income/[income_code]/create (the wizard, SEEDED via `incomeCodeParam`
 * — the param IS the 6-digit invite code, resolved on mount, NO ?code=).
 */
const SEEDED = { incomeCodeParam: '123456' };

function user(address: string, name: string, privateBio = ''): User {
  return {
    active: true,
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
  // §4.34.C/D: the intro route and the create route resolve the param
  // code on mount — the seeded/intro renders below rely on the default
  // happy-path mocks (individual tests override before render when they
  // need failures).
  mockedResolve.mockResolvedValue({ roomAddress: room.address });
  mockedApi.getRoom.mockResolvedValue(room);
  mockedApi.listRoomUsers.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  identity.set(null);
});

describe('JoinFlow — 6th-digit auto-advance (§4.34.B, Concept §48)', () => {
  /**
   * §4.34.B: after the 6th digit — typed, backspace-refilled, pasted, or
   * prefilled by the ?code= deep link / the scanner — the entry form
   * AUTOMATICALLY performs the resolve; the submit button stays as the
   * redundant affordance. Success NAVIGATES to the room intro route
   * /income/[income_code] (§4.34.A — the in-card Step-2 swap is
   * superseded); failure shows the existing codeErrorOf treatments with
   * the digits preserved. No double-submit: while a resolve is in flight
   * the form is busy (digit edits do not re-trigger, a submit press is a
   * no-op via the resolving guard); a FAILED resolve is not auto-retried.
   */
  it('the 6th digit (pasted) auto-submits: the resolve runs and success navigates to the intro route — no submit press', async () => {
    render(JoinFlow, { props: {} });

    pasteCode('123456');
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledWith('123456'));
    // Success → the intro route with the code in the PATH (nothing in the
    // query); the room preview does NOT render in the card anymore.
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456'));
    expect(screen.queryByText(room.name)).toBeNull();
  });

  it('typing digit by digit triggers on the 6th (no submit press)', async () => {
    render(JoinFlow, { props: {} });

    const inputs = cells();
    for (let i = 0; i < 5; i += 1) {
      fireEvent.input(inputs[i]!, { target: { value: String(i + 1) } });
      await tick();
    }
    expect(mockedResolve).not.toHaveBeenCalled(); // five digits — no fire
    fireEvent.input(cells()[5]!, { target: { value: '6' } });
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456'));
  });

  it('?code=NNNNNN deep link prefills the cells and auto-submits through the same completion path (AC 4)', async () => {
    render(JoinFlow, { props: { deepLinkCode: '654321' } });

    expect(cells().map((c) => c.value).join('')).toBe('654321');
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/654321'));
  });

  it('unknown code shows the 404 copy inline, keeps the digits, does not navigate, does NOT auto-retry (AC 5)', async () => {
    mockedResolve.mockRejectedValue(new InviteResolveError('not_found'));
    render(JoinFlow, { props: {} });

    pasteCode('999999'); // the completion itself auto-submits
    await screen.findByText(ru['join.error.unknown']);
    expect(cells().map((c) => c.value).join('')).toBe('999999');
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(room.name)).toBeNull();
    expect(goto).not.toHaveBeenCalled();
    await tick();
    await tick();
    // The failed attempt is NOT retried automatically (the trigger is the
    // completion event; the next attempt is the user's).
    expect(mockedResolve).toHaveBeenCalledTimes(1);
  });

  it('editing a digit after a failure re-arms the trigger and auto-resolves again; the digits survive every failure (AC 5)', async () => {
    mockedResolve.mockRejectedValueOnce(new InviteResolveError('not_found'));
    render(JoinFlow, { props: {} });

    pasteCode('999999');
    await screen.findByText(ru['join.error.unknown']);
    expect(cells().map((c) => c.value).join('')).toBe('999999');

    // The user edits a digit — the fresh completion fires the resolve.
    fireEvent.input(cells()[5]!, { target: { value: '8' } });
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledWith('999998'));
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/999998'));
  });

  it('seam unreachable shows the NetworkError banner, preserves the code; the redundant submit button re-runs the resolve (AC 6)', async () => {
    mockedResolve.mockRejectedValue(new NetworkError('/api/invite/111111', new Error('offline')));
    render(JoinFlow, { props: {} });

    pasteCode('111111');
    await screen.findByText(ru['common.error.network']);
    expect(cells().map((c) => c.value).join('')).toBe('111111');
    // The CTA stays functional (the redundant affordance): pressing it
    // re-runs the resolution with the preserved digits.
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    await submitViaCta();
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/111111'));
  });

  it('no double-submit: a CTA click while the auto-attempt is in flight is a no-op (the resolving guard)', async () => {
    let release!: (value: { roomAddress: string }) => void;
    mockedResolve.mockReturnValue(
      new Promise<{ roomAddress: string }>((resolve) => {
        release = resolve;
      })
    );
    render(JoinFlow, { props: {} });

    pasteCode('123456');
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledTimes(1));
    // Click the CTA while the resolve is in flight — a no-op.
    await screen.getByRole('button', { name: ru['join.enter'] }).click();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await tick();
    expect(mockedResolve).toHaveBeenCalledTimes(1);
    release({ roomAddress: room.address });
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456'));
    // Still exactly one resolve for the one completion.
    expect(mockedResolve).toHaveBeenCalledTimes(1);
  });

  it('the redundant submit button stays present and works: disabled until 6 digits, resolves a fresh completion', async () => {
    render(JoinFlow, { props: {} });

    const cta = () => screen.getByRole('button', { name: ru['join.enter'] }) as HTMLButtonElement;
    expect(cta().disabled).toBe(true); // 0 digits
    fireEvent.input(cells()[0]!, { target: { value: '1' } });
    await tick();
    expect(cta().disabled).toBe(true); // still incomplete
    pasteCode('123456');
    // The auto-advance resolves immediately; the CTA is busy (disabled)
    // while the resolve is in flight.
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456'));
  });
});

describe('JoinFlow — the entry-flow route map (§4.34.A, Concept §48)', () => {
  /**
   * /income → /income/[income_code] (the intro route, §4.34.C) →
   * /income/[income_code]/create (§4.34.D): the income code (the 6-digit
   * invite code) travels in the PATH PARAM ONLY on both parametrized
   * routes — never in a query string.
   */
  it('the intro route resolves the param code on mount (the param IS the 6-digit invite code) and renders BOTH actions', async () => {
    render(JoinFlow, { props: { introParam: '123456' } });
    await screen.findByText(room.name);
    expect(mockedResolve).toHaveBeenCalledWith('123456');
    expect(mockedApi.getRoom).toHaveBeenCalledWith(room.address);
    expect(mockedApi.listRoomUsers).toHaveBeenCalledWith(room.address);
    expect(screen.getByText('Митап по пиксель-арту')).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.create_persona'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.change_code'] })).toBeTruthy();
  });

  it('"Create profile" on the intro route navigates to /income/<income_code>/create with an EMPTY query string (the ?code= append is removed, §4.34.D)', async () => {
    render(JoinFlow, { props: { introParam: '123456' } });
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.create_persona'] }).click();
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456/create'));
    // Negative: NO internal consumer emits ?code= on the create route.
    expect(goto).not.toHaveBeenCalledWith(expect.stringContaining('?code='));
  });

  it('"Change code" on the intro route goes back to /income (§4.34.C)', async () => {
    render(JoinFlow, { props: { introParam: '123456' } });
    await screen.findByText(room.name);
    await screen.getByRole('button', { name: ru['join.change_code'] }).click();
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income'));
  });

  it('the intro route resolving treatment: shell + spinner only, the footer actions disabled until the room context is present (no skeleton)', async () => {
    let release!: (value: { roomAddress: string }) => void;
    mockedResolve.mockReturnValue(
      new Promise<{ roomAddress: string }>((resolve) => {
        release = resolve;
      })
    );
    const { container } = render(JoinFlow, { props: { introParam: '123456' } });

    // While resolving: the shell renders (header/locale + mascot + title),
    // the content region shows the small inline spinner, no skeleton, and
    // the footer actions are disabled.
    expect(container.querySelector('.shell-header [role="radiogroup"]')).toBeTruthy();
    expect(container.querySelector('.mascot-row')).toBeTruthy();
    expect(container.querySelector('.intro-title')?.textContent).toBe(ru['join.title']);
    expect(container.querySelector('.spinner')).toBeTruthy();
    expect(container.querySelector('.skeleton')).toBeNull();
    const buttons = Array.from(container.querySelectorAll('.shell-footer button')) as HTMLButtonElement[];
    expect(buttons).toHaveLength(2);
    expect(buttons.every((b) => b.disabled)).toBe(true);
    release({ roomAddress: room.address });
    await screen.findByText(room.name);
    // Once resolved, BOTH actions are enabled.
    const resolvedButtons = Array.from(
      container.querySelectorAll('.shell-footer button')
    ) as HTMLButtonElement[];
    expect(resolvedButtons.every((b) => !b.disabled)).toBe(true);
  });

  it('a dead param (404 on the resolve) shows the code-not-found treatment; Change code goes back to /income (§4.34.C)', async () => {
    mockedResolve.mockRejectedValue(new InviteResolveError('not_found'));
    render(JoinFlow, { props: { introParam: '999999' } });
    await screen.findByText(ru['join.error.unknown']);
    expect(goto).not.toHaveBeenCalled();
    await screen.getByRole('button', { name: ru['join.change_code'] }).click();
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income'));
  });

  it('a malformed-looking param shows the same treatment with NO API call (§4.34.C)', async () => {
    render(JoinFlow, { props: { introParam: 'not-a-code' } });
    await screen.findByText(ru['join.error.unknown']);
    expect(mockedResolve).not.toHaveBeenCalled();
  });

  it('a room deleted meanwhile (404 on the room read) shows the gone card; its Change code action goes back to /income', async () => {
    mockedApi.getRoom.mockRejectedValue(new ApiError(404, '/api/room/x', 'room deleted'));
    render(JoinFlow, { props: { introParam: '123456' } });
    await screen.findByText(ru['join.error.gone']);
    await screen.getByRole('button', { name: ru['join.change_code'] }).click();
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income'));
  });

  it('a network failure on the intro route shows the banner with a working retry (§4.34.C)', async () => {
    mockedResolve.mockRejectedValue(new NetworkError('/api/invite/123456', new Error('offline')));
    render(JoinFlow, { props: { introParam: '123456' } });
    await screen.findByText(ru['common.error.network']);
    // Retry re-runs the intro resolve.
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await screen.findByText(room.name);
  });

  it('the create route seeds from the path param only: resolve on mount opens the wizard (§4.34.D, NO ?code=)', async () => {
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['join.wizard.intro.title']);
    // The seeded resolve ran with the param (the 6-digit code).
    expect(mockedResolve).toHaveBeenCalledWith('123456');
    expect(mockedApi.getRoom).toHaveBeenCalledWith(room.address);
    // The entry steps never rendered: no digit cells.
    expect(screen.queryByRole('group', { name: ru['join.code.label'] })).toBeNull();
    // The seeded code is carried into the persona submit (AC 8 asserts
    // the exact body with invite_code '123456' through this same seed).
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
  });

  it('the seeded create route: a network failure shows the banner with retry (no dead-end blank shell, §4.34.D)', async () => {
    mockedResolve.mockRejectedValue(new NetworkError('/api/invite/123456', new Error('offline')));
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['common.error.network']);
    expect(goto).not.toHaveBeenCalled();
    // Retry re-runs the seed resolve.
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await screen.findByText(ru['join.wizard.intro.title']);
  });

  it('the seeded create route: an unresolvable param redirects to /income with replaceState (the §4.31.D rule, §4.34.D)', async () => {
    mockedResolve.mockRejectedValue(new InviteResolveError('not_found'));
    render(JoinFlow, { props: SEEDED });
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income', { replaceState: true }));
  });

  it('wizard back on the create route lands on the INTRO route (param-only — the /income?code= round-trip is superseded, §4.34.D)', async () => {
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['join.wizard.intro.title']);
    // The intro's revert arrow (the back control, §24 item 2).
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456'));
    // Negative: no ?code= emission anywhere.
    expect(goto).not.toHaveBeenCalledWith(expect.stringContaining('?code='));
  });

  it('the scanner feeds the code into the cells and the §4.34.B auto-advance takes over (no double resolve)', async () => {
    let release!: (value: { roomAddress: string }) => void;
    mockedResolve.mockReturnValue(
      new Promise<{ roomAddress: string }>((resolve) => {
        release = resolve;
      })
    );
    render(JoinFlow, { props: {} });

    // Simulate the scanner mount point: the code enters the cells as if
    // typed (the completion event then auto-submits).
    pasteCode('123456');
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledTimes(1));
    await tick();
    await tick();
    release({ roomAddress: room.address });
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income/123456'));
    expect(mockedResolve).toHaveBeenCalledTimes(1);
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
    // Seeded render (§4.34.D): the flow mounts at /income/[income_code]/create
    // directly IN the wizard step — the income-code param (resolved on
    // mount).
    render(JoinFlow, { props: SEEDED });
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
    // §23.2 5.9: goto follows the card's fade-out (the boundary into
    // /room) — the fade is 1.5s (§24 item 5), so the wait allows for it.
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'), { timeout: 2500 });
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
    // §23.2 5.9: goto follows the card's fade-out (the boundary into
    // /room) — the fade is 1.5s (§24 item 5), so the wait allows for it.
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'), { timeout: 2500 });
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
    // §23.2 5.9: goto follows the card's fade-out (the boundary into
    // /room) — the fade is 1.5s (§24 item 5), so the wait allows for it.
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'), { timeout: 2500 });
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
  it('the scan button opens the overlay; the manual fallback closes it and refocuses the cells; a detected code fills the cells and the auto-advance takes over (AC 18 + §4.34.B)', async () => {
    render(JoinFlow, { props: {} });
    await screen.getByRole('button', { name: ru['join.scan.open'] }).click();
    expect(screen.getByRole('dialog')).toBeTruthy();
    // Manual fallback (§3.8, context a): «Ввести код вручную».
    await screen.getByRole('button', { name: ru['scan.fallback.enter_code'] }).click();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(cells()[0]);
    // A detected invite code enters Step 1 exactly as if typed — the cells
    // fill and the §4.34.B completion auto-resolves (a scanned code never
    // waits for the submit button).
    pasteCode('123456');
    await waitFor(() => expect(mockedResolve).toHaveBeenCalledWith('123456'));
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

  it('the resume card is REMOVED (Concept §47): the phone treatment lives only on the .join wrapper', () => {
    // tz12-02: the join entry (JoinFlow) lives on /income — the route
    // file re-homed from routes/+page.svelte.
    const src = source('src/routes/income/+page.svelte');
    const phone = phoneBlock(src);
    expect(phone).toMatch(/\.join\s*\{[^}]*max-width:\s*none/);
    expect(phone).toMatch(/\.join\s*\{[^}]*padding:\s*0/);
    // Concept §47 (2026-11-23): no stored-session resume variant on the
    // entry surface — the resume card markup/styles/i18n keys are gone.
    expect(src).not.toMatch(/\.resume\b/);
    expect(src).not.toMatch(/join\.resume\./);
    // Tokens only (sweep discipline).
    expect(phone).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('desktop is untouched: the overrides exist only inside the phone query', () => {
    // Concept §47 (2026-11-23): the resume card (and its border-radius/clip
    // overrides) is GONE from the route file — the page keeps only the
    // wrapper's max-width override; the JoinFlow card keeps its own
    // chrome-dropping overrides in the component file.
    const phoneOverrides: Record<string, string[]> = {
      'src/lib/components/join/JoinFlow.svelte': [
        'border-radius: 0',
        'clip-path: none',
        'max-width: none'
      ],
      // tz12-02: the join entry (JoinFlow) lives on /income — the route
      // file re-homed from routes/+page.svelte.
      'src/routes/income/+page.svelte': ['max-width: none']
    };
    for (const [file, decls] of Object.entries(phoneOverrides)) {
      let css = source(file);
      // tz11-08 (task 109): the persona-scoped :global wrapper rule is the
      // Concept §25 conduit — the page-level .join wrapper is bounded and
      // made a full-width, gutter-free flex conduit ONLY while the creation
      // chat is mounted (the :has(> .persona-step) gate; the other join
      // steps keep their content-driven wrapper geometry). It is exempt
      // from the phone-only chrome check below by design.
      // Concept §30 (DESIGN §4.19): the SAME conduit exists for the
      // non-chat join forms — the :has(> .form-shell) gate (the §29
      // viewport rule on the code/room/vault steps). Both step gates are
      // exempt from the phone-only chrome check by design.
      css = css.replace(
        /:global\(\.app-shell > \.join:has\(> \.[\w-]+\)\)\s*\{[^}]*\}/g,
        ''
      );
      // The desktop block is intact.
      expect(css, file).toMatch(/@media \(min-width:\s*720px\)/);
      // Each chrome-dropping declaration appears exactly once in the file —
      // inside the 719px query, never in the base (desktop) rules.
      for (const decl of decls) {
        expect(css.split(decl).length - 1, `${file}: "${decl}"`).toBe(1);
      }
      const base = baseCss(css);
      for (const decl of decls) {
        expect(base).not.toContain(decl);
      }
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
   * slows it — the owner amendment's concrete value is exactly 1.5s
   * (recorded in Concept §24 item 5).
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
    expect(css).toMatch(/\.stage\s*\{[^}]*animation:\s*fade-in\s+1\.5s\s+ease-out/);
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
    expect(css).toMatch(/\.card\.leaving\s*\{[^}]*animation:\s*fade-out\s+1\.5s\s+ease-out/);
    expect(css).toMatch(/@keyframes fade-out\s*\{[\s\S]*?opacity:\s*1[\s\S]*?opacity:\s*0/);
    // The goto waits out the fade; prefers-reduced-motion navigates
    // immediately (the base.css catch-all collapses the animation).
    expect(css).toMatch(/matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
    expect(css).toMatch(/if\s*\(!reducedMotion\)\s*await[^;]*FADE_MS/);
  });

  it('behavior: after the creation 2xx the card takes the leaving fade, then the flow enters /room', async () => {
    mockedApi.createRoomUser.mockResolvedValue(user('0xme', 'Я'));
    // Seeded mount (tz12-02): the create route opens the flow IN the
    // persona step (the income-code param, resolved on mount §4.34.D).
    render(JoinFlow, { props: SEEDED });
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
    // ...then the route hand-off into /room (after the 1.5s fade).
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/room'), { timeout: 2500 });
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
    // tz11-10 (Concept §27): the TWO-REGION root — the page-level .join
    // wrapper carries the DEFINITE viewport height while the persona chat
    // is mounted: `100vh` fallback + `100dvh` (the dynamic viewport — the
    // available screen area after the keyboard; the later supported
    // declaration wins). Every flex:1 link below it resolves against a
    // definite height and the messages area is the only scroll-port
    // (geometry from the layout itself, not measured JS).
    const gate = css.match(
      /:global\(\.app-shell > \.join:has\(> \.persona-step\)\)\s*\{[^}]*\}/
    );
    const gateText = gate?.[0] ?? '';
    expect(gateText).toMatch(/height:\s*100vh/);
    expect(gateText).toMatch(/height:\s*100dvh/);
    // The dvh refinement comes AFTER the vh fallback (later supported
    // declaration wins in a real browser).
    expect(gateText.indexOf('height: 100vh')).toBeGreaterThan(-1);
    expect(gateText.indexOf('height: 100vh')).toBeLessThan(
      gateText.indexOf('height: 100dvh')
    );
  });

  it('tz11-08 (task 109, bug round 2): the page-level .join wrapper link ABOVE JoinFlow is bounded for the persona step — the task-107 recurrence root cause', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    // Task 107 bounded this component's own links; the join route page
    // (routes/income/+page.svelte — tz12-02 re-homing of routes/+page.svelte)
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
    // The gate never leaks to the wrapper's base state: the wrapper rules
    // exist ONLY as :has()-keyed step gates — the §24–§29 persona gate
    // (Concept §25 conduit) and the §30 form-shell gate (the non-chat
    // join forms; DESIGN §4.19) — never on `.join` unconditionally.
    const wrapperRules = css.match(/:global\(\.app-shell > \.join[^{]*\{/g) ?? [];
    expect(wrapperRules).toHaveLength(2);
    expect(wrapperRules.some((rule) => rule.includes(':has(> .persona-step)'))).toBe(true);
    expect(wrapperRules.some((rule) => rule.includes(':has(> .form-step)'))).toBe(true);
  });

  it('desktop (Concept §30 geometry unification): the creation chat + mascot intro adopt the SHARED FormShell container geometry — the same width/centering as the unified forms, full screen height', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    const desktop = css.slice(css.indexOf('@media (min-width: 720px)'));
    const phoneStart = desktop.indexOf('@media (max-width: 719px)');
    const desktopOnly = phoneStart === -1 ? desktop : desktop.slice(0, phoneStart);
    // The canonical width lives on the SHARED FormShell (the §30
    // geometry standard) — the §25 750–850px approximation is superseded.
    const shell = source('src/lib/components/join/FormShell.svelte');
    expect(shell).toMatch(/--form-shell-max-width:\s*480px/);
    // The persona step (the creation chat AND the mascot intro inside it)
    // consumes the SAME shared constant — no wizard-specific container
    // metrics, dimensions and position identical to the unified forms.
    expect(desktopOnly).toMatch(
      /\.join\.persona-step\s*\{[^}]*max-width:\s*var\(--form-shell-max-width\)/
    );
    // Full screen height: no vertical gutter around the chat box (the
    // base .join padding is dropped on the persona step — the box reaches
    // the window's top and bottom edges).
    expect(desktopOnly).toMatch(/\.join\.persona-step\s*\{[^}]*padding:\s*0/);
    // The unified forms consume the same shared constant.
    expect(desktopOnly).toMatch(/\.join\s*\{[^}]*max-width:\s*var\(--form-shell-max-width\)/);
    // The mascot intro is a persona-step screen — no separate width of
    // its own in the wizard (the FormShell fills the persona card).
    const wizard = source('src/lib/components/join/CreationWizard.svelte');
    expect(wizard).not.toMatch(/\.wizard\s*\{[^}]*max-width/);
    // Size/proportions only: no color/hex overrides anywhere in the file.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('structure: in the rendered persona step the composer follows the log — the input bar cannot cover the newest message', async () => {
    // Seeded mount (tz12-02): the create route opens the flow IN the
    // persona step (the income-code param, resolved on mount §4.34.D).
    render(JoinFlow, { props: SEEDED });
    await screen.findByText(ru['join.wizard.intro.title']);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const log = document.querySelector('div.log') as HTMLElement;
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
   *      exactly as routes/+layout.svelte + routes/income/+page.svelte
   *      (tz12-02: the join entry route) render it;
   *   3. the real JoinFlow is mounted into that fixture — the persona
   *      step via the /income/[income_code]/create seed (the entry steps via the
   *      unseeded /income mount);
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
      'src/routes/income/+page.svelte',
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
    // The exact rendered ancestor chain of JoinFlow on /income and
    // /income/[income_code]/create (tz12-02 re-homing)
    // (routes/+layout.svelte → routes/income/+page.svelte → JoinFlow).
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

  it('the computed chain from div.log to the app-shell is a bounded flex column ending in the log as the single scroll container (tz11-10: the two-region root is the DEFINITE 100dvh wrapper height)', async () => {
    injectCascadeFixtureCss();
    // TWO MOUNTS (tz12-02): the off-state (the code step on /income) and
    // the on-state (the persona step seeded on /income/[income_code]/create) —
    // the room intro's "Create profile" navigates to the create route, so
    // one mount can no longer hold both steps.
    const wrapper = seedShellAndWrapper();
    // Svelte mount options: mount INTO the seeded wrapper (the page-level
    // .join wrapper is JoinFlow's real DOM parent on /income).
    render(JoinFlow, { props: {}, target: wrapper });

    // GATE, off-state: at the code step the wrapper does not match the
    // PERSONA gate — the code step is bounded by the §30 form-shell gate
    // instead (asserted below). The REAL code-step markup is captured
    // now; its computed off-state proof runs below (the
    // fixtures are attached only once every screen query is done — an
    // attached fixture would duplicate the flow's UI for the screen*).
    await screen.findByText(ru['join.enter']);
    const wrap = document.querySelector('.app-shell > .join') as HTMLElement;
    expect(wrap).toBeTruthy();
    expect(wrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(false);
    const offHtml = (shell as HTMLElement).outerHTML;
    cleanup();
    (shell as HTMLElement).remove();

    // ON-state mount: the create route's seed (the income-code param,
    // §4.34.D) opens
    // the flow IN the persona step (the creation chat).
    seedShellAndWrapper();
    render(JoinFlow, { props: SEEDED, target: shell!.querySelector('.join') as HTMLElement });
    await screen.findByText(ru['join.wizard.intro.title']);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const log = document.querySelector('div.log') as HTMLElement;
    expect(log).toBeTruthy();

    // GATE, on-state on the LIVE rendered tree: the wrapper matches the
    // :has gate once the persona step is mounted.
    const wrap2 = document.querySelector('.app-shell > .join') as HTMLElement;
    expect(wrap2.matches('.app-shell > .join:has(> .persona-step)')).toBe(true);

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
    // Off-state: the code-step markup — the PERSONA gate is off (the
    // creation chat keeps its own gate), and — Concept §30 (DESIGN
    // §4.19) — the code step IS a form-shell step: the wrapper is bounded
    // by the §30 form-shell gate instead (min-height: 0 + the definite
    // 100dvh viewport height; the §29 viewport rule now covers every
    // join-surface form, not just the creation chat).
    const offShell = parsedShellOf(offHtml);
    const offWrap = offShell.children[0] as HTMLElement;
    expect(offWrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(false);
    expect(isZeroMin(getComputedStyle(offWrap).minHeight)).toBe(true);
    // The definite screen height is step-gated (the §30 form-shell gate
    // on the code step): the wrapper resolves a definite viewport height
    // — a px length in the cascade (happy-dom against its window; a real
    // browser against dvh).
    expect(getComputedStyle(offWrap).height).toMatch(/px/);
    // On-state: the persona-step markup — the gate is on, the wrapper is
    // a bounded, full-width, gutter-free conduit.
    const pShell = parsedShellOf((shell as HTMLElement).outerHTML);
    // The wrapper is the shell's only element child on `/` (no TabBar).
    const pWrap = pShell.children[0] as HTMLElement;
    const pLog = pShell.querySelector('div.log') as HTMLElement;
    expect(pWrap).toBeTruthy();
    expect(pLog).toBeTruthy();
    expect(pWrap.className).toContain('join');
    expect(pWrap.matches('.app-shell > .join:has(> .persona-step)')).toBe(true);
    expect(getComputedStyle(pWrap).minHeight).toBe('0');
    expect(getComputedStyle(pWrap).maxWidth).toBe('none');
    // tz11-10 (Concept §27): the wrapper IS the creation-chat screen
    // root — the DEFINITE available screen height (100vh fallback +
    // 100dvh; the dynamic viewport = the area left after the keyboard).
    // A definite height resolves to a px length in the cascade (happy-dom
    // against its window; a real browser against dvh) — unlike the
    // off-state wrapper above. Every flex:1 link below resolves against
    // this definite height (geometry from the layout itself, not
    // measured JS).
    expect(getComputedStyle(pWrap).height).toMatch(/px/);

    // THE CHAIN: every flex-item link from the log up to (exclusive) the
    // shell is a flex column with min-height: 0 — one unbounded link is
    // the recurrence bug; the shell provides the definite height.
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
    // §44.4.2 iOS correction (DESIGN §4.31.2): the persona gate LIFTS the
    // shell's min-height (0) — the layout's 100dvh pin would keep the
    // shell un-shrunk on iOS (height = max(min-height, height), and the
    // iOS layout viewport does not resize on keyboard); the definite
    // height now comes from the gate's height trio (100vh fallback +
    // 100dvh + the --app-height px).
    expect(shellCs.minHeight).toBe('0');
    expect(shellCs.height).toMatch(/px/);

    // THE LOG is the scroll container: overflow-y engages on it and on
    // NOTHING else in the whole rendered chain.
    expect(getComputedStyle(pLog).overflowY).toBe('auto');
    expect(getComputedStyle(pLog).flexGrow).toBe('1');
    const scrollers = Array.from(
      pShell.querySelectorAll<HTMLElement>('*')
    ).filter((el) => getComputedStyle(el).overflowY === 'auto');
    expect(scrollers).toEqual([pLog]);

    // tz11-10 (Concept §27): the TWO REGIONS in the parsed chain — the
    // messages area (the scroll-port, above) and the user-form area
    // (flex: none, position static: OUTSIDE the scroll-port, fixed at
    // the bottom by the layout — never overlaying the newest message).
    const pComposer = pShell.querySelector('.composer') as HTMLElement;
    expect(pComposer).toBeTruthy();
    expect(pLog.contains(pComposer)).toBe(false);
    const pStage = pLog.parentElement as HTMLElement;
    expect([...pStage.children]).toEqual([pLog, pComposer]);
    expect(getComputedStyle(pComposer).flexGrow).toBe('0');
    // (position/no-sticky is source-pinned; happy-dom resolves no
    // computed `position`.)
  });

  it('tz11-12 (task 113, Concept §28 / DESIGN §4.17.1): the MAIN BLOCK never scrolls — the overflow-clipped fixed-height main block, the form block pinned ACROSS STEPS, the messenger the single scroll-port', async () => {
    injectCascadeFixtureCss();
    const wrapper = seedShellAndWrapper();
    // Seeded mount (tz12-02): the create route opens the flow IN the
    // persona step (the income-code param, resolved on mount §4.34.D).
    render(JoinFlow, { props: SEEDED, target: wrapper });
    await screen.findByText(ru['join.wizard.intro.title']);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);

    /** LIVE structure at one step: EXACTLY two blocks — the messenger
     * first, the form block last (pinned at the main block's bottom);
     * the active step form lives INSIDE the form block. */
    function assertLivePinned(formSelector: string): void {
      const log = document.querySelector('div.log') as HTMLElement;
      const composer = document.querySelector('.composer') as HTMLElement;
      expect(log).toBeTruthy();
      expect(composer).toBeTruthy();
      const stage = log.parentElement as HTMLElement;
      expect([...stage.children]).toEqual([log, composer]);
      expect(log.contains(composer)).toBe(false);
      expect(composer.querySelector(formSelector)).toBeTruthy();
      expect(log.querySelector(formSelector)).toBeNull();
    }

    // Capture the step markup now; the parsed-cascade proof runs at the
    // END (attached fixtures would duplicate the flow's UI for the
    // screen* queries driving the steps — see the test above).
    const snapshots: { label: string; html: string; form: string }[] = [];
    function capture(label: string, form: string): void {
      snapshots.push({ label, html: (shell as HTMLElement).outerHTML, form });
      assertLivePinned(form);
    }

    /** An EMPTY composer input shows the revert arrow (no send button) —
     * an empty bio is sent via Enter (the composer form submit). */
    function submitComposer(): void {
      fireEvent.submit(document.querySelector('form.input-row') as HTMLFormElement);
    }

    capture('name', 'form.input-row');
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await tick();
    await tick();
    await screen.getByRole('button', { name: ru['join.wizard.send'] }).click();
    await screen.findByText(ru['join.wizard.public.question']);
    submitComposer(); // public (empty allowed)
    await screen.findByText(ru['join.wizard.private.question']);
    submitComposer(); // private (empty allowed)
    await screen.findByText(ru['join.wizard.contact.question']);
    capture('contact-type', '.choices');
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);
    capture('themes', '.badges');
    await screen.getByRole('radio', { name: ru['interests.group.1'] }).click();
    await screen.findByText(
      ru['join.wizard.interests.pick_question'].replace('{group}', ru['interests.group.1'])
    );
    capture('topics', '.toggle-chip');

    // THE PARSED-CASCADE PROOF across all four steps: the main block
    // root is the definite-height overflow-clipped flex container (it
    // never scrolls itself and never hands scrolling to the page), the
    // form block is pinned at its bottom (the last block, outside the
    // scroll-port, holding the step form) and the messenger is the ONLY
    // scroll container on the whole screen.
    for (const { label, html, form } of snapshots) {
      const fixture = document.createElement('div');
      fixture.innerHTML = html;
      document.body.appendChild(fixture);
      parsedFixtures.push(fixture);
      const pShell = fixture.children[0] as HTMLElement;
      const pWrap = pShell.children[0] as HTMLElement;
      const pLog = pShell.querySelector('div.log') as HTMLElement;
      const pComposer = pShell.querySelector('.composer') as HTMLElement;
      expect(pWrap.matches('.app-shell > .join:has(> .persona-step)'), label).toBe(true);
      const wrapCs = getComputedStyle(pWrap);
      // Fixed height + THE NO-SCROLL CLIP (§4.17.1).
      expect(wrapCs.height, label).toMatch(/px/);
      expect(wrapCs.overflowX, label).toBe('hidden');
      expect(wrapCs.overflowY, label).toBe('hidden');
      // Main-block no-scroll: scrollHeight == clientHeight (happy-dom
      // computes no layout and reports 0 — the documented caveat; the
      // real-browser evidence is the clip + the cascade pins).
      expect(pWrap.scrollHeight, label).toBe(pWrap.clientHeight);
      // EXACTLY two blocks: messenger first, form block last (pinned).
      const pStage = pLog.parentElement as HTMLElement;
      expect([...pStage.children], label).toEqual([pLog, pComposer]);
      expect(pLog.contains(pComposer), label).toBe(false);
      expect(pComposer.querySelector(form), label).toBeTruthy();
      // The messenger is the ONLY scrollable element on the whole screen.
      const scrollers = Array.from(pShell.querySelectorAll<HTMLElement>('*')).filter(
        (el) => getComputedStyle(el).overflowY === 'auto'
      );
      expect(scrollers, label).toEqual([pLog]);
    }
  });
});

describe('JoinFlow — viewport-bounded main block (tz11-13, task 114, Concept §29 / DESIGN §4.17.2)', () => {
  /**
   * The owner refinement: the root page wrapper AND the main block are
   * strictly bounded by the visible browser window (below the fixed
   * header down to the screen bottom / virtual keyboard) — never
   * content-driven growth. With a TALL user-input form (multi-button
   * choice forms, contact forms) the form block grows UPWARD from the
   * bottom edge, content-sized (flex: none), and the messenger above it
   * SHRINKS (flex: 1 + min-height: 0) and scrolls internally; the form
   * block is never clipped at its bottom and never scrolls. The
   * task-113 clip stays as the outer guard: a form taller than the
   * whole main block overflows UPWARD (the stage packs flex-end — see
   * CreationWizard) so its bottom edge stays flush and the excess is
   * cut at the main block's top (the messenger has already collapsed to
   * its minimum — the stated beyond-the-bound behavior).
   *
   * happy-dom runs no layout engine (no box metrics) — the contract is
   * pinned the established way: source pins + the REAL-GEOMETRY parsed
   * cascade (the outerHTML round-trip — the documented :has() quirk
   * workaround) over a SHORT and an INFLATED (tall-form) fixture.
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
      'src/routes/income/+page.svelte',
      'src/lib/components/join/JoinFlow.svelte',
      'src/lib/components/join/CreationWizard.svelte'
    ]) {
      const style = document.createElement('style');
      style.setAttribute('data-cascade-contract-114', file);
      style.textContent = unscope(styleBlock(file));
      document.head.appendChild(style);
      injected.push(style);
    }
  }

  afterEach(() => {
    for (const style of injected) style.remove();
    injected.length = 0;
    if (shell) shell.remove();
    shell = null;
    for (const fixture of parsedFixtures) fixture.remove();
    parsedFixtures.length = 0;
  });

  it('source pins: the root page wrapper AND the main block are locked to the viewport (100vh fallback + 100dvh — the keyboard/visualViewport handling), persona-gated', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    // (a) The ROOT PAGE WRAPPER (the app-shell) is height-locked while
    // the creation chat is mounted — its min-height alone left it
    // content-growable in principle; the definite height closes the
    // path. /chats, /room and the other join steps are untouched.
    const shellLock =
      css.match(/:global\(\.app-shell:has\(> \.join > \.persona-step\)\)\s*\{[^}]*\}/)?.[0] ?? '';
    expect(shellLock).toBeTruthy();
    expect(shellLock).toMatch(/height:\s*100vh/);
    expect(shellLock).toMatch(/height:\s*100dvh/);
    // The dvh refinement comes AFTER the vh fallback (the later
    // supported declaration wins; dvh = the dynamic viewport — the
    // visible area after the keyboard, no measuring JS).
    expect(shellLock.indexOf('height: 100vh')).toBeGreaterThanOrEqual(0);
    expect(shellLock.indexOf('height: 100vh')).toBeLessThan(
      shellLock.indexOf('height: 100dvh')
    );
    // (b) The MAIN BLOCK keeps the task-113 definite viewport height +
    // the no-scroll clip (unchanged — the outer guard).
    const gate = css.match(
      /:global\(\.app-shell > \.join:has\(> \.persona-step\)\)\s*\{[^}]*\}/
    )?.[0];
    expect(gate).toBeTruthy();
    expect(gate).toMatch(/height:\s*100vh/);
    expect(gate).toMatch(/height:\s*100dvh/);
    expect(gate).toMatch(/overflow-x:\s*hidden/);
    expect(gate).toMatch(/overflow-y:\s*hidden/);
    // (c) The FORM BLOCK side (CreationWizard): the stage packs flex-end
    // (the tall form overflows UPWARD — its bottom edge stays flush),
    // the form block is flex:none, has no overflow of its own (it never
    // scrolls / is never clipped internally) and the messenger is the
    // flex:1 shrink absorber with its own scroll-port.
    const wizardCss = source('src/lib/components/join/CreationWizard.svelte');
    expect(wizardCss).toMatch(/\.stage\s*\{[^}]*justify-content:\s*flex-end/);
    expect(wizardCss).toMatch(/\.composer\s*\{[^}]*flex:\s*none/);
    expect(wizardCss).not.toMatch(/\.composer\s*\{[^}]*overflow/);
    expect(wizardCss).toMatch(/\.log\s*\{[^}]*flex:\s*1/);
    expect(wizardCss).toMatch(/\.log\s*\{[^}]*min-height:\s*0/);
    expect(wizardCss).toMatch(/\.log\s*\{[^}]*overflow-y:\s*auto/);
  });

  it('tall-form fixture: the main block height is the same definite viewport bound regardless of content; the form block stays content-sized (flex none, no internal scroll) with its bottom flush (flex-end packing) and the messenger absorbs the remainder as the single scroll-port', async () => {
    injectCascadeFixtureCss();
    shell = document.createElement('div');
    shell.className = 'app-shell';
    const wrapper = document.createElement('div');
    wrapper.className = 'join';
    shell.appendChild(wrapper);
    document.body.appendChild(shell);
    // Seeded mount (tz12-02): the create route opens the flow IN the
    // persona step (the income-code param, resolved on mount §4.34.D).
    render(JoinFlow, { props: SEEDED, target: wrapper });

    // Drive to the THEMES step — the real tall multi-button form
    // (8 theme badges + Ready + back live in the form block).
    await screen.findByText(ru['join.wizard.intro.title']);
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    const nameInput = screen.getByLabelText(ru['join.form.name']) as HTMLInputElement;
    fireEvent.input(nameInput, { target: { value: 'Я' } });
    await tick();
    await tick();
    await screen.getByRole('button', { name: ru['join.wizard.send'] }).click();
    await screen.findByText(ru['join.wizard.public.question']);
    fireEvent.submit(document.querySelector('form.input-row') as HTMLFormElement); // public (empty)
    await screen.findByText(ru['join.wizard.private.question']);
    fireEvent.submit(document.querySelector('form.input-row') as HTMLFormElement); // private (empty)
    await screen.findByText(ru['join.wizard.contact.question']);
    await screen.getByRole('button', { name: ru['join.wizard.contact.skip'] }).click();
    await screen.findByText(ru['join.wizard.interests.question']);

    // LIVE structure at the tall form: the form block is the stage's
    // LAST child (pinned at the main block's bottom — flush-bottom
    // structure) and holds the multi-button form; the log holds none.
    const liveLog = document.querySelector('div.log') as HTMLElement;
    const liveComposer = document.querySelector('.composer') as HTMLElement;
    const liveStage = liveLog.parentElement as HTMLElement;
    expect([...liveStage.children]).toEqual([liveLog, liveComposer]);
    expect(liveComposer.querySelector('.badges')).toBeTruthy();
    expect(liveComposer.querySelectorAll('.badges .choice').length).toBeGreaterThanOrEqual(8);
    expect(liveLog.querySelector('.badges')).toBeNull();

    // The parsed-cascade proof: the SAME markup as a short fixture and a
    // TALL fixture (the form block inflated far beyond the main block).
    const html = (shell as HTMLElement).outerHTML;
    function parsedShellOf(inflate: boolean): HTMLElement {
      const fixture = document.createElement('div');
      fixture.innerHTML = html;
      document.body.appendChild(fixture);
      parsedFixtures.push(fixture);
      const pShell = fixture.children[0] as HTMLElement;
      if (inflate) {
        // A form block taller than the whole main block (the beyond-
        // the-bound case the clip guards).
        const panel = pShell.querySelector('.composer .panel') as HTMLElement;
        expect(panel).toBeTruthy();
        for (let i = 0; i < 60; i += 1) {
          const extra = document.createElement('button');
          extra.type = 'button';
          extra.className = 'choice badge';
          extra.textContent = `extra choice ${i}`;
          panel.appendChild(extra);
        }
      }
      return pShell;
    }
    const shortShell = parsedShellOf(false);
    const tallShell = parsedShellOf(true);

    for (const [label, pShell] of [
      ['short form', shortShell],
      ['tall form', tallShell]
    ] as const) {
      const pWrap = pShell.children[0] as HTMLElement;
      const wrapCs = getComputedStyle(pWrap);
      // The main block resolves to a definite viewport height and keeps
      // the no-scroll clip (§4.17.1) — whatever the form's content.
      expect(wrapCs.height, label).toMatch(/px/);
      expect(wrapCs.overflowX, label).toBe('hidden');
      expect(wrapCs.overflowY, label).toBe('hidden');
      const pLog = pShell.querySelector('div.log') as HTMLElement;
      const pComposer = pShell.querySelector('.composer') as HTMLElement;
      const pStage = pLog.parentElement as HTMLElement;
      // EXACTLY two blocks: the messenger first, the form block last.
      expect([...pStage.children], label).toEqual([pLog, pComposer]);
      expect(pLog.contains(pComposer), label).toBe(false);
      expect(pComposer.querySelector('.badges'), label).toBeTruthy();
      // MESSENGER SHRINKS: the form block is flex:none (keeps its full
      // content height — grows upward from the bottom edge) and the
      // messenger is the flex:1 shrink absorber with min-height: 0.
      expect(getComputedStyle(pComposer).flexGrow, label).toBe('0');
      expect(getComputedStyle(pComposer).flexShrink, label).toBe('0');
      // NEVER CLIP THE FORM: the form block has NO overflow of its own —
      // it never scrolls and is never clipped internally (happy-dom
      // computes unset overflow as ''; a real browser resolves the
      // visible default); the flex-end packing keeps its bottom edge
      // flush (excess overflows upward, the clip cuts it at the main
      // block's top).
      expect(['', 'visible'], label).toContain(getComputedStyle(pComposer).overflowY);
      expect(getComputedStyle(pStage).justifyContent, label).toBe('flex-end');
      // ...and the messenger stays internally scrollable.
      const logCs = getComputedStyle(pLog);
      expect(logCs.flexGrow, label).toBe('1');
      expect(['0', '0px'], label).toContain(logCs.minHeight);
      expect(logCs.overflowY, label).toBe('auto');
      // The messenger is the ONLY scrollable element on the whole screen.
      const scrollers = Array.from(pShell.querySelectorAll<HTMLElement>('*')).filter(
        (el) => getComputedStyle(el).overflowY === 'auto'
      );
      expect(scrollers, label).toEqual([pLog]);
    }
    // BOUNDED REGARDLESS OF CONTENT: the tall form's main block height
    // is the SAME definite viewport bound as the short form's — the
    // height never grows with the content.
    expect(getComputedStyle((tallShell.children[0] as HTMLElement)).height).toBe(
      getComputedStyle((shortShell.children[0] as HTMLElement)).height
    );
  });
});

describe('JoinFlow — unified three-block form shell (Concept §30, DESIGN §4.19)', () => {
  /**
   * The non-chat join-surface forms ("Join the Event" enter-code, "Room
   * intro" create-profile/change-code, the return-to-event resume picker)
   * adopt the SAME three-block structure as the §28/§29 creation dialog:
   * header (NOT scrollable): the app icon LEFT + the language switch
   * RIGHT; footer (NOT scrollable): the form's action buttons (1..n);
   * middle (the ONLY scrollable region): title + text (≤ 75% of the form
   * width) + the main interactive element. The form is strictly
   * viewport-bounded (the §29 rule — the keyboard/visualViewport dvh
   * chain). Owner refinements folded in: the middle content is
   * TOP-ANCHORED (starts at the top, flows top-to-bottom with paddings,
   * horizontal centering only — NEVER vertically centered) and the
   * footer is a 1..n action region (Room intro carries BOTH buttons).
   *
   * happy-dom runs no layout engine — the geometry is pinned the
   * established way: source pins + the REAL-GEOMETRY parsed cascade (the
   * outerHTML round-trip — the documented :has() quirk workaround).
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

  const injected30: HTMLStyleElement[] = [];
  let shell30: HTMLElement | null = null;
  const parsedFixtures30: HTMLElement[] = [];

  afterEach(() => {
    for (const style of injected30) style.remove();
    injected30.length = 0;
    if (shell30) shell30.remove();
    shell30 = null;
    for (const fixture of parsedFixtures30) fixture.remove();
    parsedFixtures30.length = 0;
  });

  it('source pins: the FormShell is the three-block shell — fixed header/footer, the middle the ONLY scroll region, top-anchored content, text ≤ 75%', () => {
    const css = source('src/lib/components/join/FormShell.svelte');
    // Header + footer are FIXED regions (never scroll).
    expect(css).toMatch(/\.shell-header\s*\{[^}]*flex:\s*none/);
    expect(css).toMatch(/\.shell-footer\s*\{[^}]*flex:\s*none/);
    // The middle is the ONLY scrollable region (flex: 1 + min-height: 0
    // + its own scroll-port — the §28/§29 geometry).
    expect(css).toMatch(/\.shell-middle\s*\{[^}]*flex:\s*1/);
    expect(css).toMatch(/\.shell-middle\s*\{[^}]*min-height:\s*0/);
    expect(css).toMatch(/\.shell-middle\s*\{[^}]*overflow-y:\s*auto/);
    // Top-anchored content (owner refinement): paddings present, NO
    // vertical centering (the column axis never centers) — long content
    // starts at the top of the scroll region.
    const content = css.match(/\.content\s*\{[^}]*\}/)?.[0] ?? '';
    expect(content).toMatch(/padding:/);
    expect(content).not.toMatch(/justify-content:\s*(center|flex-end)/);
    expect(content).not.toMatch(/align-items:\s*center/);
    // §30: the middle text fills no more than 75% of the form width.
    expect(css).toMatch(/\.content :global\(p\)\s*\{[^}]*max-width:\s*75%/);
    // Header-LEFT: the web-app icon — the shipped PWA mark's graphic
    // WITHOUT its background plate (owner amendment: transparent against
    // the header background, token fills, no hex); header-RIGHT: the
    // language switch (LocaleControl).
    expect(css).toMatch(/<svg\s+class="app-icon"/);
    expect(css).toMatch(/viewBox="0 0 64 64"/);
    // NO background plate: the icon style declares the transparent reset
    // (and no other background value), and the mark carries no full-bleed
    // background rect.
    const iconRule = css.match(/\.app-icon\s*\{[^}]*\}/)?.[0] ?? '';
    expect(iconRule).toMatch(/background:\s*transparent/);
    const iconSvg = css.match(/<svg\s+class="app-icon"[\s\S]*?<\/svg>/)?.[0] ?? '';
    expect(iconSvg).not.toMatch(/<rect width="64" height="64"/);
    expect(iconSvg).toMatch(/fill="var\(--color-accent\)"/);
    expect(iconSvg).toMatch(/fill="var\(--color-bg\)"/);
    expect(css).toMatch(/import LocaleControl from '\.\/LocaleControl\.svelte'/);
    // Owner amendment (§30 item 1) — header sizing: the icon is a little
    // bigger (40px) and the switcher's height EQUALS the icon's height
    // (a 40px .locale row; the shared SegmentedControl sized down ONLY
    // under .locale: 36px buttons + 2px track padding = 40px — the
    // profile settings control stays untouched at 48px).
    expect(iconSvg).toMatch(/width="40"/);
    expect(iconSvg).toMatch(/height="40"/);
    expect(css).toMatch(/\.locale\s*\{[^}]*height:\s*40px/);
    expect(css).toMatch(/\.locale :global\(\.segmented\)\s*\{[^}]*padding:\s*2px/);
    expect(css).toMatch(/\.locale :global\(\.segmented button\)\s*\{[^}]*min-height:\s*36px/);
    expect(css).toMatch(/\.locale\s*\{[^}]*align-items:\s*center/);
    // Concept §30 geometry unification (owner amendment): the canonical
    // shared container width is defined ON the FormShell.
    expect(css).toMatch(/--form-shell-max-width:\s*480px/);
    // Footer: a 1..n action region (the rendered footer snippet).
    expect(css).toMatch(/@render footer\?\.\(\)/);
    // Token discipline: no raw hex.
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('source pins: every covered join form mounts the shell with its own regions', () => {
    // Enter-code (the reference instantiation): the form still wraps the
    // shell (native submit semantics); mascot → title → digits → the
    // QR-scan link ONLY in the middle; the footer holds the enter action
    // with the return-to-event entry STACKED BELOW it (owner amendment);
    // no second locale switch in the form (the shell header carries it).
    const entry = source('src/lib/components/join/CodeEntry.svelte');
    expect(entry).toMatch(/import FormShell from '\.\/FormShell\.svelte'/);
    expect(entry).toMatch(/<FormShell>/);
    expect(entry).toMatch(/<form class="step" onsubmit=\{submit\}>/);
    expect(entry).not.toMatch(/LocaleControl/);
    const entryFooterAt = entry.indexOf('{#snippet footer()}');
    const entryFooter = entry.slice(entryFooterAt);
    expect(entryFooter).toMatch(/type="submit"/);
    expect(entryFooter.indexOf('join.enter')).toBeGreaterThan(-1);
    // The return-to-event entry lives ONLY in the footer, BELOW the
    // enter button (the middle block carries the QR-scan link ONLY).
    expect(entryFooter.indexOf('join.import.title')).toBeGreaterThan(
      entryFooter.indexOf('join.enter')
    );
    expect(entry.slice(0, entryFooterAt)).not.toMatch(/join\.import\.title/);
    const entryOrder =
      entry.indexOf('mascot-row') < entry.indexOf('<h1>') &&
      entry.indexOf('<h1>') < entry.indexOf('class="cells"') &&
      entry.indexOf('class="cells"') < entry.indexOf('join.scan.open');
    expect(entryOrder).toBe(true);

    // Room intro: footer holds BOTH create-profile and change-code (the
    // multi-button footer case).
    const preview = source('src/lib/components/join/RoomPreview.svelte');
    expect(preview).toMatch(/import FormShell from '\.\/FormShell\.svelte'/);
    expect(preview).toMatch(/<FormShell>/);
    const previewFooter = preview.slice(preview.indexOf('{#snippet footer()}'));
    expect(previewFooter.indexOf('join.create_persona')).toBeGreaterThan(-1);
    expect(previewFooter.indexOf('join.change_code')).toBeGreaterThan(
      previewFooter.indexOf('join.create_persona')
    );

    // Return-to-event (resume): rows in the middle, back in the footer.
    const vault = source('src/lib/components/join/VaultList.svelte');
    expect(vault).toMatch(/import FormShell from '\.\/FormShell\.svelte'/);
    expect(vault).toMatch(/<FormShell>\s*\n\s*<div class="body">/);
    const vaultFooter = vault.slice(vault.indexOf('{#snippet footer()}'));
    expect(vaultFooter).toMatch(/backLabel/);
  });

  it('the §29 viewport rule on the join forms: the form-shell gates mirror the proven persona gate (definite 100dvh + no-scroll clip + app-shell lock)', () => {
    const css = source('src/lib/components/join/JoinFlow.svelte');
    // (a) The route-wrapper gate: bounded, full-width, gutter-free
    // conduit with the no-scroll clip — the persona gate's geometry.
    const gate = css.match(/:global\(\.app-shell > \.join:has\(> \.form-step\)\)\s*\{[^}]*\}/)?.[0] ?? '';
    expect(gate).toBeTruthy();
    expect(gate).toMatch(/min-height:\s*0/);
    expect(gate).toMatch(/max-width:\s*none/);
    expect(gate).toMatch(/padding:\s*0/);
    expect(gate).toMatch(/overflow-x:\s*hidden/);
    expect(gate).toMatch(/overflow-y:\s*hidden/);
    // The dvh refinement comes AFTER the vh fallback (the later
    // supported declaration wins; dvh = the dynamic viewport — the
    // visible area after the keyboard, no measuring JS).
    expect(gate.indexOf('height: 100vh')).toBeGreaterThanOrEqual(0);
    expect(gate.indexOf('height: 100vh')).toBeLessThan(gate.indexOf('height: 100dvh'));
    // (b) The app-shell is height-locked while a form step is mounted.
    const shellLock =
      css.match(/:global\(\.app-shell:has\(> \.join > \.form-step\)\)\s*\{[^}]*\}/)?.[0] ?? '';
    expect(shellLock).toBeTruthy();
    expect(shellLock).toMatch(/height:\s*100vh/);
    expect(shellLock).toMatch(/height:\s*100dvh/);
    // (c) The bounded chain: the card + stage fill the definite height
    // (flex: 1 + min-height: 0) and the JoinFlow root link is bounded.
    expect(css).toMatch(/\.card\.form-card\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/);
    expect(css).toMatch(/\.card\.form-card \.stage\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/);
    expect(css).toMatch(/\.join\.form-step\s*\{[^}]*min-height:\s*0/);
    // (d) The §24–§29 creation-dialog contracts stay untouched: the
    // persona gate + composer-card rules remain as they were.
    expect(css).toMatch(/class:persona-step=\{flow\.step === 'persona'\}/);
    expect(css).toMatch(/:global\(\.app-shell > \.join:has\(> \.persona-step\)\)/);
    expect(css).toMatch(/\.card\.composer-card\s*\{[^}]*flex:\s*1[^}]*min-height:\s*0/);
  });

  it('behavior (enter-code, the reference instantiation): header = app icon + language switch; middle = mascot → title → digits → the QR-scan link ONLY (top-anchored); footer = enter on top, return-to-event stacked below', async () => {
    // The Step-1 return entry exists only with a non-empty device vault.
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        {
          roomAddress: '0xoldroom',
          userAddress: '0xold',
          token: 'stored-vault-token',
          name: 'Старая персона',
          savedAt: '2026-11-14T10:00:00Z'
        }
      ])
    );
    const { container } = render(JoinFlow, { props: {} });
    // HEADER (fixed): app icon LEFT (40px, no background plate), language
    // switch RIGHT (the .locale row's height equals the icon's — owner
    // amendment §30.1).
    const header = container.querySelector('.shell-header') as HTMLElement;
    expect(header).toBeTruthy();
    const headerIcon = header.querySelector('svg.app-icon') as HTMLElement;
    expect(headerIcon).toBeTruthy();
    expect(headerIcon.getAttribute('height')).toBe('40');
    // No inline plate; the transparent rule is pinned at source level.
    expect(headerIcon.getAttribute('style')).toBeFalsy();
    expect(header.querySelector('[role="radiogroup"]')?.getAttribute('aria-label')).toBe(
      ru['common.locale']
    );
    // MIDDLE (the scroll region): mascot, title, the 6-digit input and
    // the QR-scan link ONLY — the return-to-event entry is NOT here.
    const middle = container.querySelector('.shell-middle') as HTMLElement;
    expect(middle).toBeTruthy();
    expect(middle.querySelector('.mascot-row')).toBeTruthy();
    expect(middle.querySelector('h1')?.textContent).toBe(ru['join.title']);
    expect(middle.querySelector('.digit-input')?.querySelectorAll('input')).toHaveLength(6);
    const middleScan = middle.querySelectorAll('button.scan');
    expect(middleScan).toHaveLength(1);
    expect(middleScan[0]!.textContent).toContain(ru['join.scan.open']);
    expect(middle.textContent).not.toContain(ru['join.import.title']);
    // FOOTER (fixed): TWO STACKED buttons — enter on top, return below.
    const footer = container.querySelector('.shell-footer') as HTMLElement;
    expect(footer).toBeTruthy();
    const footerButtons = footer.querySelectorAll('button');
    expect(footerButtons).toHaveLength(2);
    expect(footerButtons[0]!.classList.contains('cta')).toBe(true);
    expect(footerButtons[0]!.textContent).toContain(ru['join.enter']);
    expect(footerButtons[1]!.textContent).toContain(ru['join.import.title']);
    // The regions never cross: no form content in the header, no digit
    // input or shell chrome inside the footer.
    expect(header.querySelector('.digit-input')).toBeNull();
    expect(footer.querySelector('.digit-input')).toBeNull();
    expect(middle.querySelector('.shell-header')).toBeNull();
    expect(middle.querySelector('.shell-footer')).toBeNull();
  });

  it('behavior (room intro, the §4.34.C intro route): the footer holds BOTH create-profile and change-code actions (the 1..n footer region), the header carries the language switch', async () => {
    // The intro route mode: the flow mounts AT the room (intro) step and
    // resolves the param code on mount (§4.34.C) — the in-card Step-2 swap
    // on /income is superseded by the route map (§4.34.A).
    const { container } = render(JoinFlow, { props: { introParam: '123456' } });
    await screen.findByText(room.name);
    // The 1..n footer: create profile FIRST, change code second.
    const footer = container.querySelector('.shell-footer') as HTMLElement;
    const buttons = Array.from(footer.querySelectorAll('button'));
    expect(buttons).toHaveLength(2);
    expect(buttons[0]!.textContent).toContain(ru['join.create_persona']);
    expect(buttons[1]!.textContent).toContain(ru['join.change_code']);
    // Header + middle intact: the language switch and the mascot/title.
    expect(container.querySelector('.shell-header [role="radiogroup"]')).toBeTruthy();
    expect(container.querySelector('.shell-middle .mascot-row')).toBeTruthy();
    expect(container.querySelector('.shell-middle .room-name')?.textContent).toBe(room.name);
  });

  it('behavior (return-to-event resume): the picker rows live in the middle, the back action in the footer', async () => {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        {
          roomAddress: '0xoldroom',
          userAddress: '0xold',
          token: 'stored-vault-token',
          name: 'Старая персона',
          savedAt: '2026-11-14T10:00:00Z'
        }
      ])
    );
    render(JoinFlow, { props: {} });
    await screen.getByRole('button', { name: ru['join.import.title'] }).click();
    await screen.findByText(ru['join.import.subtitle']);
    // The resume rows (the main interactive element) are in the middle.
    const middle = document.querySelector('.shell-middle') as HTMLElement;
    expect(middle.querySelector('.rows')).toBeTruthy();
    // The back action is the footer's button.
    const footer = document.querySelector('.shell-footer') as HTMLElement;
    expect(footer.querySelector('button')?.textContent).toContain(ru['common.back']);
    // The language switch is in the header.
    expect(document.querySelector('.shell-header [role="radiogroup"]')).toBeTruthy();
  });

  it('real-geometry parsed cascade (code step): the form is viewport-bounded and the shell middle is the ONLY scroll region — header/footer fixed, content top-anchored', async () => {
    // The REAL <style> blocks of the rendered chain, injected raw
    // (unscoped) — the same strongest-layout-capable contract as the
    // persona cascade tests above (no new deps, no headless browser).
    for (const file of [
      'src/routes/+layout.svelte',
      'src/routes/income/+page.svelte',
      'src/lib/components/join/JoinFlow.svelte',
      'src/lib/components/join/FormShell.svelte',
      'src/lib/components/join/CodeEntry.svelte'
    ]) {
      const style = document.createElement('style');
      style.setAttribute('data-cascade-contract-30', file);
      style.textContent = unscope(styleBlock(file));
      document.head.appendChild(style);
      injected30.push(style);
    }
    shell30 = document.createElement('div');
    shell30.className = 'app-shell';
    const wrapper = document.createElement('div');
    wrapper.className = 'join';
    shell30.appendChild(wrapper);
    document.body.appendChild(shell30);
    mockedResolve.mockResolvedValue({ roomAddress: room.address });
    mockedApi.getRoom.mockResolvedValue(room);
    mockedApi.listRoomUsers.mockResolvedValue([]);
    render(JoinFlow, { props: {}, target: wrapper });
    await screen.findByText(ru['join.enter']);
    // THE PARSED-CASCADE PROOF: the SAME markup, round-tripped through
    // the HTML parser (the documented :has() quirk workaround).
    const fixture = document.createElement('div');
    fixture.innerHTML = (shell30 as HTMLElement).outerHTML;
    document.body.appendChild(fixture);
    parsedFixtures30.push(fixture);
    const pShell = fixture.children[0] as HTMLElement;
    const pWrap = pShell.children[0] as HTMLElement;
    // The wrapper matches the §30 form-shell gate: bounded (definite
    // viewport height), full-width, gutter-free, no-scroll clip.
    expect(pWrap.matches('.app-shell > .join:has(> .form-step)')).toBe(true);
    const wrapCs = getComputedStyle(pWrap);
    expect(wrapCs.minHeight).toBe('0');
    expect(wrapCs.maxWidth).toBe('none');
    expect(wrapCs.height).toMatch(/px/);
    expect(wrapCs.overflowX).toBe('hidden');
    expect(wrapCs.overflowY).toBe('hidden');
    // THE BOUNDED CHAIN: every flex-item link from the shell up to
    // (exclusive) the app-shell is a flex column with min-height: 0.
    const pForm = pShell.querySelector('.form-shell') as HTMLElement;
    expect(pForm).toBeTruthy();
    const bounded: HTMLElement[] = [];
    for (let el = pForm.parentElement; el && el !== pShell; el = el.parentElement) {
      bounded.push(el);
    }
    expect(bounded.length).toBeGreaterThanOrEqual(5); // step→stage→card→join→wrapper
    for (const el of bounded) {
      const cs = getComputedStyle(el);
      expect(cs.display, `${el.className} display`).toBe('flex');
      expect(cs.flexDirection, `${el.className} direction`).toBe('column');
      expect(cs.minHeight, `${el.className} min-height`).toBe('0');
    }
    // THE THREE REGIONS: header (flexGrow 0) first, the middle (flexGrow
    // 1 + min-height: 0 + its own scroll-port) between, footer (flexGrow
    // 0) last — the middle is the shell's ONLY scrollable element.
    const pHeader = pShell.querySelector('.shell-header') as HTMLElement;
    const pMiddle = pShell.querySelector('.shell-middle') as HTMLElement;
    const pFooter = pShell.querySelector('.shell-footer') as HTMLElement;
    expect(pForm.contains(pHeader)).toBe(true);
    expect(pForm.contains(pFooter)).toBe(true);
    expect(pHeader.nextElementSibling).toBe(pMiddle);
    expect(getComputedStyle(pHeader).flexGrow).toBe('0');
    expect(getComputedStyle(pFooter).flexGrow).toBe('0');
    // Owner amendment (§30 item 1) — header alignment: the switcher row's
    // height equals the app icon's height (40px), both centered in the
    // header (the .locale resolved height + the icon's 40px attribute).
    const pLocale = pHeader.querySelector('.locale') as HTMLElement;
    const pIcon = pHeader.querySelector('svg.app-icon') as HTMLElement;
    expect(pLocale).toBeTruthy();
    expect(pIcon).toBeTruthy();
    expect(getComputedStyle(pLocale).height).toBe('40px');
    expect(pIcon.getAttribute('height')).toBe('40');
    const middleCs = getComputedStyle(pMiddle);
    expect(middleCs.flexGrow).toBe('1');
    expect(['0', '0px']).toContain(middleCs.minHeight);
    expect(middleCs.overflowY).toBe('auto');
    // The middle is the ONLY scrollable element on the whole screen.
    const scrollers = Array.from(pShell.querySelectorAll<HTMLElement>('*')).filter(
      (el) => getComputedStyle(el).overflowY === 'auto'
    );
    expect(scrollers).toEqual([pMiddle]);
    // TOP-ANCHORED content (owner refinement): the content block carries
    // paddings and is NEVER vertically centered (no center/flex-end on
    // the column axis) — long content starts at the top of the region.
    const pContent = pMiddle.querySelector('.content') as HTMLElement;
    expect(pContent).toBeTruthy();
    const contentCs = getComputedStyle(pContent);
    expect(contentCs.paddingTop).not.toBe('0px');
    expect(['normal', 'flex-start', '']).toContain(contentCs.justifyContent);
    expect(['stretch', 'normal', '']).toContain(contentCs.alignItems);
  });
});
