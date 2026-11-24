/** /host/[room_address]/invite tests (TZ13-04 Part A, DESIGN rev. 4 §3.7.3
 * AC 1–12): the guard redirect, the active list (15 s poll cadence, per-code
 * aria-labels, QR link to the per-code QR page), the mint control (presets
 * + custom datetime; mint appears at the top AND is recorded in the rule-C
 * ledger), revoke without confirm (row → history as «отозван»), the rule-C
 * history disclosure (caveat, dead rows non-interactive, no double render),
 * the empty state, inline errors with retry (ledger still renders),
 * failure-records-nothing, and the host reset semantics (404 deleted room,
 * 401/403 session reset). */
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { ApiError, type Invite } from '@bleak/api-client';

const { mockPage } = vi.hoisted(() => ({
  mockPage: {
    params: {} as Record<string, string | undefined>,
    url: new URL('http://localhost/host/0xroom/invite')
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
    listInvites: vi.fn(),
    mintInvite: vi.fn(),
    revokeInvite: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { hostApi } from '#lib/api/client';
import { clearHostRoom, hostRoom } from '../src/lib/stores/hostSession';
import Page from '../src/routes/host/[room_address]/invite/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const mockedHostApi = vi.mocked(hostApi, true);
const mockedGoto = vi.mocked(goto);

const ROOM_ADDRESS = '0xroom';

function invite(code: string, expiresInMs: number): Invite {
  return {
    room: ROOM_ADDRESS,
    code,
    created_at: new Date(Date.now() - 60_000).toISOString(),
    expires_at: new Date(Date.now() + expiresInMs).toISOString()
  };
}

const LEDGER_KEY = `bleak.hostInvites.${ROOM_ADDRESS}`;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  mockPage.params = { room_address: ROOM_ADDRESS };
  mockedHostApi.listInvites.mockResolvedValue([]);
  mockedHostApi.mintInvite.mockResolvedValue(invite('654321', 24 * 3_600_000));
  mockedHostApi.revokeInvite.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  clearHostRoom();
  localStorage.clear();
  sessionStorage.clear();
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

describe('guard (§3.7.3 AC 1)', () => {
  it('redirects to /host when no stored room session exists', async () => {
    await renderPage();
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(mockedHostApi.listInvites).not.toHaveBeenCalled();
  });

  it('redirects to /host when the stored roomAddress does not match the URL param', async () => {
    localStorage.setItem(
      'bleak.hostRoom',
      JSON.stringify({ code: '654321', roomAddress: '0xother', roomToken: 't' })
    );
    hostRoom.set({ code: '654321', roomAddress: '0xother', roomToken: 't' });
    await renderPage();
    await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
    expect(mockedHostApi.listInvites).not.toHaveBeenCalled();
  });
});

describe('active list (§3.7.3 AC 2, 11, 12)', () => {
  it('renders one InviteRow per active code with per-code aria-labels and the QR link to the per-code QR page', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 30 * 60_000)]);
    const { container } = render(Page, { props: {} });
    await screen.findByText('111111');
    // The row actions carry their per-code aria-labels (AC 11).
    expect(
      screen.getByRole('button', { name: ru['host.invites.copy_code'].replace('{code}', '111111') })
    ).toBeTruthy();
    expect(
      container.querySelector('a[aria-label="' + ru['host.invites.qr_aria'].replace('{code}', '111111') + '"]')
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ru['host.invites.copy_link'].replace('{code}', '111111') })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: ru['host.invites.revoke_aria'].replace('{code}', '111111') })
    ).toBeTruthy();
    // The QR action navigates to the per-code QR route (AC 11).
    const qrLink = container.querySelector('a[aria-label*="111111"]') as HTMLAnchorElement;
    expect(qrLink.getAttribute('href')).toBe(`/host/${ROOM_ADDRESS}/invite/111111/qr`);
    // The list is a real <ul> of rows ≥ 48px touch targets (AC 12).
    expect(container.querySelector('.rows')).toBeTruthy();
    expect(container.querySelector('ul.rows li.invite-row')).toBeTruthy();
  });

  it('shows the muted expiry («истекает через {time}») next to the code', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 30 * 60_000)]);
    render(Page, { props: {} });
    await screen.findByText('111111');
    const pattern = ru['host.invites.expires_in'].replace('{time}', '\\d+');
    expect(screen.getByText(new RegExp(pattern))).toBeTruthy();
  });
});

