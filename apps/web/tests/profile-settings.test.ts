/** /profile/settings tests (DESIGN §4.29.B — v3.23 list-block restyle):
 * the settings page is APP-LEVEL ONLY now. Covered: the sub-page chrome
 * (no tab bar, back control with the /profile fallback, the CENTERED h1
 * «Настройки»), the ONE profile entry row → /profile/edit (AC 13; the
 * three old persona-edit rows are GONE — the editors re-host on
 * /profile/edit, covered by tests/profile-edit.test.ts), the Language row
 * with the INLINE LocaleControl, token rotation (§8.1.3 untouched:
 * identity + vault written only after 2xx; 403 keeps them), leave room
 * (purely local per Concept §11.1.1 / DESIGN §4.12.1: the confirmation
 * question first; clears identity + mutual code; NO server delete
 * anywhere in the exit path; the vault entry survives), the STANDALONE
 * full-width outline-red leave button (red font + red border, no filled
 * background), the load-error state, and §23.2 5.6 (no interests row).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError, type User } from '@bleak/api-client';
import { identity, saveIdentity } from '../src/lib/stores/identity';
import { mutualCode } from '../src/lib/stores/mutualCode';
import { tokenVault } from '../src/lib/stores/tokenVault';
import { verifyVaultEntry } from '../src/lib/join';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route.replace('[address]', '0xchat')
}));

vi.mock('#lib/api/client', () => ({
  api: {
    getRoomUser: vi.fn(),
    updateRoomUser: vi.fn(),
    getUserGreeting: vi.fn(),
    putUserGreeting: vi.fn(),
    regenerateGreeting: vi.fn(),
    deleteRoomUser: vi.fn(),
    rotateUserToken: vi.fn()
  }
}));

vi.mock('#lib/crypto/secrets', () => ({
  generateTokenSecret: () => 'N'.repeat(43)
}));

// Deterministic back rule: the test environment's history length is not
// meaningful — force the fallback branch so goto(/profile) is assertable.
vi.mock('#lib/chats/view', () => ({
  backTarget: () => 'list'
}));

import { api } from '#lib/api/client';
import Page from '../src/routes/profile/settings/+page.svelte';
import { ru } from '../src/lib/i18n/ru';

const ME = '0xme';
const ROOM = '0xroom';
const TOKEN = 'persona-token';
const mockedApi = vi.mocked(api, true);

function userFixture(overrides: Partial<User> = {}): User {
  return {
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

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  vi.useRealTimers();
  // The page hydrates the stores from localStorage defensively (initIdentity),
  // so storage AND the store must carry the identity.
  localStorage.setItem(
    'bleak.identity',
    JSON.stringify({ roomAddress: ROOM, userAddress: ME, token: TOKEN })
  );
  identity.set({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  // The entry row prefills from the persona record (mount-time fetch).
  mockedApi.getRoomUser.mockResolvedValue(userFixture());
  mockedApi.rotateUserToken.mockResolvedValue(undefined);
  mockedApi.deleteRoomUser.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  identity.set(null);
  mutualCode.set(null);
  tokenVault.set([]);
  localStorage.clear();
  vi.useRealTimers();
});

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('settings route renders (§4.29.B.1; AC 12; RU + EN)', () => {
  it('renders the CENTERED h1, locale control, rotate row and leave button (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: ru['profile.settings.title'] })).toBeTruthy();
    expect(screen.getByText(ru['common.locale'])).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.leave'] })).toBeTruthy();
    // EN parity: the same route re-renders through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('heading', { level: 1, name: en['profile.settings.title'] })).toBeTruthy();
    expect(screen.getByText(en['common.locale'])).toBeTruthy();
    setLocale('ru');
    await tick();
  });

  it('the h1 is CENTERED (grid [48px 1fr 48px]) with the back control in the side column', async () => {
    await renderPage();
    const bar = document.querySelector('.top-bar') as HTMLElement | null;
    expect(bar).toBeTruthy();
    // The back button and the spacer occupy the 48px side columns; the
    // title sits centered in the middle (source-level — happy-dom
    // evaluates no grid geometry).
    expect(bar?.querySelector('button.back')).toBeTruthy();
    expect(bar?.querySelector('.spacer')).toBeTruthy();
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/settings/+page.svelte'),
      'utf8'
    );
    const grid = source.match(/\.top-bar\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(grid).toContain('grid-template-columns: var(--touch-target) 1fr var(--touch-target)');
    const title = source.match(/\.top-bar h1\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(title).toContain('text-align: center');
  });

  it('is a sub-page: no tab bar (scoped style) + back navigation falling back to /profile', async () => {
    await renderPage();
    // The /chats/[address] sub-page pattern: the tab bar is hidden while the
    // route is mounted (scoped style injected into <head>).
    expect(document.head.innerHTML).toContain('nav.tabbar');
    // Back control: backTarget is forced to the fallback → goto(/profile).
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/profile'));
  });
});

describe('profile entry row (§4.29.B.3.1; AC 13, 17)', () => {
  it('renders the ONE entry row → /profile/edit: 40px own avatar + name + muted address + chevron; the accessible name is profile.edit.title', async () => {
    await renderPage();
    const entry = screen.getByRole('link', { name: ru['profile.edit.title'] }) as HTMLAnchorElement;
    expect(entry.getAttribute('href')).toBe('/profile/edit');
    // 40px own avatar (square, accent backdrop), the name and the muted
    // single-line address inside the row.
    const avatar = entry.querySelector('span.frame');
    expect(avatar).toBeTruthy();
    expect(entry.textContent).toContain('Трамвайщик');
    expect(entry.textContent).toContain(ME);
    // A chevron trails the row.
    expect(entry.querySelectorAll('svg').length).toBeGreaterThan(0);
  });

  it('the three old persona-edit rows are GONE; no toggle rows; no interests row (§23.2 5.6; AC 17)', async () => {
    await renderPage();
    // §4.29.E.3: the editor-row keys are RETIRED from the dictionaries —
    // the rows are gone with them (the editors re-host on /profile/edit).
    expect(ru['profile.persona.edit' as keyof typeof ru]).toBeUndefined();
    expect(ru['profile.greeting.edit' as keyof typeof ru]).toBeUndefined();
    expect(ru['profile.settings.persona' as keyof typeof ru]).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Интересы' })).toBeNull();
    // Exactly one block carries rows — no toggle markup anywhere (B.2:
    // nothing invented; there is no toggle-backed setting).
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/settings/+page.svelte'),
      'utf8'
    );
    expect(source).not.toMatch(/type="checkbox"/);
    expect(source).not.toMatch(/role="switch"/);
  });

  it('a load error shows ErrorBanner + retry; a retry re-fetches the persona record', async () => {
    mockedApi.getRoomUser.mockRejectedValueOnce(
      new ApiError(500, '/api/room/0xroom/user/0xme', 'db locked')
    );
    mockedApi.getRoomUser.mockResolvedValueOnce(userFixture());
    render(Page, { props: {} });
    await tick();
    await tick();
    // The error surfaces with a retry affordance...
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(screen.queryByRole('link', { name: ru['profile.edit.title'] })).toBeNull();
    // ...and the retry recovers into the entry row.
    await screen.getByRole('button', { name: ru['common.retry'] }).click();
    await waitFor(() =>
      expect(screen.getByRole('link', { name: ru['profile.edit.title'] })).toBeTruthy()
    );
  });
});

describe('token rotation (§8.1.3 — untouched; AC 15)', () => {
  function seedVault(): void {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        { roomAddress: ROOM, userAddress: ME, token: TOKEN, name: 'Трамвайщик', savedAt: '2026-11-15T10:00:00Z' },
        { roomAddress: '0xother', userAddress: '0xold', token: 'OTHER', name: 'Прошлая', savedAt: '2026-11-01T10:00:00Z' }
      ])
    );
  }

  it('the row opens the ConfirmDialog with the other-device lockout copy; the key glyph leads the row', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.rotate.row'] }).click();
    await tick();
    expect(screen.getByText(ru['profile.rotate.body'])).toBeTruthy();
    // The row carries the `key` glyph (§4.29.B.3.2, D.4).
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/settings/+page.svelte'),
      'utf8'
    );
    expect(source).toContain('PixelIcon name="key"');
  });

  it('rotate updates identity + the matching vault entry IN PLACE, only after the 2xx (AC 15)', async () => {
    seedVault();
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.rotate.row'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['profile.rotate.cta'] }).click();

    await waitFor(() => expect(mockedApi.rotateUserToken).toHaveBeenCalledTimes(1));
    // Bearer = the CURRENT token (auto-injected by the api context — the
    // page passes only the room, address and the new raw body token).
    expect(mockedApi.rotateUserToken).toHaveBeenCalledWith(ROOM, ME, 'N'.repeat(43));
    // Identity + vault rewritten ONLY after the 2xx:
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: 'N'.repeat(43) });
    expect(JSON.parse(localStorage.getItem('bleak.identity') ?? '{}')).toEqual({
      roomAddress: ROOM,
      userAddress: ME,
      token: 'N'.repeat(43)
    });
    const vault = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(vault[0]).toMatchObject({ roomAddress: ROOM, userAddress: ME, token: 'N'.repeat(43), name: 'Трамвайщик' });
    expect(vault[1]).toMatchObject({ token: 'OTHER' }); // untouched
  });

  it('a 403 keeps the identity and shows the inline server text (no client writes)', async () => {
    mockedApi.rotateUserToken.mockRejectedValue(
      new ApiError(403, '/api/room/0xroom/user/0xme/token', 'token belongs to another record')
    );
    seedVault();
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.rotate.row'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['profile.rotate.cta'] }).click();
    await waitFor(() => expect(screen.getByText(/token belongs to another record/)).toBeTruthy());
    // Identity + vault unchanged (written only after 2xx).
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')[0]).toMatchObject({ token: TOKEN });
  });
});

describe('leave room (§4.29.B.3.3; AC 16; Concept §11.1.1 local-only exit)', () => {
  function seedVault(): void {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        {
          roomAddress: ROOM,
          userAddress: ME,
          token: TOKEN,
          name: 'Трамвайщик',
          savedAt: '2026-11-18T10:00:00Z'
        }
      ])
    );
  }

  it('asks the confirmation question BEFORE leaving — local-leave copy, no server delete', async () => {
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    // The question is asked before any action — the dialog shows the
    // local-leave copy (no longer implying server-side deletion, §4.12.1).
    expect(screen.getByText(ru['profile.leave.confirm_body'])).toBeTruthy();
    expect(mockedApi.deleteRoomUser).not.toHaveBeenCalled();
  });

  it('confirms, clears identity + the one-time mutual code, and navigates to the join entry /income (tz12-02) — purely local, NO server delete (Concept §11.1.1)', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mutualCode.set({ userAddress: ME, code: 'LIVE' });
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    // NO delete anywhere in the attendee exit path (hard or soft) — the
    // persona stays on the server; the backend DELETE endpoint is only for
    // explicit deletion elsewhere (host drill-down).
    expect(mockedApi.deleteRoomUser).not.toHaveBeenCalled();
    await waitFor(() => expect(get(identity)).toBeNull());
    await waitFor(() => expect(localStorage.getItem('bleak.mutualCode')).toBeNull());
    expect(get(mutualCode)).toBeNull();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income'));
  });

  it('owner round-trip (§11.1.1 + §10.1.1): the vault entry survives the leave; the return-to-event pick validates the stored token and restores the identity', async () => {
    seedVault();
    await renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(get(identity)).toBeNull());
    // clearIdentity does NOT touch the vault — the entry is untouched.
    const stored = JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]');
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    // The return-to-event pick: verifyVaultEntry succeeds because the
    // persona was never deleted — the Bearer token equals the stored one.
    mockedApi.getRoomUser.mockResolvedValue(userFixture());
    const returned = await verifyVaultEntry(stored[0]);
    expect(returned.address).toBe(ME);
    expect(mockedApi.getRoomUser).toHaveBeenCalledWith(ROOM, ME, { token: TOKEN });
    // Identity restore from the entry fields (the JoinFlow enter path;
    // navigation to /room is covered by tests/join-flow.test.ts).
    saveIdentity({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  });
});

/**
 * Outline-style leave (§4.29.B.3.3; Concept §8.1.3, DESIGN §4.9.3): the
 * STANDALONE bottom button renders red font + red border ONLY on the
 * transparent surface — no filled red background (§7.1.6 roles verbatim).
 * tokens.css is parsed as the palette source of truth, same approach as
 * tests/bubble-contrast.test.ts.
 */
