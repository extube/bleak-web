/** QrScanner component tests — LEAN suite (2026-11-17 slimming pass, owner
 * directive): one block per distinct behavior, micro/aria asserts removed
 * (recorded in docs/verification-v2.md). Covers: camera state machine
 * (no start without CTA; granted; insecure/secure no-camera; denied), close
 * paths (manual fallback, persona fallback, Escape + track stop), payload
 * processing (invite hand-off; invalid contents incl. cross-context),
 * scan-again restart, and the persona routine: foreign/own, confirm success
 * (+ already-mutual calls anyway), consistency fallback, error states
 * (410/403/400 table, network retry, 401 gate close), single-direction
 * variant, confirm cancel. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, NetworkError, type Chat, type User } from '@bleak/api-client';

vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: Record<string, string>) =>
    params && 'address' in params ? `/chats/${params.address}` : route
}));

const apiMock = vi.hoisted(() => ({
  createMutualHandshake: vi.fn(),
  createHandshake: vi.fn(),
  listChatsOfUser: vi.fn()
}));
vi.mock('#lib/api/client', () => ({ api: apiMock }));

const decodeMock = vi.hoisted(() => ({ scanText: null as string | null }));
vi.mock('#lib/scanner/decode', () => ({
  barcodeDetectorSupported: () => false,
  loadDecoder: async () => ({ decodeFrame: async () => decodeMock.scanText })
}));

import QrScanner from '../src/lib/components/QrScanner.svelte';
import { identity } from '../src/lib/stores/identity';
import { ru } from '../src/lib/i18n/ru';

const alice: User = {
  address: '0xalice',
  room: '0xroom',
  name: 'Алиса',
  greeting: '',
  public_bio: '',
  private_bio: '',
  language: 'ru',
  created_at: '2026-11-14T10:00:00Z',
  updated_at: '2026-11-14T10:00:00Z',
  deleted_at: null
};
const me: User = { ...alice, address: '0xme', name: 'Я' };

const MUTUAL_CODE = 'one-time-code';
/** The v2 binding persona-QR payload (`?u=…&m=…`). */
const personaQr = (address: string, withCode = true): string =>
  `http://localhost:5173/?u=${address}${withCode ? `&m=${MUTUAL_CODE}` : ''}`;

function chatFixture(address: string, members: [string, string]): Chat {
  return {
    address,
    room: '0xroom',
    phase: 'networking',
    phase_started_at: '',
    scenario: 'ai-future',
    language: 'ru',
    created_at: '2026-11-14T10:00:00Z',
    participants: members.map((member) => ({ chat: address, user: member }))
  };
}

/** Presence check (panel copy is duplicated into the aria-live region). */
function see(text: string | RegExp): boolean {
  return screen.getAllByText(text).length > 0;
}

// --- camera / secure-context stubs -----------------------------------------

const trackStop = vi.fn();
function fakeStream(): MediaStream {
  return { getTracks: () => [{ stop: trackStop }] } as unknown as MediaStream;
}

function stubSecurity(secure: boolean): void {
  Object.defineProperty(window, 'isSecureContext', { configurable: true, value: secure });
}

function stubMediaDevices(getUserMedia?: () => Promise<MediaStream>): void {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: getUserMedia ? { getUserMedia } : undefined
  });
}

function grantedCamera(): ReturnType<typeof vi.fn> {
  const gUM = vi.fn(async () => fakeStream());
  stubMediaDevices(() => gUM());
  return gUM;
}

function asMe(): void {
  identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
}

beforeEach(() => {
  trackStop.mockClear();
  decodeMock.scanText = null;
  apiMock.createMutualHandshake.mockReset().mockResolvedValue({});
  apiMock.createHandshake.mockReset().mockResolvedValue({});
  apiMock.listChatsOfUser.mockReset().mockResolvedValue([]);
  identity.set(null);
  stubSecurity(true);
});

afterEach(() => {
  cleanup();
});

