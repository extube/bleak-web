/** /profile/settings tests (Concept §8.1.3, DESIGN §4.9.3): the settings
 * block moved off /profile onto this sub-page — a pure logic move, so the
 * moved suites assert the same behaviors against the new route: heading +
 * rows render (RU + EN), token rotation (identity + vault written only
 * after 2xx; 403 keeps them), leave room (confirmation question first;
 * clears identity + mutual code; failure keeps identity), outline-style
 * leave button (red font + red border, no filled background), back
 * navigation, and no tab bar (sub-page pattern). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';
import { get } from 'svelte/store';
import { ApiError } from '@bleak/api-client';
import { identity } from '../src/lib/stores/identity';
import { mutualCode } from '../src/lib/stores/mutualCode';
import { tokenVault } from '../src/lib/stores/tokenVault';

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string) => route.replace('[address]', '0xchat')
}));

vi.mock('#lib/api/client', () => ({
  api: {
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

function renderPage(): void {
  render(Page, { props: {} });
}

describe('settings route renders (AC: heading, locale, rows; RU + EN)', () => {
  it('renders the heading, locale control, rotate row and leave button (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    renderPage();
    expect(screen.getByRole('heading', { name: ru['profile.settings.title'] })).toBeTruthy();
    expect(screen.getByText(ru['common.locale'])).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.rotate.row'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['profile.leave'] })).toBeTruthy();
    // EN parity: the same route re-renders through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('heading', { name: en['profile.settings.title'] })).toBeTruthy();
    expect(screen.getByText(en['common.locale'])).toBeTruthy();
    setLocale('ru');
    await tick();
  });

  it('is a sub-page: no tab bar (scoped style) + back navigation falling back to /profile', async () => {
    renderPage();
    // The /chats/[address] sub-page pattern: the tab bar is hidden while the
    // route is mounted (scoped style injected into <head>).
    expect(document.head.innerHTML).toContain('nav.tabbar');
    // Back control: backTarget is forced to the fallback → goto(/profile).
    await screen.getByRole('button', { name: ru['common.back'] }).click();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/profile'));
  });
});

describe('token rotation (AC 15, moved from /profile)', () => {
  function seedVault(): void {
    localStorage.setItem(
      'bleak.tokenVault',
      JSON.stringify([
        { roomAddress: ROOM, userAddress: ME, token: TOKEN, name: 'Трамвайщик', savedAt: '2026-11-15T10:00:00Z' },
        { roomAddress: '0xother', userAddress: '0xold', token: 'OTHER', name: 'Прошлая', savedAt: '2026-11-01T10:00:00Z' }
      ])
    );
  }

  it('rotate updates identity + the matching vault entry IN PLACE, only after the 2xx (AC 15)', async () => {
    seedVault();
    renderPage();
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
    renderPage();
    await screen.getByRole('button', { name: ru['profile.rotate.row'] }).click();
    await tick();
    await screen.getByRole('button', { name: ru['profile.rotate.cta'] }).click();
    await waitFor(() => expect(screen.getByText(/token belongs to another record/)).toBeTruthy());
    // Identity + vault unchanged (written only after 2xx).
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
    expect(JSON.parse(localStorage.getItem('bleak.tokenVault') ?? '[]')[0]).toMatchObject({ token: TOKEN });
  });
});

describe('leave room (AC 7, moved from /profile)', () => {
  it('asks the confirmation question BEFORE any DELETE', async () => {
    renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    // The question is asked before any DELETE — the dialog shows the body.
    expect(screen.getByText(ru['profile.leave.confirm_body'])).toBeTruthy();
    expect(mockedApi.deleteRoomUser).not.toHaveBeenCalled();
  });

  it('confirms, DELETEs, clears identity AND the one-time mutual code, and navigates to /', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mutualCode.set({ userAddress: ME, code: 'LIVE' });
    renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(mockedApi.deleteRoomUser).toHaveBeenCalledWith(ROOM, ME));
    await waitFor(() => expect(get(identity)).toBeNull());
    await waitFor(() => expect(localStorage.getItem('bleak.mutualCode')).toBeNull());
    expect(get(mutualCode)).toBeNull();
    const { goto } = await import('$app/navigation');
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/'));
  });

  it('keeps the identity and shows the server text on failure', async () => {
    mockedApi.deleteRoomUser.mockRejectedValue(
      new ApiError(409, '/api/room/0xroom/user/0xme', 'income must exceed outcome')
    );
    renderPage();
    await screen.getByRole('button', { name: ru['profile.leave'] }).click();
    await tick();
    await screen.getAllByRole('button', { name: ru['profile.leave'] }).pop()!.click();
    await waitFor(() => expect(screen.getByText(/income must exceed outcome/)).toBeTruthy());
    expect(get(identity)).toEqual({ roomAddress: ROOM, userAddress: ME, token: TOKEN });
  });
});

/**
 * Outline-style leave (Concept §8.1.3, DESIGN §4.9.3): the exit-room action
 * renders red font + red border ONLY on the transparent surface — no filled
 * red background (the v2.1 §4.8.4 filled style is retired). tokens.css is
 * parsed as the palette source of truth, same approach as
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

describe('outline-style leave button (Concept §8.1.3, DESIGN §4.9.3)', () => {
  it('the exit button is red font + red border on a transparent background — NO filled red', () => {
    // tokens.css defines --color-danger: #c53030 (v2.1 §4.8.4 token, unchanged)
    // and the font-role companion --color-danger-text: #e05252 (architect
    // consult on the v2.2 outline style).
    expect(TOKENS_CSS).toMatch(/--color-danger:\s*#c53030\s*;/);
    expect(TOKENS_CSS).toMatch(/--color-danger-text:\s*#e05252\s*;/);
    // The standalone .leave rule (not the shared .rotate/.leave one) wires
    // the border role to --color-danger and the font role to
    // --color-danger-text, over a transparent background (no fill).
    const leaveBlocks = [...PAGE_SOURCE.matchAll(/\.leave\s*\{[^}]*\}/g)].map((m) => m[0]);
    const outline = leaveBlocks.find((block) => block.includes('var(--color-danger'));
    expect(outline, 'standalone outline-style .leave rule').toBeTruthy();
    expect(outline).toMatch(/border-color:\s*var\(--color-danger\)/);
    expect(outline).toMatch(/(?<!border-)color:\s*var\(--color-danger-text\)/);
    expect(outline).not.toMatch(/background:\s*var\(--color-danger\)/);
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
