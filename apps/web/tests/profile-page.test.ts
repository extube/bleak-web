/** /profile page tests — LEAN suite. Covers the READ-ONLY badge page
 * (Concept §10.1.4, DESIGN §4.11.4): badge render (with the live-flag
 * no-registration assert), live QR registration/rotation/failure (hash-only
 * bodies — raw never sent), persona 404, the read-only display (NO persona
 * edit affordances — all persona editing lives in /profile/settings, whose
 * editors are covered by tests/profile-settings.test.ts), the exactly-three
 * stat tiles (Concept §8.1.5), the §9.1.2 settings corner button (DESIGN
 * §4.10.2), and the v2.3 amendments (Concept §9.1.1/§9.1.4 — private-bio
 * heading + interests title margin, DESIGN §4.10.3/4.10.4). */
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

async function renderPage(): Promise<void> {
  render(Page, { props: {} });
  await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
  await tick();
  await tick();
}

describe('badge card (AC 1, 9, 11)', () => {
  it('renders name, greeting, bios, language meta, interests and stats; a live stored code re-renders WITHOUT a registration call', async () => {
    localStorage.setItem('bleak.interests', JSON.stringify(['coffee', 'books']));
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
    expect(screen.getByText('Кофе')).toBeTruthy();
    expect(screen.getByText(ru['profile.stats.handshakes_label'])).toBeTruthy();
    // the stored code is LIVE → no registration call (fresh registration is
    // covered by the next block)
    expect(mockedApi.registerMutualCode).not.toHaveBeenCalled();
    expect(screen.getByRole('img', { name: ru['profile.qr.aria'] })).toBeTruthy();
  });
});

