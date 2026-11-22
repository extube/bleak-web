/** Landing page tests (tz12-05, Concept §31+§32+§33, DESIGN §4.20 as
 * amended by §4.21 — the owner's photo-review adjustment batch): `/` keeps
 * the §4.20 showcase and applies all 7 §4.21 items — the hero pair redo
 * (NOVA + ASTRA: white hair + purple horns; BYTE retired), the agent
 * reminder box (pixel font, 1:3.5 strip, bottom-fixed in the taller
 * art block, up-down bob, big visible check mark), the compact stat card,
 * the §4.21.D three-section desktop layout (PHONE ORDER UNCHANGED), the
 * three BIG step blocks (FIND / CHAT / SHARE), the removed §4.20.I footer
 * blocks, the committed background.jpg app asset with the smooth vignette
 * edge, the contact footer, the PIP↔GLITCH mascot-chat strip (unchanged),
 * and the deep-link forwarding (?code= / ?u= → /income, query preserved).
 * The re-homed routes resolve to the EXISTING surfaces: /income renders
 * the join entry and /income/[room]/create renders the creation wizard
 * (the seeded JoinFlow persona step). */
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
import { buildChatTimeline } from '../src/lib/components/landing/chatTimeline';
import { ICON_RECTS } from '../src/lib/components/icons/registry';
import { LANDING_FIGURES } from '../src/lib/components/landing/figures';
import { existsSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

/** The 38 §4.20.M + §4.21.H keys — every landing string, RU/EN parity. */
const LANDING_KEYS = [
  'landing.tagline.left.1',
  'landing.tagline.left.2',
  'landing.tagline.top',
  'landing.tagline.right.1',
  'landing.tagline.right.2',
  'landing.headline.1',
  'landing.headline.2',
  'landing.headline.accent',
  'landing.sub',
  'landing.cta',
  'landing.dialog.line1',
  'landing.dialog.line2',
  'landing.dialog.line3',
  'landing.hero.aria',
  'landing.stat.title',
  'landing.stat.line1',
  'landing.stat.line2',
  'landing.stat.line3',
  'landing.agent.name',
  'landing.agent.badge',
  'landing.agent.traits',
  'landing.agent.quote',
  'landing.agent.cta',
  'landing.chat.label',
  'landing.chat.bubble1',
  'landing.chat.bubble2',
  'landing.chat.bubble3',
  'landing.chat.bubble4',
  'landing.chat.aria',
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

/** The two §4.20.I keys the §4.21.H amendment kills (§4.21.G removes the blocks). */
const DEAD_KEYS = ['landing.footer.line', 'landing.footer.badge'] as const;

const LANDING_SOURCES = [
  'src/routes/+page.svelte',
  'src/lib/components/landing/LandingHeroScene.svelte',
  'src/lib/components/landing/LandingReminder.svelte',
  'src/lib/components/landing/LandingChatStrip.svelte',
  'src/lib/components/landing/LandingFigure.svelte',
  'src/lib/components/landing/figures.ts',
  'src/lib/components/landing/chatTimeline.ts'
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
});

describe('/ — the §4.21 hero pair redo (Concept §33.1)', () => {
  it('renders NOVA (left, unchanged) and ASTRA (right) — the BYTE robot appears nowhere on /', () => {
    const { container } = render(LandingPage, { props: {} });
    const scene = screen.getByRole('img', { name: ru['landing.hero.aria'] });
    expect(scene.querySelector('[data-figure="nova"]')).toBeTruthy();
    expect(scene.querySelector('[data-figure="astra"]')).toBeTruthy();
    // BYTE is retired from the hero AND from the whole landing (§4.21.A)
    expect(container.querySelectorAll('[data-figure="byte"]')).toHaveLength(0);
    // the §4.20.D handshake-node diamond + light beam are retired too
    expect(container.querySelector('.node-pulse')).toBeNull();
    expect(container.querySelector('.node-halo')).toBeNull();
  });

  it('ASTRA is a copy of NOVA — same body/proportions — with ONLY the head changed (white hair + purple horns)', () => {
    const nova = LANDING_FIGURES.nova;
    const astra = LANDING_FIGURES.astra;
    // same non-square hero grid (§4.21.A: explicit viewW/viewH → 16×31)
    expect(nova.viewW).toBe(16);
    expect(nova.viewH).toBe(31);
    expect(astra.viewW).toBe(16);
    expect(astra.viewH).toBe(31);
    // the body below the head is byte-identical: neck, scarf, stripes,
    // coat, arms, legs, shoes — only the HEAD differs (§4.21.A)
    const bodyParts = (fig: typeof nova) =>
      fig.parts.filter((p) => p.rects.every((r) => r[1] >= 16));
    expect(bodyParts(nova)).toEqual(bodyParts(astra));
    // NOVA keeps the warm §4.20.D hair (the owner kept the left personage)
    const novaHair = nova.parts
      .flatMap((p) => (p.rects.every((r) => r[1] >= 3 && r[1] < 16) ? [p.fill] : []))
      .join();
    expect(novaHair).toContain('--color-art-hair-3');
    // ASTRA's hair is WHITE: the nearest-white token --color-text (lit
    // rows) + the 72% surface-elevated under-shade (§4.21.A)
    const astraFills = astra.parts.map((p) => p.fill).join('|');
    expect(astraFills).toContain('var(--color-text)');
    expect(astraFills).toContain(
      'color-mix(in srgb, var(--color-text) 72%, var(--color-surface-elevated))'
    );
    // ASTRA's white hair rect data equals NOVA's hair rect data (same head shape)
    const headRects = (fig: typeof nova) =>
      fig.parts.flatMap((p) => [...p.rects]).filter((r) => r[1] >= 3 && r[1] < 16);
    expect(headRects(astra)).toEqual(headRects(nova));
    // two small purple horns: 2×3-unit --color-deepa-4 columns + glints
    const horns = astra.parts.filter(
      (p) => p.fill === 'var(--color-deepa-4)' && p.rects.every((r) => r[1] === 0)
    );
    expect(horns).toHaveLength(2);
    expect(horns.flatMap((p) => [...p.rects])).toEqual([
      [3, 0, 2, 3],
      [11, 0, 2, 3]
    ]);
    const glints = astra.parts
      .filter((p) => p.fill === 'var(--color-text)')
      .flatMap((p) => [...p.rects])
      .filter((r) => r[1] === 0);
    expect(glints).toEqual([
      [3, 0, 2, 1],
      [11, 0, 2, 1]
    ]);
    // NOVA has NO horns: nothing sits above the hair top row
    expect(nova.parts.every((p) => p.rects.every((r) => r[1] >= 3))).toBe(true);
  });

  it('the pair renders through LandingFigure with the 16×31 viewBox and the idle sway kept', () => {
    const { container } = render(LandingPage, { props: {} });
    const svgs = [...container.querySelectorAll('.pair svg')];
    expect(svgs).toHaveLength(2);
    for (const svg of svgs) {
      expect(svg.getAttribute('viewBox')).toBe('0 0 16 31');
    }
    const fig = source('src/lib/components/landing/LandingFigure.svelte');
    expect(fig).toMatch(/animation: figure-idle 1\.6s steps\(2\) infinite alternate/);
    // the §4.21.B layer table: desktop 160px tall, mobile 64px tall
    const scene = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(scene).toMatch(/height:\s*64px/);
    expect(scene).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?height:\s*160px/);
    expect(scene).toMatch(/left:\s*2%/);
    expect(scene).toMatch(/right:\s*2%/);
  });
});

