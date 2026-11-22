/** Landing page tests (tz12-07, Concept §35, DESIGN §4.23 amending
 * §4.22/§4.21/§4.20 item by item): `/` gets the §4.23 batch — the video
 * becomes the FIXED FULL-VIEWPORT background layer (LandingVideoHero
 * repurposed in place: the committed mp4 app asset, the decisive attribute
 * set with the reduced-motion-gated one-shot start, the dissolve vignette +
 * 30% legibility tint, the kept 12-dot mesh, the failure degradation; the
 * play control retires with the video-as-content model, §4.23.E.5), the
 * header becomes the floating LIQUID-GLASS panel (sticky 12px chip: 92%
 * landing-bg fill + backdrop blur(14px) saturate(1.1) + violet hairline +
 * rounded corners radius-lg/md; keep-list unchanged) with the SAME glass
 * recipe on the lead panel, the desktop plain-flow row (lead glass panel +
 * 360px agent card) and the phone DOM-order stack, and the agent reminders
 * are REMOVED ENTIRELY (§4.23.C: the component, its integration, the play
 * control, the dialog/video i18n keys — negative assertions + key cleanup,
 * grep-audited). Still in force: routes, Start/TALK → /income (6-digit),
 * RU/EN parity (23 keys), BLEAK/БЛИК naming, three step blocks, contact
 * footer, removed blocks stay removed, deep links. */
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

/** The 23 §4.20.M + §4.21.H + §4.22.H + §4.23.F keys (as reduced by the
 * §4.22.1 chat-strip retirement and the §4.23.C dialog/video removal) —
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
  'landing.footer.copyright'
] as const;

/** The keys the §4.21.H + §4.22.H amendments kill, plus the §4.22.1
 * chat-strip keys and the §4.23.C dialog/video keys — in NEITHER
 * dictionary. */
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
  'landing.video.pause'
] as const;

