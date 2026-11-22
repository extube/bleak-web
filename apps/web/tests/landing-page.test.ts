/** Landing page tests (tz12-12, Concept §40 owner batch, DESIGN §4.28
 * amending §4.27 item by item — building on the §4.26/§4.27 rounds):
 * §4.28 adds the v3.22 font ladder (titles/descriptions/captions/
 * badges-pills, the negatives §4.28.E) + the §40 phone widths
 * (.landing/.top share max(90%, 280px), the dropped inline padding,
 * desktop 80/90 unchanged). Earlier rounds' contracts below: (1) §4.26.A
 * the DETACHED floating glass header: the owner's
 * EXACT §38.1 values verbatim — position: fixed; top: 24px, left/right 0 +
 * margin-inline auto, width max(90%, 280px) (§4.28.F shared floor)
 * max-width 1200px, border-radius
 * var(--radius-md) (20px) at every width, background rgba(18, 15, 28, 0.35),
 * backdrop-filter blur(18px) saturate(180%) (both prefixes), the FULL 1px
 * rgba(255, 255, 255, 0.2) border + the inset white highlight, the
 * no-backdrop fallback rgba(18, 15, 28, 0.85); the nav is FOUR smooth-
 * scroll anchors (HOW IT WORKS → #how-it-works, PRIVACY → #privacy,
 * USE CASES → #use-cases, JOIN → #join; the #tutorial/#agents links are
 * gone, #agents stays as an id with no nav link), scroll-margin-top
 * 100px + CSS smooth scroll under prefers-reduced-motion: no-preference;
 * (2) §4.26.B the banner glass + [ LIVE NETWORK // IRL ] sub-badge + the
 * pulsing status dot; (3) §4.26.C the step cards glass + hover glow/lift
 * + mini-illustrations + micro-pills; (4) §4.26.D the footer glass pill;
 * (5) §4.26.E–I the FOUR new sections (sim / privacy / use-cases / join)
 * with the shared glass recipe + the mailto GET EARLY ACCESS stub;
 * (6) §4.26.J the §37 open-state rule STAYS: first viewport = lead +
 * BLEAK only. Still in force: the fixed video layer stack, the
 * keep-list, BLEAK/БЛИК, routes, Start/TALK → /income (6-digit), RU/EN
 * parity (55 keys, §4.27.G), removed blocks stay removed, deep links. */
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
import { ICON_RECTS } from '../src/lib/components/icons/registry';
import { LANDING_FIGURES } from '../src/lib/components/landing/figures';
import { BLEAK_FIGURE } from '../src/lib/components/personage/bleakFigure';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

/** The 23 §4.20.M keys (unchanged) + the §4.26.L keys minus the 4
 * §4.27.G-removed sim chat keys + the 1 §4.27.G ring aria key — 55 total,
 * every landing string, RU/EN parity. */
const LANDING_KEYS = [
  'landing.headline.1',
  'landing.headline.2',
  'landing.headline.accent',
  'landing.sub',
  'landing.cta',
  'landing.stat.title',
  'landing.stat.line1',
  'landing.stat.line2',
  'landing.stat.line3',
  'landing.agent.name',
  'landing.agent.badge',
  'landing.agent.traits',
  'landing.agent.quote',
  'landing.agent.cta',
  'landing.tutorial.search',
  'landing.tutorial.chat',
  'landing.tutorial.share',
  'landing.steps.find.desc',
  'landing.steps.chat.desc',
  'landing.steps.share.desc',
  'landing.footer.contact.email.label',
  'landing.footer.contact.github.label',
  'landing.footer.copyright',
  // §4.26.L — the 35 keys, §4.27.G-amended
  'landing.nav.how',
  'landing.nav.privacy',
  'landing.nav.usecases',
  'landing.nav.join',
  'landing.banner.badge',
  'landing.banner.status',
  'landing.steps.find.pill',
  'landing.steps.chat.pill',
  'landing.steps.share.pill',
  'landing.sim.title',
  'landing.sim.you',
  'landing.sim.you.status',
  'landing.sim.nearby',
  'landing.sim.nearby.status',
  // §4.27.G: the ring's role="img" label (embeds the value)
  'landing.sim.compat.aria',
  'landing.sim.badge',
  'landing.privacy.title',
  'landing.privacy.ghost.title',
  'landing.privacy.ghost.desc',
  'landing.privacy.mutual.title',
  'landing.privacy.mutual.desc',
  'landing.privacy.gps.title',
  'landing.privacy.gps.desc',
  'landing.usecases.title',
  'landing.usecases.conferences',
  'landing.usecases.parties',
  'landing.usecases.coworkings',
  'landing.usecases.festivals',
  'landing.join.title',
  'landing.join.headline',
  'landing.join.input.placeholder',
  'landing.join.button'
] as const;

/** The keys the §4.21.H + §4.22.H amendments kill, plus the §4.22.1
 * chat-strip keys and the §4.23.C dialog/video keys — and the §4.27.F
 * orphaned sim chat message keys — in NEITHER dictionary. */
const DEAD_KEYS = [
  'landing.footer.line',
  'landing.footer.badge',
  'landing.tagline.left.1',
  'landing.tagline.left.2',
  'landing.tagline.top',
  'landing.tagline.right.1',
  'landing.tagline.right.2',
  'landing.hero.aria',
  'landing.chat.label',
  'landing.chat.bubble1',
  'landing.chat.bubble2',
  'landing.chat.bubble3',
  'landing.chat.bubble4',
  'landing.chat.aria',
  'landing.dialog.line1',
  'landing.dialog.line2',
  'landing.dialog.line3',
  'landing.video.aria',
  'landing.video.play',
  'landing.video.pause',
  // §4.27.C/F: the 3-message chat window's keys are retired with it
  'landing.sim.who1',
  'landing.sim.who2',
  'landing.sim.msg1',
  'landing.sim.msg2'
] as const;

const LANDING_SOURCES = [
  'src/routes/+page.svelte',
  'src/lib/components/landing/LandingVideoHero.svelte',
  'src/lib/components/landing/LandingFigure.svelte',
  'src/lib/components/landing/figures.ts',
  'src/lib/components/landing/sectionArt.ts',
  'src/lib/components/personage/bleakFigure.ts'
];

beforeEach(() => {
  mockPage.url = new URL('http://localhost/');
  mockPage.params = {};
  localStorage.clear();
});

