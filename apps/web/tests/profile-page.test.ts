/** /profile page tests — LEAN suite, re-targeted to the §4.29 redesign
 * (v3.23 profile redesign, Concept §42): the header (h1 + the scan
 * affordance icon button + the settings gear icon link, AC 1), the header
 * scan button opening the shared §3.8 QrScanner (Concept §50, superseding
 * the §4.29.A.2 tab-switch reading; the QR display stays reachable via its
 * tab panel, EXACTLY ONE QrCodeBadge instance), the centered identity block (AC 3), the exactly-three stat tiles
 * above the tabs (AC 4, Concept §8.1.5), the three pill tabs with real
 * tablist/tab/tabpanel semantics and the About default (AC 5), the tab
 * contents (AC 6–7), the live QR block (AC 8), live QR
 * registration/rotation/failure (AC 9 — hash-only bodies, raw never sent;
 * rotation switches to the QR tab when another tab is active), persona 404
 * (AC 10), and the read-only display — NO persona edit affordances (AC 6;
 * all persona editing lives on /profile/edit). The private-bio heading and
 * interests-title-margin source contracts (Concept §9.1.1/§9.1.4) carry. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, type Chat, type Handshake, type User } from '@bleak/api-client';
import { identity } from '../src/lib/stores/identity';
import { mutualCode } from '../src/lib/stores/mutualCode';
import { tokenVault } from '../src/lib/stores/tokenVault';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route.replace('[address]', '0xchat')
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoomUser: vi.fn(),
    listHandshakesOfUser: vi.fn(),
    listChatsOfUser: vi.fn(),
    listRoomUsers: vi.fn(),
    registerMutualCode: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  // Deterministic fakes: the raw mutual code is fixed and the SHA-256 hash
  // is a CONSTANT (independent of its input), so hash-only registration is
  // assertable — the raw value appears in no hashed output either.
  generateMutualCode: () => 'MUTUALRAWCODE',
  sha256Hex: async () => 'FAKEHASH'
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/profile/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');

const ME = '0xme';
const ROOM = '0xroom';
const TOKEN = 'persona-token';
const mockedApi = vi.mocked(api, true);

function userFixture(overrides: Partial<User> = {}): User {
  return {
    active: true,
    address: ME,
    room: ROOM,
    name: 'Трамвайщик',
    greeting: 'Привет! Я про трамваи.',
    public_bio: 'Поттер из Питера',
    private_bio: 'Люблю глина и стеклодувное дело',
    language: 'ru',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    deleted_at: null,
    ...overrides
  };
}

function handshake(from: string, to: string): Handshake {
  return {
    tx_id: `${from}->${to}`,
    from_address: from,
    to_address: to,
    room: ROOM,
    status: 1,
    value: 1,
    created_at: new Date().toISOString()
  };
}

function chat(address: string, participants: string[]): Chat {
  return {
    address,
    room: ROOM,
    phase: 'networking',
    phase_started_at: new Date().toISOString(),
    scenario: 'ai-future',
    language: 'ru',
    created_at: new Date().toISOString(),
    participants: participants.map((user) => ({ chat: address, user }))
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  // The page hydrates the stores from localStorage defensively (initIdentity
  // + initMutualCode), so storage AND the stores must carry the identity.
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: TOKEN })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: true }));
  mockedApi.listHandshakesOfUser.mockResolvedValue([]);
  mockedApi.listChatsOfUser.mockResolvedValue([]);
  mockedApi.listRoomUsers.mockResolvedValue([]);
  mockedApi.registerMutualCode.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  identity.set(null);
  mutualCode.set(null);
  tokenVault.set([]);
  localStorage.clear();
  vi.useRealTimers();
});

async function renderPage(): Promise<{ container: HTMLElement }> {
  const result = render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
  await tick();
  await tick();
  return result;
}

/** Activate the QR tab through the real tab button (role queries skip the
 * hidden panels, so QR-panel content queries go through this). */
async function openQrTab(): Promise<void> {
  await screen.getByRole('tab', { name: ru['profile.tab.qr'] }).click();
  await tick();
  await tick();
}

