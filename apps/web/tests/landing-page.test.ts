/** Landing page tests (tz12-06, Concept §31+§32+§33+§34, DESIGN §4.22 as
 * amending §4.21/§4.20): `/` gets the §4.22 video-hero batch — the slimmed
 * header (web icon + desktop nav anchors + language switcher ONLY; the
 * taglines and the header START controls removed), the video block
 * (LandingVideoHero: the committed mp4 app asset, full common-block width,
 * the decisive attribute set with the reduced-motion-gated one-shot start,
 * the play control, the failure degradation), the desktop overlay geometry
 * (lead 27% / agents 26% floating over the video's dark edges; NO overlay
 * on phone), the reminder-box contract migration (bottom-fixed inside the
 * video block, 1:3.5, bob, check mark, the §4.22.C center-band desktop
 * cap), the BLEAK rename (no agent-name leftovers on the landing), the
 * black page background + dissolve, and the §4.22.G supersessions (the
 * still image + the drawn hero pair + the ghost income mascot retired), and
 * the §4.22.1 owner amendment (Concept §34 record): the mascot-chat strip
 * is retired — its component, timeline module, figure data, i18n keys and
 * tests removed; the video's own cast is the only animated center content.
 * Still in force: routes, Start → /income (6-digit), RU/EN parity (29
 * keys), three step blocks, removed blocks stay removed, deep links. */
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

/** The 29 §4.20.M + §4.21.H + §4.22.H keys (as reduced by the §4.22.1
 * chat-strip retirement) — every landing string, RU/EN parity. */
const LANDING_KEYS = [
  'landing.headline.1',
  'landing.headline.2',
  'landing.headline.accent',
  'landing.sub',
  'landing.cta',
  'landing.dialog.line1',
  'landing.dialog.line2',
  'landing.dialog.line3',
  'landing.video.aria',
  'landing.video.play',
  'landing.video.pause',
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
 * chat-strip keys — in NEITHER dictionary. */
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
  'landing.chat.aria'
] as const;