describe('mint control (§3.7.3 AC 3, 4)', () => {
  it('opens the inline chooser with the presets and 24 h pre-selected (default)', async () => {
    storeSession();
    await renderPage();
    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    const pressed = document.querySelectorAll('.pill[aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
    expect(pressed[0]!.textContent).toBe(ru['host.invites.preset.24h']);
    expect(screen.getByText(ru['host.invites.preset.1h'])).toBeTruthy();
    expect(screen.getByText(ru['host.invites.preset.7d'])).toBeTruthy();
    expect(screen.getByText(ru['host.invites.preset.custom'])).toBeTruthy();
  });

  it('mints with the preselected 24 h preset; the code appears at the top of the active list AND is recorded in the ledger (rule C)', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60 * 60_000)]);
    // The mint response is minted NOW — newer created_at than the fixture
    // list, so it must sort to the TOP of the active list.
    mockedHostApi.mintInvite.mockResolvedValue({
      room: ROOM_ADDRESS,
      code: '654321',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3_600_000).toISOString()
    });
    const { container } = render(Page, { props: {} });
    await screen.findByText('111111');

    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    await (container.querySelector('.mint-confirm') as HTMLButtonElement).click();
    await waitFor(() =>
      expect(mockedHostApi.mintInvite).toHaveBeenCalledWith(ROOM_ADDRESS, {
        expires_at: expect.any(String)
      })
    );
    const iso = (mockedHostApi.mintInvite.mock.calls[0]?.[1] as { expires_at: string }).expires_at;
    expect(new Date(iso).getTime()).toBeGreaterThan(Date.now() + 23 * 3_600_000);
    expect(new Date(iso).getTime()).toBeLessThan(Date.now() + 25 * 3_600_000);
    // The new code appears at the TOP of the active list…
    await waitFor(() => expect(screen.getByText('654321')).toBeTruthy());
    const firstRowCode = container.querySelector('ul.rows li.invite-row .code');
    expect(firstRowCode?.textContent).toBe('654321');
    // …AND is recorded in the rule-C ledger (bleak.hostInvites.<room>).
    expect(localStorage.getItem(LEDGER_KEY)).toContain('654321');
  });

  it('mints with «Своё время…» — the custom datetime-local value becomes the ISO expiry', async () => {
    storeSession();
    await renderPage();
    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    await screen.getByText(ru['host.invites.preset.custom']).click();
    await tick();
    const input = screen.getByLabelText(ru['host.invites.custom_label']) as HTMLInputElement;
    // min = now (the datetime-local input's minimum is the current time).
    expect(input.min).toBeTruthy();
    expect(new Date(input.min).getTime()).toBeLessThanOrEqual(Date.now() + 60_000);
    input.value = '2027-01-05T10:30';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    await (document.querySelector('.mint-confirm') as HTMLButtonElement).click();
    await waitFor(() =>
      expect(mockedHostApi.mintInvite).toHaveBeenCalledWith(ROOM_ADDRESS, {
        expires_at: new Date('2027-01-05T10:30').toISOString()
      })
    );
  });

  it('a mint failure records NOTHING in the ledger and renders the error inline near the control', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([]);
    mockedHostApi.mintInvite.mockRejectedValue(new ApiError(500, '/api/room/x/invite', 'db locked'));
    await renderPage();
    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    await (document.querySelector('.mint-confirm') as HTMLButtonElement).click();
    await waitFor(() => expect(screen.getByText(/db locked/)).toBeTruthy());
    expect(localStorage.getItem(LEDGER_KEY)).toBeNull();
  });
});