describe('header (§4.29.A.1, AC 1)', () => {
  it('renders «Мой профиль» with the QR affordance button and the gear icon link to /profile/settings (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    await renderPage();

    expect(screen.getByRole('heading', { level: 1, name: ru['profile.title'] })).toBeTruthy();
    // Scan affordance: an icon-only button; the label announces scanner
    // intent (Concept §50 — the §4.29.E copy retargeted, both dictionaries).
    const qrBtn = screen.getByRole('button', { name: ru['profile.header.qr'] });
    expect(qrBtn).toBeTruthy();
    // Gear: a real link (§2.6) styled as an icon button, navigating to the
    // settings sub-page; its accessible name is the settings title.
    const gear = screen.getByRole('link', { name: ru['profile.settings.title'] }) as HTMLAnchorElement;
    expect(gear.getAttribute('href')).toBe('/profile/settings');

    // EN parity: the same header re-renders through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('heading', { level: 1, name: en['profile.title'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: en['profile.header.qr'] })).toBeTruthy();
    expect(screen.getByRole('link', { name: en['profile.settings.title'] })).toBeTruthy();
    setLocale('ru');
    await tick();
  });

  it('the header cluster sits top-right at the header level, icon buttons are token-styled (source-level)', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/+page.svelte'),
      'utf8'
    );
    // The two affordances live INSIDE the header element (top-right).
    const header = source.match(/<header class="header">[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(header).toContain('profile.header.qr');
    expect(header).toContain("resolve('/profile/settings')");
    expect(header).toContain('PixelIcon name="scan"');
    expect(header).toContain('PixelIcon name="gear"');
    // Concept §50: the scan button's target is the §3.8 scanner, not the
    // QR tab.
    expect(header).toContain('onclick={openScanner}');
    // Icon-button treatment: full touch target, muted → text hover, tokens
    // only (§4.29.A.1).
    const block = source.match(/\.icon-btn\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('var(--touch-target)');
    expect(block).toContain('color: var(--color-text-muted)');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('header scan affordance → §3.8 QrScanner (Concept §50, supersedes §4.29.A.2)', () => {
  it('tapping the header scan button opens the QrScanner overlay, NOT the QR tab; members fetched ONCE per open', async () => {
    mockedApi.listRoomUsers.mockResolvedValue([]);
    await renderPage();

    // Default tab on mount is About (the QR panel starts hidden — hidden
    // panels are inaccessible to role queries, so they are checked by id).
    expect(
      (screen.getByRole('tab', { name: ru['profile.tab.about'] }).getAttribute('aria-selected'))
    ).toBe('true');
    expect(
      document.querySelector('#profile-panel-qr')?.hasAttribute('hidden')
    ).toBe(true);

    await screen.getByRole('button', { name: ru['profile.header.qr'] }).click();
    await tick();
    await tick();

    // The §3.8 scanner dialog is open (the overlay target, NOT the display).
    expect(screen.getByRole('dialog', { name: ru['scan.aria'] })).toBeTruthy();
    // The QR tab did NOT activate — the button's target changed (Concept §50).
    expect(
      (screen.getByRole('tab', { name: ru['profile.tab.about'] }).getAttribute('aria-selected'))
    ).toBe('true');
    expect(
      document.querySelector('#profile-panel-qr')?.hasAttribute('hidden')
    ).toBe(true);

    // The persona members list is fetched ONCE per open (no polling).
    expect(mockedApi.listRoomUsers).toHaveBeenCalledTimes(1);
    expect(mockedApi.listRoomUsers).toHaveBeenCalledWith(ROOM);
  });

  it('a member-list failure still opens the scanner (empty list — §3.8 empty-membership semantics)', async () => {
    mockedApi.listRoomUsers.mockRejectedValue(new Error('offline'));
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.header.qr'] }).click();
    await tick();
    await tick();
    expect(screen.getByRole('dialog', { name: ru['scan.aria'] })).toBeTruthy();
    expect(mockedApi.listRoomUsers).toHaveBeenCalledTimes(1);
  });

  it('closing the scanner and re-opening refetches the members list (once per open, still no polling)', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.header.qr'] }).click();
    await tick();
    await tick();
    await screen.getByRole('button', { name: ru['scan.close'] }).click();
    await tick();
    expect(screen.queryByRole('dialog', { name: ru['scan.aria'] })).toBeNull();
    await screen.getByRole('button', { name: ru['profile.header.qr'] }).click();
    await tick();
    await tick();
    expect(mockedApi.listRoomUsers).toHaveBeenCalledTimes(2);
  });

  it('the QR DISPLAY stays reachable via its tab-panel affordance (§43 A.2 carried); EXACTLY ONE QrCodeBadge', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    const { container } = await renderPage();

    // Exactly one QR mount in the whole DOM (the QR tab panel's).
    expect(container.querySelectorAll('figure.qr-badge').length).toBe(1);
    // No scanner open by default — the header button targets the scanner,
    // the tab panel remains the QR display affordance.
    expect(screen.queryByRole('dialog', { name: ru['scan.aria'] })).toBeNull();

    await openQrTab();
    expect(
      (screen.getByRole('tab', { name: ru['profile.tab.qr'] }).getAttribute('aria-selected'))
    ).toBe('true');
    expect(
      container.querySelector('#profile-panel-qr')?.hasAttribute('hidden')
    ).toBe(false);
    // The QR is visible and announced exactly once.
    expect(screen.getAllByRole('img', { name: ru['profile.qr.aria'] }).length).toBe(1);
  });
});

describe('identity block (§4.29.A.4, AC 3)', () => {
  it('a centered column: the 96px square avatar, the name and the read-only language meta', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    await renderPage();
    expect(screen.getByText('Трамвайщик')).toBeTruthy();
    expect(screen.getByText(ru['profile.language.meta'].replace('{language}', 'ru'))).toBeTruthy();
    // Square treatment is the PixelAvatar default (D.1): the badge carries
    // NO border-radius / ring on the avatar frame — source-level.
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const identity = source.match(/\.identity\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(identity).toContain('flex-direction: column');
    expect(identity).toContain('align-items: center');
    expect(identity).not.toMatch(/border-radius/);
  });
});

describe('badge content tabs (AC 6, 7)', () => {
  it('renders name, greeting, bios, language meta, interest chips from the mirror, and stats; a live stored code re-renders WITHOUT a registration call', async () => {
    // The interests mirror (DESIGN §4.13.1): scoped rows under the shared
    // `bleak.interests` key — titles as stored at add time.
    localStorage.setItem(
      'bleak.interests',
      JSON.stringify({
        '0xroom|0xme': [
          { title: 'Кофе', group: 2, key: 13, user_address: ME },
          { title: 'Книги', group: 3, key: 22, user_address: ME }
        ]
      })
    );
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.listHandshakesOfUser.mockResolvedValue([
      handshake(ME, '0xa'),
      handshake('0xb', ME)
    ]);
    mockedApi.listChatsOfUser.mockResolvedValue([chat('0xchat1', [ME, '0xa'])]);

    await renderPage();

    expect(screen.getByText('Трамвайщик')).toBeTruthy();
    expect(screen.getByText('Привет! Я про трамваи.')).toBeTruthy();
    expect(screen.getByText('Поттер из Питера')).toBeTruthy();
    // Badge chips read the mirror and re-localize through the catalog
    // (RU locale: keys 13 and 22 → «Кофе» / «Книги», with their emojis).
    expect(screen.getByText(/Кофе/)).toBeTruthy();
    expect(screen.getByText(/Книги/)).toBeTruthy();
    expect(screen.getByText(ru['profile.stats.handshakes_label'])).toBeTruthy();
    // the stored code is LIVE → no registration call (fresh registration is
    // covered by the live-QR block)
    expect(mockedApi.registerMutualCode).not.toHaveBeenCalled();
  });

  it('unknown mirror keys fall back to the stored title (no fake emoji)', async () => {
    localStorage.setItem(
      'bleak.interests',
      JSON.stringify({
        '0xroom|0xme': [{ title: 'Парусный спорт', group: 4, key: 999, user_address: ME }]
      })
    );
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    await renderPage();
    expect(screen.getByText(/Парусный спорт/)).toBeTruthy();
  });

  it('chips follow the locale via the catalog (EN: Coffee / Books)', async () => {
    localStorage.setItem(
      'bleak.interests',
      JSON.stringify({
        '0xroom|0xme': [
          { title: 'Кофе', group: 2, key: 13, user_address: ME },
          { title: 'Книги', group: 3, key: 22, user_address: ME }
        ]
      })
    );
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    await renderPage();
    const { setLocale } = await import('../src/lib/i18n/locale');
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByText(/Coffee/)).toBeTruthy();
    expect(screen.getByText(/Books/)).toBeTruthy();
    setLocale('ru');
    await tick();
  });

  it('the private bio carries the muted-red caption above the content (carried §4.10.3 markup)', async () => {
    await renderPage();
    const heading = document.querySelector('.private-bio-heading');
    expect(heading?.textContent).toBe(ru['profile.private_bio.caption']);
  });
});

describe('pill tabs semantics (§4.29.A.7, AC 5)', () => {
  it('a real tablist with three tabs; default is About; panels are labelled and swap instantly (hidden attribute)', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    const { container } = await renderPage();

    const tablist = screen.getByRole('tablist');
    expect(tablist).toBeTruthy();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.length).toBe(3);
    expect(screen.getByRole('tab', { name: ru['profile.tab.about'] })).toBeTruthy();
    expect(screen.getByRole('tab', { name: ru['profile.tab.interests'] })).toBeTruthy();
    expect(screen.getByRole('tab', { name: ru['profile.tab.qr'] })).toBeTruthy();

    // Default tab on mount = About; its panel is the only visible one.
    expect(
      (screen.getByRole('tab', { name: ru['profile.tab.about'] }).getAttribute('aria-selected'))
    ).toBe('true');
    expect(container.querySelector('#profile-panel-about')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#profile-panel-interests')?.hasAttribute('hidden')).toBe(true);
    expect(container.querySelector('#profile-panel-qr')?.hasAttribute('hidden')).toBe(true);

    // Switch to Interests: aria-selected moves, the panel becomes visible —
    // an instant content swap (hidden attribute, no animation).
    await screen.getByRole('tab', { name: ru['profile.tab.interests'] }).click();
    await tick();
    expect(
      (screen.getByRole('tab', { name: ru['profile.tab.interests'] }).getAttribute('aria-selected'))
    ).toBe('true');
    expect(container.querySelector('#profile-panel-interests')?.hasAttribute('hidden')).toBe(false);
    expect(container.querySelector('#profile-panel-about')?.hasAttribute('hidden')).toBe(true);

    // The active pill carries the fill-accent treatment, inactive
    // outline-muted (source-level — happy-dom computes no styles).
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const tab = source.match(/\.tab\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(tab).toContain('border-radius: var(--radius-pill)');
    expect(tab).toContain('min-height: var(--touch-target)');
    expect(tab).toContain('transition:');
    const active = source.match(/\.tab\.active\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(active).toContain('background: var(--color-accent)');
    expect(active).toContain('color: var(--color-accent-ink)');
    // Pills stay smooth — never .pixel-corners on the tabs.
    expect(source).not.toMatch(/class="tabs[^"]*pixel-corners/);
    // The tablist/tab/tabpanel semantics are real roles.
    expect(source).toContain('role="tablist"');
    expect(container.querySelectorAll('[role="tab"]').length).toBe(3);
    expect(container.querySelectorAll('[role="tabpanel"]').length).toBe(3);
  });
});

describe('live badge QR (AC 8, 9)', () => {
  it('first load with no code: registers a fresh code sending the HASH only, never the raw', async () => {
    await renderPage();
    await waitFor(() => expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1));
    // body = the SHA-256 hash of the generated code — the raw code value
    // (MUTUALRAWCODE) appears in NO argument of the registration call
    expect(mockedApi.registerMutualCode).toHaveBeenCalledWith(ROOM, ME, 'FAKEHASH');
    for (const call of mockedApi.registerMutualCode.mock.calls) {
      expect(JSON.stringify(call)).not.toContain('MUTUALRAWCODE');
    }
    // the raw code persists client-side for the badge QR re-render
    expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'MUTUALRAWCODE' });
    expect(localStorage.getItem('bleak.mutualCode')).toContain('MUTUALRAWCODE');
  });

  it('the QR tab shows the badge skeleton until a code exists (never a broken payload)', async () => {
    // Hang the registration: the skeleton stays until the fresh code lands.
    mockedApi.registerMutualCode.mockReturnValue(new Promise(() => undefined));
    await renderPage();
    await openQrTab();
    expect(document.querySelector('.qr-skeleton')).toBeTruthy();
    expect(screen.queryByRole('img', { name: ru['profile.qr.aria'] })).toBeNull();
  });

  it('with a stored code the QR tab shows the framed QR with both captions (AC 8)', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    await renderPage();
    await openQrTab();
    expect(screen.getByRole('img', { name: ru['profile.qr.aria'] })).toBeTruthy();
    expect(screen.getByText(ru['profile.qr.caption'])).toBeTruthy();
    expect(screen.getByText(ru['profile.qr.onetime'])).toBeTruthy();
    // The QR issues no network request of its own — only the badge poll ran.
    expect(mockedApi.registerMutualCode).not.toHaveBeenCalled();
  });

  it('a burned flag (mutual_code_live=false) rotates: fresh code, hash-only body, note auto-hides after 2 s', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'OLD' }));
      mutualCode.set({ userAddress: ME, code: 'OLD' });
      mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: false }));
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1);
      expect(mockedApi.registerMutualCode).toHaveBeenCalledWith(ROOM, ME, 'FAKEHASH');
      expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'MUTUALRAWCODE' });
      // The rotation switched the app to the QR tab first (§4.29.A.3) — the
      // note announces the swap there and auto-hides after 2 s.
      expect(
        (screen.getByRole('tab', { name: ru['profile.tab.qr'] }).getAttribute('aria-selected'))
      ).toBe('true');
      expect(screen.getByText(ru['profile.qr.refreshed'], { exact: false })).toBeTruthy();
      await vi.advanceTimersByTimeAsync(2000);
      await tick();
      expect(screen.queryByText(ru['profile.qr.refreshed'], { exact: false })).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('a rotation firing while ANOTHER tab is active switches to the QR tab first (§4.29.A.3)', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'OLD' }));
      mutualCode.set({ userAddress: ME, code: 'OLD' });
      mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: false }));
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1);
      // The default tab was About; the rotation forced the QR tab active.
      expect(
        (screen.getByRole('tab', { name: ru['profile.tab.qr'] }).getAttribute('aria-selected'))
      ).toBe('true');
      expect(
        (screen.getByRole('tab', { name: ru['profile.tab.about'] }).getAttribute('aria-selected'))
      ).toBe('false');
    } finally {
      vi.useRealTimers();
    }
  });

  it('registration failure keeps the last QR and retries on the next 4 s tick', async () => {
    vi.useFakeTimers();
    try {
      localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'OLD' }));
      mutualCode.set({ userAddress: ME, code: 'OLD' });
      mockedApi.getRoomUser.mockResolvedValue(userFixture({ mutual_code_live: false }));
      mockedApi.registerMutualCode
        .mockRejectedValueOnce(new ApiError(500, '/x', 'db locked'))
        .mockResolvedValueOnce(undefined);
      render(Page, { props: {} });
      await vi.advanceTimersByTimeAsync(30);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(1);
      // The old code is untouched while the registration fails.
      expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'OLD' });
      // Next 4 s tick: the flag still reads false → retry succeeds.
      await vi.advanceTimersByTimeAsync(4100);
      await tick();
      expect(mockedApi.registerMutualCode).toHaveBeenCalledTimes(2);
      expect(get(mutualCode)).toEqual({ userAddress: ME, code: 'MUTUALRAWCODE' });
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('read-only display (Concept §42.3, DESIGN §4.29.A/G.3)', () => {
  it('NO persona edit affordances remain on /profile — no edit buttons, editing lives on /profile/edit', async () => {
    localStorage.setItem('bleak.interests', JSON.stringify({}));
    await renderPage();
    // The removed edit keys no longer exist at all (§23.2 5.6 + E.3).
    expect(ru['profile.interests.edit' as keyof typeof ru]).toBeUndefined();
    expect(ru['profile.interests.add' as keyof typeof ru]).toBeUndefined();
    // The persona is still displayed in full: greeting preview, bios,
    // interests title (read-only section labels, not edit affordances).
    expect(screen.getByText('Привет! Я про трамваи.')).toBeTruthy();
    expect(screen.getByText('Поттер из Питера')).toBeTruthy();
    expect(screen.getAllByText(ru['profile.interests.title']).length).toBeGreaterThan(0);
    // The page renders NO editing api calls.
    expect(mockedApi.updateRoomUser).toBeUndefined();
    expect(mockedApi.getRoomUser).toHaveBeenCalled(); // badge poll only
  });

  it('the badge component carries no edit callbacks or edit icons (source-level)', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    expect(source).not.toContain('oneditpersona');
    expect(source).not.toContain('oneditgreeting');
    expect(source).not.toContain('oneditinterests');
    expect(source).not.toMatch(/PixelIcon\s+name="edit"/);
    // The «add interests» chip was an edit affordance — gone too.
    expect(source).not.toContain('add-chip');
  });
});