const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
const TOKENS_CSS = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');
const PAGE_SOURCE = readFileSync(join(WEB_ROOT, 'src/routes/profile/settings/+page.svelte'), 'utf8');

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16)
  ];
}

function luminance(hex: string): number {
  const lin = (value: number): number => {
    const s = value / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(fg: string, bg: string): number {
  const sorted = [luminance(fg), luminance(bg)].sort((a, b) => b - a);
  const hi = sorted[0] ?? 0;
  const lo = sorted[1] ?? 0;
  return (hi + 0.05) / (lo + 0.05);
}

describe('outline-style leave button (§4.29.B.3.3; Concept §8.1.3, DESIGN §4.9.3)', () => {
  it('the exit button is a STANDALONE full-width bottom button — red font + red border on a transparent background, NO filled red', () => {
    // tokens.css defines --color-danger: #c53030 (v2.1 §4.8.4 token, unchanged)
    // and the font-role companion --color-danger-text: #e05252 (architect
    // consult on the v2.2 outline style).
    expect(TOKENS_CSS).toMatch(/--color-danger:\s*#c53030\s*;/);
    expect(TOKENS_CSS).toMatch(/--color-danger-text:\s*#e05252\s*;/);
    // The standalone .leave rule (NOT inside a list block) wires the border
    // role to --color-danger and the font role to --color-danger-text, over
    // a transparent background (no fill).
    const leaveBlocks = [...PAGE_SOURCE.matchAll(/\.leave\s*\{[^}]*\}/g)].map((m) => m[0]);
    const outline = leaveBlocks.find((block) => block.includes('var(--color-danger'));
    expect(outline, 'standalone outline-style .leave rule').toBeTruthy();
    expect(outline).toMatch(/border:\s*1px solid var\(--color-danger\)/);
    expect(outline).toMatch(/(?<!border-)color:\s*var\(--color-danger-text\)/);
    expect(outline).not.toMatch(/background:\s*var\(--color-danger\)/);
    expect(outline).toMatch(/background:\s*transparent/);
    expect(outline).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    // Standalone placement: the button lives BELOW the blocks at the page
    // bottom — the markup order is blocks first, leave last.
    const lastBlockIndex = PAGE_SOURCE.lastIndexOf('class="block"');
    const leaveIndex = PAGE_SOURCE.indexOf('class="leave"');
    expect(leaveIndex).toBeGreaterThan(lastBlockIndex);
  });

  it('numeric contrast — font #e05252 on the surface ≥4.5:1 AA; border #c53030 on the surface ≥3:1 non-text', () => {
    // Font role: --color-danger-text (#e05252) on the card surface (#101213)
    // = 4.92:1 — WCAG 1.4.3 normal-text AA ≥4.5:1 holds.
    expect(contrast('#e05252', '#101213')).toBeGreaterThanOrEqual(4.5);
    // Border role: --color-danger (#c53030) on the same surface = 3.43:1 —
    // WCAG 1.4.11 non-text ≥3:1 holds (the 3.43 value recorded here
    // supersedes the earlier 4.5 note; see tokens.css lineage comment).
    expect(contrast('#c53030', '#101213')).toBeGreaterThanOrEqual(3);
  });
});
