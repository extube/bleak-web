/** /host/[room_address]/invite/[code]/qr tests (TZ13-04 Part B, DESIGN
 * rev. 4 §3.7.4 AC 1–7): the guard redirect, the client-side QR (ZERO
 * network requests, 280px frame, code aria-label), the code row (Handjet +
 * copy-code chip whose clipboard receives the digits), the copy-link
 * control (clipboard gets the deep link), the conditional native Share
 * button (only where navigator.share exists, same URL), the
 * LINK-NEVER-RENDERED DOM scan, the unknown-code warning (QR + actions
 * still render), the ONE mount liveness recheck (no Poller), the inline
 * error with retry, and the polite «Скопировано» confirmations. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError } from '@bleak/api-client';

const { mockPage } = vi.hoisted(() => ({
  mockPage: {
    params: {} as Record<string, string | undefined>,
    url: new URL('http://localhost/host/0xroom/invite/123456/qr')
  }
}));
vi.mock('$app/state', () => ({ page: mockPage }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: Record<string, string>) => {
    let out = route;
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        out = out.replace(`[${key}]`, value);
      }
    }
    return out;
  }
}));

vi.mock('#lib/api/client', () => ({
  HOST_NOTICE_KEY: 'bleak.hostNotice',
  hostApi: {
    listInvites: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { hostApi } from '#lib/api/client';
import { clearHostRoom, hostRoom } from '../src/lib/stores/hostSession';
import { inviteQrPayload } from '../src/lib/qr/svgQr';
import Page from '../src/routes/host/[room_address]/invite/[code]/qr/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const mockedHostApi = vi.mocked(hostApi, true);
const mockedGoto = vi.mocked(goto);

const ROOM_ADDRESS = '0xroom';
const CODE = '123456';
const LEDGER_KEY = `bleak.hostInvites.${ROOM_ADDRESS}`;

/** The absolute invite deep link — the SAME payload the QR encodes. */
const PAYLOAD = () => inviteQrPayload(CODE);

let clipboardWrite: ReturnType<typeof vi.fn>;
const nativeShare = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockPage.params = { room_address: ROOM_ADDRESS, code: CODE };
  mockedHostApi.listInvites.mockResolvedValue([]);
  // Clipboard stub (happy-dom may or may not expose one).
  clipboardWrite = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText: clipboardWrite },
    configurable: true
  });
  Reflect.deleteProperty(navigator, 'share');
});

afterEach(() => {
  cleanup();
  clearHostRoom();
  localStorage.clear();
  sessionStorage.clear();
  Reflect.deleteProperty(navigator, 'clipboard');
  Reflect.deleteProperty(navigator, 'share');
});

function storeSession(): void {
  localStorage.setItem(
    'bleak.hostRoom',
    JSON.stringify({ code: '123456', roomAddress: ROOM_ADDRESS, roomToken: 'stored-room-token' })
  );
  hostRoom.set({ code: '123456', roomAddress: ROOM_ADDRESS, roomToken: 'stored-room-token' });
}

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await tick();
  await tick();
}

describe('guard (§3.7.2)', () => {
  it('redirects to /host when no stored room session exists', async () => {
    await renderPage();
    await vi.waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(mockedHostApi.listInvites).not.toHaveBeenCalled();
  });

  it('redirects to /host when the stored roomAddress does not match the URL param', async () => {
    localStorage.setItem(
      'bleak.hostRoom',
      JSON.stringify({ code: '654321', roomAddress: '0xother', roomToken: 't' })
    );
    hostRoom.set({ code: '654321', roomAddress: '0xother', roomToken: 't' });
    await renderPage();
    await vi.waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(mockedHostApi.listInvites).not.toHaveBeenCalled();
  });
});