afterEach(() => {
  cleanup();
  setLocale('ru');
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('/ — the §4.26.A detached floating glass header (icon + nav + switcher ONLY)', () => {
  it('renders exactly: the plate-less web icon (cutouts in --color-landing-bg), the FOUR smooth-scroll anchors (desktop-only) and the LocaleControl — the keep-list is UNCHANGED (§4.22.A verbatim)', () => {
    const { container } = render(LandingPage, { props: {} });
    const top = container.querySelector('header.top');
    expect(top).toBeTruthy();
    // the web icon: the §30 FormShell mark's graphic, 40px, aria-hidden
    const icon = top?.querySelector('svg.app-icon');
    expect(icon?.getAttribute('width')).toBe('40');
    expect(icon?.getAttribute('height')).toBe('40');
    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    const css = source('src/routes/+page.svelte');
    // no background plate; the cutout cells are the landing page token
    expect(css).toMatch(/\.app-icon\s*\{[^}]*flex:\s*none/);
    expect(icon?.querySelector('g[fill="var(--color-landing-bg)"]')).toBeTruthy();
    // the four smooth-scroll anchors, in the §4.26.A DOM order, with
    // existing targets (§4.26.K.3: the #tutorial/#agents links are gone)
    const nav = top?.querySelector('.top-nav');
    const links = [...(nav?.querySelectorAll('a') ?? [])];
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      '#how-it-works',
      '#privacy',
      '#use-cases',
      '#join'
    ]);
    expect(nav?.textContent).toContain(ru['landing.nav.how']);
    expect(nav?.textContent).toContain(ru['landing.nav.privacy']);
    expect(nav?.textContent).toContain(ru['landing.nav.usecases']);
    expect(nav?.textContent).toContain(ru['landing.nav.join']);
    // verbatim EN labels
    expect(en['landing.nav.how']).toBe('HOW IT WORKS');
    expect(en['landing.nav.privacy']).toBe('PRIVACY');
    expect(en['landing.nav.usecases']).toBe('USE CASES');
    expect(en['landing.nav.join']).toBe('JOIN');
    // every anchor target exists in the DOM and no dead link remains
    for (const id of ['how-it-works', 'privacy', 'use-cases', 'join']) {
      expect(container.querySelector(`#${id}`)).toBeTruthy();
    }
    expect(container.querySelector('#tutorial')).toBeNull();
    expect(links.map((a) => a.getAttribute('href'))).not.toContain('#tutorial');
    expect(links.map((a) => a.getAttribute('href'))).not.toContain('#agents');
    // #agents remains as an id (the BLEAK card section) — no nav link to it
    expect(container.querySelector('#agents')).toBeTruthy();
    // desktop-only anchors (≥720px); the switcher is always there
    expect(css).toMatch(/\.top-nav\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.top-nav\s*\{[^}]*display:\s*flex/);
    expect(top?.querySelector('.locale .segmented')).toBeTruthy();
    // no header START control (the entry points are exactly two, §4.22.A)
    expect(container.querySelector('header.top .start-pill')).toBeNull();
    expect(container.querySelector('header.top .start-link')).toBeNull();
  });

  it('the header is FIXED, DETACHED from the top edge (§4.26.A): position: fixed; top: 24px — out of the content flow (the video scrolls through the 24px gap above it and directly underneath), z-index 10, sized against the viewport: width max(90%, 280px) (§4.28.F — the SHARED floor, the same expression as .landing on phone so the edges align) + max-width 1200px + margin-inline auto with left/right 0; desktop keeps the 80% content / 90% header split (§4.26.O.5, the floor is inert ≥720px)', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.top\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.top\s*\{[^}]*top:\s*24px/);
    // NOT sticky — the sticky position retires (§4.25.D.5)
    expect(css).not.toMatch(/\.top\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.top\s*\{[^}]*z-index:\s*10/);
    // §4.28.F: the header carries the SAME max(90%, 280px) expression as
    // .landing on phone (the shared floor) + the §38 cap and centering
    expect(css).toMatch(/\.top\s*\{[^}]*width:\s*max\(90%, 280px\)/);
    expect(css).toMatch(/\.top\s*\{[^}]*max-width:\s*1200px/);
    expect(css).toMatch(/\.top\s*\{[^}]*margin-inline:\s*auto/);
    expect(css).toMatch(/\.top\s*\{[^}]*left:\s*0/);
    expect(css).toMatch(/\.top\s*\{[^}]*right:\s*0/);
    // the §4.26.O.5 header width expression is SUPERSEDED (§4.28.G.9)...
    const topRule = css.match(/\.top\s*\{[^}]*\}/)?.[0] ?? '';
    expect(topRule).not.toMatch(/width:\s*90%/);
    expect(topRule).not.toMatch(/max\(80%, 280px\)/);
    // ...while the CONTENT container carries the shared phone width
    // (§4.28.F) and restores the §4.24.A 80% at ≥720px
    expect(css).toMatch(/\.landing\s*\{[^}]*width:\s*max\(90%, 280px\)/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.landing\s*\{[^}]*width:\s*max\(80%, 280px\)/
    );
    // no vw units anywhere in the header geometry
    expect(topRule).not.toMatch(/vw/);
    // desktop row height + padding (§4.23.B) — unchanged inner chrome
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.top\s*\{[^}]*min-height:\s*56px[^}]*padding:\s*10px 16px/);
    expect(css).toMatch(/\.top\s*\{[^}]*min-height:\s*52px[^}]*padding:\s*8px 10px/);
    // §4.26.A anchor plumbing: every target clears the detached header
    expect(css).toMatch(/scroll-margin-top:\s*100px/);
    // smooth scroll via CSS, scoped under no-preference (the default auto
    // IS the reduced-motion fallback)
    expect(css).toMatch(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{[\s\S]*?scroll-behavior:\s*smooth/
    );
    // the header is OUT of the flow — .landing's first in-flow child is
    // main.canvas (§4.25.G AC 9)
    const page = source('src/routes/+page.svelte');
    const headerIdx = page.indexOf('<header class="top">');
    const mainIdx = page.indexOf('<main class="canvas">');
    expect(mainIdx).toBeGreaterThan(headerIdx);
  });

  it('the liquid-glass header (§4.26.A — the owner\'s EXACT §38.1 values, verbatim): background rgba(18, 15, 28, 0.35), backdrop-filter blur(18px) saturate(180%) (+ -webkit-), the FULL glossy 1px rgba(255, 255, 255, 0.2) border (all four sides), the inset white highlight, radius-md (20px) at every width — the §4.25.C values are superseded (§4.26.K.1); the no-backdrop-filter fallback is rgba(18, 15, 28, 0.85)', () => {
    const css = source('src/routes/+page.svelte');
    // the owner's low-opacity dark tint (the sanctioned raw-literal
    // family, §4.26.K.8 — the raw-hex guard cannot match rgba(…))
    expect(css).toMatch(/\.top\s*\{[^}]*background:\s*rgba\(18, 15, 28, 0\.35\)/);
    // the strong frosted blur — both prefixes (comment-stripped: the count
    // assertion sees the declarations only)
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/-webkit-backdrop-filter:\s*blur\(18px\) saturate\(180%\)/);
    expect(stripped).toMatch(/backdrop-filter:\s*blur\(18px\) saturate\(180%\)/);
    // exactly one blur(18px) saturate(180%) pair — the header only
    expect(stripped.match(/backdrop-filter:\s*blur\(18px\) saturate\(180%\)/g)).toHaveLength(2);
    // the glossy 1px semi-transparent WHITE border on all four sides —
    // the §4.25.C top/bottom-only rule is GONE
    expect(css).toMatch(/\.top\s*\{[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.2\)/);
    const topRule = css.match(/\.top\s*\{[^}]*\}/)?.[0] ?? '';
    expect(topRule).not.toMatch(/border-top|border-bottom/);
    // the INNER highlight — the liquid-glass edge
    expect(css).toMatch(/\.top\s*\{[^}]*box-shadow:\s*inset 0 1px 1px rgba\(255, 255, 255, 0\.35\)/);
    // the §4.25.C exact values are superseded — none of them remain
    expect(css).not.toMatch(/rgba\(20, 20, 30, 0\.25\)/);
    expect(css).not.toMatch(/rgba\(20, 20, 30, 0\.85\)/);
    expect(css).not.toMatch(/border-top:\s*1px solid rgba\(255, 255, 255, 0\.15\)/);
    expect(css).not.toMatch(/box-shadow:\s*inset 0 1px 0 rgba\(255, 255, 255, 0\.15\)/);
    // the no-backdrop-filter fallback re-pointed to the new tint
    expect(css).toMatch(
      /@supports not \(\(backdrop-filter: blur\(1px\)\) or \(-webkit-backdrop-filter: blur\(1px\)\)\)\s*\{[\s\S]{0,120}?\.top\s*\{[^}]*background:\s*rgba\(18, 15, 28, 0\.85\)/
    );
    // rounded corners — radius-md (the owner's 20px) at EVERY width; the
    // phone chip rule is DELETED (§4.26.A)
    expect(css).toMatch(/\.top\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
    expect(css).not.toMatch(/\.top\s*\{[^}]*border-radius:\s*var\(--radius-lg\)/);
    expect(css).not.toMatch(
      /@media \(max-width: 719\.98px\)\s*\{[\s\S]*?\.top\s*\{[^}]*border-radius/
    );
    // scoped: the pixel-frame surfaces keep the square/stepped corner
    // treatment (their rules set no border-radius); the glass surfaces
    // (footer + the four sections) carry the rounded family (§4.26.K.7)
    const stepBlock = css.match(/\.step-body\s*\{[^}]*\}/)?.[0] ?? '';
    expect(stepBlock, '.step-body must stay square (the pixel aesthetic)').not.toMatch(
      /border-radius/
    );
    for (const rule of ['.foot-body', '.join-card']) {
      const block = css.match(new RegExp(`${rule}\\s*\\{[\\s\\S]*?\\}\\n`))?.[0] ?? '';
      expect(block, `${rule} is a glass surface (rounded, §4.26.K.7)`).toMatch(
        /border-radius:\s*var\(--radius-md\)/
      );
    }
    // the .glass class stays retired (§4.24.F.3 / §4.26.K.8)
    expect(css).not.toMatch(/\.glass/);
    // and the pixel-frame construction is still in the markup for the
    // card surfaces (§4.25.D.2: the lead is the ONLY transparent surface)
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.agent-card')?.className).toContain('pixel-corners');
    expect(container.querySelector('.step-block')?.className).toContain('pixel-corners');
    // the lead carries none of them (§4.25.B)
    expect(container.querySelector('.copy')?.className).not.toContain('pixel-corners');
    expect(container.querySelector('.copy')?.className).not.toContain('pixel-frame');
  });

  it('the tagline lines are gone (no DOM nodes) and the GLITCH figure is retired with the strip (§4.22.1); the header carries no START control', () => {
    const { container } = render(LandingPage, { props: {} });
    for (const name of ['.tagline', '.tagline-left', '.tagline-top', '.tagline-right', '.tag-glyph']) {
      expect(container.querySelector(name)).toBeNull();
    }
    // no header START controls (§4.22.A: the entry points are exactly the
    // lead Start CTA + the card TALK)
    expect(container.querySelector('.start-pill')).toBeNull();
    expect(container.querySelector('.start-link')).toBeNull();
    const css = source('src/routes/+page.svelte');
    expect(css).not.toMatch(/start-pill|start-link/);
    // §4.22.1: the chat strip is retired — GLITCH renders nowhere on the
    // page (the tagline glyph died with the taglines; the strip followed)
    expect(container.querySelectorAll('[data-figure="glitch"]')).toHaveLength(0);
    // at 320px the header is icon + switcher — never empty, nothing clipped
    expect(container.querySelector('.top')?.textContent).not.toBe('');
  });

  it('§4.27.A the nav font bump: .top-nav a computes font-size: 14px (was 12px) — the Handjet family, weight 600, letter-spacing 0.08em, uppercase, the muted color, the deepa-4 hover over 120ms and the desktop-only ≥720px visibility are ALL unchanged; the language switcher is UNCHANGED (explicit negative — no .locale-scoped size override exists in the landing sources)', () => {
    const css = source('src/routes/+page.svelte');
    // the bump: 12px → 14px
    expect(css).toMatch(/\.top-nav a\s*\{[^}]*font-size:\s*14px/);
    expect(css).not.toMatch(/\.top-nav a\s*\{[^}]*font-size:\s*12px/);
    // everything else about the anchors is verbatim
    const navRule = css.match(/\.top-nav a\s*\{[^}]*\}/)?.[0] ?? '';
    expect(navRule).toMatch(/font-family:\s*var\(--font-pixel\)/);
    expect(navRule).toMatch(/font-weight:\s*600/);
    expect(navRule).toMatch(/letter-spacing:\s*0\.08em/);
    expect(navRule).toMatch(/text-transform:\s*uppercase/);
    expect(navRule).toMatch(/color:\s*var\(--color-text-muted\)/);
    expect(css).toMatch(/\.top-nav a:hover\s*\{[^}]*color:\s*var\(--color-deepa-4\)/);
    expect(css).toMatch(/\.top-nav a\s*\{[^}]*transition:\s*color 120ms ease-out/);
    // §4.27.A explicit negative: the switcher is NOT dragged along —
    // LocaleControl.svelte and SegmentedControl.svelte are untouched files
    // and no landing style overrides sizes inside .locale
    expect(css).not.toMatch(/\.locale[^{]*\{[^}]*font-size/);
    const localeControl = source('src/lib/components/join/LocaleControl.svelte');
    const segmented = source('src/lib/components/SegmentedControl.svelte');
    expect(segmented).toMatch(/font-size:\s*14px/); // the switcher's buttons stay 14px
    // neither file grew a size change for this batch (their 14px stands;
    // this test only reads them — the guard is the untouched-file negative)
    expect(localeControl.length).toBeGreaterThan(0);
  });

  it('the LocaleControl still switches every landing string without a reload', async () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    setLocale('en');
    await tick();
    expect(container.querySelector('.agent-name')?.textContent).toBe(en['landing.agent.name']);
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('/ — the §4.22.B video block (LandingVideoHero replaces the drawn hero)', () => {
  it('the committed app asset background-video-loop.mp4 exists and is imported via the #lib URL import (not hotlinked, not in static/) — the §4.27.1 owner amendment: the yo-yo is the FILE itself (pre-stitched forward+reverse); the superseded background-video.mp4 is GONE from the bundle', () => {
    const assetPath = 'src/lib/assets/landing/background-video-loop.mp4';
    expect(existsSync(join(WEB_ROOT, assetPath))).toBe(true);
    // a real MP4 (the ISO-BMFF ftyp box at bytes 4..8), committed at ~3 MB
    const bytes = readFileSync(join(WEB_ROOT, assetPath));
    expect(statSync(join(WEB_ROOT, assetPath)).size).toBeGreaterThan(1_000_000);
    expect(bytes.slice(4, 8).toString('ascii')).toBe('ftyp');
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(
      /import videoUrl from '#lib\/assets\/landing\/background-video-loop\.mp4';/
    );
    expect(hero).toMatch(/src=\{videoUrl\}/);
    expect(existsSync(join(WEB_ROOT, 'static/background-video-loop.mp4'))).toBe(false);
    // negative: the superseded §4.22.B clip is retired from the app assets
    expect(existsSync(join(WEB_ROOT, 'src/lib/assets/landing/background-video.mp4'))).toBe(false);
    expect(hero).not.toMatch(/#lib\/assets\/landing\/background-video\.mp4/);
  });

  it('the video is the FIXED FULL-VIEWPORT background layer (§4.23.A): position: fixed; inset: 0, z 0, width/height 100%, object-fit cover + object-position 50% 50% — it fills the whole screen at every ratio (desktop 1280×800, phone 320×640 / 390×844), crops, never letterboxes', () => {
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    // fixed + inset 0 — independent of scrolling; the page scrolls over it
    expect(css).toMatch(/\.video\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.video\s*\{[^}]*inset:\s*0/);
    expect(css).toMatch(/\.video\s*\{[^}]*z-index:\s*0/);
    // full-viewport: 100% × 100% with cover — at EVERY viewport ratio the
    // video fills the screen (a fixed layer is viewport-sized, so the same
    // declarations hold at desktop and phone; cover crops, never
    // letterboxes — no letterbox bars on any ratio)
    expect(css).toMatch(/\.video\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
    expect(css).toMatch(/\.video\s*\{[^}]*object-fit:\s*cover/);
    expect(css).toMatch(/\.video\s*\{[^}]*object-position:\s*50% 50%/);
    // the layer is the FIRST child of .landing-page (before .landing)
    const page = source('src/routes/+page.svelte');
    const pageStart = page.indexOf('<div class="landing-page">');
    const videoTag = page.indexOf('<LandingVideoHero');
    const landingTag = page.indexOf('<div class="landing">');
    expect(videoTag).toBeGreaterThan(pageStart);
    expect(videoTag).toBeLessThan(landingTag);
    // the §4.22.B aspect-ratio box is retired (§4.23.E.1) — no 16:9 block
    expect(css).not.toMatch(/aspect-ratio/);
  });

  it('content scrolls OVER the video (the layer stack holds): the video (z 0) → vignette + 30% tint (z 1) → dots (z 2) → content column (z 3) → fixed header (z 10); the fixed layer never moves while .landing scrolls over it and the header never moves', () => {
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    const page = source('src/routes/+page.svelte');
    // the fixed layer children are viewport-sized and unmoving
    expect(hero).toMatch(/\.video-layer::after\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*1/);
    expect(hero).toMatch(/\.dots\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*2/);
    // the content column is the z-3 scrolling layer above the fixed layer
    expect(page).toMatch(/\.landing\s*\{[^}]*position:\s*relative[^}]*z-index:\s*3/);
    // the fixed glass header rides above everything (z 10)
    expect(page).toMatch(/\.top\s*\{[^}]*z-index:\s*10/);
    // the layer is non-interactive — content interaction is unaffected
    expect(hero).toMatch(/\.video-layer\s*\{[^}]*pointer-events:\s*none/);
    expect(hero).toMatch(/\.dots\s*\{[^}]*pointer-events:\s*none/);
  });

  it('renders the decisive §34 attribute set RESTORED verbatim (§4.27.1): muted loop playsinline preload="metadata" disablepictureinpicture aria-hidden — NO autoplay attribute, NO native controls', () => {
    const { container } = render(LandingPage, { props: {} });
    const video = container.querySelector('video.video') as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    // the properties are set on mount (the muted property is the autoplay-
    // policy load-bearing one; the rest stay attributes)
    expect(video?.muted).toBe(true);
    // §4.27.1: native looping is back — the clip is pre-stitched ping-pong
    expect(video?.loop).toBe(true);
    expect(video?.preload).toBe('metadata');
    expect(video?.getAttribute('playsinline')).not.toBeNull();
    expect(video?.getAttribute('disablepictureinpicture')).not.toBeNull();
    expect(video?.getAttribute('aria-hidden')).toBe('true');
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.hasAttribute('controls')).toBe(false);
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(
      /loop\s*\n\s*muted\s*\n\s*playsinline\s*\n\s*preload="metadata"\s*\n\s*disablepictureinpicture\s*\n\s*aria-hidden="true"/
    );
    // comment-stripped: the `loop` token is PRESENT (native playback);
    // no autoplay attribute, no native controls attribute
    const stripped = hero.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/\bloop\b/);
    expect(stripped).not.toMatch(/\bautoplay\b/);
    expect(stripped).not.toMatch(/\bcontrols\b/);
  });

  it('autoplay is GATED: the one-shot mount effect checks prefers-reduced-motion — under reduce the video stays paused at frame 0 and the tint + vignette + dots ARE the static state (§4.23.G); there is no opt-in control', async () => {
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(
      /prefers-reduced-motion:\s*reduce/);
    expect(hero).toMatch(/\.play\(\)/);
    // behavior: under reduced motion the video is not started (no .play()
    // call) — and there is NO control to reveal (§4.23.E.5)
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })));
    const { container } = render(LandingPage, { props: {} });
    await tick();
    const video = container.querySelector('video.video') as HTMLVideoElement;
    expect(video.paused).toBe(true);
    expect(container.querySelector('button.play')).toBeNull();
  });

  it('the play control is RETIRED (§4.23.E.5): no play/pause button, no .play styles, no playback-state wiring — the video is aria-hidden ambient background scenery, not a content surface', () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('button.play')).toBeNull();
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    const stripped = hero.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/toggle|onplay|onpause|onended/);
    expect(stripped).not.toMatch(/\.play\s*\{/);
    expect(stripped).not.toMatch(/play-hidden/);
    expect(stripped).not.toMatch(/aria-label=\{playing/);
  });

  it('failure degradation (§4.23.G): on the video error event the element hides — the fixed layer degrades to the static near-black treatment (the landing-bg token + the vignette wash + the dots; no glyph, no blank screen, no layout shift), the content column unaffected', async () => {
    const { container } = render(LandingPage, { props: {} });
    await tick();
    const layer = container.querySelector('.video-layer');
    expect(layer).toBeTruthy();
    // the page token paints behind the layer (the seamless fallback tint)
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(css).toMatch(/\.video-failed\s*\{[^}]*display:\s*none/);
    // fire the error event — the element hides, the layer keeps running
    const video = container.querySelector('video.video') as HTMLVideoElement;
    video.dispatchEvent(new Event('error'));
    await tick();
    expect(video.className).toContain('video-failed');
    expect(layer?.querySelectorAll('.dot')).toHaveLength(12);
    // no poster attribute anywhere (the tint IS the pre/fallback state)
    expect(css).not.toMatch(/poster=/);
  });

  it('the animated purple pixels are kept verbatim (§4.23.A layer 3): 12 pixel dots, three alpha shades, steps(2) twinkle with staggered delays — ambient over the FULL viewport, below the content', () => {
    const { container } = render(LandingPage, { props: {} });
    const layer = container.querySelector('.video-layer');
    const dots = [...(layer?.querySelectorAll('.dot') ?? [])];
    expect(dots).toHaveLength(12);
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(css).toMatch(/dot-twinkle 1\.6s steps\(2\) infinite/);
    expect(css).toMatch(/SHADE_ALPHA = \[18, 35, 60\]/);
    expect(css).toMatch(/var\(--color-deepa-4\) \$\{SHADE_ALPHA\[shade\]\}%, transparent/);
    const delays = dots.map((d) => parseFloat((d.getAttribute('style') ?? '').match(/--d:\s*([\d.]+)s/)?.[1] ?? '-1'));
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(1.2);
    // reduced motion: the twinkle collapses (static dots)
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\}/)?.[0] ?? '';
    expect(reduced).toMatch(/\.dot\s*\{[^}]*animation:\s*none/);
  });

  it('the dissolve (§4.23.A layer 2, re-specced for the fixed full-screen layer): the radial vignette outer stop is --color-landing-bg and the element carries the uniform 30% legibility wash — no hard edge where the video meets the page at any viewport ratio', () => {
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(css).toMatch(
      /radial-gradient\(\s*ellipse 120% 105% at 50% 50%,\s*transparent 0 55%,\s*color-mix\(in srgb, var\(--color-landing-bg\) 55%, transparent\) 78%,\s*var\(--color-landing-bg\) 100%/
    );
    // the global legibility tint: a base 30% wash of the page token
    expect(css).toMatch(
      /background-color:\s*color-mix\(in srgb, var\(--color-landing-bg\) 30%, transparent\)/
    );
    expect(css).toMatch(/pointer-events:\s*none/);
  });
});