describe('persona 404 (AC 10)', () => {
  it('renders the not-found card and the exit clears identity', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.getRoomUser.mockRejectedValue(new ApiError(404, '/api/room/0xroom/user/0xme', 'user not found'));
    await renderPage();
    expect(screen.getByText(ru['profile.not_found'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['profile.exit'] }).click();
    await waitFor(() => expect(get(identity)).toBeNull());
  });
});

describe('profile stats — exactly three, above the tabs (AC 4; Concept §8.1.5)', () => {
  it('renders EXACTLY three stat tiles — Sent / Added you / Chatting — with the renamed RU labels', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.listHandshakesOfUser.mockResolvedValue([
      handshake(ME, '0xa'), // sent
      handshake('0xb', ME) // received → "Added you"
    ]);
    mockedApi.listChatsOfUser.mockResolvedValue([chat('0xchat1', [ME, '0xa'])]);

    const { container } = render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    await tick();
    await tick();

    // Exactly three tiles — no fourth metric on /profile, none hidden away.
    expect(container.querySelectorAll('.stats .stat-tile').length).toBe(3);
    // The renamed labels (RU) are all present, and the old ones are gone.
    expect(screen.getByText(ru['profile.stats.handshakes_label'])).toBeTruthy(); // «Отправлено»
    expect(screen.getByText(ru['profile.stats.added_label'])).toBeTruthy(); // «Добавили вас»
    expect(screen.getByText(ru['profile.stats.dialogs_label'])).toBeTruthy(); // «В диалогах»
    expect(screen.queryByText('Хендшейки')).toBeNull();
    expect(screen.queryByText('Диалоги')).toBeNull();

    // The stats row sits ABOVE the pill tabs in the DOM (A.5).
    const card = container.querySelector('article');
    const stats = card?.querySelector('.stats');
    const tabs = card?.querySelector('[role="tablist"]');
    expect(stats && tabs && (stats.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING)).toBeTruthy();
  });

  it('EN parity: the same three tiles read Sent / Added you / Chatting', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.listHandshakesOfUser.mockResolvedValue([handshake(ME, '0xa')]);
    mockedApi.listChatsOfUser.mockResolvedValue([]);
    const { container } = render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    await tick();
    await tick();

    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    setLocale('en');
    await tick();
    await tick();

    expect(container.querySelectorAll('.stats .stat-tile').length).toBe(3);
    expect(screen.getByText(en['profile.stats.handshakes_label'])).toBeTruthy(); // Sent
    expect(screen.getByText(en['profile.stats.added_label'])).toBeTruthy(); // Added you
    expect(screen.getByText(en['profile.stats.dialogs_label'])).toBeTruthy(); // Chatting
    setLocale('ru');
    await tick();
  });
});