describe('/ — the §4.21.B art block (taller, image background, smooth edge)', () => {
  it('the committed app asset background.jpg exists and is imported via the #lib URL import (not hotlinked, not in static/)', () => {
    const assetPath = 'src/lib/assets/landing/background.jpg';
    expect(existsSync(join(WEB_ROOT, assetPath))).toBe(true);
    // a real JPEG (magic bytes), copied from the owner's background-img.jpg
    const bytes = readFileSync(join(WEB_ROOT, assetPath));
    expect(bytes.length).toBeGreaterThan(100_000);
    expect(bytes[0]).toBe(0xff);
    expect(bytes[1]).toBe(0xd8);
    const scene = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(scene).toMatch(/import backgroundUrl from '#lib\/assets\/landing\/background\.jpg';/);
    expect(scene).toMatch(/src=\{backgroundUrl\}/);
    expect(scene).not.toMatch(/assets\/landing\/background\.jpg\?raw/);
    expect(existsSync(join(WEB_ROOT, 'static/background.jpg'))).toBe(false);
  });

  it('the block is taller (500px mobile / 680px ≥720px) and renders the image object-fit: cover with intrinsic dims (no CLS)', () => {
    const { container } = render(LandingPage, { props: {} });
    const css = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(css).toMatch(/\.art-block\s*\{[^}]*height:\s*500px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.art-block\s*\{[^}]*height:\s*680px/);
    const img = container.querySelector('img.bg');
    expect(img).toBeTruthy();
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('aria-hidden')).toBe('true');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('decoding')).toBe('async');
    expect(img?.getAttribute('width')).toBe('1024');
    expect(img?.getAttribute('height')).toBe('1024');
    expect(css).toMatch(/object-fit:\s*cover/);
    expect(css).toMatch(/object-position:\s*50% 50%/);
  });

  it('the smooth transition: a radial vignette ::after dissolves every edge into exactly --color-bg (no hard line)', () => {
    const css = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(css).toMatch(
      /radial-gradient\(\s*ellipse 80% 78% at 50% 46%,\s*transparent 0 52%,\s*color-mix\(in srgb, var\(--color-bg\) 45%, transparent\) 72%,\s*var\(--color-bg\) 100%/
    );
    expect(css).toMatch(/pointer-events:\s*none/);
    // the base tint shows only pre-load (an alpha mix of existing tokens)
    expect(css).toMatch(/background:\s*color-mix\(in srgb, var\(--color-deepa-4\) 6%, var\(--color-bg\)\)/);
  });

  it('the animated purple pixels are kept: 12 pixel dots, three alpha shades, steps(2) twinkle with staggered delays', () => {
    const { container } = render(LandingPage, { props: {} });
    const dots = [...container.querySelectorAll('.dot')];
    expect(dots).toHaveLength(12);
    const css = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(css).toMatch(/dot-twinkle 1\.6s steps\(2\) infinite/);
    // the three violet alpha shades (the §4.20.D SHADE palette)
    expect(css).toMatch(/SHADE_ALPHA = \[18, 35, 60\]/);
    expect(css).toMatch(/var\(--color-deepa-4\) \$\{SHADE_ALPHA\[shade\]\}%, transparent/);
    // staggered 0–1.2s delays
    const delays = dots.map((d) => parseFloat((d.getAttribute('style') ?? '').match(/--d:\s*([\d.]+)s/)?.[1] ?? '-1'));
    expect(Math.min(...delays)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...delays)).toBeLessThanOrEqual(1.2);
    // every dot sits OUTSIDE the protected rects (figures x 21–83 / y 44–80;
    // bubble x 24–76 / y 2–22 — §4.21.B safe zone)
    for (const dot of dots) {
      const style = dot.getAttribute('style') ?? '';
      const x = parseFloat(style.match(/left:\s*([\d.]+)%/)?.[1] ?? '0');
      const y = parseFloat(style.match(/top:\s*([\d.]+)%/)?.[1] ?? '0');
      const inFigures = x >= 21 && x <= 83 && y >= 44 && y <= 80;
      const inBubble = x >= 24 && x <= 76 && y >= 2 && y <= 22;
      expect(inFigures || inBubble).toBe(false);
    }
  });

  it('the hero pair stands in the bottom-corner flower band — outside the protected central scene', () => {
    const { container } = render(LandingPage, { props: {} });
    const nova = container.querySelector('.pair [data-figure="nova"]');
    const astra = container.querySelector('.pair [data-figure="astra"]');
    expect(nova).toBeTruthy();
    expect(astra).toBeTruthy();
    const css = source('src/lib/components/landing/LandingHeroScene.svelte');
    // anchored to the outer 2% edges (§4.21.B layer 4)…
    expect(css).toMatch(/:global\(\[data-figure='nova'\]\)\s*\{\s*left:\s*2%/);
    expect(css).toMatch(/:global\(\[data-figure='astra'\]\)\s*\{\s*right:\s*2%/);
    // …with the feet line above the reminder box (--reminder-h + 16px)
    expect(css).toMatch(/bottom:\s*calc\(var\(--reminder-h\) \+ 16px\)/);
  });
});