describe('/ — §4.27.1 the native-loop swap (the §39.4 owner decision, Option A)', () => {
  it('the JS seek-stepper is RETIRED: no videoPingPong module file, no stepTime/PlayDirection imports, no rAF/direction/currentTime wiring anywhere in the landing sources — the pre-stitched clip + native `loop` IS the ping-pong', () => {
    // the module file is deleted
    expect(existsSync(join(WEB_ROOT, 'src/lib/components/landing/videoPingPong.ts'))).toBe(false);
    // no reference survives in any landing source (comment-stripped: the
    // amendment record may name the retired seam in prose)
    for (const file of LANDING_SOURCES) {
      const stripped = source(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(stripped, `${file} still references the retired stepper seam`).not.toMatch(
        /videoPingPong|stepTime|PlayDirection/
      );
    }
    // the hero carries none of the stepper wiring (the compat-ring tally's
    // own rAF in +page.svelte is the unrelated §4.27.D count-up)
    const heroStripped = source(
      'src/lib/components/landing/LandingVideoHero.svelte'
    )
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\/\/.*$/gm, '');
    expect(heroStripped).not.toMatch(
      /requestAnimationFrame|cancelAnimationFrame|currentTime\s*=|\.pause\(\)|loadedmetadata/
    );
  });

  it('the gated one-shot .play() is the WHOLE playback wiring: the mount effect keeps the prefers-reduced-motion early return before the play call, the rejection is swallowed, and the error fallback + black bg + dissolve + dot mesh are UNCHANGED', () => {
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    // the reduced-motion gate precedes the one-shot .play()
    const effect = hero.match(/\$effect\(\(\) => \{[\s\S]*?\n {2}\}\);/)?.[0] ?? '';
    expect(effect).toMatch(/prefers-reduced-motion: reduce\)'\)\.matches\) return;/);
    expect(effect).toMatch(/\.play\(\)/);
    expect(effect.indexOf('.play()')).toBeGreaterThan(
      effect.indexOf('prefers-reduced-motion')
    );
    // the rejection is swallowed — no control to reveal (§4.23.I flag 1)
    expect(effect).toMatch(/\.catch\(\(\) =>/);
    // the §4.23.G fallback treatment stands verbatim
    expect(hero).toMatch(/\.video-failed\s*\{[^}]*display:\s*none/);
    expect(hero).toMatch(/onerror=\{\(\) => \{\s*failed = true;?\s*\}\}/);
    expect(hero).toMatch(
      /radial-gradient\(\s*ellipse 120% 105% at 50% 50%,\s*transparent 0 55%,\s*color-mix\(in srgb, var\(--color-landing-bg\) 55%, transparent\) 78%,\s*var\(--color-landing-bg\) 100%/
    );
    expect(hero).toMatch(/dot-twinkle 1\.6s steps\(2\) infinite/);
  });
});

describe('/ — the §4.25.A open state (§37.1): the hero regions + the thirds row', () => {
  it('§37.1 the DEFAULT OPEN STATE — at the scroll origin the first viewport contains ONLY the lead block and the BLEAK agent card (plus the fixed header chrome): the hero region (.stage) is the FIRST block of main.canvas, the stat card / step blocks / contact footer flow AFTER it — below the fold initially, revealed on scroll', () => {
    const { container } = render(LandingPage, { props: {} });
    const canvas = container.querySelector('main.canvas');
    // the hero region is the FIRST block; its ONLY children are the lead
    // and the agent card (the middle third is empty)
    const hero = canvas?.firstElementChild;
    expect(hero?.classList.contains('stage')).toBe(true);
    const heroClasses = [...(hero?.children ?? [])].map((el) => el.className);
    expect(heroClasses.some((c) => c.includes('area-lead'))).toBe(true);
    expect(heroClasses.some((c) => c.includes('area-agents'))).toBe(true);
    expect(heroClasses.some((c) => c.includes('area-stat'))).toBe(false);
    expect(heroClasses.some((c) => c.includes('area-tutorial'))).toBe(false);
    expect(heroClasses.some((c) => c.includes('area-foot'))).toBe(false);
    // everything else renders after the hero region — the banner, the
    // three step blocks, the FOUR new sections and the contact footer
    // (below the fold; the §4.26.E DOM order sim → privacy → use-cases
    // → join after the steps, before the footer)
    const afterHero = canvas?.textContent ?? '';
    expect(afterHero).toContain(ru['landing.stat.title']);
    expect(afterHero).toContain(ru['landing.tutorial.search']);
    expect(afterHero).toContain(ru['landing.sim.title']);
    expect(afterHero).toContain(ru['landing.privacy.title']);
    expect(afterHero).toContain(ru['landing.usecases.title']);
    expect(afterHero).toContain(ru['landing.join.title']);
    expect(afterHero).toContain(ru['landing.footer.contact.email.label']);
    expect(canvas?.querySelector('.stage ~ .area-stat')).toBeTruthy();
    expect(canvas?.querySelector('.stage ~ .area-tutorial')).toBeTruthy();
    expect(canvas?.querySelector('.stage ~ #sim')).toBeTruthy();
    expect(canvas?.querySelector('.stage ~ #privacy')).toBeTruthy();
    expect(canvas?.querySelector('.stage ~ #use-cases')).toBeTruthy();
    expect(canvas?.querySelector('.stage ~ #join')).toBeTruthy();
    expect(canvas?.querySelector('.stage ~ footer.contact')).toBeTruthy();
    // §4.26.E AC 13: the strict DOM order — steps → sim → privacy →
    // use-cases → join → footer
    const order = ['.area-tutorial', '#sim', '#privacy', '#use-cases', '#join', 'footer.contact'];
    const positions = order.map((sel) => {
      const el = canvas?.querySelector(sel);
      return [...(canvas?.children ?? [])].indexOf(el ?? canvas!);
    });
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('desktop ≥720px: .stage is the 100dvh HERO REGION — the THIRDS grid (§4.24.D) with align-content: center + align-items: center (§4.25.A supersedes §4.24.D\'s align-items: start, §4.25.D.6): lead column 1, the BLEAK agent card column 3, the MIDDLE THIRD EMPTY; the minmax(0,1fr) 360px row and the 360px cap stay retired (§4.24.F.5)', () => {
    const css = source('src/routes/+page.svelte');
    // the thirds grid: three equal columns, the §4.23.D gap rhythm
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.stage\s*\{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/
    );
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stage\s*\{[^}]*column-gap:\s*var\(--space-6\)/);
    // the hero region = the whole first viewport, everything centered
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stage\s*\{[^}]*min-height:\s*100dvh/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stage\s*\{[^}]*align-content:\s*center/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stage\s*\{[^}]*align-items:\s*center/);
    // the lead = the FIRST third, the BLEAK card = the LAST third
    expect(css).toMatch(/\.area-lead\s*\{[^}]*grid-column:\s*1/);
    expect(css).toMatch(/\.area-agents\s*\{[^}]*grid-column:\s*3/);
    // the middle third is EMPTY — no element is placed in column 2
    expect(css).not.toMatch(/grid-column:\s*2/);
    // the retired §4.23.D two-column row + cap
    expect(css).not.toMatch(/minmax\(0, 1fr\) 360px/);
    // §4.23.E.1: the video-row overlay grid stays gone
    expect(css).not.toMatch(/27% minmax|26%/);
    expect(css).not.toMatch(/\.area-video/);
    expect(css).not.toMatch(/\.area-chat/);
  });

  it('PHONE: the DOM-order stack over the video background (§4.23.E.2) — .area-lead is the 100dvh hero region (§4.25.A) — no horizontal scroll at 320px; the 280px container floor keeps the phone chip usable', () => {
    const css = source('src/routes/+page.svelte');
    // base canvas + stage = one column (flex); the DOM order IS the mobile order
    expect(css).toMatch(/\.canvas\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.stage\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    const order = [
      'area-lead', 'area-agents', 'area-stat', 'area-tutorial',
      'area-sim', 'area-privacy', 'area-usecases', 'area-join', 'area-foot'
    ];
    const positions = order.map((name) => css.indexOf(name, css.indexOf('<main')));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // the phone hero region: the START block centers in the first screen
    expect(css).toMatch(
      /@media \(max-width: 719\.98px\)\s*\{[\s\S]*?\.area-lead\s*\{[^}]*min-height:\s*100dvh[^}]*display:\s*flex[^}]*justify-content:\s*center/
    );
    // the overlay positioning exists ONLY inside the ≥720px media query —
    // the base .stage rule is the plain flex column (no grid, no overlay)
    const baseStage = css.match(/\.stage\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    expect(baseStage).toMatch(/display:\s*flex/);
    expect(baseStage).not.toMatch(/grid|position/);
    // §4.28.F the container: max(90%, 280px) on phone — the SHARED floor
    // with the header (the 1000px cap retires as a width rule)
    expect(css).toMatch(/\.landing\s*\{[^}]*width:\s*max\(90%, 280px\)/);
    expect(css).not.toMatch(/max-width:\s*1000px/);
    // the fixed video layer is viewport-sized (width 100% — no overflow
    // at 320px; the layer itself never scrolls)
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(/\.video\s*\{[^}]*width:\s*100%/);
    expect(hero).toMatch(/\.video\s*\{[^}]*position:\s*fixed/);
  });

  it('the §4.24.E two-thirds spacer is GONE (§4.25.D.1): no calc(200dvh / 3) anywhere, no padding-top on .canvas/.landing in ANY media query; .landing\'s top padding is 0 (inline + bottom padding per breakpoint unchanged) — the open state is produced entirely by the two 100dvh constructions', () => {
    const css = source('src/routes/+page.svelte');
    // comment-stripped: the spacer is GONE — dvh or vh, in any expression
    // (comments are prose — they may record the retired rule by name)
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/calc\(200dvh \/ 3\)/);
    expect(stripped).not.toMatch(/calc\(200vh \/ 3\)/);
    // no padding-top on .canvas / .landing anywhere
    const canvasRules = [...css.matchAll(/\.canvas\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(canvasRules.length).toBeGreaterThan(0);
    expect(canvasRules.every((r) => !r.includes('padding-top'))).toBe(true);
    const landingRules = [...css.matchAll(/\.landing\s*\{[^}]*\}/g)].map((m) => m[0]);
    expect(landingRules.every((r) => !r.includes('padding-top'))).toBe(true);
    // the retired top padding: 0 top; §4.28.F — the phone INLINE padding
    // is DROPPED (the blocks span edge-to-edge, aligned with the header),
    // the bottom padding stays; desktop restores the --space-7 gutters
    expect(css).toMatch(/\.landing\s*\{[^}]*padding:\s*0 0 var\(--space-5\)/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.landing\s*\{[^}]*padding:\s*0 var\(--space-7\) var\(--space-7\)/
    );
  });

  it('the lead is NARROWER (§4.24.C): it fills its thirds column (≈ 288px at 1280) — the fit-content/560px sizing retires; the desktop headline adapts via clamp(28px, 4vw, 48px) (§4.28.A — the bump forces the re-check so the lead stays dominant over the 28px .agent-name: 28.8px at 720px, capped 48px from 1200px up)', () => {
    const css = source('src/routes/+page.svelte');
    // the lead fills its grid column (100% of the third), phone full-width
    expect(css).toMatch(/\.copy\s*\{[^}]*width:\s*100%/);
    // no content-sized / capped lead sizing remains
    expect(css).not.toMatch(/fit-content/);
    const copyRule = css.match(/\.copy\s*\{[^}]*\}/)?.[0] ?? '';
    expect(copyRule).not.toMatch(/max-width/);
    // §4.28.A the headline ladder: 40px base (48px ≥480px) + the adjusted
    // clamp at ≥720px
    expect(css).toMatch(/\.headline\s*\{[^}]*font-size:\s*40px/);
    expect(css).toMatch(/@media \(min-width: 480px\)\s*\{[\s\S]*?\.headline\s*\{[^}]*font-size:\s*48px/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.headline\s*\{[^}]*font-size:\s*clamp\(28px, 4vw, 48px\)/
    );
    // the superseded §4.27.B/§4.26 values are gone everywhere (comment-
    // stripped: comments are prose and may name retired values)
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).not.toMatch(/font-size:\s*36px/);
    expect(stripped).not.toMatch(/font-size:\s*44px/);
    expect(stripped).not.toMatch(/clamp\(22px, 3\.5vw, 44px\)/);
    expect(stripped).not.toMatch(/font-size:\s*64px/);
  });

  it('the fixed video layer is a decorative aria-hidden div — NO region role, NO accessible name (§4.23.E.6); the lead is TRANSPARENT and BORDERLESS (§4.25.B — §37.2): no pixel frame, no solid panel, no border, no glass — legibility via the token-only text halo ONLY', () => {
    const { container } = render(LandingPage, { props: {} });
    const layer = container.querySelector('.video-layer');
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    // the §4.22.H named-region contract is retired: no region anywhere
    expect(screen.queryByRole('region')).toBeNull();
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).not.toMatch(/<section/);
    expect(hero).not.toMatch(/aria-label=/);
    // the lead carries NO pixel-frame classes (§4.25.D.2 — the lead is the
    // ONLY transparent surface; the card language stands elsewhere)
    const lead = container.querySelector('.copy');
    expect(lead).toBeTruthy();
    expect(lead?.className).not.toContain('pixel-corners');
    expect(lead?.className).not.toContain('pixel-frame');
    expect(lead?.querySelector('.copy-body.pixel-corners')).toBeNull();
    const css = source('src/routes/+page.svelte');
    expect(css).not.toMatch(/\.glass/);
    // .copy-body is transparent: NO background fill, NO border, NO
    // backdrop-filter, NO translucent fill, NO radius, NO shadow
    const copyBody = css.match(/\.copy-body\s*\{[^}]*\}/)?.[0] ?? '';
    expect(copyBody).toMatch(/background:\s*transparent/);
    expect(copyBody).not.toMatch(/var\(--color-surface\)/);
    expect(copyBody).not.toMatch(/backdrop-filter|color-mix|border|border-radius|box-shadow/);
    // .copy is borderless too
    const copyRule = css.match(/\.copy\s*\{[^}]*\}/)?.[0] ?? '';
    expect(copyRule).not.toMatch(/border|backdrop-filter|color-mix|border-radius|box-shadow/);
    // legibility = the TEXT halo only: .headline + .sub declare the
    // 0 1px 2px color-mix(… --color-surface 90% …) + soft-ambient tail
    expect(css).toMatch(
      /\.headline\s*\{[^}]*text-shadow:\s*\n?\s*0 1px 2px color-mix\(in srgb, var\(--color-surface\) 90%, transparent\),\s*\n?\s*0 0 14px color-mix\(in srgb, var\(--color-surface\) 55%, transparent\)/
    );
    expect(css).toMatch(
      /\.sub\s*\{[^}]*text-shadow:\s*\n?\s*0 1px 2px color-mix\(in srgb, var\(--color-surface\) 90%, transparent\),\s*\n?\s*0 0 10px color-mix\(in srgb, var\(--color-surface\) 55%, transparent\)/
    );
    // the accent word keeps its violet glow declaration (overrides the halo)
    expect(css).toMatch(
      /text-shadow:\s*\n?\s*0 0 8px color-mix\(in srgb, var\(--color-deepa-4\) 60%, transparent\),\s*\n?\s*0 0 24px/
    );
    // the Start button keeps its exact current style: an opaque violet pill
    // — unchanged markup, unchanged CSS (§4.25.G AC 8)
    expect(css).toMatch(/\.cta-main\s*\{[^}]*min-height:\s*var\(--touch-target\)/);
    expect(css).toMatch(/\.cta-main,\s*\n?\s*\.talk\s*\{[^}]*background:\s*var\(--color-deepa-4\)/);
    // the copy is §4.20.C verbatim and the CTA survives the re-skin
    expect(container.querySelector('.headline .accent-word')).toBeTruthy();
    expect(container.querySelector('.copy .cta-main')).toBeTruthy();
  });
});