describe('QR (§3.7.4 AC 1)', () => {
  it('renders the client-side QR with ZERO network requests, 280px pixel-cornered frame and the code aria-label', async () => {
    storeSession();
    // Zero-network contract: any fetch during render FAILS the test.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => {
        throw new Error('the invite QR must not issue network requests');
      })
    );
    mockedHostApi.listInvites.mockResolvedValue([{ code: CODE } as never]);
    const { container } = render(Page, { props: {} });
    await screen.findByText(CODE);

    const frame = container.querySelector('.frame') as HTMLElement;
    expect(frame).toBeTruthy();
    expect(frame.querySelector('svg')).toBeTruthy();
    expect(frame.style.width).toBe('280px');
    expect(frame.style.height).toBe('280px');
    expect(frame.className).toContain('pixel-corners');
    expect(frame.getAttribute('aria-label')).toBe(
      ru['host.qr.aria'].replace('{code}', CODE)
    );
    // No network access happened — the stub would have thrown on any use.
    expect(vi.mocked(fetch).mock.calls.length).toBe(0);
    vi.unstubAllGlobals();
  });
});

describe('code row + copy actions (§3.7.4 AC 2, 3, 7)', () => {
  it('shows the 6-digit code (Handjet 40px) with a copy-code chip whose clipboard receives the digits', async () => {
    storeSession();
    const { container } = render(Page, { props: {} });
    await screen.findByText(CODE);
    expect(container.querySelector('.code')).toBeTruthy();
    const chip = screen.getByRole('button', {
      name: ru['host.qr.copy_code_aria'].replace('{code}', CODE)
    });
    expect(chip.textContent).toBe(ru['host.qr.copy_code']);
    await chip.click();
    await vi.waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(CODE));
  });

  it('the copy-link control writes the absolute invite deep link to the clipboard', async () => {
    storeSession();
    render(Page, { props: {} });
    await screen.findByText(CODE);
    const link = screen.getByRole('button', {
      name: ru['host.qr.copy_link_aria']
    });
    expect(link.textContent).toBe(ru['host.qr.copy_link']);
    await link.click();
    await vi.waitFor(() => expect(clipboardWrite).toHaveBeenCalledWith(PAYLOAD()));
  });

  it('copy actions confirm with «Скопировано» announced aria-live=polite', async () => {
    storeSession();
    render(Page, { props: {} });
    await screen.findByText(CODE);
    await screen
      .getByRole('button', { name: ru['host.qr.copy_code_aria'].replace('{code}', CODE) })
      .click();
    const note = await screen.findByText(ru['common.copied']);
    expect(note.getAttribute('aria-live')).toBe('polite');
  });

  it('the back control returns to the invite page', async () => {
    storeSession();
    const { container } = render(Page, { props: {} });
    await screen.findByText(CODE);
    const back = container.querySelector('a.back') as HTMLAnchorElement;
    expect(back.getAttribute('href')).toBe(`/host/${ROOM_ADDRESS}/invite`);
  });
});

describe('share-or-copy-link (§3.7.4 AC 3)', () => {
  it('renders NO native Share button where navigator.share does not exist', async () => {
    storeSession();
    render(Page, { props: {} });
    await screen.findByText(CODE);
    expect(screen.queryByText(ru['host.qr.share'])).toBeNull();
  });

  it('renders the native Share button ONLY where navigator.share exists and shares the SAME URL', async () => {
    storeSession();
    Object.defineProperty(navigator, 'share', {
      value: nativeShare.mockResolvedValue(undefined),
      configurable: true
    });
    render(Page, { props: {} });
    await screen.findByText(CODE);
    const share = screen.getByText(ru['host.qr.share']);
    await share.click();
    await vi.waitFor(() => expect(nativeShare).toHaveBeenCalledWith({ url: PAYLOAD() }));
  });
});

describe('LINK NEVER RENDERED (§3.7.4 AC 4 — hard AC)', () => {
  it('the URL appears only in clipboard/share payloads — never as text, title or tooltip', async () => {
    storeSession();
    Object.defineProperty(navigator, 'share', {
      value: nativeShare.mockResolvedValue(undefined),
      configurable: true
    });
    const { container } = render(Page, { props: {} });
    await screen.findByText(CODE);
    // Both link actions exist…
    expect(screen.getByRole('button', { name: ru['host.qr.copy_link_aria'] })).toBeTruthy();
    expect(screen.getByText(ru['host.qr.share'])).toBeTruthy();
    // …but the URL itself is nowhere in the DOM (no text node, no title,
    // no tooltip — the scan covers element text AND every attribute).
    expect(container.innerHTML).not.toContain('code=');
    expect(container.innerHTML).not.toContain(PAYLOAD());
    // Even the QR aria-label carries the CODE, not the URL.
    expect(container.innerHTML).toContain(CODE);
  });
});

