/** /host entry-route tests (DESIGN rev. 4 §3.7.1, TZ13-02; Concept §54.1).
 * Covers: the entry card mode switch (create/log-in, never dead-ends,
 * preserves input), masked-input attributes, the create flow (generated room
 * token in the body, creation token in the header ONLY — custody: no body,
 * no log, no storage; 401/403 → «Токен отклонён.» masked, nothing stored),
 * the log-in flow (pre-credential probe validation with LOCAL 401 handling —
 * the hostApi gate never fires; 200 stores/overwrites + navigates, 401/403
 * inline rejected + nothing stored), the auto-resume probe states (200 →
 * auto-navigate through the skeleton, 401 → clear + reset notice + Create
 * fallback, 404 → deleted copy + clear, NetworkError → entry KEPT + banner +
 * retry), the reset notice (sessionStorage `bleak.hostNotice` consumed once,
 * pre-selects Log-in), and the bounded address finder (cap 25, concurrency
 * ≤ 4, stop at the first 200, never writes storage).
 * The rev. 3 host-console entry cases moved here (TZ §9.4.6); the panel/
 * invite/QR cases belong to the TZ13-03/TZ13-04 route files. */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

import { ApiError, NetworkError, type Invite, type Room } from '@bleak/api-client';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (route: string) => route }));

vi.mock('#lib/api/client', () => ({
  HOST_NOTICE_KEY: 'bleak.hostNotice',
  hostApi: {
    createRoomWithInvite: vi.fn()
  },
  hostProbes: {
    validateKey: vi.fn(),
    listRooms: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  generateTokenSecret: () => 'R'.repeat(43)
}));

import { goto } from '$app/navigation';
import { hostApi, hostProbes } from '#lib/api/client';
import { clearHostRoom } from '../src/lib/stores/hostSession';
import { identity } from '../src/lib/stores/identity';
import Page from '../src/routes/host/+page.svelte';
import {
  FINDER_CAP,
  FINDER_CONCURRENCY,
  findRoomByKey
} from '../src/lib/components/host/HostEntryCard.svelte';
import { ru } from '../src/lib/i18n/ru';

const mockedGoto = vi.mocked(goto);
const mockedCreate = vi.mocked(hostApi.createRoomWithInvite);
const mockedValidate = vi.mocked(hostProbes.validateKey);
const mockedlistRooms = vi.mocked(hostProbes.listRooms);

const CREATE_TOKEN = 'ctok-one-time';

/** A minimal contract-shaped Room for the public list stubs. */
function stubRoom(address: string): Room {
  return {
    address,
    name: `room-${address}`,
    description: '',
    language: 'ru',
    max_user: 50,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null
  };
}

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (cause: unknown) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function storageDump(): string {
  let out = '';
  for (let i = 0; i < localStorage.length; i += 1)
    out += localStorage.getItem(localStorage.key(i) ?? '') ?? '';
  for (let i = 0; i < sessionStorage.length; i += 1)
    out += sessionStorage.getItem(sessionStorage.key(i) ?? '') ?? '';
  return out;
}

/** Seed a stored host session the boot probe should pick up. */
function storeSession(address = '0xroom'): void {
  localStorage.setItem(
    'bleak.hostRoom',
    JSON.stringify({ code: '123456', roomAddress: address, roomToken: 'stored-room-token' })
  );
}

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await tick();
  await tick();
}

async function fill(label: string, value: string): Promise<void> {
  const input = screen.getByLabelText(label) as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await tick();
}

function segment(label: string): HTMLButtonElement {
  return screen.getByRole('radio', { name: label }) as HTMLButtonElement;
}

async function switchMode(label: string): Promise<void> {
  await segment(label).click();
  await tick();
  await tick();
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  identity.set(null);
  mockedGoto.mockResolvedValue(undefined);
  mockedCreate.mockResolvedValue({
    room: stubRoom('0xroom'),
    code: '123456'
  });
  mockedValidate.mockRejectedValue(new ApiError(401, '/api/room/0xroom/invite', 'bad key'));
  mockedlistRooms.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  clearHostRoom();
  identity.set(null);
  localStorage.clear();
  sessionStorage.clear();
});