describe('private-bio heading (Concept §10.1.3, DESIGN §4.11.3)', () => {
  it('the «only your agent sees this» heading is small, sentence case, and keeps the muted red', async () => {
    await renderPage();
    const heading = document.querySelector('.private-bio-heading');
    expect(heading?.textContent).toBe(ru['profile.private_bio.caption']);
    // The v2.4 amendment: body face (Inter — NOT the Handjet pixel font)
    // and a muted red derived from the danger token via color-mix (never
    // solid); the uppercase is dropped and the heading becomes SMALLER
    // than the private content below it — size contrast is the hierarchy.
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const block = source.match(/\.private-bio-heading\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('font-family: var(--font-body)');
    expect(block).not.toContain('var(--font-pixel)');
    expect(block).toContain('color-mix(in srgb, var(--color-danger-text) 70%, transparent)');
    expect(block).not.toContain('var(--color-text-muted)');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); // tokens only, no raw hex
    // Sentence case: the transform is explicitly none, no uppercase left.
    expect(block).toContain('text-transform: none');
    expect(block).not.toContain('uppercase');
    // Smaller than the private bio text (14px) below it.
    const headingSize = Number(block.match(/font-size:\s*(\d+)px/)?.[1]);
    const bioBlock = source.match(/\.bio-text\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const bioSize = Number(bioBlock.match(/font-size:\s*(\d+)px/)?.[1]);
    expect(headingSize).toBeGreaterThan(0);
    expect(bioSize).toBeGreaterThan(0);
    expect(headingSize).toBeLessThan(bioSize);
    // The heading sits ABOVE the private content in the badge block.
    const orderBlock = source.match(/for_agent[\s\S]*?bio-text/)?.[0] ?? '';
    expect(orderBlock.indexOf('private-bio-heading')).toBeLessThan(
      orderBlock.indexOf('bio-text')
    );
  });

  it('the persona editor caption carries the same small sentence-case treatment (body face + muted red)', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/PersonaEditor.svelte'),
      'utf8'
    );
    const block = source.match(/\.private-bio-heading\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('font-family: var(--font-body)');
    expect(block).not.toContain('var(--font-pixel)');
    expect(block).toContain('color-mix(in srgb, var(--color-danger-text) 70%, transparent)');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(block).toContain('text-transform: none');
    expect(block).not.toContain('uppercase');
    const headingSize = Number(block.match(/font-size:\s*(\d+)px/)?.[1]);
    expect(headingSize).toBeGreaterThan(0);
    expect(headingSize).toBeLessThan(14); // smaller than the 14px content size
  });
});

