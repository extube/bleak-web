/** QrScanner component tests (TZ-04, DESIGN §3.8): camera state machine
 * (no start without the CTA tap; granted/denied/no-camera copy), manual
 * fallback from every state, invite-QR hand-off, and the persona routine
 * wiring (confirm → both POSTs → success) with a mocked decoder + api.
 *
 * Note: state copies are announced in the aria-live region as well as shown
 * in the result panel, so presence checks use getAllByText (see()). */
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
  it('renders the dialog when open; the camera is NOT started without the CTA tap', () => {
    const gUM = grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite' } });
    expect(screen.getByRole('dialog', { name: ru['scan.aria'] })).toBeTruthy();
    expect(see(ru['scan.permission.intro'])).toBe(true);
    expect(screen.getByText(ru['scan.fallback.enter_code'])).toBeTruthy();
    expect(gUM).not.toHaveBeenCalled();
  });

  it('the «Включить камеру» tap starts the stream and shows the viewfinder + hint', async () => {
    const gUM = grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(gUM).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(see(ru['scan.hint.join'])).toBe(true));
    expect(document.querySelector('video')).toBeTruthy();
  });

  it('no navigator.mediaDevices (insecure origin) → no-camera state + HTTPS note', async () => {
    stubSecurity(false);
    stubMediaDevices(undefined);
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.no_camera'])).toBe(true));
    expect(screen.getByText(ru['scan.insecure'])).toBeTruthy();
  });

  it('secure context without mediaDevices → no-camera state without the HTTPS note', async () => {
    stubSecurity(true);
    stubMediaDevices(undefined);
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.no_camera'])).toBe(true));
    expect(screen.queryByText(ru['scan.insecure'])).toBeNull();
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

  it('the manual fallback closes from every state (invite: enter code manually)', async () => {
    const onClosed = vi.fn();
    grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite', onClosed } });
    await screen.getByRole('button', { name: ru['scan.fallback.enter_code'] }).click();
    await tick();
    expect(onClosed).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('persona context shows the find-in-the-list fallback', () => {
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

  it('focus returns to the invoking button on close', async () => {
    const opener = document.createElement('button');
    opener.textContent = 'opener';
    document.body.appendChild(opener);
    opener.focus();
    grantedCamera();
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('dialog')));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    await tick();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('states are announced via aria-live', () => {
    render(QrScanner, { props: { open: true, context: 'invite' } });
    const live = document.querySelector('[aria-live="polite"]');
    expect(live?.textContent).toBe(ru['scan.permission.intro']);
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

  it('foreign/invalid QR content shows the invalid-QR state (never a silent close)', async () => {
    grantedCamera();
    decodeMock.scanText = 'https://example.com/something?x=1';
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.invalid_qr'])).toBe(true));
    expect(screen.queryByRole('dialog')).toBeTruthy();
  });

  it('a persona QR scanned in invite context is invalid content', async () => {
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    const onPersonaScanned = vi.fn();
    render(QrScanner, {
      props: { open: true, context: 'invite', onPersonaScanned }
    });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.invalid_qr'])).toBe(true));
    expect(onPersonaScanned).not.toHaveBeenCalled();
  });

  it('an invite QR scanned in persona context is invalid content', async () => {
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?code=123456';
    const onInviteCode = vi.fn();
    render(QrScanner, { props: { open: true, context: 'persona', onInviteCode } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.invalid_qr'])).toBe(true));
    expect(onInviteCode).not.toHaveBeenCalled();
  });

  it('«Сканировать снова» restarts the camera from a terminal state', async () => {
    const gUM = grantedCamera();
    decodeMock.scanText = 'https://example.com/something?x=1';
    render(QrScanner, { props: { open: true, context: 'invite' } });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.invalid_qr'])).toBe(true));
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

  it('a foreign persona shows the error state and sends no request', async () => {
    grantedCamera();
    decodeMock.scanText = personaQr('0xstranger');
    const onPersonaScanned = vi.fn();
    render(QrScanner, { props: personaProps({ onPersonaScanned }) });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.foreign_persona'])).toBe(true));
    expect(onPersonaScanned).toHaveBeenCalledWith('0xstranger');
    expect(apiMock.createMutualHandshake).not.toHaveBeenCalled();
  });

  it('my own QR shows the info state and sends no request', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    grantedCamera();
    decodeMock.scanText = personaQr('0xme');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.own_qr'])).toBe(true));
    expect(apiMock.createMutualHandshake).not.toHaveBeenCalled();
  });

  it('a known persona → confirm card with name; confirming sends ONE mutual POST (u + m) → success', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
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

    // The chat is in the refreshed list → the link points at the dialog.
    const link = screen.getByRole('link', { name: ru['hs.open_dialog'] });
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
    expect(onPersonaScanned).toHaveBeenCalledWith('0xalice');
  });

  it('an already-mutual pair reaches the same success state — NO client precheck skips the call', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    apiMock.listChatsOfUser.mockResolvedValue([chatFixture('0xchat1', ['0xme', '0xalice'])]);
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    // The backend burns the code and returns success without a second
    // chat — the client called the endpoint all the same.
    expect(apiMock.createMutualHandshake).toHaveBeenCalledTimes(1);
    const link = screen.getByRole('link', { name: ru['hs.open_dialog'] });
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
  });

  it('a chat not yet listed after the call (eventual consistency) → the /chats fallback link', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    const link = screen.getByRole('link', { name: ru['hs.open_dialog'] });
    expect(link.getAttribute('href')).toBe('/chats');
  });

  it('a 410 renders the stale-code state with Scan again and NO Retry for the dead code', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    apiMock.createMutualHandshake.mockRejectedValue(
      new ApiError(410, '/api/handshake/mutual', 'already used')
    );
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['scan.code_used'])).toBe(true));
    // No "Retry" control for the dead code — only Scan again + fallback.
    expect(screen.queryByRole('button', { name: ru['common.retry'] })).toBeNull();
    expect(screen.getByRole('button', { name: ru['scan.again'] })).toBeTruthy();
    expect(screen.getByText(ru['scan.fallback.find_list'])).toBeTruthy();
  });

  it('a 403 renders the §2.9 income-rule state; the copy never implies the badge burned', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    apiMock.createMutualHandshake.mockRejectedValue(
      new ApiError(403, '/api/handshake/mutual', 'income must exceed outcome')
    );
    const gUM = grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.income_limit'])).toBe(true));
    // Server text appended muted (§2.9).
    expect(see(/income must exceed outcome/)).toBe(true);
    expect(screen.queryByRole('button', { name: ru['common.retry'] })).toBeNull();
    // Scan again works (the code was not consumed on the rule rejection):
    // the camera restarts (2nd getUserMedia call).
    await screen.getByRole('button', { name: ru['scan.again'] }).click();
    await waitFor(() => expect(gUM).toHaveBeenCalledTimes(2));
  });

  it('a NetworkError shows the retry state; Retry re-sends u + m safely to success', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
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
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
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

  it('an ApiError shows the server text with Retry', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
    apiMock.createMutualHandshake.mockRejectedValue(
      new ApiError(400, '/api/handshake/mutual', 'malformed payload')
    );
    grantedCamera();
    decodeMock.scanText = personaQr('0xalice');
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(/malformed payload/)).toBe(true));
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
  });

  it('a `?u=` payload WITHOUT `m` runs the single-direction variant: ONE idempotent handshake POST', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
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

  it('the confirm card can be cancelled back to scanning', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme', token: 't' });
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