describe('entry card + mode switch (AC 1, 5, 11)', () => {
  it('default boot shows the entry card pre-selected to Create with both modes reachable', async () => {
    await renderPage();
    expect(screen.getByText(ru['host.title'])).toBeTruthy();
    expect(segment(ru['host.mode.create']).getAttribute('aria-checked')).toBe('true');
    expect(segment(ru['host.mode.login']).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByLabelText(ru['host.gate.label'])).toBeTruthy();
    // Both modes are always reachable — no dead end.
    expect(segment(ru['host.mode.login']).disabled).toBe(false);
  });

  it('masked inputs: creation token and room key are type=password + autocomplete=off; the address is plain text', async () => {
    await renderPage();
    const token = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(token.type).toBe('password');
    expect(token.getAttribute('autocomplete')).toBe('off');

    await switchMode(ru['host.mode.login']);
    const address = screen.getByLabelText(ru['host.login.address']) as HTMLInputElement;
    const key = screen.getByLabelText(ru['host.login.key']) as HTMLInputElement;
    expect(address.type).toBe('text');
    expect(key.type).toBe('password');
    expect(key.getAttribute('autocomplete')).toBe('off');
  });

  it('switching modes never loses input (non-dead-end): values survive the round trip', async () => {
    await renderPage();
    await fill(ru['host.gate.label'], CREATE_TOKEN);
    await switchMode(ru['host.mode.login']);
    await fill(ru['host.login.address'], '0xroom');
    await fill(ru['host.login.key'], 'room-key-value');
    await switchMode(ru['host.mode.create']);
    expect((screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement).value).toBe(
      CREATE_TOKEN
    );
    await switchMode(ru['host.mode.login']);
    expect((screen.getByLabelText(ru['host.login.address']) as HTMLInputElement).value).toBe(
      '0xroom'
    );
    expect((screen.getByLabelText(ru['host.login.key']) as HTMLInputElement).value).toBe(
      'room-key-value'
    );
  });
});