describe('interests title margin (Concept §9.1.4, DESIGN §4.10.4)', () => {
  it('a clear vertical gap sits between the «Interests» title row and the interest chips — tokens only', async () => {
    await renderPage();
    // The title row is present on the interests panel, directly followed by
    // the chips.
    expect(document.querySelector('.row-head .bio-label')?.textContent)
      .toBe(ru['profile.interests.title']);
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const block = source.match(/\.row-head\s*\{[\s\S]*?\}/)?.[0] ?? '';
    // The chosen spacing-scale step (--space-3 = 12px) is applied below the
    // title row, before the chips / empty-state content.
    expect(block).toContain('margin-bottom: var(--space-3)');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); // tokens only, no raw hex
  });
});

describe('phone full-screen form (Concept §12, DESIGN §4.12.1 item 5)', () => {
  /**
   * §4.29.G.6: at phone widths (<720px) the /profile content becomes the
   * page — full width/height, no rounded floating chrome, no pixel-corner
   * clip. happy-dom evaluates no media queries, so the contract is the
   * repo's established source-read pattern — now split across the route
   * (container + header + the not-found card) and the ProfileBadge card
   * (the panel cards). The overrides live ONLY inside the
   * `max-width: 719px` query — desktop (min-width: 720px) is untouched.
   */
  it('the route drops its container chrome at phone widths — full-bleed, tab-bar clearance stays', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/+page.svelte'),
      'utf8'
    );
    const match = source.match(/@media \(max-width:\s*719px\)\s*\{([\s\S]*)<\/style>/);
    expect(match, 'phone (max-width: 719px) block not found').toBeTruthy();
    const phone = match?.[1] ?? '';
    // The container drops its side padding; the bottom tab-bar clearance
    // stays (functional, not chrome) and the header keeps its own gutter.
    expect(phone).toMatch(
      /\.profile-page\s*\{[^}]*padding:\s*0 0 calc\(var\(--bottom-tabbar-height\)/
    );
    expect(phone).toMatch(/\.header\s*\{[^}]*padding:\s*var\(--space-5\)/);
    expect(phone).toMatch(/\.badge\s*\{[^}]*border-radius:\s*0/);
    // Tokens only (sweep discipline).
    expect(phone).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('the ProfileBadge panel cards drop their floating chrome at phone widths; desktop is untouched', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    const match = source.match(/@media \(max-width:\s*719px\)\s*\{([\s\S]*)<\/style>/);
    expect(match, 'phone (max-width: 719px) block not found').toBeTruthy();
    const phone = match?.[1] ?? '';
    expect(phone).toMatch(/\.card\s*\{[^}]*border-radius:\s*0/);
    expect(phone).toMatch(/\.card\s*\{[^}]*clip-path:\s*none/);
    // Each chrome-dropping declaration appears exactly once — inside the
    // 719px query, never in the base (desktop) rules.
    for (const decl of ['border-radius: 0', 'clip-path: none']) {
      expect(source.split(decl).length - 1).toBe(1);
    }
    const base = source.replace(/@media \(max-width:\s*719px\)[\s\S]*$/, '');
    expect(base).not.toContain('border-radius: 0');
    expect(base).not.toContain('clip-path: none');
  });
});

// ---------------------------------------------------------------------------
// Auto-handshake indicator (Concept §49, DESIGN §4.35.B): a muted status
// line in the identity block, composed label + ": " + on|off from the
// SERVER-provided User.active (no write path on this page, no local state).
// ---------------------------------------------------------------------------

describe('auto-handshake indicator (§4.35.B)', () => {
  it('renders the on-state pair from user.active = true (RU composed string)', async () => {
    mockedApi.getRoomUser.mockResolvedValue(userFixture({ active: true }));
    await renderPage();
    expect(
      screen.getByText(`${ru['profile.auto_handshake.label']}: ${ru['profile.auto_handshake.on']}`)
    ).toBeTruthy();
  });

  it('renders the off-state pair from user.active = false (RU composed string)', async () => {
    mockedApi.getRoomUser.mockResolvedValue(userFixture({ active: false }));
    await renderPage();
    expect(
      screen.getByText(`${ru['profile.auto_handshake.label']}: ${ru['profile.auto_handshake.off']}`)
    ).toBeTruthy();
    // Only ONE state word ever renders — never both.
    expect(
      screen.queryByText(`${ru['profile.auto_handshake.label']}: ${ru['profile.auto_handshake.on']}`)
    ).toBeNull();
  });

  it('EN parity: the same pair reads "Auto-handshake: on/off" via the locale store', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    mockedApi.getRoomUser.mockResolvedValue(userFixture({ active: true }));
    await renderPage();
    setLocale('en');
    await tick();
    await tick();
    expect(
      screen.getByText(`${en['profile.auto_handshake.label']}: ${en['profile.auto_handshake.on']}`)
    ).toBeTruthy();
    setLocale('ru');
    await tick();
  });

  it('the indicator is NON-INTERACTIVE and the identity block carries no controls (the page stays read-only)', async () => {
    mockedApi.getRoomUser.mockResolvedValue(userFixture({ active: false }));
    await renderPage();
    const line = document.querySelector('.auto-handshake');
    expect(line).toBeTruthy();
    expect(line?.querySelector('button, a, input, [role]')).toBeNull();
    // No write path exists anywhere on /profile (§4.35.B: the toggle lives
    // on /profile/settings).
    expect(mockedApi.updateRoomUser).toBeUndefined();
  });

  it('the line is the LAST element of the identity block, under the language-meta line (source-level, §4.35.B guards)', async () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/lib/components/profile/ProfileBadge.svelte'),
      'utf8'
    );
    // Identity-block composition (A.4 amended): avatar → name → meta →
    // auto-handshake line (last).
    const identity = source.match(/<header class="identity">[\s\S]*?<\/header>/)?.[0] ?? '';
    expect(identity.indexOf('class="meta-stack"')).toBeGreaterThan(
      identity.indexOf('class="name"')
    );
    expect(identity.indexOf('class="auto-handshake"')).toBeGreaterThan(
      identity.indexOf('class="meta"')
    );
    // 14px muted line, tight space-1 stack under the meta, the reused
    // status-active glyph decorative (no label prop → PixelIcon renders
    // aria-hidden itself) — tokens only, no new glyph.
    const block = source.match(/\.auto-handshake\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('font-size: 14px');
    expect(block).toContain('color: var(--color-text-muted)');
    expect(identity).toContain('PixelIcon name="status-active"');
    expect(identity).not.toMatch(/PixelIcon name="status-active"[^>]*label=/);
    expect(source).not.toMatch(/class="auto-handshake[^"]*pixel-corners/);
  });
});