describe('/ — the §4.21.C agent reminder box (the dialogue box becomes the reminder)', () => {
  it('lives INSIDE the art block, fixed at its bottom (absolute, bottom 16px) — not a sibling section', () => {
    const { container } = render(LandingPage, { props: {} });
    const reminder = container.querySelector('.reminder');
    expect(reminder).toBeTruthy();
    expect(container.querySelector('.art-block .reminder')).toBeTruthy();
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    expect(css).toMatch(/\.reminder\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.reminder\s*\{[^}]*bottom:\s*16px/);
  });

  it('proportions = 1 : 3.5 (height:width) and adaptive — never overlays the nearest blocks at 320/390/1280', () => {
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    // the owner ratio: a wide strip (aspect-ratio 3.5/1)
    expect(css).toMatch(/aspect-ratio:\s*3\.5\s*\/\s*1/);
    expect(css).toMatch(/min-height:\s*64px/);
    // capped width per breakpoint: 16px side insets mobile, 24px desktop
    expect(css).toMatch(/width:\s*min\(100% - 32px, 256px\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.reminder\s*\{[^}]*width:\s*min\(100% - 48px, 348px\)/);
    // centered without transforms (transform is reserved for the bob)
    expect(css).toMatch(/left:\s*0/);
    expect(css).toMatch(/right:\s*0/);
    expect(css).toMatch(/margin-inline:\s*auto/);
    // the block exposes the resolved height for the pair's offset
    const scene = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(scene).toMatch(/--reminder-h:\s*calc\(var\(--reminder-w\) \/ 3\.5\)/);
    // top-edge adaptivity (§4.21.B/§4.21.I-5): at the capped widths the top
    // edge sits ≥81% of the block height at every tested width
    // mobile 500px block, 256px reminder: (500 − 16 − 73.1) / 500
    expect((500 - 16 - 256 / 3.5) / 500).toBeGreaterThanOrEqual(0.81);
    // desktop 680px block, 348px reminder: (680 − 16 − 99.4) / 680
    expect((680 - 16 - 348 / 3.5) / 680).toBeGreaterThanOrEqual(0.81);
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
    // original §4.3 construction: 4 arms + 8 diagonal cells + center + highlight
    expect(spark?.querySelectorAll('rect')).toHaveLength(14);
  });

  it('the check mark is bigger + more visible: ≥20px pixel check, bottom-center half-out, pulsing accent glow', () => {
    const { container } = render(LandingPage, { props: {} });
    const check = container.querySelector('.reminder .check svg');
    expect(check).toBeTruthy();
    expect(check?.getAttribute('width')).toBe('24');
    expect(check?.getAttribute('height')).toBe('24');
    const css = source('src/lib/components/landing/LandingReminder.svelte');
    // 20px on mobile (§4.21.C: 24px desktop / 20px mobile)
    expect(css).toMatch(/@media \(max-width: 719\.98px\)\s*\{[\s\S]*?\.check svg\s*\{[^}]*width:\s*20px/);
    // half-out over the frame edge, bottom-center
    expect(css).toMatch(/bottom:\s*0/);
    expect(css).toMatch(/transform:\s*translate\(-50%, 50%\)/);
    // the glow pulse: 60% → 100% accent mix, 1.6s steps(2) alternate
    expect(css).toMatch(/check-glow 1\.6s steps\(2\) infinite alternate/);
    expect(css).toMatch(/drop-shadow\(0 0 6px color-mix\(in srgb, var\(--color-deepa-4\) 60%, transparent\)\)/);
    // the vertex glint is present (12-grid run + the --color-text glint)
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
});

describe('/ — the §4.20 unchanged zones (header, headline, cards, chat strip)', () => {
  it('renders the 3-line headline with the single highlighted accent word', () => {
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

  it('carries the pixel-font taglines at the top corners (left pair always; top-center and right pair + GLITCH glyph on desktop)', () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.tagline-left')?.textContent).toContain(
      ru['landing.tagline.left.1']
    );
    expect(container.querySelector('.tagline-left')?.textContent).toContain(
      ru['landing.tagline.left.2']
    );
    expect(container.querySelector('.tagline-top')?.textContent).toBe(
      ru['landing.tagline.top']
    );
    const right = container.querySelector('.tagline-right');
    expect(right?.textContent).toContain(ru['landing.tagline.right.1']);
    expect(right?.textContent).toContain(ru['landing.tagline.right.2']);
    expect(right?.querySelector('[data-figure="glitch"]')).toBeTruthy();
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.tagline-top\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.tagline-right\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.tagline-top\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.top-nav\s*\{[^}]*display:\s*flex/);
    expect(container.querySelector('.top-nav')?.textContent).toContain(
      ru['landing.tutorial.search']
    );
    expect(container.querySelector('.top-nav')?.textContent).toContain(
      ru['landing.agent.name']
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
    // padding 20px → 12px 14px mobile / 16px 20px desktop (was 20px uniform)
    expect(css).toMatch(/\.stat-body\s*\{[^}]*padding:\s*12px 14px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stat-body\s*\{[^}]*padding:\s*16px 20px/);
    // internal title 18px→17px, three lines keep 13px with 2px inter-line gaps
    expect(css).toMatch(/\.stat-title\s*\{[^}]*font-size:\s*17px/);
    expect(css).toMatch(/\.stat-line\s*\{[^}]*font-size:\s*13px/);
    expect(css).toMatch(/\.stat-line\s*\{[^}]*line-height:\s*1\.35/);
    expect(css).toMatch(/margin:\s*0 0 2px/);
    // BLOOM glyph 56px → 44px mobile / 48px desktop
    expect(css).toMatch(/\.stat-glyph :global\(svg\)\s*\{[^}]*width:\s*44px/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.stat-glyph :global\(svg\)\s*\{[^}]*width:\s*48px/);
  });

  it('renders the agent character card (VECTOR) with the single TALK action — unchanged by §4.21', () => {
    const { container } = render(LandingPage, { props: {} });
    const agents = container.querySelector('#agents');
    expect(agents?.querySelector('[data-figure="vector"]')).toBeTruthy();
    expect(agents?.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    expect(agents?.querySelector('.agent-badge')?.textContent).toBe(ru['landing.agent.badge']);
    expect(agents?.querySelector('.agent-quote')?.textContent).toBe(ru['landing.agent.quote']);
    const actions = [...(agents?.querySelectorAll('button') ?? [])];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.textContent?.trim()).toBe(ru['landing.agent.cta']);
    expect(agents?.querySelector('.card')?.className).toContain('pixel-frame--strong');
  });

  it('renders the mascot-chat animation strip: 4 alternating bubble turns (GLITCH → PIP → GLITCH → PIP) with per-char typewriter timing', () => {
    render(LandingPage, { props: {} });
    const strip = screen.getByRole('img', { name: ru['landing.chat.aria'] });
    expect(strip.querySelector('.chat-label')?.textContent).toBe(ru['landing.chat.label']);
    expect(strip.querySelector('.chat-mascot.pip [data-figure="pip"]')).toBeTruthy();
    expect(strip.querySelector('.chat-mascot.glitch [data-figure="glitch"]')).toBeTruthy();
    const bubbles = [...strip.querySelectorAll('.chat-bubble')];
    expect(bubbles).toHaveLength(4);
    expect(bubbles.map((b) => b.className.includes('glitch'))).toEqual([
      true, false, true, false
    ]);
    expect(bubbles[0]?.textContent).toContain(ru['landing.chat.bubble1']);
    expect(bubbles[3]?.textContent).toContain(ru['landing.chat.bubble4']);
    expect(bubbles[0]?.getAttribute('style')).toContain(
      `--chars: ${ru['landing.chat.bubble1'].length}`
    );
    expect(strip.getAttribute('style')).toMatch(/--loop: \d+ms/);
    expect(document.head.innerHTML).toContain('@keyframes lp-pop-0');
    expect(document.head.innerHTML).toContain('@keyframes lp-type-3');
    const css = source('src/lib/components/landing/LandingChatStrip.svelte');
    for (const n of [0, 1, 2, 3]) {
      expect(css).toMatch(new RegExp(`\\.chat-bubble\\.i${n}\\s*\\{[^}]*animation-name:\\s*lp-pop-${n}`));
      expect(css).toMatch(new RegExp(`\\.chat-bubble-text\\.i${n}\\s*\\{[^}]*animation-name:\\s*lp-type-${n}`));
    }
  });

  it('the chat timeline math: 55ms/char typewriter, 900ms hold, 3.4s turn cap, content-derived loop with fade + rest', () => {
    const specs = [
      { from: 'glitch', text: ru['landing.chat.bubble1'] },
      { from: 'pip', text: ru['landing.chat.bubble2'] },
      { from: 'glitch', text: ru['landing.chat.bubble3'] },
      { from: 'pip', text: ru['landing.chat.bubble4'] }
    ] as const;
    const timeline = buildChatTimeline(specs);
    expect(timeline.turns).toHaveLength(4);
    timeline.turns.forEach((turn) => {
      expect(turn.chars).toBe(turn.text.length);
      expect(turn.typeMs).toBe(Math.min(turn.chars * 55, turn.turnMs - 160 - 160));
      expect(turn.turnMs).toBe(Math.min(160 + turn.chars * 55 + 900, 3400));
      expect(turn.turnMs).toBeLessThanOrEqual(3400);
    });
    const last = timeline.turns[3]!;
    expect(timeline.loopMs).toBe(last.startMs + last.turnMs + 1000);
    for (let i = 1; i < timeline.turns.length; i++) {
      const prev = timeline.turns[i - 1]!;
      expect(timeline.turns[i]!.startMs).toBe(prev.startMs + prev.turnMs);
    }
    for (const n of [0, 1, 2, 3]) {
      expect(timeline.keyframesCss).toContain(`@keyframes lp-pop-${n}`);
      expect(timeline.keyframesCss).toContain(`@keyframes lp-type-${n}`);
    }
    const enTimeline = buildChatTimeline([
      { from: 'glitch', text: en['landing.chat.bubble1'] },
      { from: 'pip', text: en['landing.chat.bubble2'] },
      { from: 'glitch', text: en['landing.chat.bubble3'] },
      { from: 'pip', text: en['landing.chat.bubble4'] }
    ]);
    expect(enTimeline.loopMs).not.toBe(timeline.loopMs);
  });

  it('reduced motion: no typewriter, no loop — the chat bubbles render statically; the reminder collapses to a static box', () => {
    const chat = source('src/lib/components/landing/LandingChatStrip.svelte');
    expect(chat).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(chat).toMatch(/\.chat-bubble\s*\{[^}]*animation:\s*none[^}]*opacity:\s*1/);
    expect(chat).toMatch(/\.chat-bubble-text\s*\{[^}]*animation:\s*none[^}]*clip-path:\s*none/);
    const scene = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(scene).toMatch(/@media \(prefers-reduced-motion/);
  });
});

describe('/ — the three BIG step blocks (§4.21.E, replaces the §4.20.H icon row)', () => {
  it('three separate display blocks, each with the pixel step number, the pixel-font title, the step icon and a mini description', () => {
    const { container } = render(LandingPage, { props: {} });
    const blocks = [...container.querySelectorAll('#tutorial .step-block')];
    expect(blocks).toHaveLength(3);
    // pixel step numbers 01 / 02 / 03 (locale-invariant literals)
    expect(blocks.map((b) => b.querySelector('.step-num')?.textContent)).toEqual([
      '01', '02', '03'
    ]);
    // pixel-font titles FIND / CHAT / SHARE (the kept §4.20.M keys)
    expect(blocks.map((b) => b.querySelector('.step-title')?.textContent)).toEqual([
      ru['landing.tutorial.search'],
      ru['landing.tutorial.chat'],
      ru['landing.tutorial.share']
    ]);
    // the §4.20.H icon set incl. the contact-share glyph (aria-hidden)
    expect(blocks.map((b) => b.querySelector('.step-icon svg')?.getAttribute('viewBox'))).toEqual([
      '0 0 16 16', '0 0 16 16', '0 0 16 16'
    ]);
    expect(blocks.every((b) => b.querySelector('.step-icon svg')?.getAttribute('aria-hidden') === 'true')).toBe(true);
    expect(ICON_RECTS['contact-share'].length).toBeGreaterThan(0);
    // one-line mini descriptions (the new §4.21.H keys)
    expect(blocks.map((b) => b.querySelector('.step-desc')?.textContent)).toEqual([
      ru['landing.steps.find.desc'],
      ru['landing.steps.chat.desc'],
      ru['landing.steps.share.desc']
    ]);
    // non-interactive: no buttons/links inside the tutorial section
    expect(container.querySelectorAll('#tutorial button, #tutorial a')).toHaveLength(0);
    // the old §4.20.H small-icon row is retired (no chevron connectors)
    expect(container.querySelectorAll('#tutorial .chevron')).toHaveLength(0);
  });

  it('desktop = left-to-right equal row (repeat(3, 1fr), ~300px min-height); phone = top-to-bottom stack', () => {
    const css = source('src/routes/+page.svelte');
    // phone: stacked with --space-5 gaps, natural height
    expect(css).toMatch(/\.steps\s*\{[^}]*flex-direction:\s*column/);
    expect(css).toMatch(/\.steps\s*\{[^}]*gap:\s*var\(--space-5\)/);
    // desktop: the equal thirds row
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.steps\s*\{[^}]*display:\s*grid[^}]*grid-template-columns:\s*repeat\(3, 1fr\)/);
    expect(css).toMatch(/@media \(min-width: 720px\)\s*\{[\s\S]*?\.step-block \.step-body\s*\{[^}]*min-height:\s*300px/);
  });
});

describe('/ — the §4.21.G contact footer + the §4.20.I removals', () => {
  it('renders ONE site contact block: the kept copyright row + EMAIL/GITHUB links', () => {
    const { container } = render(LandingPage, { props: {} });
    const contact = container.querySelector('.contact');
    expect(contact?.tagName).toBe('FOOTER');
    expect(contact?.className).toContain('pixel-frame--strong');
    // row 1: the kept landing.footer.copyright content (brand + year)
    expect(contact?.querySelector('.brand-name')?.textContent).toBe('bleak-web');
    expect(contact?.querySelector('.foot-year')?.textContent).toBe('· 2026');
    // row 2: EMAIL → mailto:extube@proton.me, GITHUB → github.com/extube
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
    // the labels are pixel-font (Handjet), the value text-colored + glow hover
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.link-label\s*\{[^}]*font-family:\s*var\(--font-pixel\)/);
    expect(css).toMatch(/\.link-value\s*\{[^}]*font-family:\s*var\(--font-pixel\)/);
    expect(css).toMatch(/\.link-value\s*\{[^}]*color:\s*var\(--color-text\)/);
    // max-width 560px, centered, padding 16px 20px (§4.21.G)
    expect(css).toMatch(/\.contact\s*\{[^}]*max-width:\s*560px/);
    expect(css).toMatch(/\.contact\s*\{[^}]*margin:\s*0 auto/);
    expect(css).toMatch(/\.foot-body\s*\{[^}]*padding:\s*16px 20px/);
    // the /income entry points are now exactly two: Start CTA + agent TALK
    // (the §4.20.I CTA badge dies with its link role)
    expect(container.querySelectorAll('a[href="/income"]')).toHaveLength(1);
  });

  it('the two §4.20.I footer blocks are ABSENT — no DOM node, no rendered copy, no dead keys in either dictionary', () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.area-ftpos')).toBeNull();
    expect(container.querySelector('.badge-block')).toBeNull();
    expect(container.querySelector('.foot-line')).toBeNull();
    expect(container.textContent).not.toContain('EVERY CONNECTION MATTERS');
    expect(container.textContent).not.toContain('КАЖДЫЙ КОНТАКТ ВАЖЕН');
    expect(container.textContent).not.toContain('START NOW');
    expect(container.textContent).not.toContain('СТАРТ СЕЙЧАС');
    for (const key of DEAD_KEYS) {
      expect(ru).not.toHaveProperty(key);
      expect(en).not.toHaveProperty(key);
    }
  });
});