describe('camera state machine (§3.8)', () => {
  it('renders the dialog WITHOUT starting the camera; the «Включить камеру» tap starts the stream', async () => {
    const gUM = grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite' } });
    expect(screen.getByRole('dialog', { name: ru['scan.aria'] })).toBeTruthy();
    expect(see(ru['scan.permission.intro'])).toBe(true);
    expect(screen.getByText(ru['scan.fallback.enter_code'])).toBeTruthy();
    expect(gUM).not.toHaveBeenCalled();

    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(gUM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(see(ru['scan.hint.join'])).toBe(true));
    expect(document.querySelector('video')).toBeTruthy();
  });

  it.each([
    { secure: false, media: false, httpsNote: true, what: 'insecure origin (no mediaDevices)' },
    { secure: true, media: false, httpsNote: false, what: 'secure context without mediaDevices' }
  ])('$what → the no-camera state (HTTPS note: $httpsNote)', async ({ secure, httpsNote }) => {
    stubSecurity(secure);
    stubMediaDevices(undefined);
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.no_camera'])).toBe(true));
    if (httpsNote) expect(screen.getByText(ru['scan.insecure'])).toBeTruthy();
    else expect(screen.queryByText(ru['scan.insecure'])).toBeNull();
  });

  it('denied permission shows the exact copy with a Try again action; the camera stays off', async () => {
    const gUM = vi.fn(async () => {
      throw new DOMException('denied', 'NotAllowedError');
    });
    stubMediaDevices(() => gUM());
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.permission.denied'])).toBe(true));
    expect(screen.getByRole('button', { name: ru['scan.try_again'] })).toBeTruthy();
    expect(screen.getByText(ru['scan.fallback.enter_code'])).toBeTruthy();
    expect(trackStop).not.toHaveBeenCalled(); // never started
  });

  it('the manual fallback closes from every state; the persona context shows the find-in-the-list fallback', async () => {
    const onClosed = vi.fn();
    grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite', onClosed } });
    await screen.getByRole('button', { name: ru['scan.fallback.enter_code'] }).click();
    await tick();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();

    cleanup();
    render(QrScanner, { props: { open: true, context: 'persona' } });
    expect(screen.getByText(ru['scan.fallback.find_list'])).toBeTruthy();
  });

  it('Escape closes and stops all camera tracks (light off)', async () => {
    const onClosed = vi.fn();
    grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite', onClosed } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(document.querySelector('video')).toBeTruthy());
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await tick();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trackStop).toHaveBeenCalled();
  });
});