describe('unknown code (§3.7.4 AC 5)', () => {
  it('an unknown [code] renders the warning line but still renders the QR and the code actions', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([]); // not in the server list
    // …and not in the device ledger either.
    const { container } = render(Page, { props: {} });
    await screen.findByText(ru['host.qr.warning']);
    expect(container.querySelector('.frame')).toBeTruthy();
    expect(container.querySelector('.code')?.textContent).toBe(CODE);
    expect(screen.getByRole('button', { name: ru['host.qr.copy_code_aria'].replace('{code}', CODE) })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['host.qr.copy_link_aria'] })).toBeTruthy();
  });

  it('a code known from the server list renders NO warning', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([{ code: CODE } as never]);
    render(Page, { props: {} });
    await screen.findByText(CODE);
    expect(screen.queryByText(ru['host.qr.warning'])).toBeNull();
  });

  it('a code known from the device ledger (expired/revoked here) renders NO warning', async () => {
    storeSession();
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([
        {
          code: CODE,
          created_at: '2026-11-20T09:00:00Z',
          expires_at: '2026-11-20T10:00:00Z'
        }
      ])
    );
    mockedHostApi.listInvites.mockResolvedValue([]);
    render(Page, { props: {} });
    await screen.findByText(CODE);
    expect(screen.queryByText(ru['host.qr.warning'])).toBeNull();
  });
});

describe('no Poller (§3.7.4 AC 6)', () => {
  it('runs ONE liveness recheck on mount, then idle — no further requests', async () => {
    vi.useFakeTimers();
    try {
      storeSession();
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.listInvites).toHaveBeenCalledTimes(1);
      expect(screen.getByText(CODE)).toBeTruthy();
      await vi.advanceTimersByTimeAsync(65_000);
      expect(mockedHostApi.listInvites).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('loading + error states (§3.7.4 states)', () => {
  it('shows the skeleton card during the recheck', async () => {
    storeSession();
    let resolveRecheck: (value: never) => void = () => {};
    mockedHostApi.listInvites.mockReturnValue(
      new Promise((resolve) => {
        resolveRecheck = resolve as unknown as (value: never) => void;
      })
    );
    const { container } = render(Page, { props: {} });
    await tick();
    expect(container.querySelector('.skeleton')).toBeTruthy();
    expect(container.querySelector('.frame')).toBeNull();
    resolveRecheck([] as never);
    await vi.waitFor(() => expect(container.querySelector('.frame')).toBeTruthy());
  });

  it('a failed recheck renders the inline error with retry; a retry success resolves the warning state', async () => {
    storeSession();
    mockedHostApi.listInvites
      .mockRejectedValueOnce(new ApiError(500, '/api/room/x/invite', 'db locked'))
      .mockResolvedValue([]);
    render(Page, { props: {} });
    await screen.findByText(/db locked/);
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
    expect(mockedHostApi.listInvites).toHaveBeenCalledTimes(1);
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await vi.waitFor(() => expect(mockedHostApi.listInvites).toHaveBeenCalledTimes(2));
    // After the successful retry: unknown-code warning (empty server list,
    // empty ledger) — the page is usable again.
    await screen.findByText(ru['host.qr.warning']);
    expect(screen.queryByText(/db locked/)).toBeNull();
  });
});

describe('host reset (§3.7.4 guard semantics)', () => {
  it.each([401, 403])(
    'a %i on the recheck clears bleak.hostRoom, sets bleak.hostNotice and lands on /host',
    async (status) => {
      storeSession();
      mockedHostApi.listInvites.mockRejectedValue(
        new ApiError(status, `/api/room/${ROOM_ADDRESS}/invite`, 'revoked')
      );
      render(Page, { props: {} });
      await vi.waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
      expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
      expect(sessionStorage.getItem('bleak.hostNotice')).toBe('1');
    }
  );
});