describe('revoke (§3.7.3 AC 5)', () => {
  it('revokes with NO confirm; the row leaves the active list, appears in history as «отозван» and the ledger is stamped', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60 * 60_000)]);
    render(Page, { props: {} });
    await screen.findByText('111111');

    // No confirm dialog: the click calls DELETE …/invite/{code} directly.
    await screen
      .getByRole('button', { name: ru['host.invites.revoke_aria'].replace('{code}', '111111') })
      .click();
    await waitFor(() =>
      expect(mockedHostApi.revokeInvite).toHaveBeenCalledWith(ROOM_ADDRESS, '111111')
    );
    await waitFor(() => expect(screen.getByText(ru['host.invites.revoked'])).toBeTruthy());
    // The row leaves the active list and re-renders inside the history
    // disclosure — the code text is now only a (non-interactive) history row.
    await waitFor(() =>
      expect(screen.getAllByText('111111').every((node) => !!node.closest('.history-row'))).toBe(
        true
      )
    );
    const today = new Date().toISOString().slice(0, 10);
    expect(
      screen.getByText(ru['host.invites.revoked_at'].replace('{date}', today))
    ).toBeTruthy();
    // The rule-C ledger carries the revocation stamp.
    const ledger = JSON.parse(localStorage.getItem(LEDGER_KEY) ?? '[]') as Array<{
      code: string;
      revoked_at?: string;
    }>;
    expect(ledger.some((entry) => entry.code === '111111' && entry.revoked_at)).toBe(true);
  });

  it('a revoke failure records nothing in the ledger and renders the error inline near the control', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60 * 60_000)]);
    mockedHostApi.revokeInvite.mockRejectedValue(
      new ApiError(500, '/api/room/x/invite/111111', 'db locked')
    );
    render(Page, { props: {} });
    await screen.findByText('111111');
    await screen
      .getByRole('button', { name: ru['host.invites.revoke_aria'].replace('{code}', '111111') })
      .click();
    await waitFor(() => expect(screen.getByText(/db locked/)).toBeTruthy());
    expect(localStorage.getItem(LEDGER_KEY)).toBeNull();
    // The row stays active (nothing happened).
    expect(screen.getByText('111111')).toBeTruthy();
  });
});

describe('rule-C history (§3.7.3 AC 3, 6, 7, 8)', () => {
  it('renders ledger entries missing from the server list as expired/revoked badges with the caveat under the header', async () => {
    storeSession();
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([
        {
          code: '222222',
          created_at: '2026-11-20T09:00:00Z',
          expires_at: '2026-11-20T10:00:00Z'
        },
        {
          code: '333333',
          created_at: '2026-11-21T09:00:00Z',
          expires_at: '2026-11-22T09:00:00Z',
          revoked_at: '2026-11-21T10:00:00Z'
        }
      ])
    );
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60 * 60_000)]);
    render(Page, { props: {} });
    await screen.findByText('111111');

    expect(screen.getByText(ru['host.invites.expired_title'])).toBeTruthy();
    // The binding ledger caveat under the section header (AC 7).
    expect(screen.getByText(ru['host.invites.ledger_caveat'])).toBeTruthy();
    // Expired/revoked muted text badges with the correct dates (AC 6).
    expect(
      screen.getByText(ru['host.invites.expired_at'].replace('{date}', '2026-11-20'))
    ).toBeTruthy();
    expect(
      screen.getByText(ru['host.invites.revoked_at'].replace('{date}', '2026-11-21'))
    ).toBeTruthy();
  });

  it('dead (history) rows are non-interactive: no copy/QR/revoke actions and no navigation (AC 8)', async () => {
    storeSession();
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([
        {
          code: '222222',
          created_at: '2026-11-20T09:00:00Z',
          expires_at: '2026-11-20T10:00:00Z'
        }
      ])
    );
    const { container } = render(Page, { props: {} });
    await screen.findByText('222222');
    const history = container.querySelector('.history-rows') as HTMLElement;
    expect(history).toBeTruthy();
    expect(history.querySelectorAll('button')).toHaveLength(0);
    expect(history.querySelectorAll('a')).toHaveLength(0);
  });

  it('entries still in the server list are never double-rendered (AC via merge rule)', async () => {
    storeSession();
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([
        {
          code: '111111',
          created_at: new Date(Date.now() - 120_000).toISOString(),
          expires_at: new Date(Date.now() + 60 * 60_000).toISOString()
        }
      ])
    );
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60 * 60_000)]);
    render(Page, { props: {} });
    await screen.findByText('111111');
    // Server-authoritative: 111111 renders once (active), no history row.
    expect(screen.getAllByText('111111')).toHaveLength(1);
    expect(screen.queryByText(ru['host.invites.expired_title'])).toBeNull();
  });

  it('the history section is omitted when it has no entries', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([invite('111111', 60 * 60_000)]);
    const { container } = render(Page, { props: {} });
    await screen.findByText('111111');
    expect(container.querySelector('details.history')).toBeNull();
  });
});