describe('live badge QR (AC 14)', () => {
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
      // The transient note announces the swap and auto-hides after 2 s.
      await vi.advanceTimersByTimeAsync(2000);
      await tick();
      expect(screen.queryByText(ru['profile.qr.refreshed'], { exact: false })).toBeNull();
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

describe('read-only display (Concept §10.1.4, DESIGN §4.11.4)', () => {
  it('NO persona edit affordances remain on /profile — no edit buttons, editors live in /profile/settings', async () => {
    localStorage.setItem('bleak.interests', JSON.stringify([]));
    await renderPage();
    // The badge-header persona edit button and the greeting/interests edit
    // controls are GONE from the profile page.
    expect(screen.queryByRole('button', { name: ru['profile.persona.edit'] })).toBeNull();
    expect(screen.queryByRole('button', { name: ru['profile.greeting.edit'] })).toBeNull();
    expect(screen.queryByRole('button', { name: ru['profile.interests.edit'] })).toBeNull();
    expect(screen.queryByRole('button', { name: ru['profile.interests.add'] })).toBeNull();
    // The persona is still displayed in full: greeting preview, bios,
    // interests title (read-only section labels, not edit affordances).
    expect(screen.getByText('Привет! Я про трамваи.')).toBeTruthy();
    expect(screen.getByText('Поттер из Питера')).toBeTruthy();
    expect(screen.getByText(ru['profile.interests.title'])).toBeTruthy();
    // The persona records the page renders NO editing api calls.
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

describe('persona 404 (AC 8)', () => {
  it('renders the not-found card and the exit clears identity', async () => {
    localStorage.setItem('bleak.mutualCode', JSON.stringify({ userAddress: ME, code: 'LIVE' }));
    mockedApi.getRoomUser.mockRejectedValue(new ApiError(404, '/api/room/0xroom/user/0xme', 'user not found'));
    await renderPage();
    expect(screen.getByText(ru['profile.not_found'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['profile.exit'] }).click();
    await waitFor(() => expect(get(identity)).toBeNull());
  });
});

describe('profile stats — exactly three (Concept §8.1.5, DESIGN §4.9.5)', () => {
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
    // The title row is present on the badge, directly followed by the chips.
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

describe('settings relocation (Concept §8.1.3, DESIGN §4.9.3)', () => {
  it('the leave/rotate rows are GONE from /profile; a settings nav link renders instead (RU + EN)', async () => {
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    await renderPage();
    // No settings rows remain on the profile page itself.
    expect(screen.queryByRole('button', { name: ru['profile.rotate.row'] })).toBeNull();
    expect(screen.queryByRole('button', { name: ru['profile.leave'] })).toBeNull();
    expect(screen.queryByText(ru['common.locale'])).toBeNull();
    // The affordance is a real link to the new sub-page (§2.6).
    const link = screen.getByRole('link', { name: ru['profile.settings.title'] }) as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('/profile/settings');
    // EN parity: the same link re-renders through the locale store.
    setLocale('en');
    await tick();
    await tick();
    expect(screen.getByRole('link', { name: en['profile.settings.title'] })).toBeTruthy();
    setLocale('ru');
    await tick();
  });
});

describe('settings corner button (Concept §9.1.2, DESIGN §4.10.2)', () => {
  it('a settings link sits in the page header top-right corner; the body-level row is absorbed', async () => {
    const { container } = render(Page, { props: {} });
    await waitFor(() => expect(mockedApi.getRoomUser).toHaveBeenCalled());
    await tick();
    await tick();

    // The entry lives at the header level, above the content column.
    const corner = container.querySelector('.header .settings-corner') as HTMLAnchorElement | null;
    expect(corner).toBeTruthy();
    expect(corner?.getAttribute('href')).toBe('/profile/settings');
    expect(corner?.textContent).toContain(ru['profile.settings.title']);
    // The body-level settings row from the relocation task is absorbed —
    // exactly ONE settings entry point (no duplicate route/affordance).
    expect(container.querySelector('.settings-row')).toBeNull();
  });

  it('EN parity: the corner label follows the locale', async () => {
    await renderPage();
    const { setLocale } = await import('../src/lib/i18n/locale');
    const { en } = await import('../src/lib/i18n/en');
    setLocale('en');
    await tick();
    await tick();
    const corner = document.querySelector('.settings-corner') as HTMLAnchorElement | null;
    expect(corner?.textContent).toContain(en['profile.settings.title']);
    setLocale('ru');
    await tick();
  });

  it('the corner button is styled like the other icon buttons — rounded square, tokens only', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/+page.svelte'),
      'utf8'
    );
    const block = source.match(/\.settings-corner\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(block).toContain('border-radius: var(--radius-md)');
    expect(block).not.toMatch(/#[0-9a-fA-F]{3,8}\b/); // tokens only, no raw hex
    // Header-level flex placement (top-right, above the content column).
    const header = source.match(/\.header\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(header).toContain('justify-content: space-between');
  });
});

describe('phone full-screen form (Concept §12, DESIGN §4.12.1 item 5)', () => {
  /**
   * v2.6: at phone widths (<720px) the /profile badge card becomes the
   * page — full width/height, no rounded floating chrome, no pixel-corner
   * clip. happy-dom evaluates no media queries, so the contract is the
   * repo's established source-read pattern. Growth reason: new phone
   * breakpoint behavior. The overrides live ONLY inside the
   * `max-width: 719px` query — desktop (min-width: 720px) is untouched.
   */
  const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
    ? process.cwd()
    : join(process.cwd(), 'apps', 'web');

  it('the badge card becomes the page at phone widths — full-bleed, no floating chrome', () => {
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
    // The badge card loses the floating chrome and fills the viewport
    // height; its --space-5 padding stays the content gutter.
    expect(phone).toMatch(/\.badge\s*\{[^}]*border-radius:\s*0/);
    expect(phone).toMatch(/\.badge\s*\{[^}]*clip-path:\s*none/);
    expect(phone).toMatch(/\.badge\s*\{[^}]*flex:\s*1/);
    // Tokens only (sweep discipline).
    expect(phone).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('desktop is untouched: the overrides exist only inside the phone query', () => {
    const source = readFileSync(
      join(WEB_ROOT, 'src/routes/profile/+page.svelte'),
      'utf8'
    );
    // The desktop block is intact.
    expect(source).toMatch(/@media \(min-width:\s*720px\)/);
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