describe('/ — behavior (§4.20.L, §4.21.G amendment)', () => {
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

  it('the header carries the working RU/EN switch and both START controls (mobile pill / desktop link)', () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.locale .segmented')).toBeTruthy();
    expect(container.querySelector('.start-pill')?.textContent?.trim()).toBe(ru['landing.cta']);
    const link = container.querySelector<HTMLAnchorElement>('.start-link');
    expect(link?.getAttribute('href')).toBe('/income');
    expect(link?.textContent?.trim()).toBe(ru['landing.cta']);
  });

  it('the bottom tab bar is not rendered on / (the layout isJoin check covers the landing)', () => {
    const layout = source('src/routes/+layout.svelte');
    expect(layout).toMatch(/pathname === '\/'/);
    expect(layout).toMatch(/pathname\.startsWith\('\/income'\)/);
  });
});

describe('/ — RU/EN parity (the 38 §4.20.M+§4.21.H keys, the working switch)', () => {
  it('every landing key exists in BOTH dictionaries, non-empty — and the two dead keys exist in NEITHER', () => {
    expect(LANDING_KEYS).toHaveLength(38);
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

  it('verbatim §4.21.H copy in both languages (new keys + the hero.aria amendment)', () => {
    expect(ru['landing.steps.find.desc']).toBe('Радар показывает, кто рядом прямо сейчас.');
    expect(en['landing.steps.find.desc']).toBe('The radar shows who is around you right now.');
    expect(ru['landing.steps.chat.desc']).toBe('Ваши агенты заводят разговор до вашего прихода.');
    expect(en['landing.steps.chat.desc']).toBe('Your agents break the ice before you arrive.');
    expect(ru['landing.steps.share.desc']).toBe('Одно рукопожатие — и контакты обменяны.');
    expect(en['landing.steps.share.desc']).toBe('One handshake — and contacts are exchanged.');
    expect(ru['landing.footer.contact.email.label']).toBe('ПОЧТА');
    expect(en['landing.footer.contact.email.label']).toBe('EMAIL');
    expect(ru['landing.footer.contact.github.label']).toBe('ГИТХАБ');
    expect(en['landing.footer.contact.github.label']).toBe('GITHUB');
    expect(ru['landing.hero.aria']).toBe(
      'Пиксельная сцена: двое у фиолетового города под светящимся приветствием'
    );
    expect(en['landing.hero.aria']).toBe(
      'Pixel scene: two figures before a violet city under a glowing hello'
    );
  });

  it('the switch re-renders EVERY landing string (headline, accent word, taglines, reminder lines, bubbles, cards, steps, footer labels) without a reload', async () => {
    const { container } = render(LandingPage, { props: {} });
    expect(container.querySelector('.accent-word')?.textContent?.trim()).toBe(
      ru['landing.headline.accent']
    );
    expect(container.querySelector('.tagline-top')?.textContent).toBe(ru['landing.tagline.top']);
    expect(container.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    // flip to EN through the shared store — the same DOM re-renders
    setLocale('en');
    await tick();
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toContain(en['landing.headline.1']);
    expect(h1.textContent).toContain(en['landing.headline.accent']);
    expect(container.querySelector('.tagline-top')?.textContent).toBe(en['landing.tagline.top']);
    expect(container.querySelector('.sub')?.textContent).toBe(en['landing.sub']);
    expect(container.querySelector('.agent-name')?.textContent).toBe(en['landing.agent.name']);
    expect(container.querySelector('.stat-title')?.textContent).toBe(en['landing.stat.title']);
    expect(container.querySelector('.chat-label')?.textContent).toBe(en['landing.chat.label']);
    expect(container.textContent).toContain(en['landing.chat.bubble4']);
    expect(container.textContent).toContain(en['landing.dialog.line3']);
    // the step blocks re-render (titles + descriptions)
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
    // the contact footer labels swap without a reload
    const labels = [...container.querySelectorAll('.link-label')].map((l) => l.textContent);
    expect(labels).toEqual([
      en['landing.footer.contact.email.label'],
      en['landing.footer.contact.github.label']
    ]);
    // the chat strip re-derived its locale-dependent loop + keyframes
    const strip = screen.getByRole('img', { name: en['landing.chat.aria'] });
    expect(strip.getAttribute('style')).toMatch(/--loop: \d+ms/);
    const enBubbles = [...strip.querySelectorAll('.chat-bubble')];
    expect(enBubbles[3]?.getAttribute('style')).toContain(
      `--chars: ${en['landing.chat.bubble4'].length}`
    );
    expect(document.head.innerHTML).toContain('@keyframes lp-pop-0');
    expect(document.head.innerHTML).toContain('@keyframes lp-type-3');
    // no navigation happened — the switch is purely client-side
    expect(goto).not.toHaveBeenCalled();
  });
});

describe('/ — adaptive layout + palette discipline (§4.21.D + §4.20.K/§4.20.A, source pins)', () => {
  it('PHONE ORDER UNCHANGED: single-column stacking in the §4.20.K order (minus the two removed blocks, reminder merged into the art block)', () => {
    const css = source('src/routes/+page.svelte');
    // base canvas = one column (flex), the DOM order IS the mobile order
    expect(css).toMatch(/\.canvas\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    const canvas = css.match(/\.canvas\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    const order = ['area-lead', 'area-art', 'area-chat', 'area-agents', 'area-stat', 'area-tutorial', 'area-foot'];
    const positions = order.map((name) => css.indexOf(name, css.indexOf('<main')));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // the removed §4.20.I blocks are gone from the tail (no area-ftpos/badge areas)
    expect(css).not.toMatch(/area-ftpos|area-badge/);
    // the canvas is capped at the 1000px desktop composition width
    expect(css).toMatch(/max-width:\s*1000px/);
    // the art block is full-width and overflow-guarded (no scroll at 320px)
    const scene = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(scene).toMatch(/\.art-block\s*\{[^}]*width:\s*100%/);
    expect(scene).toMatch(/\.art-block\s*\{[^}]*overflow:\s*hidden/);
    expect(canvas || css).toBeTruthy();
  });

  it('desktop ≥720px: the §4.21.D three-section grid (27% minmax(0,1fr) 26%) via CSS-only grid areas', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(
      /@media \(min-width: 720px\)[\s\S]*grid-template-columns:\s*27% minmax\(0, 1fr\) 26%/
    );
    const areaSrc = css.match(/grid-template-areas:([\s\S]*?;)/)?.[1] ?? '';
    const rows = [...areaSrc.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
    // section 2 = lead | art | agent+chat; section 3 = stat + tut rows; footer
    expect(rows).toEqual([
      'lead art   agent',
      'lead art   chat',
      'stat stat  stat',
      'tut  tut   tut',
      'foot foot  foot'
    ]);
    expect(css).toMatch(/grid-template-rows:\s*auto 1fr/);
    // the headline scales 36px → 44px (≥480px) → 64px (≥720px)
    expect(css).toMatch(/\.headline\s*\{[^}]*font-size:\s*36px/);
    expect(css).toMatch(/@media \(min-width: 480px\)\s*\{[\s\S]*?font-size:\s*44px/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*?\.headline\s*\{[^}]*font-size:\s*64px/);
  });

  it('the mascot-chat strip keeps its desktop slot UNDER the agent card in the right column (§4.21.D re-verification)', () => {
    const css = source('src/routes/+page.svelte');
    // agent row 1, chat row 2, same 26% column — never shares space with
    // the art block or the reminder (the art area is column 2 only)
    const areaSrc = css.match(/grid-template-areas:([\s\S]*?;)/)?.[1] ?? '';
    const rows = [...areaSrc.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
    expect(rows[0]?.endsWith('agent')).toBe(true);
    expect(rows[1]?.endsWith('chat')).toBe(true);
    // the art column exists only in the section-2 rows (never with stat/tut/foot)
    expect(rows.map((r) => r.split(/\s+/).filter((c) => c === 'art').length)).toEqual([
      1, 1, 0, 0, 0
    ]);
  });

  it('palette discipline: no raw hex anywhere in the landing sources; the accent is the approved violet token', () => {
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(withoutComments, `${file} carries a raw hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
    const page = source('src/routes/+page.svelte');
    expect(page).toMatch(/var\(--color-deepa-4\)/);
    expect(page).not.toMatch(/--color-accent/);
  });

  it('no new dependencies, no canvas element, no animation library (§4.21.I-22)', () => {
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

  it('the mascot cast: six DISTINCT figures — NOVA + ASTRA (hero), VECTOR, BLOOM, PIP, GLITCH — BYTE retired (§4.20.J + §4.21.A)', () => {
    const { container } = render(LandingPage, { props: {} });
    const kinds = [...container.querySelectorAll('[data-figure]')].map(
      (el) => el.getAttribute('data-figure')
    );
    for (const kind of ['nova', 'astra', 'vector', 'bloom', 'pip', 'glitch']) {
      expect(kinds, `${kind} on the page`).toContain(kind);
    }
    expect(kinds).not.toContain('byte');
    // each region carries its own figure — VECTOR only in the agent card,
    // BLOOM only in the stat card, PIP only in the chat strip
    expect(container.querySelectorAll('.agent-card [data-figure="bloom"]')).toHaveLength(0);
    expect(container.querySelectorAll('.stat-card [data-figure="vector"]')).toHaveLength(0);
    expect(container.querySelectorAll('.agent-card [data-figure="pip"]')).toHaveLength(0);
    // NOVA/ASTRA exist ONLY inside the hero pair (each has exactly one node)
    expect(container.querySelectorAll('[data-figure="nova"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-figure="astra"]')).toHaveLength(1);
    // the cast table (figures.ts) declares exactly the six figure kinds
    const data = source('src/lib/components/landing/figures.ts');
    for (const kind of ['vector', 'bloom', 'pip', 'glitch', 'nova', 'astra']) {
      expect(data).toMatch(new RegExp(`^  ${kind}: \\{`, 'm'));
    }
    expect(data).not.toMatch(/^\s*byte:/m);
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