describe('states (§3.7.3)', () => {
  it('the empty state shows when there are no active codes and no ledger entries; its CTA opens the mint chooser', async () => {
    storeSession();
    mockedHostApi.listInvites.mockResolvedValue([]);
    render(Page, { props: {} });
    await screen.findByText(ru['host.invites.empty']);
    await screen.getByRole('button', { name: ru['host.invites.mint'] }).click();
    await tick();
    // The mint CTA opens the inline expiry chooser.
    expect(document.querySelector('.chooser')).toBeTruthy();
  });

  it('list errors render inline with retry; the ledger section still renders (it is local)', async () => {
    storeSession();
    localStorage.setItem(
      LEDGER_KEY,
      JSON.stringify([
        {
          code: '222222',
          created_at: '2026-11-20T09:00:00Z',
          expires_at: '2026-11-20T10:00:00Z'
        }
      ])
    );
    mockedHostApi.listInvites.mockRejectedValue(new ApiError(500, '/api/room/x/invite', 'db locked'));
    render(Page, { props: {} });
    await waitFor(() => expect(screen.getByText(/db locked/)).toBeTruthy());
    expect(screen.getByRole('button', { name: ru['common.retry'] })).toBeTruthy();
    // The local ledger section still renders during the error.
    expect(screen.getByText(ru['host.invites.expired_title'])).toBeTruthy();
  });
});

describe('poll cadence: 15 s, per-tick ledger re-merge, stopped on teardown', () => {
  it('polls listInvites every 15 s, re-merges the ledger per tick, and issues no requests after unmount', async () => {
    vi.useFakeTimers();
    try {
      storeSession();
      // 111111 was minted on THIS device (rule-C ledger seeded)…
      localStorage.setItem(
        LEDGER_KEY,
        JSON.stringify([
          {
            code: '111111',
            created_at: new Date(Date.now() - 60_000).toISOString(),
            expires_at: new Date(Date.now() + 60 * 60_000).toISOString()
          }
        ])
      );
      mockedHostApi.listInvites
        .mockResolvedValueOnce([invite('111111', 60 * 60_000)])
        .mockResolvedValue([]); // the code vanished server-side (revoked elsewhere)
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.listInvites).toHaveBeenCalledTimes(1);
      expect(screen.getByText('111111')).toBeTruthy();

      await vi.advanceTimersByTimeAsync(15_100);
      await vi.advanceTimersByTimeAsync(30);
      expect(mockedHostApi.listInvites).toHaveBeenCalledTimes(2);
      // The per-tick re-merge: the code is now missing from the server
      // list → it moved into the rule-C history section.
      expect(screen.getByText(ru['host.invites.expired_title'])).toBeTruthy();

      const callsBeforeUnmount = mockedHostApi.listInvites.mock.calls.length;
      cleanup();
      await vi.advanceTimersByTimeAsync(31_000);
      expect(mockedHostApi.listInvites.mock.calls.length).toBe(callsBeforeUnmount);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('host reset semantics (§3.7.3 states)', () => {
  it('listInvites 404 (room deleted elsewhere) → «Комната удалена.», cleared room + redirect to /host', async () => {
    storeSession();
    mockedHostApi.listInvites.mockRejectedValue(
      new ApiError(404, `/api/room/${ROOM_ADDRESS}/invite`, 'room not found')
    );
    render(Page, { props: {} });
    await waitFor(() => expect(screen.getByText(ru['host.room.deleted'])).toBeTruthy());
    expect(mockedGoto).toHaveBeenCalledWith('/host');
    expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
  });

  it.each([401, 403])(
    'a %i on listInvites clears bleak.hostRoom, sets bleak.hostNotice and lands on /host — attendee identity untouched',
    async (status) => {
      storeSession();
      mockedHostApi.listInvites.mockRejectedValue(
        new ApiError(status, `/api/room/${ROOM_ADDRESS}/invite`, 'revoked')
      );
      render(Page, { props: {} });
      await waitFor(() => expect(mockedGoto).toHaveBeenCalledWith('/host'));
      expect(localStorage.getItem('bleak.hostRoom')).toBeNull();
      expect(sessionStorage.getItem('bleak.hostNotice')).toBe('1');
      expect(localStorage.getItem('bleak.identity')).toBeNull();
    }
  );
});