describe('create flow (AC 2, 3)', () => {
  it('happy path: room token generated client-side, creation token ONLY in the header arg, stored + navigated (custody)', async () => {
    const logSpy = vi.spyOn(console, 'log');
    const warnSpy = vi.spyOn(console, 'warn');
    const errorSpy = vi.spyOn(console, 'error');
    await renderPage();
    await fill(ru['host.gate.label'], CREATE_TOKEN);
    await fill(ru['host.form.name'], 'Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();

    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(1));
    const [body, headerArg] = mockedCreate.mock.calls[0] as unknown as [
      Record<string, unknown>,
      string
    ];
    expect(body).toEqual({ name: 'Митап', language: 'ru', token: 'R'.repeat(43) });
    expect(headerArg).toBe(CREATE_TOKEN); // the header, never the body
    expect(JSON.stringify(body)).not.toContain(CREATE_TOKEN); // no body custody
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining(CREATE_TOKEN));
    expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining(CREATE_TOKEN));
    expect(errorSpy).not.toHaveBeenCalledWith(expect.stringContaining(CREATE_TOKEN));
    logSpy.mockRestore();
    warnSpy.mockRestore();
    errorSpy.mockRestore();
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
        roomAddress: '0xroom',
        roomToken: 'R'.repeat(43),
        code: '123456'
      })
    );
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xroom'));
    // The creation token is never persisted anywhere (AC 2).
    expect(storageDump()).not.toContain(CREATE_TOKEN);
  });

  it('a rejected creation token (401/403) shows «Токен отклонён.» + server text, value kept masked, nothing stored', async () => {
    mockedCreate.mockRejectedValue(
      new ApiError(403, '/api/room', 'creation token invalid or already used')
    );
    await renderPage();
    await fill(ru['host.gate.label'], 'wrong-token');
    await fill(ru['host.form.name'], 'Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();

    await waitFor(() => expect(screen.getByText(/Токен отклонён/)).toBeTruthy());
    expect(screen.getByText(/creation token invalid/)).toBeTruthy();
    const input = screen.getByLabelText(ru['host.gate.label']) as HTMLInputElement;
    expect(input.type).toBe('password');
    expect(input.value).toBe('wrong-token');
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    expect(storageDump()).not.toContain('wrong-token');
  });

  it('create 400/409 surfaces the server text under the room fields', async () => {
    mockedCreate.mockRejectedValue(new ApiError(400, '/api/room', 'duplicate name'));
    await renderPage();
    await fill(ru['host.gate.label'], CREATE_TOKEN);
    await fill(ru['host.form.name'], 'Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText('duplicate name')).toBeTruthy());
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it('create NetworkError → §2.1 banner + retry re-runs the create call', async () => {
    mockedCreate.mockRejectedValueOnce(new NetworkError('/api/room', new Error('wifi')));
    await renderPage();
    await fill(ru['host.gate.label'], CREATE_TOKEN);
    await fill(ru['host.form.name'], 'Митап');
    await screen.getByRole('button', { name: ru['host.create'] }).click();
    await waitFor(() => expect(screen.getByText(ru['common.error.network'])).toBeTruthy());

    mockedCreate.mockResolvedValueOnce({ room: stubRoom('0xroom'), code: '123456' });
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(mockedCreate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xroom'));
  });
});

describe('log-in flow (AC 4; pre-credential probe, §9.4.2)', () => {
  async function gotoLoginMode(): Promise<void> {
    await renderPage();
    await switchMode(ru['host.mode.login']);
  }

  it('200 validates through the probe path, stores/overwrites with an unknown code and navigates — the hostApi gate never fires', async () => {
    mockedValidate.mockResolvedValue([]);
    await gotoLoginMode();
    await fill(ru['host.login.address'], '0xroom2');
    await fill(ru['host.login.key'], 'pasted-key');
    await screen.getByRole('button', { name: ru['host.mode.login'] }).click();

    await waitFor(() => expect(mockedValidate).toHaveBeenCalledWith('0xroom2', 'pasted-key'));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
        roomAddress: '0xroom2',
        roomToken: 'pasted-key',
        code: '' // starts unknown — fills from the panel's first invite-list tick
      })
    );
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xroom2'));
    // The gated hostApi path is NEVER used for the pre-credential probe.
    expect(mockedCreate).not.toHaveBeenCalled();
  });

  it.each([401, 403])(
    '%i → «Ключ комнаты отклонён.» inline, value stays masked, nothing stored',
    async (status) => {
      mockedValidate.mockRejectedValue(new ApiError(status, '/x', 'room key invalid'));
      await gotoLoginMode();
      await fill(ru['host.login.address'], '0xroom2');
      await fill(ru['host.login.key'], 'pasted-key');
      await screen.getByRole('button', { name: ru['host.mode.login'] }).click();

      await waitFor(() => expect(screen.getByText(/Ключ комнаты отклонён/)).toBeTruthy());
      expect(screen.getByText(/room key invalid/)).toBeTruthy();
      const key = screen.getByLabelText(ru['host.login.key']) as HTMLInputElement;
      expect(key.type).toBe('password');
      expect(key.value).toBe('pasted-key');
      expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    }
  );

  it('NetworkError → §2.1 banner + retry re-probes', async () => {
    mockedValidate.mockRejectedValueOnce(new NetworkError('/x', new Error('wifi')));
    await gotoLoginMode();
    await fill(ru['host.login.address'], '0xroom2');
    await fill(ru['host.login.key'], 'pasted-key');
    await screen.getByRole('button', { name: ru['host.mode.login'] }).click();
    await waitFor(() => expect(screen.getByText(ru['common.error.network'])).toBeTruthy());
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();

    mockedValidate.mockResolvedValueOnce([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(mockedValidate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xroom2'));
  });
});

describe('auto-resume probe (AC 6, 7, 8; Concept §54.1)', () => {
  it('200 → skeleton + «Проверяем доступ к комнате…» while probing, then auto-navigate with no form flash', async () => {
    storeSession();
    const gate = deferred<Invite[]>();
    mockedValidate.mockReturnValue(gate.promise);
    await renderPage();

    await waitFor(() => expect(screen.getByText(ru['host.resume.checking'])).toBeTruthy());
    expect(document.querySelector('[aria-busy="true"]')).toBeTruthy();
    // The forms never render while the probe is in flight.
    expect(screen.queryByLabelText(ru['host.gate.label'])).toBeNull();
    expect(screen.queryByLabelText(ru['host.login.key'])).toBeNull();

    gate.resolve([]);
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xroom'));
    expect(screen.queryByLabelText(ru['host.gate.label'])).toBeNull();
  });

  it('401 → clears the stored entry, shows the reset notice, falls back to Create', async () => {
    storeSession();
    mockedValidate.mockRejectedValue(new ApiError(401, '/x', 'dead key'));
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.session_reset'])).toBeTruthy());
    expect(segment(ru['host.mode.create']).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByLabelText(ru['host.gate.label'])).toBeTruthy();
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it('404 → clears the entry and shows «Комната удалена.»', async () => {
    storeSession();
    mockedValidate.mockRejectedValue(new ApiError(404, '/x', 'room not found'));
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['host.room.deleted'])).toBeTruthy());
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    expect(screen.getByLabelText(ru['host.gate.label'])).toBeTruthy();
  });

  it('NetworkError → the stored entry is KEPT, banner + retry above the usable card; retry re-probes', async () => {
    storeSession();
    mockedValidate.mockRejectedValueOnce(new NetworkError('/x', new Error('wifi')));
    await renderPage();
    await waitFor(() => expect(screen.getByText(ru['common.error.network'])).toBeTruthy());
    // A failed probe must not destroy a possibly-valid credential.
    expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
      code: '123456',
      roomAddress: '0xroom',
      roomToken: 'stored-room-token'
    });
    // The entry card is fully usable meanwhile.
    expect(segment(ru['host.mode.login']).disabled).toBe(false);

    mockedValidate.mockResolvedValueOnce([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(mockedValidate).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xroom'));
  });
});

describe('reset notice (AC 9)', () => {
  it('renders only when `bleak.hostNotice` is set, consumes the key once, and pre-selects Log-in', async () => {
    sessionStorage.setItem('bleak.hostNotice', '1');
    await renderPage();
    const notice = screen.getByText(ru['host.session_reset']);
    expect(notice).toBeTruthy();
    // The lock glyph card + polite announcement.
    expect(notice.closest('[aria-live="polite"]')).toBeTruthy();
    expect(notice.closest('section')?.classList.contains('pixel-corners')).toBe(true);
    // Key removed after render (once per incident).
    expect(sessionStorage.getItem('bleak.hostNotice')).toBeNull();
    // Its presence pre-selects the Log-in mode.
    expect(segment(ru['host.mode.login']).getAttribute('aria-checked')).toBe('true');
  });

  it('no flag → no notice', async () => {
    await renderPage();
    expect(screen.queryByText(ru['host.session_reset'])).toBeNull();
  });
});

describe('address finder (AC 10, F11)', () => {
  it('no match: probes the public list with the entered key and shows the honest copy — never writes storage', async () => {
    mockedlistRooms.mockResolvedValue([
      stubRoom('0xa'),
      stubRoom('0xb'),
      stubRoom('0xc')
    ]);
    await renderPage();
    await switchMode(ru['host.mode.login']);
    await fill(ru['host.login.key'], 'tried-key');
    await screen.getByRole('button', { name: ru['host.login.find'] }).click();

    await waitFor(() => expect(mockedValidate).toHaveBeenCalledTimes(3));
    expect(mockedlistRooms).toHaveBeenCalledTimes(1);
    await waitFor(() =>
      expect(screen.getByText(ru['host.login.find_none'])).toBeTruthy()
    );
    // The finder NEVER writes storage — only the successful validation does.
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
    expect(storageDump()).not.toContain('tried-key');
    expect(mockedGoto).not.toHaveBeenCalled();
  });

  it('a match fills the address and continues the normal validation → store + navigate', async () => {
    mockedlistRooms.mockResolvedValue([stubRoom('0xnope'), stubRoom('0xmatch')]);
    mockedValidate.mockImplementation((addr: string) =>
      addr === '0xmatch' ? Promise.resolve([]) : Promise.reject(new ApiError(401, '/x', 'no'))
    );
    await renderPage();
    await switchMode(ru['host.mode.login']);
    await fill(ru['host.login.key'], 'good-key');
    await screen.getByRole('button', { name: ru['host.login.find'] }).click();

    await waitFor(
      () =>
        expect((screen.getByLabelText(ru['host.login.address']) as HTMLInputElement).value).toBe(
          '0xmatch'
        )
    );
    await waitFor(() => expect(mockedValidate).toHaveBeenCalledWith('0xmatch', 'good-key'));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('bleak.hostRoom') ?? '{}')).toEqual({
        roomAddress: '0xmatch',
        roomToken: 'good-key',
        code: ''
      })
    );
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host/0xmatch'));
  });

  it('shows «Ищем комнату…» while the bounded probe is running', async () => {
    mockedlistRooms.mockReturnValue(new Promise(() => undefined)); // never settles
    await renderPage();
    await switchMode(ru['host.mode.login']);
    await fill(ru['host.login.key'], 'some-key');
    await screen.getByRole('button', { name: ru['host.login.find'] }).click();
    await waitFor(() => expect(screen.getByText(ru['host.login.finding'])).toBeTruthy());
    expect(mockedlistRooms).toHaveBeenCalledTimes(1);
  });

  it('listRooms failure → §2.1 banner + retry re-runs the finder', async () => {
    mockedlistRooms.mockRejectedValueOnce(new NetworkError('/api/room', new Error('wifi')));
    await renderPage();
    await switchMode(ru['host.mode.login']);
    await fill(ru['host.login.key'], 'some-key');
    await screen.getByRole('button', { name: ru['host.login.find'] }).click();
    await waitFor(() => expect(screen.getByText(ru['common.error.network'])).toBeTruthy());

    mockedlistRooms.mockResolvedValueOnce([]);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(mockedlistRooms).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(screen.getByText(ru['host.login.find_none'])).toBeTruthy()
    );
  });
});