const LANDING_SOURCES = [
  'src/routes/+page.svelte',
  'src/lib/components/landing/LandingVideoHero.svelte',
  'src/lib/components/landing/LandingFigure.svelte',
  'src/lib/components/landing/figures.ts',
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

describe('/ — the §4.23.B liquid-glass header (icon + nav + switcher ONLY)', () => {
  it('renders exactly: the plate-less web icon (cutouts in --color-landing-bg), the two in-page anchors (desktop-only) and the LocaleControl — the keep-list is UNCHANGED (§4.22.A verbatim)', () => {
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
    // the two anchors, names reusing the §4.20.M keys (no new nav keys)
    const nav = top?.querySelector('.top-nav');
    const links = [...(nav?.querySelectorAll('a') ?? [])];
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['#tutorial', '#agents']);
    expect(nav?.textContent).toContain(ru['landing.tutorial.search']);
    expect(nav?.textContent).toContain(ru['landing.agent.name']);
    // desktop-only anchors (≥720px); the switcher is always there
    expect(css).toMatch(/\.top-nav\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.top-nav\s*\{[^}]*display:\s*flex/);
    expect(top?.querySelector('.locale .segmented')).toBeTruthy();
    // no header START control (the entry points are exactly two, §4.22.A)
    expect(container.querySelector('header.top .start-pill')).toBeNull();
    expect(container.querySelector('header.top .start-link')).toBeNull();
  });

  it('the floating glass chip: sticky at 12px with z-index 10 above the content column, side insets 12px aligned to the 1000px canvas', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.top\s*\{[^}]*position:\s*sticky/);
    expect(css).toMatch(/\.top\s*\{[^}]*top:\s*var\(--space-3\)/);
    expect(css).toMatch(/\.top\s*\{[^}]*z-index:\s*10/);
    // the floating chip geometry: 12px side insets, aligned to the canvas
    expect(css).toMatch(/\.top\s*\{[^}]*width:\s*min\(100% - 24px, calc\(1000px - 48px\)\)/);
    expect(css).toMatch(/\.top\s*\{[^}]*margin-inline:\s*auto/);
    // desktop row height + padding (§4.23.B) — the smaller phone chip below
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.top\s*\{[^}]*min-height:\s*56px[^}]*padding:\s*10px 16px/);
    expect(css).toMatch(/\.top\s*\{[^}]*min-height:\s*52px[^}]*padding:\s*8px 10px/);
    // anchored sections never hide under the stuck panel
    expect(css).toMatch(/scroll-margin-top:\s*80px/);
  });

  it('the glass recipe (exact values): 92% landing-bg fill, backdrop blur(14px) saturate(1.1) (+ -webkit-), the 22% Deepa violet hairline, rounded corners radius-lg desktop / radius-md phone chip — scoped to the glass surfaces only', () => {
    const css = source('src/routes/+page.svelte');
    // the exact recipe, shared by the header and the lead panel (§4.23.D)
    expect(css).toMatch(
      /background:\s*color-mix\(in srgb, var\(--color-landing-bg\) 92%, transparent\)/
    );
    expect(css).toMatch(/-webkit-backdrop-filter:\s*blur\(14px\) saturate\(1\.1\)/);
    expect(css).toMatch(/backdrop-filter:\s*blur\(14px\) saturate\(1\.1\)/);
    expect(css).toMatch(
      /border:\s*1px solid color-mix\(in srgb, var\(--color-deepa-4\) 22%, transparent\)/
    );
    // rounded corners — the ONLY rounded surface family: radius-lg (24px)
    // desktop / radius-md (20px) phone chip, tokens only
    expect(css).toMatch(/border-radius:\s*var\(--radius-lg\)/);
    expect(css).toMatch(/@media \(max-width: 719\.98px\)\s*\{[\s\S]*?\.top\s*\{[^}]*border-radius:\s*var\(--radius-md\)/);
    // scoped: the pixel-frame cards/steps/footer keep the square/stepped
    // corner treatment — their rules set no border-radius
    for (const rule of ['.step-body', '.foot-body']) {
      const block = css.match(new RegExp(`${rule}\\s*\\{[^}]*\\}`))?.[0] ?? '';
      expect(block, `${rule} must stay square (the pixel aesthetic)`).not.toMatch(/border-radius/);
    }
    // and the pixel-frame construction is still in the markup
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.agent-card')?.className).toContain('pixel-corners');
    expect(container.querySelector('.step-block')?.className).toContain('pixel-corners');
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
  it('the committed app asset background-video.mp4 exists and is imported via the #lib URL import (not hotlinked, not in static/)', () => {
    const assetPath = 'src/lib/assets/landing/background-video.mp4';
    expect(existsSync(join(WEB_ROOT, assetPath))).toBe(true);
    // a real MP4 (the ISO-BMFF ftyp box at bytes 4..8), committed at ~4.4 MB
    const bytes = readFileSync(join(WEB_ROOT, assetPath));
    expect(statSync(join(WEB_ROOT, assetPath)).size).toBeGreaterThan(1_000_000);
    expect(bytes.slice(4, 8).toString('ascii')).toBe('ftyp');
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(
      /import videoUrl from '#lib\/assets\/landing\/background-video\.mp4';/
    );
    expect(hero).toMatch(/src=\{videoUrl\}/);
    expect(existsSync(join(WEB_ROOT, 'static/background-video.mp4'))).toBe(false);
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

  it('content scrolls OVER the video (the layer stack holds): the video (z 0) → vignette + 30% tint (z 1) → dots (z 2) → content column (z 3) → sticky header (z 10); the fixed layer never moves while .landing scrolls over it', () => {
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    const page = source('src/routes/+page.svelte');
    // the fixed layer children are viewport-sized and unmoving
    expect(hero).toMatch(/\.video-layer::after\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*1/);
    expect(hero).toMatch(/\.dots\s*\{[^}]*position:\s*fixed[^}]*inset:\s*0[^}]*z-index:\s*2/);
    // the content column is the z-3 scrolling layer above the fixed layer
    expect(page).toMatch(/\.landing\s*\{[^}]*position:\s*relative[^}]*z-index:\s*3/);
    // the sticky glass header rides above everything (z 10)
    expect(page).toMatch(/\.top\s*\{[^}]*z-index:\s*10/);
    // the layer is non-interactive — content interaction is unaffected
    expect(hero).toMatch(/\.video-layer\s*\{[^}]*pointer-events:\s*none/);
    expect(hero).toMatch(/\.dots\s*\{[^}]*pointer-events:\s*none/);
  });

  it('renders the decisive attribute set verbatim: muted loop playsinline preload="metadata" disablepictureinpicture — NO autoplay attribute, NO native controls', () => {
    const { container } = render(LandingPage, { props: {} });
    const video = container.querySelector('video.video') as HTMLVideoElement | null;
    expect(video).toBeTruthy();
    // the properties are set on mount (the muted property is the autoplay-
    // policy load-bearing one; the rest stay attributes)
    expect(video?.muted).toBe(true);
    expect(video?.loop).toBe(true);
    expect(video?.preload).toBe('metadata');
    expect(video?.getAttribute('playsinline')).not.toBeNull();
    expect(video?.getAttribute('disablepictureinpicture')).not.toBeNull();
    expect(video?.getAttribute('aria-hidden')).toBe('true');
    expect(video?.hasAttribute('autoplay')).toBe(false);
    expect(video?.hasAttribute('controls')).toBe(false);
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(/muted\s*\n\s*loop\s*\n\s*playsinline\s*\n\s*preload="metadata"\s*\n\s*disablepictureinpicture\s*\n\s*aria-hidden="true"/);
    // comment-stripped: no autoplay attribute, no native controls attribute
    const stripped = hero.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
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

describe('/ — the §4.23.D content over the video (the plain-flow row vs the phone stack)', () => {
  it('desktop ≥720px: the lead glass panel (column 1) and the agent card (column 2, 360px cap) share one plain-flow row; the §4.22.B overlay geometry is retired (§4.23.E.1)', () => {
    const css = source('src/routes/+page.svelte');
    // the plain-flow row: minmax(0,1fr) / 360px, top-aligned
    expect(css).toMatch(
      /@media \(min-width: 720px\)[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) 360px/
    );
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.stage\s*\{[^}]*align-items:\s*start/);
    // the lead panel in column 1, the agent card in column 2
    expect(css).toMatch(/\.area-lead\s*\{[^}]*grid-column:\s*1/);
    expect(css).toMatch(/\.area-agents\s*\{[^}]*grid-column:\s*2/);
    // §4.23.E.1: the video-row overlay grid is gone — no 27%/1fr/26%
    // bands, no .area-video slot, no aspect-ratio stage
    expect(css).not.toMatch(/27% minmax|26%/);
    expect(css).not.toMatch(/\.area-video/);
    expect(css).not.toMatch(/\.area-chat/);
  });

  it('PHONE: the DOM-order stack over the video background (§4.23.E.2 — everything overlays now) with no horizontal scroll at 320px', () => {
    const css = source('src/routes/+page.svelte');
    // base canvas + stage = one column (flex); the DOM order IS the mobile order
    expect(css).toMatch(/\.canvas\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.stage\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    const order = ['area-lead', 'area-agents', 'area-stat', 'area-tutorial', 'area-foot'];
    const positions = order.map((name) => css.indexOf(name, css.indexOf('<main')));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // the overlay positioning exists ONLY inside the ≥720px media query —
    // the base .stage rule is the plain flex column (no grid, no overlay)
    const baseStage = css.match(/\.stage\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    expect(baseStage).toMatch(/display:\s*flex/);
    expect(baseStage).not.toMatch(/grid|position/);
    // the canvas is capped at the 1000px desktop width
    expect(css).toMatch(/max-width:\s*1000px/);
    // the fixed video layer is viewport-sized (width 100% — no overflow
    // at 320px; the layer itself never scrolls)
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(/\.video\s*\{[^}]*width:\s*100%/);
    expect(hero).toMatch(/\.video\s*\{[^}]*position:\s*fixed/);
  });

  it('the fixed video layer is a decorative aria-hidden div — NO region role, NO accessible name (§4.23.E.6); the lead panel is glass (§4.23.D)', () => {
    const { container } = render(LandingPage, { props: {} });
    const layer = container.querySelector('.video-layer');
    expect(layer?.getAttribute('aria-hidden')).toBe('true');
    // the §4.22.H named-region contract is retired: no region anywhere
    expect(screen.queryByRole('region')).toBeNull();
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).not.toMatch(/<section/);
    expect(hero).not.toMatch(/aria-label=/);
    // the lead glass panel carries the glass class (the shared recipe)
    expect(container.querySelector('.copy.glass')).toBeTruthy();
    const page = source('src/routes/+page.svelte');
    expect(page).toMatch(/\.copy[^{]*\{[^}]*max-width:\s*560px/);
    expect(page).toMatch(/@media \(min-width: 720px\)[\s\S]*?\.copy\s*\{[^}]*width:\s*fit-content/);
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

  it('the landing cast: two DISTINCT figures — BLEAK (card only), BLOOM (stat only) — no figure appears twice (§4.22.I as reduced by §4.22.1)', () => {
    const { container } = render(LandingPage, { props: {} });
    const kinds = [...container.querySelectorAll('[data-figure]')].map(
      (el) => el.getAttribute('data-figure')
    );
    for (const kind of ['bleak', 'bloom']) {
      expect(kinds, `${kind} on the page`).toContain(kind);
    }
    for (const kind of ['byte', 'nova', 'astra', 'pip', 'glitch']) {
      expect(kinds).not.toContain(kind);
    }
    // each region carries its own figure — one node per figure on the page
    for (const kind of ['bleak', 'bloom']) {
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
    // the 1000px canvas centered inside the full-bleed wrapper
    expect(page).toMatch(/\.landing\s*\{[^}]*max-width:\s*1000px[^}]*margin:\s*0 auto/);
  });

  it('no new hex anywhere in the landing sources; the accent is the approved violet token', () => {
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(withoutComments, `${file} carries a raw hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
    const page = source('src/routes/+page.svelte');
    expect(page).toMatch(/var\(--color-deepa-4\)/);
    expect(page).not.toMatch(/--color-accent/);
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

  it('renders the stat card compact (§4.21.F): minimized padding, 17px title, 44/48px BLOOM', () => {
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
    expect(css).toMatch(/\.stat-title\s*\{[^}]*font-size:\s*17px/);
    expect(css).toMatch(/\.stat-line\s*\{[^}]*font-size:\s*13px/);
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

  it('three separate step blocks, each with the pixel step number, the pixel-font title, the step icon and a mini description (§4.21.E intact)', () => {
    const { container } = render(LandingPage, { props: {} });
    const blocks = [...container.querySelectorAll('#tutorial .step-block')];
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
    expect(container.querySelectorAll('#tutorial button, #tutorial a')).toHaveLength(0);
    expect(container.querySelectorAll('#tutorial .chevron')).toHaveLength(0);
  });

  it('steps layout: phone stacked (--space-5 gaps) / desktop equal thirds (~300px min-height) — §4.21.E intact', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.steps\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.steps\s*\{[^}]*gap:\s*var\(--space-5\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.steps\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.step-block \.step-body\s*\{[^}]*min-height:\s*300px/);
  });

  it('renders ONE site contact block: the kept copyright row + EMAIL/GITHUB links (§4.21.G intact)', () => {
    const { container } = render(LandingPage, { props: {} });
    const contact = container.querySelector('.contact');
    expect(contact?.tagName).toBe('FOOTER');
    expect(contact?.className).toContain('pixel-frame--strong');
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

describe('/ — RU/EN parity (the 23 §4.20.M+§4.21.H+§4.22.H+§4.23.F keys, the working switch)', () => {
  it('every landing key exists in BOTH dictionaries, non-empty — and the dead keys exist in NEITHER', () => {
    expect(LANDING_KEYS).toHaveLength(23);
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
