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

describe('persona routine (context *b*, ruling 3)', () => {
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
    decodeMock.scanText = 'http://localhost:5173/?u=0xstranger';
    const onPersonaScanned = vi.fn();
    render(QrScanner, { props: personaProps({ onPersonaScanned }) });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.foreign_persona'])).toBe(true));
    expect(onPersonaScanned).toHaveBeenCalledWith('0xstranger');
    expect(apiMock.createHandshake).not.toHaveBeenCalled();
  });

  it('my own QR shows the info state and sends no request', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xme';
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.own_qr'])).toBe(true));
    expect(apiMock.createHandshake).not.toHaveBeenCalled();
  });

  it('a known persona → confirm card with name; confirming sends BOTH POSTs in order → success', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    const onPersonaScanned = vi.fn();
    render(QrScanner, { props: personaProps({ onPersonaScanned }) });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    expect(screen.getByText('Алиса')).toBeTruthy();

    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));

    const calls = apiMock.createHandshake.mock.calls;
    expect(calls.length).toBe(2);
    expect(calls[0]?.[0]).toEqual({ from_address: '0xme', to_address: '0xalice', status: 1 });
    expect(calls[1]?.[0]).toEqual({ from_address: '0xalice', to_address: '0xme', status: 1 });

    // No chat listed yet (eventual consistency) → the /chats fallback link.
    const link = screen.getByRole('link', { name: ru['hs.open_dialog'] });
    expect(link.getAttribute('href')).toBe('/chats');
    expect(onPersonaScanned).toHaveBeenCalledWith('0xalice');
  });

  it('already mutual → skips the POSTs entirely, success links to the chat', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    apiMock.listChatsOfUser.mockResolvedValue([chatFixture('0xchat1', ['0xme', '0xalice'])]);
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    expect(apiMock.createHandshake).not.toHaveBeenCalled();
    const link = screen.getByRole('link', { name: ru['hs.open_dialog'] });
    expect(link.getAttribute('href')).toBe('/chats/0xchat1');
  });

  it('idempotent 200 responses reach the same success state (no error UI)', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    // 200/201 are identical success; the panel offers scan-again, no error copy.
    expect(screen.getByRole('button', { name: ru['scan.again'] })).toBeTruthy();
    expect(screen.queryByText(ru['scan.error.network'])).toBeNull();
  });

  it('a NetworkError during the POSTs shows the retry state; Retry re-sends the pair safely', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    apiMock.createHandshake.mockRejectedValueOnce(
      new NetworkError('/api/handshake', new Error('offline'))
    );
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(ru['scan.error.network'])).toBe(true));
    expect(apiMock.createHandshake.mock.calls.length).toBe(1);

    // Network recovers → Retry re-sends the pair (idempotent) → success.
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() => expect(see(ru['hs.agents_talking'])).toBe(true));
    expect(apiMock.createHandshake.mock.calls.length).toBe(3);
  });

  it('an ApiError shows the server text with Retry', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    apiMock.createHandshake.mockRejectedValue(
      new ApiError(400, '/api/handshake', 'income must exceed outcome')
    );
    grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cta'] }).click();
    await waitFor(() => expect(see(/income must exceed outcome/)).toBe(true));
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
  });

  it('the confirm card can be cancelled back to scanning', async () => {
    identity.set({ roomAddress: '0xroom', userAddress: '0xme' });
    const gUM = grantedCamera();
    decodeMock.scanText = 'http://localhost:5173/?u=0xalice';
    render(QrScanner, { props: personaProps() });
    await screen.getByRole('button', { name: ru['scan.turn_on'] }).click();
    await waitFor(() => expect(see(ru['scan.confirm.title'])).toBe(true));
    await screen.getByRole('button', { name: ru['scan.confirm.cancel'] }).click();
    await waitFor(() => expect(gUM).toHaveBeenCalledTimes(2)); // camera restarted
    expect(apiMock.createHandshake).not.toHaveBeenCalled();
  });
});