describe('finder bounds — findRoomByKey (technical criteria)', () => {
  const rejectAll = () => Promise.reject(new ApiError(401, '/x', 'no'));

  it(`caps probing at ${FINDER_CAP} rooms even when the list is longer`, async () => {
    const rooms = Array.from({ length: 40 }, (_, i) => ({ address: `0xroom${i}` }));
    const validateKey = vi.fn(rejectAll);
    const match = await findRoomByKey('k', { listRooms: async () => rooms, validateKey });
    expect(match).toBeNull();
    expect(validateKey).toHaveBeenCalledTimes(FINDER_CAP);
    expect(FINDER_CAP).toBe(25);
  });

  it('runs at most 4 probes in flight', async () => {
    const rooms = Array.from({ length: 12 }, (_, i) => ({ address: `0xr${i}` }));
    let inFlight = 0;
    let maxInFlight = 0;
    const validateKey = vi.fn(() => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      return new Promise<never>((_resolve, reject) => {
        setTimeout(() => {
          inFlight -= 1;
          reject(new ApiError(401, '/x', 'no'));
        }, 5);
      });
    });
    await findRoomByKey('k', { listRooms: async () => rooms, validateKey });
    expect(FINDER_CONCURRENCY).toBe(4);
    expect(maxInFlight).toBe(4);
  });

  it('stops at the first 200 — no NEW probes start after a match', async () => {
    const rooms = [
      { address: '0xa' },
      { address: '0xb' },
      { address: '0xc' },
      { address: '0xd' },
      { address: '0xe' },
      { address: '0xf' },
      { address: '0xg' }
    ];
    // Candidate 0xb accepts instantly; every other probe rejects slowly so
    // the first in-flight batch is still pending when the match lands.
    const validateKey = vi.fn((address: string) =>
      address === '0xb'
        ? Promise.resolve([])
        : new Promise<never>((_resolve, reject) => {
            setTimeout(() => reject(new ApiError(401, '/x', 'no')), 10);
          })
    );
    const match = await findRoomByKey('k', { listRooms: async () => rooms, validateKey });
    expect(match?.address).toBe('0xb');
    const probed = validateKey.mock.calls.map((call) => call[0]);
    expect(probed).toContain('0xb');
    // Only the initial in-flight batch (concurrency 4) was ever started.
    expect(probed).toHaveLength(4);
    expect(probed).not.toContain('0xe');
    expect(probed).not.toContain('0xf');
    expect(probed).not.toContain('0xg');
  });

  it('a listRooms failure propagates (page banner + retry)', async () => {
    const validateKey = vi.fn(rejectAll);
    await expect(
      findRoomByKey('k', {
        listRooms: async () => Promise.reject(new NetworkError('/api/room', new Error('wifi'))),
        validateKey
      })
    ).rejects.toBeInstanceOf(NetworkError);
    expect(validateKey).not.toHaveBeenCalled();
  });
});

describe('no attendee redirect (AC 12)', () => {
  it('an attendee identity never redirects /host — the entry card drives everything', async () => {
    localStorage.setItem(
      'bleak.identity',
      JSON.stringify({ roomAddress: '0xroom', userAddress: '0xme', token: 'p-tok' })
    );
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 'p-tok' });
    await renderPage();
    expect(segment(ru['host.mode.create'])).toBeTruthy();
    expect(mockedGoto).not.toHaveBeenCalled();
  });
});
