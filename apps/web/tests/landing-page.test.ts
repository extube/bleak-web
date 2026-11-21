/** Landing page tests (tz12-02, Concept §31): the NEW `/` — the public
 * showcase with pixel mascots (BleakMascot reuse, no background plate per
 * §23.1), the "effective networking with AI agents" positioning, a
 * labelled navigation, the Start button opening /income (the 6-digit
 * entry), the three-step tutorial (search → chatting → contacts
 * sharing), RU/EN parity through the FormShell-style header switcher,
 * and the join deep-link forwarding (?code= / ?u= → /income, the query
 * preserved). The re-homed routes resolve to the EXISTING surfaces:
 * /income renders the join entry and /income/[room]/create renders the
 * creation wizard (the seeded JoinFlow persona step). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import { tick } from 'svelte';

const { mockPage } = vi.hoisted(() => ({
  mockPage: {
    params: {} as Record<string, string | undefined>,
    url: new URL('http://localhost/')
  }
}));
vi.mock('$app/state', () => ({ page: mockPage }));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
  resolve: (route: string, params?: { room?: string }) =>
    params?.room ? route.replace('[room]', params.room) : route
}));

// The create-route page mounts the real JoinFlow — its mount-time
// dependencies are stubbed the same way join-flow.test.ts stubs them.
vi.mock('#lib/api/invite-resolve', () => ({ resolveInviteCode: vi.fn() }));
vi.mock('#lib/crypto/secrets', () => ({ generateTokenSecret: vi.fn(() => 'generated-raw-token') }));
vi.mock('#lib/api/client', () => ({
  api: {
    getRoom: vi.fn(),
    listRoomUsers: vi.fn(),
    getRoomUser: vi.fn(),
    createRoomUser: vi.fn(),
    addUserInterests: vi.fn()
  }
}));

import { goto } from '$app/navigation';
import { setLocale } from '#lib/i18n/locale';
import LandingPage from '../src/routes/+page.svelte';
import IncomePage from '../src/routes/income/+page.svelte';
import CreatePage from '../src/routes/income/[room]/create/+page.svelte';
import { ru } from '../src/lib/i18n/ru';
import { en } from '../src/lib/i18n/en';
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

beforeEach(() => {
  mockPage.url = new URL('http://localhost/');
  mockPage.params = {};
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  setLocale('ru');
  localStorage.clear();
});

describe('/ — the landing page (tz12-02, Concept §31)', () => {
  it('renders the pixel mascots: the hero figure with its name + one per tutorial step (no background plate)', async () => {
    const { container } = render(LandingPage, { props: {} });
    const mascots = container.querySelectorAll('.mascot svg');
    expect(mascots.length).toBeGreaterThanOrEqual(4); // hero + 3 tutorial steps
    // §23.1 item 1: NO background plate — the mascot wrapper carries no
    // box (the svg fills it; the hero figure is a named image).
    const hero = screen.getByRole('img', { name: ru['landing.mascot.aria'] });
    expect(hero.getAttribute('viewBox')).toBe('0 0 12 12');
    expect(container.querySelector('.mascot')?.className).not.toMatch(/plate|box|frame/);
    // Every wrapper is a transparent inline box (no fill of its own).
    for (const wrapper of container.querySelectorAll('.mascot')) {
      expect(getComputedStyle(wrapper as HTMLElement).backgroundColor).toBe('');
    }
  });

  it('says the words about the project: the positioning is EFFECTIVE NETWORKING WITH AI AGENTS', async () => {
    render(LandingPage, { props: {} });
    expect(
      (screen.getByRole('heading', { level: 1 }) as HTMLElement).textContent
    ).toBe(ru['landing.hero.title']);
    expect(screen.getByText(ru['landing.hero.text'])).toBeTruthy();
  });

  it('carries the navigation: a labelled nav with the section anchors + the public host console', async () => {
    render(LandingPage, { props: {} });
    const nav = screen.getByRole('navigation', { name: ru['landing.nav.aria'] });
    expect(nav).toBeTruthy();
    const links = [...nav.querySelectorAll('a')];
    expect(links).toHaveLength(3);
    expect(links.map((a) => a.textContent)).toEqual([
      ru['landing.nav.about'],
      ru['landing.nav.how'],
      ru['landing.nav.host']
    ]);
    // The host console is a real route link; the anchors hit the sections.
    expect(links[2]?.getAttribute('href')).toBe('/host');
    expect(screen.getByRole('heading', { name: ru['landing.nav.how'] })).toBeTruthy();
  });

  it('the Start button navigates to /income — the 6-digit entry page', async () => {
    render(LandingPage, { props: {} });
    const start = screen.getByRole('button', { name: ru['landing.start'] });
    await start.click();
    await tick();
    expect(goto).toHaveBeenCalledWith('/income');
    // The hint names what opens next (the 6-digit invite input).
    expect(screen.getByText(ru['landing.start.hint'])).toBeTruthy();
  });

  it('the tutorial section: how it works — search → chatting → contacts sharing (three steps, in order)', async () => {
    const { container } = render(LandingPage, { props: {} });
    expect(
      screen.getByRole('heading', { level: 2, name: ru['landing.how.title'] })
    ).toBeTruthy();
    const steps = [...container.querySelectorAll('ol.steps > li')];
    expect(steps).toHaveLength(3);
    const titles = steps.map((li) => li.querySelector('h3')?.textContent);
    expect(titles).toEqual([
      ru['landing.how.step1.title'],
      ru['landing.how.step2.title'],
      ru['landing.how.step3.title']
    ]);
    // Each step explains itself (the body copy is present, not just titles).
    for (const key of ['landing.how.step1.text', 'landing.how.step2.text', 'landing.how.step3.text'] as const) {
      expect(screen.getByText(ru[key])).toBeTruthy();
    }
  });

  it('mobile-first: the landing is a single centered column capped at the shared form-shell width (source pins)', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.landing\s*\{[^}]*max-width:\s*var\(--form-shell-max-width\)|\.landing\s*\{[^}]*max-width:\s*480px/);
    expect(css).toMatch(/\.landing\s*\{[^}]*flex-direction:\s*column/);
    // No new palette: tokens only (sweep discipline re-pinned here).
    expect(css).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // The FormShell-style header switcher: the 40px locale row next to
    // the 40px app icon (the §30 sizing).
    expect(css).toMatch(/\.locale\s*\{[^}]*height:\s*40px/);
    expect(css).toMatch(/width="40"/);
  });

  it('RU/EN parity: the header switcher re-renders every landing string (the shared locale store)', async () => {
    render(LandingPage, { props: {} });
    expect(
      (screen.getByRole('heading', { level: 1 }) as HTMLElement).textContent
    ).toBe(ru['landing.hero.title']);
    setLocale('en');
    await tick();
    expect(
      (screen.getByRole('heading', { level: 1 }) as HTMLElement).textContent
    ).toBe(en['landing.hero.title']);
    expect(screen.getByText(en['landing.hero.text'])).toBeTruthy();
    const nav = screen.getByRole('navigation', { name: en['landing.nav.aria'] });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((a) => a.textContent)).toEqual([
      en['landing.nav.about'],
      en['landing.nav.how'],
      en['landing.nav.host']
    ]);
    expect(screen.getByRole('button', { name: en['landing.start'] })).toBeTruthy();
    expect(screen.getByText(en['landing.start.hint'])).toBeTruthy();
    expect(
      screen.getByRole('heading', { level: 2, name: en['landing.how.title'] })
    ).toBeTruthy();
    expect(screen.getByText(en['landing.how.step1.text'])).toBeTruthy();
    expect(screen.getByText(en['landing.how.step2.text'])).toBeTruthy();
    expect(screen.getByText(en['landing.how.step3.text'])).toBeTruthy();
  });
});

describe('/ — deep links forward to the entry page (tz12-02)', () => {
  it('a persona QR / invite link landing on / (?u=…) is forwarded to /income with the query preserved', async () => {
    mockPage.url = new URL('http://localhost/?u=0xfriend&m=LIVECODE');
    render(LandingPage, { props: {} });
    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/income?u=0xfriend&m=LIVECODE', {
        replaceState: true
      })
    );
  });

  it('an invite ?code= link is forwarded the same way', async () => {
    mockPage.url = new URL('http://localhost/?code=123456');
    render(LandingPage, { props: {} });
    await waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/income?code=123456', { replaceState: true })
    );
  });

  it('no join params on the URL — the landing stays put (no navigation)', async () => {
    render(LandingPage, { props: {} });
    await tick();
    await tick();
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('/income — the room-income entry page (the re-homed join flow)', () => {
  it('resolves to the EXISTING join surface: the 6-digit DigitInput card renders (no identity)', async () => {
    render(IncomePage, { props: {} });
    expect(await screen.findByRole('group', { name: ru['join.code.label'] })).toBeTruthy();
    expect(screen.getByRole('button', { name: ru['join.enter'] })).toBeTruthy();
    // Pre-room: the resume card is not shown without an identity.
    expect(screen.queryByText(ru['join.resume.another'])).toBeNull();
  });
});

describe('/income/[room]/create — the creation process (the re-homed wizard flow)', () => {
  it('resolves to the EXISTING creation surface: the seeded flow opens IN the wizard step', async () => {
    mockPage.params = { room: '0xroom123' };
    mockPage.url = new URL('http://localhost/income/0xroom123/create?code=654321');
    render(CreatePage, { props: {} });
    expect(await screen.findByText(ru['join.wizard.intro.title'])).toBeTruthy();
    expect(await screen.findByText(ru['join.wizard.intro.line'])).toBeTruthy();
    await screen.getByRole('button', { name: ru['join.wizard.intro.start'] }).click();
    await screen.findByText(ru['join.wizard.name.question']);
    // The entry surfaces are not here: the wizard route is the creation.
    expect(screen.queryByRole('group', { name: ru['join.code.label'] })).toBeNull();
  });

  it('without a valid ?code= the route falls back to the entry page (replaceState)', async () => {
    mockPage.params = { room: '0xroom123' };
    mockPage.url = new URL('http://localhost/income/0xroom123/create');
    render(CreatePage, { props: {} });
    await waitFor(() => expect(goto).toHaveBeenCalledWith('/income', { replaceState: true }));
  });
});

describe('layout: the pre-room routes carry no tab bar (tz12-02)', () => {
  it('the isJoin check covers the landing AND the re-homed /income routes', () => {
    const layout = source('src/routes/+layout.svelte');
    expect(layout).toMatch(/pathname === '\/'/);
    expect(layout).toMatch(/pathname\.startsWith\('\/income'\)/);
  });
});