describe('/ — §4.23.C the reminders are REMOVED ENTIRELY (§35 item 3, negative assertions)', () => {
  it('no reminder DOM renders anywhere on /: no .reminder node, no cycling lines, no sparkle/check glyphs, no sr-only line', () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.reminder')).toBeNull();
    expect(container.querySelector('.reminder-body')).toBeNull();
    expect(container.querySelector('.reminder-line')).toBeNull();
    expect(container.querySelector('.reminder .spark')).toBeNull();
    expect(container.querySelector('.reminder .check')).toBeNull();
    // none of the retired dialog copy renders anywhere on /
    expect(container.textContent).not.toContain('Агент здоровается');
    expect(container.textContent).not.toContain('The agent says hello');
  });

  it('the component is gone: no LandingReminder.svelte file, no LandingReminder import, no bob/line/spark/check keyframes, no --reminder-w/--reminder-h custom properties anywhere in the landing sources', () => {
    // the file is deleted
    expect(existsSync(join(WEB_ROOT, 'src/lib/components/landing/LandingReminder.svelte'))).toBe(false);
    // no import and no geometry/style leftovers in any landing source
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(stripped, `${file} still imports the reminder`).not.toMatch(/LandingReminder/);
      expect(stripped, `${file} still carries reminder geometry`).not.toMatch(
        /--reminder-w|--reminder-h|reminder-bob|reminder-line|spark-twinkle|check-glow/
      );
      expect(stripped, `${file} still carries the play-control phone rule`).not.toMatch(
        /calc\(16px \+ var\(--reminder-h\)\)/
      );
    }
  });

  it('grep-audit: the six retired keys (landing.dialog.line1/2/3 + landing.video.aria/play/pause) exist in NEITHER dictionary and in NO route or component (§4.23.F)', () => {
    expect(ru).not.toHaveProperty('landing.dialog.line1');
    expect(ru).not.toHaveProperty('landing.dialog.line2');
    expect(ru).not.toHaveProperty('landing.dialog.line3');
    expect(ru).not.toHaveProperty('landing.video.aria');
    expect(ru).not.toHaveProperty('landing.video.play');
    expect(ru).not.toHaveProperty('landing.video.pause');
    expect(en).not.toHaveProperty('landing.dialog.line1');
    expect(en).not.toHaveProperty('landing.dialog.line2');
    expect(en).not.toHaveProperty('landing.dialog.line3');
    expect(en).not.toHaveProperty('landing.video.aria');
    expect(en).not.toHaveProperty('landing.video.play');
    expect(en).not.toHaveProperty('landing.video.pause');
    // comment-stripped sources: no dialog/video key usage remains
    for (const file of LANDING_SOURCES) {
      const stripped = source(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(stripped, `${file} still uses a retired key`).not.toMatch(
        /landing\.dialog\.|landing\.video\./
      );
    }
  });

  it('§4.27.C/F grep-audit: the four orphaned sim chat keys (landing.sim.who1/who2/msg1/msg2) exist in NEITHER dictionary, in NO route, in NO component and in NO test; the retired .sim-chat/.sim-row/.sim-who/.sim-msg markup and CSS are gone from the landing sources', () => {
    for (const key of ['landing.sim.who1', 'landing.sim.who2', 'landing.sim.msg1', 'landing.sim.msg2']) {
      expect(ru).not.toHaveProperty(key);
      expect(en).not.toHaveProperty(key);
    }
    for (const file of [...LANDING_SOURCES, 'src/routes/+page.svelte']) {
      const stripped = source(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(stripped, `${file} still uses a retired sim chat key`).not.toMatch(
        /landing\.sim\.(who1|who2|msg1|msg2)/
      );
      expect(stripped, `${file} still carries the chat-window markup/CSS`).not.toMatch(
        /sim-chat|sim-row|sim-who\b|sim-msg/
      );
    }
  });
});

describe('/ — the §4.22.D BLEAK rename + the §4.22.G supersessions', () => {
  it('the agent card renders the BLEAK personage with the renamed name; the shared rect data is byte-identical to the promoted module (one source)', () => {
    const { container } = render(LandingPage, { props: {} });
    const agents = container.querySelector('#agents');
    expect(agents?.querySelector('[data-figure="bleak"]')).toBeTruthy();
    expect(agents?.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    expect(ru['landing.agent.name']).toBe('БЛИК');
    expect(en['landing.agent.name']).toBe('BLEAK');
    // RU follows the live dict's established transliteration («Блик»,
    // join.wizard.agent.name) — untouched there
    expect(ru['join.wizard.agent.name']).toBe('Блик');
    // ONE source of truth: the landing card's figure IS the shared personage
    expect(LANDING_FIGURES.bleak).toBe(BLEAK_FIGURE);
    // the §4.20.G card shape is unchanged (single TALK action)
    const actions = [...(agents?.querySelectorAll('button') ?? [])];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.textContent?.trim()).toBe(ru['landing.agent.cta']);
    expect(agents?.querySelector('.card')?.className).toContain('pixel-frame--strong');
  });

  it('grep-audit: no agent-name leftovers in the landing sources (case-insensitive)', () => {
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      expect(src, `${file} still names the old agent`).not.toMatch(/vector|вектор/i);
    }
    expect(ru['landing.agent.name']).not.toMatch(/вектор/i);
    expect(en['landing.agent.name']).not.toMatch(/vector/i);
  });

  it('§4.22.G: the still image, the drawn hero pair and the hero scene component no longer exist', () => {
    // background.jpg is retired: the asset file, its import, its usages
    expect(existsSync(join(WEB_ROOT, 'src/lib/assets/landing/background.jpg'))).toBe(false);
    for (const file of LANDING_SOURCES) {
      expect(source(file), `${file} still uses the still image`).not.toMatch(/background\.jpg/);
    }
    // NOVA + ASTRA rect data and literals are gone from figures.ts; the
    // PIP + GLITCH data is retired with the strip (§4.22.1) — the cast is
    // the two remaining figures
    const data = source('src/lib/components/landing/figures.ts');
    for (const kind of ['bleak', 'bloom']) {
      expect(data).toMatch(new RegExp(`^  ${kind}:`, 'm'));
    }
    expect(data).not.toMatch(/nova|astra/i);
    // comment-stripped: no pip/glitch entries survive (§4.22.1)
    const dataStripped = data.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(dataStripped).not.toMatch(/\bpip\b|\bglitch\b/i);
    // LandingHeroScene.svelte no longer exists
    expect(existsSync(join(WEB_ROOT, 'src/lib/components/landing/LandingHeroScene.svelte'))).toBe(false);
    // landing.hero.aria is retired with the pair; the video layer is a
    // decorative aria-hidden div (§4.23.E.6) — every §4.23.C dead key is
    // absent from both dicts
    for (const key of DEAD_KEYS) {
      expect(ru).not.toHaveProperty(key);
      expect(en).not.toHaveProperty(key);
    }
  });

  it('§4.22.1: the strip component, its timeline module and the strip keys no longer exist anywhere', () => {
    // the §4.20.F strip is retired: no component, no timeline, no imports
    expect(existsSync(join(WEB_ROOT, 'src/lib/components/landing/LandingChatStrip.svelte'))).toBe(false);
    expect(existsSync(join(WEB_ROOT, 'src/lib/components/landing/chatTimeline.ts'))).toBe(false);
    for (const file of LANDING_SOURCES) {
      // comment-stripped (the §4.22.1 record may be named in comments)
      const stripped = source(file).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(stripped, `${file} still references the chat strip`).not.toMatch(
        /LandingChatStrip|chatTimeline|buildChatTimeline|chat-bubble|chat-strip|area-chat/
      );
      expect(stripped, `${file} still uses a chat key`).not.toMatch(/landing\.chat\./);
    }
  });

  it('the landing cast: BLEAK (agent card + the sim YOUR AGENT, §4.26.F reuse), BLOOM (stat only), SCOUT (sim only), BLEAK WAVE (join only) — the new figures render, the retired ones stay gone', () => {
    const { container } = render(LandingPage, { props: {} });
    const kinds = [...container.querySelectorAll('[data-figure]')].map(
      (el) => el.getAttribute('data-figure')
    );
    for (const kind of ['bleak', 'bloom', 'scout', 'bleakWave']) {
      expect(kinds, `${kind} on the page`).toContain(kind);
    }
    for (const kind of ['byte', 'nova', 'astra', 'pip', 'glitch']) {
      expect(kinds).not.toContain(kind);
    }
    // §4.26.F: the sim reuses the BLEAK personage (the agent card + the
    // sim's YOUR AGENT = the only allowed double mount); BLOOM, SCOUT and
    // BLEAK WAVE mount exactly once, in their own regions
    expect(container.querySelectorAll('[data-figure="bleak"]')).toHaveLength(2);
    expect(container.querySelectorAll('.agent-card [data-figure="bleak"]')).toHaveLength(1);
    expect(container.querySelectorAll('.sim-card [data-figure="bleak"]')).toHaveLength(1);
    for (const kind of ['bloom', 'scout', 'bleakWave']) {
      expect(container.querySelectorAll(`[data-figure="${kind}"]`)).toHaveLength(1);
    }
    expect(container.querySelectorAll('.agent-card [data-figure="bloom"]')).toHaveLength(0);
    expect(container.querySelectorAll('.stat-card [data-figure="bleak"]')).toHaveLength(0);
  });
});