const LANDING_SOURCES = [
  'src/routes/+page.svelte',
  'src/lib/components/landing/LandingVideoHero.svelte',
  'src/lib/components/landing/LandingReminder.svelte',
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

describe('/ — the §4.22.A slimmed header (icon + nav + switcher ONLY)', () => {
  it('renders exactly: the plate-less web icon (cutouts in --color-landing-bg), the two in-page anchors (desktop-only) and the LocaleControl', () => {
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
    // one non-sticky row (no position: sticky/fixed in the header rules)
    expect(css).not.toMatch(/\.top\s*\{[^}]*position:\s*(sticky|fixed)/);
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

  it('the block spans the full common-block width with aspect-ratio 16/9 (no fixed 500/680px height) and object-fit: cover', () => {
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(css).toMatch(/\.video-block\s*\{[^}]*width:\s*100%/);
    expect(css).toMatch(/\.video-block\s*\{[^}]*aspect-ratio:\s*16\s*\/\s*9/);
    expect(css).toMatch(/\.video\s*\{[^}]*object-fit:\s*cover/);
    expect(css).toMatch(/\.video\s*\{[^}]*width:\s*100%[^}]*height:\s*100%/);
    // the §4.21.B fixed art-block heights are superseded — no px height
    expect(css).not.toMatch(/height:\s*(500|680)px/);
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

  it('autoplay is GATED: the one-shot mount effect checks prefers-reduced-motion — under reduce the video stays paused and the play control offers the opt-in', async () => {
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(
      /prefers-reduced-motion:\s*reduce/);
    expect(hero).toMatch(/\.play\(\)/);
    // behavior: under reduced motion the video is not started — the play
    // control is visible with the play label
    // behavior: under reduced motion the video is not started — the play
    // control is visible with the play label
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
    const control = container.querySelector<HTMLButtonElement>('button.play');
    expect(control).toBeTruthy();
    expect(control?.classList.contains('play-hidden')).toBe(false);
    expect(control?.getAttribute('aria-label')).toBe(ru['landing.video.play']);
  });

  it('the play control: visible when playback is not running, hidden while playing, toggles; 48px target + focus ring; the pause label swaps in while playing', async () => {
    const { container } = render(LandingPage, { props: {} });
    await waitFor(() => {
      // without reduced motion the mount effect started playback — the
      // control hides while playing (happy-dom fires 'play' synchronously)
      const hidden = container.querySelector('button.play');
      expect(hidden?.classList.contains('play-hidden')).toBe(true);
    });
    const video = container.querySelector('video.video') as HTMLVideoElement;
    // pause → the control returns with the play label; click toggles back
    video.pause();
    await tick();
    const control = container.querySelector<HTMLButtonElement>('button.play');
    expect(control?.classList.contains('play-hidden')).toBe(false);
    expect(control?.getAttribute('aria-label')).toBe(ru['landing.video.play']);
    await control?.click();
    await tick();
    expect(video.paused).toBe(false);
    expect(control?.classList.contains('play-hidden')).toBe(true);
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    // 48px target, bottom-right 16px insets, scrim chip, muted→text hover,
    // focus ring; the pause label exists for the playing state
    expect(css).toMatch(/\.play\s*\{[^}]*width:\s*48px[^}]*height:\s*48px/);
    expect(css).toMatch(/right:\s*16px/);
    expect(css).toMatch(
      /background:\s*color-mix\(in srgb, var\(--color-landing-bg\) 60%, transparent\)/
    );
    expect(css).toMatch(/color:\s*var\(--color-text-muted\)/);
    expect(css).toMatch(/\.play:hover\s*\{[^}]*color:\s*var\(--color-text\)/);
    expect(css).toMatch(/\.play:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--color-deepa-4\)/);
    expect(css).toMatch(/\.play-hidden\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/aria-label=\{playing \? pauseLabel : playLabel\}/);
  });

  it('failure degradation: on the video error event the element hides — the block degrades to the landing-bg tint + the animated dots + the reminder (no glyph, no blank box, no layout shift)', async () => {
    const { container } = render(LandingPage, { props: {} });
    await tick();
    const block = container.querySelector('.video-block');
    expect(block).toBeTruthy();
    // the base tint is the page token (seamless pre-load + failure state)
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(css).toMatch(/\.video-block\s*\{[^}]*background:\s*var\(--color-landing-bg\)/);
    // the aspect-ratio box is fixed before the media arrives (no shift)
    expect(css).toMatch(/aspect-ratio:\s*16\s*\/\s*9/);
    expect(css).toMatch(/\.video-failed\s*\{[^}]*display:\s*none/);
    // fire the error event — the element hides, the block keeps running
    const video = container.querySelector('video.video') as HTMLVideoElement;
    video.dispatchEvent(new Event('error'));
    await tick();
    expect(video.className).toContain('video-failed');
    expect(block?.querySelectorAll('.dot')).toHaveLength(12);
    expect(block?.querySelector('.reminder')).toBeTruthy();
    // no poster attribute anywhere (the tint IS the pre/fallback state)
    expect(css).not.toMatch(/poster=/);
  });

  it('the animated purple pixels are kept verbatim: 12 pixel dots, three alpha shades, steps(2) twinkle with staggered delays — re-anchored over the video', () => {
    const { container } = render(LandingPage, { props: {} });
    const block = container.querySelector('.video-block');
    const dots = [...(block?.querySelectorAll('.dot') ?? [])];
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

  it('the dissolve (§4.22.F): the radial vignette outer stop is re-pointed to --color-landing-bg — no hard edge where the video meets the page', () => {
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(css).toMatch(
      /radial-gradient\(\s*ellipse 80% 78% at 50% 46%,\s*transparent 0 52%,\s*color-mix\(in srgb, var\(--color-landing-bg\) 45%, transparent\) 72%,\s*var\(--color-landing-bg\) 100%/
    );
    expect(css).toMatch(/pointer-events:\s*none/);
  });
});

describe('/ — the §4.22.B desktop overlay geometry (≥720px) vs the phone stack', () => {
  it('desktop: the lead block (27%) overlays the video LEFT edge and the agent card (26%) the RIGHT edge — both above the video (z-order), vertically centered on it; the chat-strip slot is retired (§4.22.1)', () => {
    const css = source('src/routes/+page.svelte');
    // the common-block grid: 27% / 1fr / 26% (the §4.21.D band, reused)
    expect(css).toMatch(
      /@media \(min-width: 720px\)[\s\S]*grid-template-columns:\s*27% minmax\(0, 1fr\) 26%/
    );
    // the video spans the WHOLE width (row 1, columns 1..end), z 0
    expect(css).toMatch(/\.area-video\s*\{[^}]*grid-column:\s*1 \/ -1[^}]*grid-row:\s*1[^}]*z-index:\s*0/);
    // the overlays sit in row 1 (the video's row → vertically centered on
    // the video via align-items: center), above the video (z 2)
    expect(css).toMatch(/\.area-lead\s*\{[^}]*grid-column:\s*1[^}]*grid-row:\s*1[^}]*z-index:\s*2/);
    expect(css).toMatch(/\.area-agents\s*\{[^}]*grid-column:\s*3[^}]*grid-row:\s*1[^}]*z-index:\s*2/);
    expect(css).toMatch(/\.stage\s*\{[^}]*align-items:\s*center/);
    // §4.22.1: the strip's desktop slot (row 2, right-aligned 280px) is gone
    expect(css).not.toMatch(/\.area-chat/);
    // the hero overlays are width-banded exactly like §4.22.B (27% / 26%)
    expect(css).toMatch(/grid-template-columns:\s*27%/);
    expect(css).toMatch(/26%/);
  });

  it('PHONE: NO overlay — the exact §4.20.K stack as reduced by §4.22.1 (video full-width, blocks stacked below) with no horizontal scroll at 320px', () => {
    const css = source('src/routes/+page.svelte');
    // base canvas + stage = one column (flex); the DOM order IS the mobile order
    expect(css).toMatch(/\.canvas\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.stage\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    const order = ['area-lead', 'area-video', 'area-agents', 'area-stat', 'area-tutorial', 'area-foot'];
    const positions = order.map((name) => css.indexOf(name, css.indexOf('<main')));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // the overlay positioning exists ONLY inside the ≥720px media query —
    // the base .stage rule is the plain flex column (no grid, no overlay)
    const baseStage = css.match(/\.stage\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    expect(baseStage).toMatch(/display:\s*flex/);
    expect(baseStage).not.toMatch(/grid|position/);
    // no fixed widths outside the strip slot at phone widths (the slot is
    // retired, §4.22.1); the canvas is capped at the 1000px desktop width
    expect(css).toMatch(/max-width:\s*1000px/);
    // the video block is full-width and overflow-guarded (no scroll at 320px)
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(/\.video-block\s*\{[^}]*width:\s*100%/);
    expect(hero).toMatch(/\.video-block\s*\{[^}]*overflow:\s*hidden/);
  });

  it('the §4.22.B video block is a named region (landing.video.aria) and the reminder lives INSIDE it, bottom-fixed', () => {
    render(LandingPage, { props: {} });
    const block = screen.getByRole('region', { name: ru['landing.video.aria'] });
    expect(block.querySelector('.reminder')).toBeTruthy();
    expect(block.querySelector('video')).toBeTruthy();
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/\.reminder\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.reminder\s*\{[^}]*bottom:\s*16px/);
  });
});