describe('payload processing (§3.8)', () => {
  it('an invite QR hands the code to the join flow and closes the scanner', async () => {
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/invite?code=123456';
    const onInviteCode = vi.fn();
    const onClosed = vi.fn();
    render(QrScanner, {
      props: { open: true, context: 'invite', onInviteCode, onClosed }
    });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(onInviteCode).toHaveBeenCalledWith('123456'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(trackStop).toHaveBeenCalled(); // camera off on result
  });

  it.each([
    { content: 'https://example.com/something?x=1', context: 'invite', what: 'foreign content' },
    { content: 'http://localhost:5173/?u=0xalice', context: 'invite', what: 'a persona QR in invite context' },
    { content: 'http://localhost:5173/?code=123456', context: 'persona', what: 'an invite QR in persona context' }
  ])('$what shows the invalid-QR state (never a silent close); «Сканировать снова» restarts the camera', async ({ content, context }) => {
    const gUM = grantedCamera();
    decodeMock.scanText = content;
    render(QrScanner, { props: { open: true, context: context as 'invite' | 'persona' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.invalid_qr'])).toBe(true));
    expect(screen.queryByRole('dialog')).toBeTruthy();

    await screen.getByRole('button', { name: ru['scan.again'] }).click();
    await waitFor(() => expect(gUM).toHaveBeenCalledTimes(2));
  });
});

describe('persona routine (context *b*, v2 server-mediated §3.8)', () => {
  function personaProps(extra: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      open: true,
      context: 'persona',
      members: [me, alice],
      ...extra
    };
  }

  it('a foreign persona → error state; my own QR → info state; NEITHER sends a request', async () => {
    grantedCamera();
    decodeMock.scanText = personaQr('0xstranger');
    const onPersonaScanned = vi.fn();
    render(QrScanner, { props: personaProps({ onPersonaScanned }) });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.foreign_persona'])).toBe(true));
    expect(onPersonaScanned).toHaveBeenCalledWith('0xstranger');
    expect(apiMock.createMutualHandshake).not.toHaveBeenCalled();

    cleanup();
    asMe();
    grantedCamera();
    decodeMock.scanText = personaQr('0xme');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.own_qr'])).toBe(true));
    expect(apiMock.createMutualHandshake).not.toHaveBeenCalled();
  });

  it('a known persona → confirm card; confirming sends ONE mutual POST (u + m); an already-mutual pair reaches success the same way (NO client precheck)', async () => {
    asMe();
    apiMock.listChatsOfUser.mockResolvedValue([chatFixture('0xchat1', ['0xme', '0xalice'])]);
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    const onPersonaScanned = vi.fn();
    render(QrScanner, { props: personaProps({ onPersonaScanned }) });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    expect(screen.getByText('Алиса')).toBeTruthy();

    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));

    // v2: ONE server-mediated call — no client two-POST routine.
    expect(apiMock.createMutualHandshake).toHaveBeenCalledTimes(1);
    expect(apiMock.createMutualHandshake).toHaveBeenCalledWith({
      user_address: '0xalice',
      mutual_code: MUTUAL_CODE
    });
    expect(apiMock.createHandshake).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: ru['hs.open_dialog'] }).getAttribute('href')).toBe(
      '/chats/0xchat1'
    );
    expect(onPersonaScanned).toHaveBeenCalledWith('0xalice');

    // Already-mutual pair: the backend burns the code and returns success —
    // the client called the endpoint all the same.
    cleanup();
    asMe();
    apiMock.createMutualHandshake.mockReset().mockResolvedValue({});
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    expect(apiMock.createMutualHandshake).toHaveBeenCalledTimes(1);
  });

  it('a chat not yet listed after the call (eventual consistency) → the /chats fallback link', async () => {
    asMe();
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    expect(screen.getByRole('link', { name: ru['hs.open_dialog'] }).getAttribute('href')).toBe(
      '/chats'
    );
  });

  it.each([
    {
      status: 410,
      body: 'already used',
      state: ru['scan.code_used'],
      retry: false,
      scanAgain: true,
      what: 'a 410 → the stale-code state with Scan again and NO Retry for the dead code'
    },
    {
      status: 403,
      body: 'income must exceed outcome',
      state: ru['hs.income_limit'],
      retry: false,
      scanAgain: true,
      what: 'a 403 → the §2.9 income-rule state (the code was NOT consumed — scan again restarts)'
    },
    {
      status: 400,
      body: 'malformed payload',
      state: /malformed payload/,
      retry: true,
      scanAgain: false,
      what: 'an unexpected ApiError → server text with Retry'
    }
  ])('$what', async ({ status, body, state, retry, scanAgain }) => {
    asMe();
    apiMock.createMutualHandshake.mockRejectedValue(
      new ApiError(status, '/api/handshake/mutual', body)
    );
    const gUM = grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(state)).toBe(true));
    if (retry) expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
    else expect(screen.queryByRole('button', { name: ru['common.retry'] })).toBeNull();
    if (scanAgain) {
      await screen.getByRole('button', { name: ru['scan.again'] }).click();
      await waitFor(() => expect(gUM).toHaveBeenCalledTimes(2));
    }
  });

  it('a NetworkError shows the retry state; Retry re-sends u + m safely to success', async () => {
    asMe();
    apiMock.createMutualHandshake.mockRejectedValueOnce(
      new NetworkError('/api/handshake/mutual', new Error('offline'))
    );
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['scan.error.network'])).toBe(true));
    expect(apiMock.createMutualHandshake.mock.calls.length).toBe(1);

    // Network recovers → Retry re-sends u + m (a failed attempt never
    // burned the code) → success.
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    expect(apiMock.createMutualHandshake.mock.calls.length).toBe(2);
    expect(apiMock.createMutualHandshake.mock.calls[1]?.[0]).toEqual({
      user_address: '0xalice',
      mutual_code: MUTUAL_CODE
    });
  });

  it('a 401 during the mutual call closes the scanner — the §2.8 global gate owns the redirect', async () => {
    asMe();
    apiMock.createMutualHandshake.mockRejectedValue(
      new ApiError(401, '/api/handshake/mutual', 'no token')
    );
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    const onClosed = vi.fn();
    render(QrScanner, { props: personaProps({ onClosed }) });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    // No stale error panel under the queued redirect.
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(onClosed).toHaveBeenCalled();
  });

  it('a `?u=` payload WITHOUT `m` runs the single-direction variant: ONE idempotent handshake POST', async () => {
    asMe();
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice', false);
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.sent'])).toBe(true));
    expect(apiMock.createHandshake).toHaveBeenCalledTimes(1);
    expect(apiMock.createHandshake).toHaveBeenCalledWith({
      from_address: '0xme',
      to_address: '0xalice',
      status: 1
    });
    expect(apiMock.createMutualHandshake).not.toHaveBeenCalled();
  });

  it('the confirm card can be cancelled back to scanning (camera restarts, nothing sent)', async () => {
    asMe();
    const gUM = grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cancel'] }).click();
    await waitFor(() => expect(gUM).toHaveBeenCalledTimes(2)); // camera restarted
    expect(apiMock.createMutualHandshake).not.toHaveBeenCalled();
  });
});