describe('/ — the §4.22.F black page background (scoped to /)', () => {
  it('the derived token --color-landing-bg is declared in tokens.css and painted full-bleed by the page wrapper', () => {
    const tokens = source('src/lib/styles/tokens.css');
    expect(tokens).toMatch(
      /--color-landing-bg:\s*color-mix\(in srgb, var\(--color-deepa-4\) 5%, var\(--color-surface\)\)/
    );
    const page = source('src/routes/+page.svelte');
    expect(page).toMatch(/\.landing-page\s*\{[^}]*min-height:\s*100dvh[^}]*background:\s*var\(--color-landing-bg\)/);
    // the §4.24.A ONE container rule, §4.28.F amendment: max(90%, 280px)
    // on phone (shared with the header), centered — every section lives
    // inside the one column (the 1000px canvas cap retires as a width
    // rule, §4.24.F.2; the ≥720px media restores max(80%, 280px))
    expect(page).toMatch(/\.landing\s*\{[^}]*width:\s*max\(90%, 280px\)[^}]*margin-inline:\s*auto/);
  });

  it('no new hex anywhere in the landing sources; the accent is the approved violet token', () => {
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(withoutComments, `${file} carries a raw hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
    const page = source('src/routes/+page.svelte');
    expect(page).toMatch(/var\(--color-deepa-4\)/);
    // §4.26.I-3: the §4.25.G negative --color-accent assertion is
    // SUPERSEDED — the GET EARLY ACCESS neon-yellow button is exactly the
    // §4.1 interactive-accent use (--color-accent bg + --color-accent-ink
    // text; §4.26.O.3)
    expect(page).toMatch(/\.cta-access\s*\{[^}]*background:\s*var\(--color-accent\)/);
    expect(page).toMatch(/\.cta-access\s*\{[^}]*color:\s*var\(--color-accent-ink\)/);
  });

  it('no new dependencies, no canvas element, no animation library', () => {
    const pkg = JSON.parse(source('package.json')) as { dependencies: Record<string, string> };
    expect(Object.keys(pkg.dependencies).sort()).toEqual([
      '@bleak/api-client',
      '@fontsource-variable/handjet',
      '@fontsource-variable/inter',
      '@fontsource/press-start-2p',
      'jsqr',
      'uqr'
    ]);
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      expect(src, `${file} must not use <canvas>`).not.toMatch(/<canvas/);
      expect(src, `${file} must not import an animation library`).not.toMatch(
        /from ['"](gsap|animejs|three|pixi\.js)['"]/
      );
    }
  });
});

describe('/ — the §4.20 unchanged zones (headline, cards, steps, footer) as reduced by §4.22.1', () => {
  it('renders the 3-line headline with the single highlighted accent word (§4.20.C verbatim)', () => {
    render(LandingPage, { props: {} });
    const h1 = screen.getByRole('heading', { level: 1 });
    const lines = [...h1.querySelectorAll('.hl-line')];
    expect(lines.map((l) => l.textContent?.trim())).toEqual([
      ru['landing.headline.1'],
      ru['landing.headline.2'],
      ru['landing.headline.accent']
    ]);
    const accent = h1.querySelector('.accent-word');
    expect(accent?.textContent?.trim()).toBe(ru['landing.headline.accent']);
    expect(h1.querySelectorAll('.sparkle')).toHaveLength(2);
    expect(source('src/routes/+page.svelte')).toMatch(
      /text-shadow:\s*\n?\s*0 0 8px color-mix\(in srgb, var\(--color-deepa-4\) 60%, transparent\),\s*\n?\s*0 0 24px/
    );
  });

  it('renders the stat card compact (§4.21.F): minimized padding, 21px title (§4.28.A), 44/48px BLOOM', () => {
    const { container } = render(LandingPage, { props: {} });
    const stat = container.querySelector('.stat-card');
    expect(stat?.querySelector('.stat-title')?.textContent).toBe(ru['landing.stat.title']);
    expect(stat?.textContent).toContain(ru['landing.stat.line1']);
    expect(stat?.textContent).toContain(ru['landing.stat.line2']);
    expect(stat?.textContent).toContain(ru['landing.stat.line3']);
    expect(stat?.querySelector('[data-figure="bloom"]')).toBeTruthy();
    expect(stat?.className).toContain('pixel-frame--strong');
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.stat-body\s*\{[^}]*padding:\s*12px 14px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stat-body\s*\{[^}]*padding:\s*16px 20px/);
    expect(css).toMatch(/\.stat-title\s*\{[^}]*font-size:\s*21px/);
    // §4.28.B: the banner's mini-lines share the one description bump
    expect(css).toMatch(/\.stat-line\s*\{[^}]*font-size:\s*17px/);
    expect(css).toMatch(/\.stat-line\s*\{[^}]*line-height:\s*1\.35/);
    expect(css).toMatch(/margin:\s*0 0 2px/);
    expect(css).toMatch(/\.stat-glyph :global\(svg\)\s*\{[^}]*width:\s*44px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stat-glyph :global\(svg\)\s*\{[^}]*width:\s*48px/);
  });

  it('§4.22.1: the mascot-chat animation strip is retired — no strip DOM, no typewriter keyframes anywhere on the page', () => {
    const { container } = render(LandingPage, { props: {} });
    for (const name of ['.chat-strip', '.chat-bubble', '.chat-mascot', '.area-chat']) {
      expect(container.querySelector(name)).toBeNull();
    }
    expect(container.querySelectorAll('[data-figure="pip"]')).toHaveLength(0);
    expect(container.querySelectorAll('[data-figure="glitch"]')).toHaveLength(0);
    expect(document.head.innerHTML).not.toContain('@keyframes lp-pop-0');
    expect(document.head.innerHTML).not.toContain('@keyframes lp-type-3');
    // the stage's phone DOM order shrank accordingly (no chat slot)
    const css = source('src/routes/+page.svelte');
    expect(css).not.toMatch(/chatBubbles|LandingChatStrip|chatTimeline/);
  });

  it('reduced motion: the video hero collapses its twinkle (the strip reduced-motion fallback is retired with it)', () => {
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(/@media \(prefers-reduced-motion/);
  });

  it('three separate step blocks, each with the pixel step number, the pixel-font title, the step icon and a mini description (§4.21.E intact; the section id is now how-it-works, §4.26.K.3)', () => {
    const { container } = render(LandingPage, { props: {} });
    const blocks = [...container.querySelectorAll('#how-it-works .step-block')];
    expect(blocks).toHaveLength(3);
    expect(blocks.map((b) => b.querySelector('.step-num')?.textContent)).toEqual([
      '01', '02', '03'
    ]);
    expect(blocks.map((b) => b.querySelector('.step-title')?.textContent)).toEqual([
      ru['landing.tutorial.search'],
      ru['landing.tutorial.chat'],
      ru['landing.tutorial.share']
    ]);
    expect(blocks.map((b) => b.querySelector('.step-icon svg')?.getAttribute('viewBox'))).toEqual([
      '0 0 16 16', '0 0 16 16', '0 0 16 16'
    ]);
    expect(blocks.every((b) => b.querySelector('.step-icon svg')?.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(ICON_RECTS['contact-share'].length).toBeGreaterThan(0);
    expect(blocks.map((b) => b.querySelector('.step-desc')?.textContent)).toEqual([
      ru['landing.steps.find.desc'],
      ru['landing.steps.chat.desc'],
      ru['landing.steps.share.desc']
    ]);
    expect(container.querySelectorAll('#how-it-works button, #how-it-works a')).toHaveLength(0);
    expect(container.querySelectorAll('#how-it-works .chevron')).toHaveLength(0);
  });

  it('steps layout: phone stacked (--space-5 gaps) / desktop equal thirds (~300px min-height) — §4.21.E intact', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.steps\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.steps\s*\{[^}]*gap:\s*var\(--space-5\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.steps\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.step-block \.step-body\s*\{[^}]*min-height:\s*300px/);
  });

  it('§4.28.B the description ladder: ONE consistent value — .step-desc, .privacy-desc, .stat-line and .agent-quote ALL compute font-size: 17px (§4.27.B\'s 15px superseded), with family/color/line-height otherwise unchanged; the lead .sub joins the description tier at 16px (18px ≥720px) and the join input stays 14px (§4.28.E.3)', () => {
    const css = source('src/routes/+page.svelte');
    // the four description classes carry the SAME bumped value
    for (const cls of ['step-desc', 'privacy-desc', 'stat-line', 'agent-quote']) {
      const rule = css.match(new RegExp(`\\.${cls}\\s*\\{[^}]*\\}`))?.[0] ?? '';
      expect(rule, `.${cls} carries the 17px bump`).toMatch(/font-size:\s*17px/);
      expect(rule, `.${cls} keeps the Inter body family`).toMatch(
        /font-family:\s*var\(--font-body\)/
      );
      expect(rule, `.${cls} lost no color declaration`).toMatch(
        /color:\s*var\(--color-(text|text-muted)\)/
      );
      expect(rule, `.${cls} did not keep the old 15px`).not.toMatch(/font-size:\s*15px/);
    }
    // existing line-heights unchanged
    expect(css).toMatch(/\.stat-line\s*\{[^}]*line-height:\s*1\.35/);
    // the lead .sub joins the ladder: 16px (18px ≥720px) — §4.27.B's
    // "stays 14px/16px" negative is superseded (§4.28.G.1)
    expect(css).toMatch(/\.sub\s*\{[^}]*font-size:\s*16px/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.sub\s*\{[^}]*font-size:\s*18px/
    );
    expect(css).not.toMatch(/\.sub\s*\{[^}]*font-size:\s*14px/);
    // the join input is a form control, not a description display — stays 14px
    const joinInput = css.match(/\.join-input\s*\{[^}]*\}/)?.[0] ?? '';
    expect(joinInput).toMatch(/font-size:\s*14px/);
    expect(joinInput).not.toMatch(/font-size:\s*17px/);
  });

  it('renders ONE site contact block: the kept copyright row + EMAIL/GITHUB links, resurfaced as the dark glass pill (§4.26.D — the pixel-frame construction retired from it)', () => {
    const { container } = render(LandingPage, { props: {} });
    const contact = container.querySelector('.contact');
    expect(contact?.tagName).toBe('FOOTER');
    // §4.26.D/§4.26.K.6: the pixel-corners/pixel-frame classes are retired
    // from the footer — it is now a glass pill
    expect(contact?.className).not.toContain('pixel-corners');
    expect(contact?.className).not.toContain('pixel-frame');
    expect(contact?.querySelector('.foot-body.pixel-corners')).toBeNull();
    expect(contact?.querySelector('.brand-name')?.textContent).toBe('bleak-web');
    expect(contact?.querySelector('.foot-year')?.textContent).toBe('· 2026');
    const links = [...(contact?.querySelectorAll('a.foot-link') ?? [])];
    expect(links).toHaveLength(2);
    const [email, github] = links;
    expect(email?.getAttribute('href')).toBe('mailto:extube@proton.me');
    expect(email?.querySelector('.link-label')?.textContent).toBe(
      ru['landing.footer.contact.email.label']
    );
    expect(email?.querySelector('.link-value')?.textContent).toBe('extube@proton.me');
    expect(github?.getAttribute('href')).toBe('https://github.com/extube');
    expect(github?.getAttribute('target')).toBe('_blank');
    expect(github?.getAttribute('rel')).toBe('noopener noreferrer');
    expect(github?.querySelector('.link-label')?.textContent).toBe(
      ru['landing.footer.contact.github.label']
    );
    expect(github?.querySelector('.link-value')?.textContent).toBe('github.com/extube');
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.link-label\s*\{[^}]*font-family:\s*var\(--font-pixel\)/);
    expect(css).toMatch(/\.link-value\s*\{[^}]*font-family:\s*var\(--font-pixel\)/);
    expect(css).toMatch(/\.link-value\s*\{[^}]*color:\s*var\(--color-text\)/);
    expect(css).toMatch(/\.contact\s*\{[^}]*max-width:\s*560px/);
    expect(css).toMatch(/\.contact\s*\{[^}]*margin:\s*0 auto/);
    expect(css).toMatch(/\.foot-body\s*\{[^}]*padding:\s*16px 20px/);
    // the §4.26.D glass pill: the owner's exact value + blur(14px) (both
    // prefixes) + the white border + the inset highlight + radius-md
    expect(css).toMatch(/\.foot-body\s*\{[^}]*background:\s*rgba\(18, 15, 28, 0\.5\)/);
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/-webkit-backdrop-filter:\s*blur\(14px\)/);
    expect(stripped).toMatch(/backdrop-filter:\s*blur\(14px\)/);
    expect(stripped.match(/backdrop-filter:\s*blur\(14px\)/g)).toHaveLength(2);
    expect(css).toMatch(/\.foot-body\s*\{[^}]*border:\s*1px solid rgba\(255, 255, 255, 0\.2\)/);
    expect(css).toMatch(/\.foot-body\s*\{[^}]*box-shadow:\s*inset 0 1px 1px rgba\(255, 255, 255, 0\.35\)/);
    expect(css).toMatch(/\.foot-body\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
  });

  it('the two §4.20.I footer blocks are ABSENT — no DOM node, no rendered copy', () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.area-ftpos')).toBeNull();
    expect(container.querySelector('.badge-block')).toBeNull();
    expect(container.querySelector('.foot-line')).toBeNull();
    expect(container.textContent).not.toContain('EVERY CONNECTION MATTERS');
    expect(container.textContent).not.toContain('КАЖДЫЙ КОНТАКТ ВАЖЕН');
    expect(container.textContent).not.toContain('START NOW');
    expect(container.textContent).not.toContain('СТАРТ СЕЙЧАС');
  });
});

describe('/ — behavior (§4.20.L; §4.22.A made the entry points exact)', () => {
  it('the Start CTA navigates to /income — the 6-digit entry page', async () => {
    const { container } = render(LandingPage, { props: {} });
    const start = container.querySelector<HTMLButtonElement>('.cta-main');
    expect(start?.textContent?.trim()).toBe(ru['landing.cta']);
    await start?.click();
    await tick();
    expect(goto).toHaveBeenCalledWith('/income');
  });

  it('the agent-card TALK action also opens /income (the chat Start flow)', async () => {
    render(LandingPage, { props: {} });
    const talk = screen.getByRole('button', { name: ru['landing.agent.cta'] });
    await talk.click();
    await tick();
    expect(goto).toHaveBeenCalledWith('/income');
  });

  it('the /income entry points are EXACTLY the lead Start CTA + the card TALK — the header carries none (§4.22.A)', () => {
    const { container } = render(LandingPage, { props: {} });
    const incomeTargets = [...container.querySelectorAll('a[href="/income"]')];
    expect(incomeTargets).toHaveLength(0);
    expect(container.querySelectorAll('.cta-main')).toHaveLength(1);
    expect(container.querySelectorAll('.talk')).toHaveLength(1);
    // the header carries no START control (its only buttons are the
    // LocaleControl's radio options)
    expect(
      container.querySelector(
        'header.top .start-pill, header.top .start-link, header.top .cta-main'
      )
    ).toBeNull();
  });

  it('the bottom tab bar is not rendered on / (the layout isJoin check covers the landing)', () => {
    const layout = source('src/routes/+layout.svelte');
    expect(layout).toMatch(/pathname === '\/'/);
    expect(layout).toMatch(/pathname\.startsWith\('\/income'\)/);
  });
});

describe('/ — RU/EN parity (the 55 §4.20.M + §4.26.L/§4.27.G keys, the working switch)', () => {
  it('every landing key exists in BOTH dictionaries, non-empty — and the dead keys exist in NEITHER', () => {
    expect(LANDING_KEYS).toHaveLength(55);
    for (const key of LANDING_KEYS) {
      expect(ru, `ru missing ${key}`).toHaveProperty(key);
      expect(en, `en missing ${key}`).toHaveProperty(key);
      expect((ru as Record<string, string>)[key]?.trim().length).toBeGreaterThan(0);
      expect((en as Record<string, string>)[key]?.trim().length).toBeGreaterThan(0);
    }
    for (const key of DEAD_KEYS) {
      expect(ru).not.toHaveProperty(key);
      expect(en).not.toHaveProperty(key);
    }
  });

  it('verbatim §4.22.H copy in both languages (the BLEAK rename)', () => {
    expect(ru['landing.agent.name']).toBe('БЛИК');
    expect(en['landing.agent.name']).toBe('BLEAK');
  });

  it('the switch re-renders EVERY landing string (headline, accent word, cards, steps, footer labels) without a reload', async () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.accent-word')?.textContent?.trim()).toBe(
      ru['landing.headline.accent']
    );
    expect(container.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    // flip to EN through the shared store — the same DOM re-renders
    setLocale('en');
    await tick();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain(en['landing.headline.1']);
    expect(h1.textContent).toContain(en['landing.headline.accent']);
    expect(container.querySelector('.sub')?.textContent).toBe(en['landing.sub']);
    expect(container.querySelector('.agent-name')?.textContent).toBe(en['landing.agent.name']);
    expect(container.querySelector('.stat-title')?.textContent).toBe(en['landing.stat.title']);
    const descs = [...container.querySelectorAll('.step-desc')].map((d) => d.textContent);
    expect(descs).toEqual([
      en['landing.steps.find.desc'],
      en['landing.steps.chat.desc'],
      en['landing.steps.share.desc']
    ]);
    const titles = [...container.querySelectorAll('.step-title')].map((t) => t.textContent);
    expect(titles).toEqual([
      en['landing.tutorial.search'],
      en['landing.tutorial.chat'],
      en['landing.tutorial.share']
    ]);
    const labels = [...container.querySelectorAll('.link-label')].map((l) => l.textContent);
    expect(labels).toEqual([
      en['landing.footer.contact.email.label'],
      en['landing.footer.contact.github.label']
    ]);
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('/ — deep links forward to the entry page (tz12-02, unchanged)', () => {
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

describe('/ — §4.26.B the banner: REAL PEOPLE. REAL RESULTS. becomes liquid glass', () => {
  it('the stat card body is glass IN PLACE (AC 5): rgba(20, 18, 30, 0.55) + blur(12px) (both prefixes); the pixel-corners/pixel-frame construction is KEPT; the compact padding/typography and the stat copy are unchanged', () => {
    const { container } = render(LandingPage, { props: {} });
    const stat = container.querySelector('.stat-card');
    expect(stat?.className).toContain('pixel-corners');
    expect(stat?.className).toContain('pixel-frame');
    expect(stat?.className).toContain('pixel-frame--strong');
    expect(stat?.querySelector('.stat-body.pixel-corners')).toBeTruthy();
    expect(stat?.querySelector('.stat-title')?.textContent).toBe(ru['landing.stat.title']);
    const css = source('src/routes/+page.svelte');
    const statBody = css.match(/\.stat-body\s*\{[^}]*\}/)?.[0] ?? '';
    expect(statBody).toMatch(/background:\s*rgba\(20, 18, 30, 0\.55\)/);
    expect(statBody).toMatch(/padding:\s*12px 14px/);
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/-webkit-backdrop-filter:\s*blur\(12px\)/);
    expect(stripped).toMatch(/backdrop-filter:\s*blur\(12px\)/);
    // the §4.25 opaque fill is superseded — no --color-surface on .stat-body
    expect(statBody).not.toMatch(/var\(--color-surface\)/);
  });

  it('the pixel sub-badge [ LIVE NETWORK // IRL ] renders ABOVE the title (AC 6): a pixel-badge chip — the outer span\'s background IS the deepa-4 frame at 60%, an inner transparent span carries the text (Handjet 11px uppercase, letter-spacing 0.08em)', async () => {
    const { container } = render(LandingPage, { props: {} });
    const copy = container.querySelector('.stat-copy');
    const badge = copy?.querySelector('.stat-badge');
    expect(badge).toBeTruthy();
    // the badge is the FIRST .stat-copy child, above the title
    expect(copy?.firstElementChild?.className).toContain('stat-badge');
    expect(badge?.nextElementSibling?.className).toContain('stat-title');
    expect(badge?.textContent?.trim()).toBe(ru['landing.banner.badge']);
    expect(badge?.className).toContain('pixel-corners');
    expect(badge?.querySelector(':scope > span.pixel-corners')).toBeTruthy();
    const ruBadge = ru['landing.banner.badge'];
    expect(ruBadge).toBe('[ ЖИВАЯ СЕТЬ // IRL ]');
    expect(en['landing.banner.badge']).toBe('[ LIVE NETWORK // IRL ]');
    const css = source('src/routes/+page.svelte');
    const badgeCss = css.match(/\.stat-badge\s*\{[^}]*\}/)?.[0] ?? '';
    expect(badgeCss).toMatch(
      /background:\s*color-mix\(in srgb, var\(--color-deepa-4\) 60%, transparent\)/
    );
    expect(badgeCss).toMatch(/padding:\s*2px/);
    expect(badgeCss).toMatch(/margin:\s*0 0 var\(--space-2\)/);
    const inner = css.match(/\.stat-badge > span\s*\{[^}]*\}/)?.[0] ?? '';
    expect(inner).toMatch(/font-size:\s*13px/); // §4.28.D: 11→13
    expect(inner).toMatch(/letter-spacing:\s*0\.08em/);
    expect(inner).toMatch(/text-transform:\s*uppercase/);
  });

  it('the glowing status caption + pulsing green pixel dot render on the right, next to the BLOOM glyph (AC 7): a square 6px deepa-1 dot pulsing steps(2) 1.6s (opacity 1↔0.4, green glow), the caption in Handjet 11px uppercase with the green glow; reduced motion → static (the base.css catch-all); the dot is aria-hidden', () => {
    const { container } = render(LandingPage, { props: {} });
    const glyph = container.querySelector('.stat-glyph');
    expect(glyph?.querySelector('[data-figure="bloom"]')).toBeTruthy();
    const status = glyph?.querySelector('.stat-status');
    expect(status?.textContent?.trim()).toBe(ru['landing.banner.status']);
    expect(en['landing.banner.status']).toBe('AI Agents active nearby');
    expect(ru['landing.banner.status']).toBe('Рядом активны ИИ-агенты');
    const dot = status?.querySelector('.status-dot');
    expect(dot?.getAttribute('aria-hidden')).toBe('true');
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.status-dot\s*\{[^}]*width:\s*6px[^}]*height:\s*6px/);
    expect(css).toMatch(/\.status-dot\s*\{[^}]*background:\s*var\(--color-deepa-1\)/);
    expect(css).toMatch(
      /\.status-dot\s*\{[^}]*animation:\s*status-pulse 1\.6s steps\(2\) infinite alternate/
    );
    expect(css).toMatch(
      /@keyframes status-pulse\s*\{[\s\S]*?from\s*\{[^}]*opacity:\s*1[\s\S]*?to\s*\{[^}]*opacity:\s*0\.4/
    );
    expect(css).toMatch(/\.stat-status\s*\{[^}]*font-size:\s*13px/); // §4.28.C: 11→13
    expect(css).toMatch(
      /\.stat-status\s*\{[^}]*text-shadow:\s*0 0 8px color-mix\(in srgb, var\(--color-deepa-1\) 45%, transparent\)/
    );
  });
});

describe('/ — §4.26.C the step cards: glass fill + hover glow/lift + illustrations + micro-pills', () => {
  it('each step body is glass (AC 8): rgba(15, 14, 22, 0.65) + blur(10px) (both prefixes); .step-body still sets NO border-radius (the pixel frame stays square/stepped over the glass)', () => {
    const { container } = render(LandingPage, { props: {} });
    for (const block of container.querySelectorAll('.step-block')) {
      expect(block.className).toContain('pixel-corners');
      expect(block.className).toContain('pixel-frame--strong');
      expect(block.querySelector('.step-body.pixel-corners')).toBeTruthy();
    }
    const css = source('src/routes/+page.svelte');
    const stepBody = css.match(/\.step-body\s*\{[^}]*\}/)?.[0] ?? '';
    expect(stepBody).toMatch(/background:\s*rgba\(15, 14, 22, 0\.65\)/);
    expect(stepBody).not.toMatch(/border-radius/);
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/-webkit-backdrop-filter:\s*blur\(10px\)/);
    expect(stripped).toMatch(/backdrop-filter:\s*blur\(10px\)/);
    expect(stripped.match(/backdrop-filter:\s*blur\(10px\)/g)).toHaveLength(2);
  });

  it('hover = purple outer glow + slight lift (AC 9): translateY(-4px) + the double drop-shadow over a 160ms ease-out transition; reduced motion → the lift is suppressed (transform: none), no press/click state exists', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.step-block\s*\{[^}]*transition:\s*transform 160ms ease-out, filter 160ms ease-out/);
    expect(css).toMatch(/\.step-block:hover\s*\{[^}]*transform:\s*translateY\(-4px\)/);
    expect(css).toMatch(
      /\.step-block:hover\s*\{[\s\S]*?drop-shadow\(0 0 12px color-mix\(in srgb, var\(--color-deepa-4\) 45%, transparent\)\)[\s\S]*?drop-shadow\(0 0 36px color-mix\(in srgb, var\(--color-deepa-4\) 20%, transparent\)\)/
    );
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\s{2}\}/g)?.join('\n') ?? '';
    expect(reduced).toMatch(/\.step-block\s*\{[^}]*transition-duration:\s*0s/);
    expect(reduced).toMatch(/\.step-block:hover\s*\{[^}]*transform:\s*none/);
    // the blocks still navigate nowhere — no buttons, no links
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelectorAll('#how-it-works button, #how-it-works a')).toHaveLength(0);
  });

  it('each card carries a 48×48px decorative pixel-art SVG top-right (AC 10): aria-hidden, crispEdges, 24×24 grid, token fills only — 01 = the radar character, 02 = two avatars + bubble, 03 = fist-bump + sparkles (original rect art, no plates)', () => {
    const { container } = render(LandingPage, { props: {} });
    const arts = [...container.querySelectorAll('.step-art')];
    expect(arts).toHaveLength(3);
    for (const art of arts) {
      expect(art.getAttribute('viewBox')).toBe('0 0 24 24');
      expect(art.getAttribute('aria-hidden')).toBe('true');
      expect(art.getAttribute('shape-rendering')).toBe('crispEdges');
    }
    const css = source('src/routes/+page.svelte');
    const artCss = css.match(/\.step-art\s*\{[^}]*\}/)?.[0] ?? '';
    expect(artCss).toMatch(/position:\s*absolute/);
    expect(artCss).toMatch(/top:\s*12px/);
    expect(artCss).toMatch(/right:\s*12px/);
    expect(artCss).toMatch(/width:\s*48px/);
    expect(artCss).toMatch(/height:\s*48px/);
    // token discipline: every fill in the step-art data is a token
    // reference (the sanctioned color-mix shading excepted)
    const art = source('src/lib/components/landing/sectionArt.ts');
    const withoutComments = art.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(withoutComments).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    for (const fill of withoutComments.match(/fill: '([^']+)'/g) ?? []) {
      expect(fill).toMatch(/var\(--color-|color-mix\(in srgb, var\(--color-/);
    }
  });

  it('the bottom micro-pills render EXACTLY (AC 11): RANGE: 50M • REAL-TIME GPS / AUTO-INTRO • ZERO AWKWARDNESS / INSTANT SYNC • MUTUAL OPT-IN (RU per §4.26.L), as pill chips (Handjet 12/13px uppercase, §4.28.D — 10/11px superseded, deepa-4 text + 40% border, radius-pill), pinned to the card bottom on desktop (margin-top: auto)', () => {
    const { container } = render(LandingPage, { props: {} });
    const pills = [...container.querySelectorAll('.step-pill')];
    expect(pills.map((p) => p.textContent?.trim())).toEqual([
      ru['landing.steps.find.pill'],
      ru['landing.steps.chat.pill'],
      ru['landing.steps.share.pill']
    ]);
    expect(ru['landing.steps.find.pill']).toBe('ДАЛЬНОСТЬ: 50М • GPS В РЕАЛЬНОМ ВРЕМЕНИ');
    expect(en['landing.steps.find.pill']).toBe('RANGE: 50M • REAL-TIME GPS');
    expect(en['landing.steps.chat.pill']).toBe('AUTO-INTRO • ZERO AWKWARDNESS');
    expect(en['landing.steps.share.pill']).toBe('INSTANT SYNC • MUTUAL OPT-IN');
    const css = source('src/routes/+page.svelte');
    const pill = css.match(/\.step-pill\s*\{[^}]*\}/)?.[0] ?? '';
    expect(pill).toMatch(/border:\s*1px solid color-mix\(in srgb, var\(--color-deepa-4\) 40%, transparent\)/);
    expect(pill).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    expect(pill).toMatch(/color:\s*var\(--color-deepa-4\)/);
    expect(pill).toMatch(/font-size:\s*12px/);
    expect(pill).toMatch(/padding:\s*4px 10px/);
    expect(css).toMatch(/\.step-pill\s*\{[^}]*margin-top:\s*var\(--space-3\)/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.step-pill\s*\{[^}]*margin-top:\s*auto/
    );
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.step-pill\s*\{[^}]*font-size:\s*13px/
    );
  });
});

describe('/ — §4.26.E–I the four new sections + the GET EARLY ACCESS stub', () => {
  it('the shared glass recipe (AC 14): .sim-card / .privacy-card / .usecase-pill / .join-card all carry rgba(18, 15, 28, 0.45) + blur(16px) (both prefixes) + the thin white glossy border + the inset highlight + radius-md; NO .glass class exists', () => {
    const css = source('src/routes/+page.svelte');
    const recipe = css.match(
      /\.sim-card,\s*\n?\s*\.privacy-card,\s*\n?\s*\.usecase-pill,\s*\n?\s*\.join-card\s*\{[^}]*\}/
    )?.[0];
    expect(recipe).toBeTruthy();
    expect(recipe).toMatch(/background:\s*rgba\(18, 15, 28, 0\.45\)/);
    expect(recipe).toMatch(/border:\s*1px solid rgba\(255, 255, 255, 0\.2\)/);
    expect(recipe).toMatch(/box-shadow:\s*inset 0 1px 1px rgba\(255, 255, 255, 0\.35\)/);
    expect(recipe).toMatch(/border-radius:\s*var\(--radius-md\)/);
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(stripped).toMatch(/-webkit-backdrop-filter:\s*blur\(16px\)/);
    expect(stripped).toMatch(/backdrop-filter:\s*blur\(16px\)/);
    expect(css).not.toMatch(/\.glass/);
    // the blur backdrops count: the recipe (1 pair) + banner (12px) +
    // steps (10px) + footer (14px) + header (18px) — per-value pairs stay
    // unshared
    expect(stripped.match(/backdrop-filter:\s*blur\(16px\)/g)).toHaveLength(2);
  });

  it('Section 4 renders (§4.27.C/§4.27.D): the wide glass container #sim with the BLEAK personage (64px, purple glow) + YOUR AGENT + Status: Scanning... (blinking cursor) on the left, the SCOUT figure (cyan glow) + NEARBY AGENT + Distance: 15m on the right, and the CENTER COLUMN .sim-center holding EXACTLY two children — the compatibility ring on top and the glowing green ICE BROKEN badge BELOW it (the §4.26.F 3-message chat window is REMOVED; no nav anchor targets #sim)', () => {
    const { container } = render(LandingPage, { props: {} });
    const sim = container.querySelector('#sim');
    expect(sim).toBeTruthy();
    expect(sim?.querySelector('.sim-card')).toBeTruthy();
    expect(sim?.querySelector('.section-title')?.textContent).toBe(ru['landing.sim.title']);
    // left: YOUR AGENT — the shared BLEAK personage at 64px, static
    const you = sim?.querySelector('.sim-you');
    const youFigure = you?.querySelector('[data-figure="bleak"] svg');
    expect(youFigure).toBeTruthy();
    expect(youFigure?.getAttribute('height')).toBe('64');
    expect(you?.querySelector('.sim-agent-name')?.textContent).toBe(ru['landing.sim.you']);
    expect(you?.querySelector('.sim-status')?.textContent?.trim()).toBe(
      ru['landing.sim.you.status']
    );
    expect(sim?.querySelector('.sim-cursor')).toBeTruthy();
    // right: NEARBY AGENT — the scout figure
    const nearby = sim?.querySelector('.sim-nearby');
    expect(nearby?.querySelector('[data-figure="scout"]')).toBeTruthy();
    expect(nearby?.querySelector('.sim-agent-name')?.textContent).toBe(
      ru['landing.sim.nearby']
    );
    expect(nearby?.querySelector('.sim-status')?.textContent?.trim()).toBe(
      ru['landing.sim.nearby.status']
    );
    // §4.27.C: the center column holds EXACTLY two children, top →
    // bottom: (1) the compatibility ring, (2) the badge BELOW it
    const center = sim?.querySelector('.sim-center');
    expect(center).toBeTruthy();
    const centerChildren = [...(center?.children ?? [])].map((el) => el.className);
    expect(centerChildren).toHaveLength(2);
    expect(centerChildren[0]).toContain('compat-ring');
    expect(centerChildren[1]).toContain('sim-badge');
    expect(center?.querySelector('.sim-badge')?.textContent?.trim()).toBe(
      ru['landing.sim.badge']
    );
    // verbatim EN badge copy
    expect(en['landing.sim.badge']).toBe('[ ICE BROKEN — SAY HELLO ]');
    // the retired chat window is ABSENT from the DOM
    for (const sel of ['.sim-chat', '.sim-chat-body', '.sim-row', '.sim-who', '.sim-msg']) {
      expect(sim?.querySelector(sel), `${sel} is gone`).toBeNull();
    }
    // the badge keeps its unchanged deepa-1 chip styles + pulse; reduced
    // motion → static (the base.css catch-all)
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.sim-badge\s*\{[^}]*color:\s*var\(--color-deepa-1\)/);
    expect(css).toMatch(/\.sim-badge\s*\{[^}]*animation:\s*badge-pulse 1\.6s steps\(2\) infinite alternate/);
    // §4.26.O.6: no nav link targets #sim (id="sim" is record-only)
    const nav = container.querySelector('.top-nav');
    for (const a of nav?.querySelectorAll('a') ?? []) {
      expect(a.getAttribute('href')).not.toBe('#sim');
    }
    // the 1fr/auto/1fr desktop grid (the 160px ring box is the `auto`
    // middle column); phone = the 2-col avatar row above the full-width
    // center (grid areas)
    expect(css).toMatch(/\.sim-grid\s*\{[^}]*grid-template-columns:\s*1fr 1fr/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.sim-grid\s*\{[^}]*grid-template-columns:\s*1fr auto 1fr/
    );
    expect(css).toMatch(/\.sim-center\s*\{[^}]*grid-area:\s*center/);
    expect(css).toMatch(/grid-template-areas:\s*\n?\s*'you center nearby'/);
    expect(css).toMatch(/grid-template-areas:\s*\n?\s*'you nearby'\s*\n?\s*'center center'/);
  });

  it('§4.27.D the compatibility circle is the /chats summary-sheet pattern REUSED (source-scan): the landing imports RING_RADIUS, ringScoreOffset, TALLY_MS and tallyValue from #lib/chats/summary — NO duplicated geometry or timing constants exist in the landing sources (no local radius 66, no local 700ms count-up constant, no re-derived dash math)', () => {
    const page = source('src/routes/+page.svelte');
    // the import — reuse, do not copy
    expect(page).toMatch(
      /import\s*\{[^}]*\bRING_RADIUS\b[^}]*\bringCircumference\b[^}]*\bringScoreOffset\b[^}]*\bTALLY_MS\b[^}]*\btallyValue\b[^}]*\}\s*from\s*'#lib\/chats\/summary';/
    );
    // no duplicated constants: the pure module is the ONLY source of the
    // geometry/count-up numbers
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      expect(src, `${file} carries a local ring radius 66`).not.toMatch(/\bRADIUS\s*=\s*66\b/);
      expect(src, `${file} carries a local 700ms count-up constant`).not.toMatch(
        /\bTALLY_MS\s*=\s*700\b|\b=\s*700\s*;\s*\/\/\s*ms\b/
      );
      expect(src, `${file} re-derives the dash math`).not.toMatch(
        /Math\.PI\s*\*\s*(RING_RADIUS|radius)/
      );
    }
    // SummarySheet.svelte + lib/chats/summary.ts are UNTOUCHED (the pattern
    // source is not modified)
    expect(source('src/lib/chats/summary.ts')).toMatch(
      /export const RING_RADIUS = 66;/
    );
    expect(source('src/lib/components/SummarySheet.svelte')).toMatch(
      /ring-fill 900ms ease-out both/
    );
  });

  it('§4.27.D the ring construction (verbatim): SVG viewBox 0 0 160 160 at 160×160px, r 66 (the imported RING_RADIUS), stroke-width 12, stroke-linecap: butt, crispEdges, the track at 25% of --color-text, the arc dasharray = full circumference with ring-fill 900ms ease-out from the full C to ringScoreOffset(96), rotate(-90deg) 12-o-clock clockwise start; the numeral renders 96% at rest — Handjet 600 40px centered, fill --color-text; arc + numeral --color-text (no yellow, no new colors)', async () => {
    // happy-dom never intersects: stub the API as unavailable → the mount
    // fallback flips `started` immediately and the count-up runs
    vi.stubGlobal('IntersectionObserver', undefined);
    const { container } = render(LandingPage, { props: {} });
    const ring = container.querySelector('.compat-ring') as SVGSVGElement | null;
    expect(ring).toBeTruthy();
    expect(ring?.getAttribute('viewBox')).toBe('0 0 160 160');
    expect(ring?.getAttribute('width')).toBe('160');
    expect(ring?.getAttribute('height')).toBe('160');
    expect(ring?.getAttribute('role')).toBe('img');
    expect(ring?.getAttribute('shape-rendering')).toBe('crispEdges');
    // the count-up runs off the mount fallback — after it lands the
    // numeral reads exactly 96%
    await waitFor(() => {
      expect(ring?.querySelector('.compat-score')?.textContent).toBe('96%');
    });
    // accessibility: the aria-label embeds the final value (the sheet's
    // scoreAria pattern); the count-up announces nothing (no aria-live)
    expect(ring?.getAttribute('aria-label')).toBe(ru['landing.sim.compat.aria']);
    expect(en['landing.sim.compat.aria']).toBe('Agent compatibility: 96%');
    expect(ru['landing.sim.compat.aria']).toBe('Совместимость агентов: 96%');
    expect(ring?.querySelector('[aria-live]')).toBeNull();
    const css = source('src/routes/+page.svelte');
    // geometry + stroke treatment (the sheet's values, verbatim)
    expect(css).toMatch(/\.compat-ring\s*\{[^}]*width:\s*160px[^}]*height:\s*160px/);
    expect(css).toMatch(/\.compat-ring\s*\{[^}]*shape-rendering:\s*crispEdges/);
    expect(css).toMatch(/\.compat-ring circle\s*\{[^}]*stroke:\s*var\(--color-text\)[^}]*stroke-width:\s*12/);
    expect(css).toMatch(/\.compat-ring \.track\s*\{[^}]*stroke:\s*color-mix\(in srgb, var\(--color-text\) 25%, transparent\)/);
    expect(css).toMatch(/\.compat-ring \.arc\s*\{[^}]*stroke-linecap:\s*butt/);
    expect(css).toMatch(/\.compat-ring \.arc\s*\{[^}]*stroke-dasharray:\s*var\(--ring-c\) var\(--ring-c\)/);
    expect(css).toMatch(/\.compat-ring \.arc\s*\{[^}]*stroke-dashoffset:\s*var\(--ring-target\)/);
    expect(css).toMatch(/\.compat-ring \.arc\s*\{[^}]*transform:\s*rotate\(-90deg\)[^}]*transform-origin:\s*80px 80px/);
    expect(css).toMatch(/\.compat-ring \.arc\s*\{[^}]*animation:\s*ring-fill 900ms ease-out both/);
    expect(css).toMatch(/@keyframes ring-fill\s*\{[\s\S]*?from\s*\{[^}]*stroke-dashoffset:\s*var\(--ring-c\)[\s\S]*?to\s*\{[^}]*stroke-dashoffset:\s*var\(--ring-target\)/);
    // the numeral: Handjet 600 40px, centered, the text ink
    const scoreRule = css.match(/\.compat-ring \.compat-score\s*\{[^}]*\}/)?.[0] ?? '';
    expect(scoreRule).toMatch(/font-family:\s*var\(--font-pixel\)/);
    expect(scoreRule).toMatch(/font-weight:\s*600/);
    expect(scoreRule).toMatch(/font-size:\s*40px/);
    expect(scoreRule).toMatch(/letter-spacing:\s*0/);
    expect(scoreRule).toMatch(/text-anchor:\s*middle/);
    expect(scoreRule).toMatch(/dominant-baseline:\s*central/);
    expect(scoreRule).toMatch(/fill:\s*var\(--color-text\)/);
    // no yellow anywhere on the ring (the green stays on the badge)
    const ringRules = css.match(/\.compat-ring[^{]*\{[^}]*\}/g)?.join('\n') ?? '';
    expect(ringRules).not.toMatch(/accent|--color-accent/);
  });

  it('§4.27.D reduced motion: the ring renders the static final state immediately — the explicit matchMedia guard jumps the tally to 96 (no observer, no rAF); scrolling never replays anything', async () => {
    const page = source('src/routes/+page.svelte');
    // the explicit guard inside the effect (the base.css catch-all only
    // intercepts CSS)
    expect(page).toMatch(
      /prefers-reduced-motion:\s*reduce/
    );
    // behavior: under reduce the numeral is 96% without any trigger
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: true,
      media: '(prefers-reduced-motion: reduce)',
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })));
    const { container } = render(LandingPage, { props: {} });
    const ring = container.querySelector('.compat-ring') as SVGSVGElement | null;
    expect(ring).toBeTruthy();
    await tick();
    expect(ring?.querySelector('.compat-score')?.textContent).toBe('96%');
    expect(ring?.getAttribute('aria-label')).toBe(ru['landing.sim.compat.aria']);
  });


  it('Section 5 renders (AC 17): the glass container #privacy titled BUILT FOR REAL LIFE, NOT STALKERS; a 3-col grid ≥720px / a stack on phone; the three cards carry the 48px ghost / padlock+key / shield+radar icons and the exact titles + descs (RU per §4.26.L)', () => {
    const { container } = render(LandingPage, { props: {} });
    const privacy = container.querySelector('#privacy');
    expect(privacy?.querySelector('.privacy-card')).toBeTruthy();
    expect(privacy?.querySelector('.section-title')?.textContent).toBe(
      ru['landing.privacy.title']
    );
    const items = [...(privacy?.querySelectorAll('.privacy-item') ?? [])];
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.querySelector('.privacy-title')?.textContent)).toEqual([
      ru['landing.privacy.ghost.title'],
      ru['landing.privacy.mutual.title'],
      ru['landing.privacy.gps.title']
    ]);
    expect(items.map((i) => i.querySelector('.privacy-desc')?.textContent)).toEqual([
      ru['landing.privacy.ghost.desc'],
      ru['landing.privacy.mutual.desc'],
      ru['landing.privacy.gps.desc']
    ]);
    for (const item of items) {
      const icon = item.querySelector('.privacy-icon');
      expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
      expect(icon?.getAttribute('shape-rendering')).toBe('crispEdges');
    }
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.privacy-icon\s*\{[^}]*width:\s*48px/);
    expect(css).toMatch(/\.privacy-grid\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.privacy-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/
    );
    // the inner cards are transparent + hairline — no nested blur (§4.26.E)
    const item = css.match(/\.privacy-item\s*\{[^}]*\}/)?.[0] ?? '';
    expect(item).toMatch(/background:\s*transparent/);
    expect(item).toMatch(/border:\s*1px solid color-mix\(in srgb, var\(--color-text\) 12%, transparent\)/);
    expect(item).not.toMatch(/backdrop-filter/);
    // verbatim EN copy
    expect(en['landing.privacy.ghost.desc']).toBe('Go invisible on the radar with one tap.');
    expect(en['landing.privacy.mutual.desc']).toBe(
      'Zero cold DMs. Contacts unlock only after a mutual handshake.'
    );
    expect(en['landing.privacy.gps.desc']).toBe('Your location is processed live and never stored.');
  });

  it('Section 6 renders (AC 18): the plain section #use-cases titled WHERE BLEAK SHINES; a 4-col pill row ≥720px / a stack on phone; the pills carry the 40px badge / neon-glasses / laptop / headphones icons and the exact labels', () => {
    const { container } = render(LandingPage, { props: {} });
    const usecases = container.querySelector('#use-cases');
    expect(usecases?.querySelector('.sim-card')).toBeNull();
    expect(usecases?.querySelector('.section-title')?.textContent).toBe(
      ru['landing.usecases.title']
    );
    const pills = [...(usecases?.querySelectorAll('.usecase-pill') ?? [])];
    expect(pills).toHaveLength(4);
    expect(pills.map((p) => p.querySelector('.usecase-label')?.textContent)).toEqual([
      ru['landing.usecases.conferences'],
      ru['landing.usecases.parties'],
      ru['landing.usecases.coworkings'],
      ru['landing.usecases.festivals']
    ]);
    for (const pill of pills) {
      const icon = pill.querySelector('.usecase-icon');
      expect(icon?.getAttribute('viewBox')).toBe('0 0 16 16');
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.usecase-icon\s*\{[^}]*width:\s*40px/);
    expect(css).toMatch(/\.usecase-pill\s*\{[^}]*min-height:\s*112px/);
    expect(css).toMatch(/\.usecase-row\s*\{[^}]*grid-template-columns:\s*1fr/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.usecase-row\s*\{[^}]*grid-template-columns:\s*repeat\(4, 1fr\)/
    );
    expect(en['landing.usecases.parties']).toBe('PARTIES & BARS');
    expect(ru['landing.usecases.parties']).toBe('ВЕЧЕРИНКИ И БАРЫ');
  });

  it('Section 7 renders (AC 19): the centered glass card #join with the purple outer glow (32px 45% + 96px 22% over the inset highlight), the BLEAK-WAVE mascot (96px), the verbatim headline, the dark glass input (aria-label = placeholder key) and the GET EARLY ACCESS neon-yellow button', () => {
    const { container } = render(LandingPage, { props: {} });
    const join = container.querySelector('#join');
    expect(join?.querySelector('.section-title')?.textContent).toBe(ru['landing.join.title']);
    const card = join?.querySelector('.join-card');
    expect(card?.querySelector('[data-figure="bleakWave"]')).toBeTruthy();
    const headline = card?.querySelector('.join-headline');
    expect(headline?.textContent?.trim()).toBe(ru['landing.join.headline']);
    expect(en['landing.join.headline']).toBe('THE RIGHT CONNECTIONS ARE ALREADY NEARBY.');
    expect(ru['landing.join.headline']).toBe('НУЖНЫЕ ЗНАКОМСТВА УЖЕ РЯДОМ.');
    const input = card?.querySelector('.join-input') as HTMLInputElement | null;
    expect(input?.getAttribute('type')).toBe('text');
    expect(input?.getAttribute('inputmode')).toBe('email');
    expect(input?.getAttribute('autocomplete')).toBe('email');
    expect(input?.placeholder).toBe(ru['landing.join.input.placeholder']);
    expect(input?.getAttribute('aria-label')).toBe(ru['landing.join.input.placeholder']);
    const cta = card?.querySelector('.cta-access');
    expect(cta?.tagName).toBe('A');
    expect(cta?.textContent?.trim()).toBe(ru['landing.join.button']);
    expect(en['landing.join.button']).toBe('GET EARLY ACCESS');
    expect(ru['landing.join.button']).toBe('ПОЛУЧИТЬ РАННИЙ ДОСТУП');
    const css = source('src/routes/+page.svelte');
    // the standalone .join-card rule (not the shared recipe selector list)
    const joinCard = css.match(/\.join-card\s*\{[^}]*max-width:\s*640px[^}]*\}/)?.[0] ?? '';
    expect(joinCard).toMatch(/max-width:\s*640px/);
    expect(joinCard).toMatch(/margin:\s*0 auto/);
    expect(joinCard).toMatch(
      /box-shadow:\s*\n?\s*inset 0 1px 1px rgba\(255, 255, 255, 0\.35\),\s*\n?\s*0 0 32px color-mix\(in srgb, var\(--color-deepa-4\) 45%, transparent\),\s*\n?\s*0 0 96px color-mix\(in srgb, var\(--color-deepa-4\) 22%, transparent\)/
    );
    const inputCss = css.match(/\.join-input\s*\{[^}]*\}/)?.[0] ?? '';
    expect(inputCss).toMatch(/background:\s*rgba\(15, 14, 22, 0\.65\)/);
    expect(inputCss).toMatch(/border:\s*1px solid rgba\(255, 255, 255, 0\.2\)/);
    expect(inputCss).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    expect(inputCss).toMatch(/min-height:\s*var\(--touch-target\)/);
    const ctaCss = css.match(/\.cta-access\s*\{[^}]*\}/)?.[0] ?? '';
    expect(ctaCss).toMatch(/background:\s*var\(--color-accent\)/);
    expect(ctaCss).toMatch(/color:\s*var\(--color-accent-ink\)/);
    expect(ctaCss).toMatch(/border-radius:\s*var\(--radius-pill\)/);
    expect(ctaCss).toMatch(/min-height:\s*var\(--touch-target\)/);
  });

  it('the GET EARLY ACCESS stub (AC 20): a plain <a> whose href is mailto:extube@proton.me with subject BLEAK EARLY ACCESS — a URL-encoded body ONLY when the input is non-empty; no form element, no fetch, no new env, NO client validation', async () => {
    const { container } = render(LandingPage, { props: {} });
    const input = container.querySelector('.join-input') as HTMLInputElement;
    const cta = container.querySelector('.cta-access') as HTMLAnchorElement;
    // empty input → the bare mailto (subject only, no body param)
    expect(input.value).toBe('');
    expect(cta.getAttribute('href')).toBe(
      'mailto:extube@proton.me?subject=BLEAK%20EARLY%20ACCESS'
    );
    // a typed value → the URL-encoded body rides along
    input.value = 'me@example.com';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await tick();
    expect(cta.getAttribute('href')).toBe(
      'mailto:extube@proton.me?subject=BLEAK%20EARLY%20ACCESS&body=me%40example.com'
    );
    // source discipline: no form element, no fetch on /, no validation
    const page = source('src/routes/+page.svelte');
    expect(page).not.toMatch(/<form/);
    expect(page).not.toMatch(/\bfetch\(/);
    expect(page).toMatch(/type="text"/);
    expect(page).toMatch(/inputmode="email"/);
  });
});

describe('/ — §4.28 the v3.22 font ladder + the §40 phone widths (tz12-12)', () => {
  it('§4.28.A–D the COMPLETE bump ladder: every bumped class computes exactly the tabled value — titles (.agent-name 28, .stat-title 21, .step-title 24, .section-title 24, .join-headline 24/28, .privacy-title 16, .sim-agent-name 16), descriptions (.step-desc/.privacy-desc/.stat-line/.agent-quote 17), captions (.stat-status 13, .sim-status 14, .agent-traits 13), badges/pills (.stat-badge > span 13, .agent-badge 13, .step-pill 12/13, .sim-badge 14, .usecase-label 16) and the CTA pill family (.cta-main/.talk/.cta-access 18) — with font-family/weight/letter-spacing/text-transform/color declarations byte-unchanged', () => {
    const css = source('src/routes/+page.svelte');
    const rule = (sel: string) => css.match(new RegExp(`${sel}\\s*\\{[^}]*\\}`))?.[0] ?? '';
    // — titles —
    expect(rule('\\.agent-name')).toMatch(/font-size:\s*28px/);
    expect(rule('\\.agent-name')).toMatch(/font-family:\s*var\(--font-pixel\)/);
    expect(rule('\\.stat-title')).toMatch(/font-size:\s*21px/);
    expect(rule('\\.step-title')).toMatch(/font-size:\s*24px/);
    expect(rule('\\.section-title')).toMatch(/font-size:\s*24px/);
    expect(rule('\\.join-headline')).toMatch(/font-size:\s*24px/);
    expect(css).toMatch(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.join-headline\s*\{[^}]*font-size:\s*28px/
    );
    expect(rule('\\.privacy-title')).toMatch(/font-size:\s*16px/);
    expect(rule('\\.sim-agent-name')).toMatch(/font-size:\s*16px/);
    // — captions —
    expect(rule('\\.stat-status')).toMatch(/font-size:\s*13px/);
    expect(rule('\\.sim-status')).toMatch(/font-size:\s*14px/);
    expect(rule('\\.agent-traits')).toMatch(/font-size:\s*13px/);
    // — badges / pills —
    expect(rule('\\.stat-badge > span')).toMatch(/font-size:\s*13px/);
    expect(rule('\\.agent-badge')).toMatch(/font-size:\s*13px/);
    expect(rule('\\.agent-badge')).toMatch(/min-height:\s*24px/); // the chip still fits
    expect(rule('\\.sim-badge')).toMatch(/font-size:\s*14px/);
    expect(rule('\\.usecase-label')).toMatch(/font-size:\s*16px/);
    expect(rule('\\.step-pill')).toMatch(/font-size:\s*12px/);
    // — the CTA pill family moves together —
    expect(rule('\\.cta-main,\\s*\\n?\\s*\\.talk')).toMatch(/font-size:\s*18px/);
    expect(rule('\\.cta-access')).toMatch(/font-size:\s*18px/);
    // the superseded §4.27.B/§4.26 badge values are gone everywhere
    expect(css).not.toMatch(/\.stat-badge > span\s*\{[^}]*font-size:\s*11px/);
    expect(css).not.toMatch(/\.agent-badge\s*\{[^}]*font-size:\s*11px/);
    expect(css).not.toMatch(/\.agent-traits\s*\{[^}]*font-size:\s*11px/);
    expect(css).not.toMatch(/\.stat-status\s*\{[^}]*font-size:\s*11px/);
    expect(css).not.toMatch(/\.sim-status\s*\{[^}]*font-size:\s*12px/);
    expect(css).not.toMatch(/\.sim-badge\s*\{[^}]*font-size:\s*12px/);
    expect(css).not.toMatch(/\.usecase-label\s*\{[^}]*font-size:\s*14px/);
    expect(css).not.toMatch(/\.privacy-title\s*\{[^}]*font-size:\s*14px/);
    expect(css).not.toMatch(/\.sim-agent-name\s*\{[^}]*font-size:\s*14px/);
    expect(css).not.toMatch(/\.step-title\s*\{[^}]*font-size:\s*20px/);
    expect(css).not.toMatch(/\.section-title\s*\{[^}]*font-size:\s*20px/);
    expect(css).not.toMatch(/\.join-headline\s*\{[^}]*font-size:\s*20px/);
    expect(css).not.toMatch(/\.agent-name\s*\{[^}]*font-size:\s*24px/);
    expect(css).not.toMatch(/\.stat-title\s*\{[^}]*font-size:\s*17px/);
    expect(css).not.toMatch(/\.step-pill\s*\{[^}]*font-size:\s*10px/);
    expect(css).not.toMatch(/\.cta-main,\s*\n?\s*\.talk\s*\{[^}]*font-size:\s*16px/);
    expect(css).not.toMatch(/\.cta-access\s*\{[^}]*font-size:\s*16px/);
  });

  it('§4.28.E the negatives — UNCHANGED sizes: .top-nav a stays 14px, the language switcher is untouched (no .locale-scoped override), .join-input stays 14px, the footer block stays 14/11/12/13px, .step-num stays 40px and .compat-ring .compat-score stays 40px', () => {
    const css = source('src/routes/+page.svelte');
    const rule = (sel: string) => css.match(new RegExp(`${sel}\\s*\\{[^}]*\\}`))?.[0] ?? '';
    expect(rule('\\.top-nav a')).toMatch(/font-size:\s*14px/);
    expect(css).not.toMatch(/\.locale[^{]*\{[^}]*font-size/);
    const segmented = source('src/lib/components/SegmentedControl.svelte');
    expect(segmented).toMatch(/font-size:\s*14px/); // the switcher's buttons stay 14px
    expect(rule('\\.join-input')).toMatch(/font-size:\s*14px/);
    expect(rule('\\.brand-name')).toMatch(/font-size:\s*14px/);
    expect(rule('\\.foot-year')).toMatch(/font-size:\s*11px/);
    expect(rule('\\.link-label')).toMatch(/font-size:\s*12px/);
    expect(rule('\\.link-value')).toMatch(/font-size:\s*13px/);
    expect(rule('\\.step-num')).toMatch(/font-size:\s*40px/);
    expect(rule('\\.compat-ring \\.compat-score')).toMatch(/font-size:\s*40px/);
  });

  it('§4.28.F phone widths: .landing and .top carry the IDENTICAL width expression max(90%, 280px) (their computed boxes are equal at 320 → 288px and at 390 → 351px; below ~311px both floor at 280px) with identical margin-inline auto — and the .landing phone rule has NO inline horizontal padding (the blocks span edge-to-edge); the ≥720px media restores the §38 values (80% content / 90% header)', () => {
    const css = source('src/routes/+page.svelte');
    // comment-stripped: comments are prose (they may name the shared
    // expression or retired values)
    const stripped = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const widthOf = (sel: string) =>
      stripped.match(new RegExp(`${sel}\\s*\\{[^}]*?width:\\s*([^;]+);`))?.[1]?.trim() ?? '';
    const landingWidth = widthOf('\\.landing');
    const topWidth = widthOf('\\.top');
    // the two columns are EXACTLY equal — one shared expression
    expect(landingWidth).toBe('max(90%, 280px)');
    expect(topWidth).toBe('max(90%, 280px)');
    expect(landingWidth).toBe(topWidth);
    // the alignment mechanism: the phone inline padding is dropped — the
    // base .landing rule declares ONLY a bottom padding
    const landingBase = stripped.match(/\.landing\s*\{[^}]*\}/)?.[0] ?? '';
    expect(landingBase).toMatch(/padding:\s*0 0 var\(--space-5\)/);
    expect(landingBase).not.toMatch(/padding:\s*0\s+var\(--/);
    // both center against the same containing block
    expect(landingBase).toMatch(/margin-inline:\s*auto/);
    expect(stripped).toMatch(/\.top\s*\{[^}]*margin-inline:\s*auto/);
    // desktop ≥720px UNCHANGED: 80% content / 90% header (the 280px floor
    // is inert there — no extra .top desktop override exists)
    const desktopLanding = stripped.match(
      /@media \(min-width: 720px\)\s*\{[\s\S]*?\.landing\s*\{[^}]*\}/
    )?.[0] ?? '';
    expect(desktopLanding).toMatch(/width:\s*max\(80%, 280px\)/);
    expect(desktopLanding).toMatch(/padding:\s*0 var\(--space-7\) var\(--space-7\)/);
    expect(topWidth).toMatch(/90%/);
    // the floor appears in exactly two width rules (no third consumer)
    expect((stripped.match(/max\(90%, 280px\)/g) ?? []).length).toBe(2);
  });

  it('§4.28.H i18n ZERO delta: exactly 55 landing.* keys in BOTH dictionaries — no key added, removed or edited by the sizing pass', () => {
    const ruLanding = Object.keys(ru).filter((k) => k.startsWith('landing.'));
    const enLanding = Object.keys(en).filter((k) => k.startsWith('landing.'));
    expect(ruLanding).toHaveLength(55);
    expect(enLanding).toHaveLength(55);
    expect(ruLanding.sort()).toEqual(enLanding.sort());
    expect(LANDING_KEYS).toHaveLength(55);
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