describe('/ — the §4.22.C reminder-box migration (contracts verbatim, one width-cap amendment)', () => {
  it('proportions = 1 : 3.5 (height:width) with the §4.22.C caps: phone min(100% - 32px, 256px) unchanged; desktop the 47%−48px center-band cap ≤348px', () => {
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/aspect-ratio:\s*3\.5\s*\/\s*1/);
    expect(css).toMatch(/min-height:\s*64px/);
    // the cap lives on the block (§4.22.C) and the box consumes it
    const hero = source('src/lib/components/landing/LandingVideoHero.svelte');
    expect(hero).toMatch(/--reminder-w:\s*min\(100% - 32px, 256px\)/);
    expect(hero).toMatch(/--reminder-w:\s*min\(calc\(47% - 48px\), 348px\)/);
    expect(css).toMatch(/width:\s*var\(--reminder-w, min\(100% - 32px, 256px\)\)/);
    // centered without transforms (transform is reserved for the bob)
    expect(css).toMatch(/left:\s*0/);
    expect(css).toMatch(/right:\s*0/);
    expect(css).toMatch(/margin-inline:\s*auto/);
    // the block exposes the resolved height (the play control's phone
    // geometry consumes it)
    expect(hero).toMatch(/--reminder-h:\s*calc\(var\(--reminder-w\) \/ 3\.5\)/);
  });

  it('the desktop cap keeps the §33.2.2 no-overlay rule against the new flanking overlays — the reminder x-band never enters either side band at 720/760/1280', () => {
    // verified per §4.22.C: block width → cap → centered band vs the
    // 27% / 26% overlay bands
    const check = (blockWidth: number): boolean => {
      const cap = Math.min((47 / 100) * blockWidth - 48, 348);
      const left = (blockWidth - cap) / 2;
      const leadBand = 0.27 * blockWidth;
      const agentBandStart = 0.74 * blockWidth;
      return left > leadBand && left + cap < agentBandStart;
    };
    // 720/760px viewports: the block is the canvas minus 2×48px padding
    expect(check(720 - 96)).toBe(true);
    expect(check(760 - 96)).toBe(true);
    // 1280px: the canvas caps at 1000px → block = 1000 − 96 = 904
    expect(check(904)).toBe(true);
    // phone cap unchanged — the reminder stays inside the block's padding
    // box (16px side insets) at 320px: block = 320 − 2×16 = 288 →
    // min(288 − 32, 256) = 256px
    const blockAt320 = 320 - 32;
    expect(Math.min(blockAt320 - 32, 256)).toBe(256);
  });

  it('the message font is PIXEL (Handjet stack), horizontally centered', () => {
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/font-family:\s*var\(--font-pixel\)/);
    expect(css).toMatch(/font-size:\s*16px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.reminder-line\s*\{[^}]*font-size:\s*18px/);
    expect(css).toMatch(/text-align:\s*center/);
    expect(css).toMatch(/letter-spacing:\s*0\.05em/);
    expect(css).toMatch(/line-height:\s*1\.3/);
    expect(css).toMatch(/padding:\s*12px 20px/);
  });

  it('keeps the cycling copy: 3 asterisk lines (200ms cross-fade inside the 12s loop) + the sr-only static line', () => {
    const { container } = render(LandingPage, { props: {} });
    const lines = [...container.querySelectorAll('.reminder-line')];
    expect(lines.map((l) => l.textContent)).toEqual([
      ru['landing.dialog.line1'],
      ru['landing.dialog.line2'],
      ru['landing.dialog.line3']
    ]);
    expect(container.querySelector('.reminder-stage')?.getAttribute('aria-hidden')).toBe('true');
    const srLine = container.querySelector('.reminder .sr-only');
    expect(srLine?.textContent).toBe(ru['landing.dialog.line1']);
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/reminder-line 12s linear infinite/);
    expect(css).toMatch(/animation-delay:\s*calc\(var\(--i, 0\) \* 4s\)/);
  });

  it('the 24px pixel sparkle emoji overlaps the top-left corner at (−10, −10) and twinkles', () => {
    const { container } = render(LandingPage, { props: {} });
    const spark = container.querySelector('.reminder .spark svg');
    expect(spark).toBeTruthy();
    expect(spark?.getAttribute('width')).toBe('24');
    expect(spark?.getAttribute('height')).toBe('24');
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/top:\s*-10px/);
    expect(css).toMatch(/left:\s*-10px/);
    expect(css).toMatch(/spark-twinkle 1\.6s steps\(2\) infinite/);
    expect(spark?.querySelectorAll('rect')).toHaveLength(14);
  });

  it('the check mark is bigger + more visible: ≥20px pixel check, bottom-center half-out, pulsing accent glow', () => {
    const { container } = render(LandingPage, { props: {} });
    const check = container.querySelector('.reminder .check svg');
    expect(check).toBeTruthy();
    expect(check?.getAttribute('width')).toBe('24');
    expect(check?.getAttribute('height')).toBe('24');
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/@media \(max-width: 719\.98px\)\s*\{[\s\S]*?\.check svg\s*\{[^}]*width:\s*20px/);
    expect(css).toMatch(/bottom:\s*0/);
    expect(css).toMatch(/transform:\s*translate\(-50%, 50%\)/);
    expect(css).toMatch(/check-glow 1\.6s steps\(2\) infinite alternate/);
    expect(css).toMatch(/drop-shadow\(0 0 6px color-mix\(in srgb, var\(--color-deepa-4\) 60%, transparent\)\)/);
    const glint = check?.querySelector('rect[fill="var(--color-text)"]');
    expect(glint?.getAttribute('x')).toBe('4');
    expect(glint?.getAttribute('y')).toBe('8');
  });

  it('the up-and-down movement: translateY 0→−6px mobile / −10px desktop, 3s ease-in-out infinite, transform-only; static under reduced motion', () => {
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/reminder-bob 3s ease-in-out infinite/);
    expect(css).toMatch(/--bob-amp:\s*6px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.reminder\s*\{[^}]*--bob-amp:\s*10px/);
    expect(css).toMatch(/transform:\s*translateY\(calc\(-1 \* var\(--bob-amp, 6px\)\)\)/);
    const reduced = css.match(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*\}/)?.[0] ?? '';
    expect(reduced).toMatch(/\.reminder\s*\{[^}]*animation:\s*none/);
    expect(reduced).toMatch(/\.spark,\s*\.check\s*\{[^}]*animation:\s*none/);
    expect(reduced).toMatch(/\.reminder-line\s*\{[^}]*animation:\s*none[^}]*position:\s*static[^}]*opacity:\s*1/);
  });

  it('the play control never overlaps the reminder band: 16px bottom insets on desktop (the 348px cap clears it); on phone the control rises above the reminder top edge', () => {
    const css = source('src/lib/components/landing/LandingVideoHero.svelte');
    // desktop: bottom 16px, right 16px — the capped reminder's centered
    // band leaves the right corner free at every tested width
    expect(css).toMatch(/right:\s*16px/);
    expect(css).toMatch(/bottom:\s*16px/);
    // phone: the verbatim 256px reminder spans nearly the whole 16:9
    // block, so the control rises above its top edge (the §4.22.C/AC-7
    // never-overlap rule wins at 320/390)
    expect(css).toMatch(
      /@media \(max-width: 719\.98px\)\s*\{[\s\S]*?\.play\s*\{[^}]*bottom:\s*calc\(16px \+ var\(--reminder-h\)\)/
    );
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
    // landing.hero.aria is retired with the pair; the video block carries
    // landing.video.aria
    for (const key of DEAD_KEYS) {
      expect(ru).not.toHaveProperty(key);
      expect(en).not.toHaveProperty(key);
    }
    expect(ru['landing.video.aria']).toBeTruthy();
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

describe('/ — RU/EN parity (the 29 §4.20.M+§4.21.H+§4.22.H keys as reduced by §4.22.1, the working switch)', () => {
  it('every landing key exists in BOTH dictionaries, non-empty — and the dead keys exist in NEITHER', () => {
    expect(LANDING_KEYS).toHaveLength(29);
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

  it('verbatim §4.22.H copy in both languages (video keys + the rename)', () => {
    expect(ru['landing.video.aria']).toBe(
      'Видео: двое у фиолетового города под светящимся приветствием'
    );
    expect(en['landing.video.aria']).toBe(
      'Video: two figures before a violet city under a glowing hello'
    );
    expect(ru['landing.video.play']).toBe('Запустить видео');
    expect(en['landing.video.play']).toBe('Play video');
    expect(ru['landing.video.pause']).toBe('Поставить на паузу');
    expect(en['landing.video.pause']).toBe('Pause video');
    expect(ru['landing.agent.name']).toBe('БЛИК');
    expect(en['landing.agent.name']).toBe('BLEAK');
  });

  it('the switch re-renders EVERY landing string (headline, accent word, video labels, reminder lines, cards, steps, footer labels) without a reload', async () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.accent-word')?.textContent?.trim()).toBe(
      ru['landing.headline.accent']
    );
    expect(container.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    const playButton = container.querySelector('button.play');
    // the video starts on mount (no reduced motion) — the label is the
    // playing-state one; either §4.22.H label is locale-correct here
    expect([ru['landing.video.play'], ru['landing.video.pause']]).toContain(
      playButton?.getAttribute('aria-label')
    );
    // flip to EN through the shared store — the same DOM re-renders
    setLocale('en');
    await tick();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain(en['landing.headline.1']);
    expect(h1.textContent).toContain(en['landing.headline.accent']);
    expect(container.querySelector('.sub')?.textContent).toBe(en['landing.sub']);
    expect(container.querySelector('.agent-name')?.textContent).toBe(en['landing.agent.name']);
    expect(container.querySelector('.stat-title')?.textContent).toBe(en['landing.stat.title']);
    expect(container.textContent).toContain(en['landing.dialog.line3']);
    const videoRegion = screen.getByRole('region', { name: en['landing.video.aria'] });
    expect(videoRegion).toBeTruthy();
    expect(
      videoRegion.querySelector('button.play')?.getAttribute('aria-label') ===
        en['landing.video.play'] ||
        videoRegion.querySelector('button.play')?.getAttribute('aria-label') ===
          en['landing.video.pause']
    ).toBe(true);
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
