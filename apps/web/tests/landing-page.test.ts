/** Landing page tests (tz12-04, Concept §31+§32, DESIGN §4.20): `/` is
 * REBUILT from zero per the owner's design example — the purple-on-black
 * pixel showcase telling OUR story (effective networking with AI agents):
 * taglines + working RU/EN switch, the 3-line headline with the glowing
 * accent word, the NOVA-meets-BYTE hero scene with the glowing handshake
 * node, the retro dialogue-box (3 cycling asterisk lines + caret), the
 * PIP↔GLITCH mascot-chat animation strip (typewriter loop), the stat card
 * (BLOOM) + agent character card (VECTOR, TALK), the exactly-3-step
 * tutorial row (FIND → CHAT → SHARE), the footer blocks, the six-figure
 * mascot cast, the mobile-first → desktop 3-column adaptive layout, and
 * the deep-link forwarding (?code= / ?u= → /income, the query preserved).
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
import { readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

const WEB_ROOT = process.cwd().endsWith(`${sep}apps${sep}web`)
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
function source(relativePath: string): string {
  return readFileSync(join(WEB_ROOT, relativePath), 'utf8');
}

/** The 35 §4.20.M keys — every landing string, RU/EN parity. */
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
  'landing.footer.line',
  'landing.footer.badge',
  'landing.footer.copyright'
] as const;

const LANDING_SOURCES = [
  'src/routes/+page.svelte',
  'src/lib/components/landing/LandingHeroScene.svelte',
  'src/lib/components/landing/LandingDialogueBox.svelte',
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

describe('/ — the §4.20 landing rebuild (Concept §32)', () => {
  it('renders the 3-line headline with the single highlighted accent word', () => {
    render(LandingPage, { props: {} });
    const h1 = screen.getByRole('heading', { level: 1 });
    const lines = [...h1.querySelectorAll('.hl-line')];
    expect(lines.map((l) => l.textContent?.trim())).toEqual([
      ru['landing.headline.1'],
      ru['landing.headline.2'],
      ru['landing.headline.accent']
    ]);
    // the accent word is THE highlighted one: its own element + glow
    // treatment + the two pixel sparkles (§4.20.C)
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
    // the top-right corner carries the 24px GLITCH glyph (§4.20.B/§4.20.J)
    expect(right?.querySelector('[data-figure="glitch"]')).toBeTruthy();
    // desktop-only taglines + nav are hidden on mobile, shown ≥720px (source)
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/\.tagline-top\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/\.tagline-right\s*\{[^}]*display:\s*none/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.tagline-top\s*\{[^}]*display:\s*block/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*\.top-nav\s*\{[^}]*display:\s*flex/);
    // the desktop anchors reuse §4.20.M keys as their accessible names
    expect(container.querySelector('.top-nav')?.textContent).toContain(
      ru['landing.tutorial.search']
    );
    expect(container.querySelector('.top-nav')?.textContent).toContain(
      ru['landing.agent.name']
    );
  });

  it('renders the hero pixel-art scene: NOVA meets BYTE under the glowing handshake node (role="img", no background plate)', () => {
    const { container } = render(LandingPage, { props: {} });
    const scene = screen.getByRole('img', { name: ru['landing.hero.aria'] });
    expect(scene.tagName).toBe('svg');
    expect(scene.getAttribute('viewBox')).toBe('0 0 64 64');
    // the two distinct figures + the pulsing focal node + 5 sparkles
    expect(scene.querySelector('[data-figure="nova"]')).toBeTruthy();
    expect(scene.querySelector('[data-figure="byte"]')).toBeTruthy();
    expect(scene.querySelector('.node-pulse')).toBeTruthy();
    expect(scene.querySelectorAll('.tw')).toHaveLength(5);
    // §23: no background plate — the scene svg has no plate/fill of its own
    const hero = container.querySelector('.hero');
    expect(hero?.className).not.toMatch(/plate|backdrop/);
  });

  it('renders the retro dialogue-box: 3 cycling asterisk lines + blinking caret + an sr-only static line', () => {
    const { container } = render(LandingPage, { props: {} });
    const lines = [...container.querySelectorAll('.dialog-line')];
    expect(lines.map((l) => l.textContent)).toEqual([
      ru['landing.dialog.line1'],
      ru['landing.dialog.line2'],
      ru['landing.dialog.line3']
    ]);
    // decorative cycle + one full static line for screen readers
    expect(container.querySelector('.dialog-stage')?.getAttribute('aria-hidden')).toBe('true');
    const srLine = container.querySelector('.dialog-box .sr-only');
    expect(srLine?.textContent).toBe(ru['landing.dialog.line1']);
    // the pixel caret is present and blinks (800ms steps(2))
    expect(container.querySelector('.caret svg')).toBeTruthy();
    const css = source('src/lib/components/landing/LandingDialogueBox.svelte');
    expect(css).toMatch(/caret-blink 800ms steps\(2\) infinite/);
    // the 3-line cycle: one 4s window per line inside a 12s loop
    expect(css).toMatch(/dialog-line 12s linear infinite/);
    expect(css).toMatch(/animation-delay:\s*calc\(var\(--i, 0\) \* 4s\)/);
  });

  it('renders the mascot-chat animation strip: 4 alternating bubble turns (GLITCH → PIP → GLITCH → PIP) with per-char typewriter timing', () => {
    render(LandingPage, { props: {} });
    const strip = screen.getByRole('img', { name: ru['landing.chat.aria'] });
    expect(strip.querySelector('.chat-label')?.textContent).toBe(ru['landing.chat.label']);
    // the two mascots face each other at the strip edges
    expect(strip.querySelector('.chat-mascot.pip [data-figure="pip"]')).toBeTruthy();
    expect(strip.querySelector('.chat-mascot.glitch [data-figure="glitch"]')).toBeTruthy();
    // four alternating bubbles, full text in the DOM (clip-reveal, not injection)
    const bubbles = [...strip.querySelectorAll('.chat-bubble')];
    expect(bubbles).toHaveLength(4);
    expect(bubbles.map((b) => b.className.includes('glitch'))).toEqual([
      true, false, true, false
    ]);
    expect(bubbles[0]?.textContent).toContain(ru['landing.chat.bubble1']);
    expect(bubbles[1]?.textContent).toContain(ru['landing.chat.bubble2']);
    expect(bubbles[2]?.textContent).toContain(ru['landing.chat.bubble3']);
    expect(bubbles[3]?.textContent).toContain(ru['landing.chat.bubble4']);
    // each bubble sets --chars inline from its rendered string length —
    // the one-shot mount computation is the only JS (§4.20.F)
    expect(bubbles[0]?.getAttribute('style')).toContain(
      `--chars: ${ru['landing.chat.bubble1'].length}`
    );
    expect(bubbles[1]?.getAttribute('style')).toContain(
      `--chars: ${ru['landing.chat.bubble2'].length}`
    );
    expect(bubbles[2]?.getAttribute('style')).toContain(
      `--chars: ${ru['landing.chat.bubble3'].length}`
    );
    expect(bubbles[3]?.getAttribute('style')).toContain(
      `--chars: ${ru['landing.chat.bubble4'].length}`
    );
    // the strip carries the content-derived loop length + the injected
    // locale-dependent keyframes exist in the document head
    expect(strip.getAttribute('style')).toMatch(/--loop: \d+ms/);
    const head = document.head.innerHTML;
    expect(head).toContain('@keyframes lp-pop-0');
    expect(head).toContain('@keyframes lp-type-3');
    expect(head).toContain('steps(var(--chars))');
    // the scoped strip pins the per-turn phase classes to the keyframes
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
    // loop = the 4 turns + the 600ms fade-out + the 400ms rest
    const last = timeline.turns[3]!;
    expect(timeline.loopMs).toBe(last.startMs + last.turnMs + 1000);
    // turns are sequential (each starts where the previous one ended)
    for (let i = 1; i < timeline.turns.length; i++) {
      const prev = timeline.turns[i - 1]!;
      expect(timeline.turns[i]!.startMs).toBe(prev.startMs + prev.turnMs);
    }
    // the emitted keyframes cover every turn, both phases
    for (const n of [0, 1, 2, 3]) {
      expect(timeline.keyframesCss).toContain(`@keyframes lp-pop-${n}`);
      expect(timeline.keyframesCss).toContain(`@keyframes lp-type-${n}`);
    }
    // the long RU turn is clamped: the hold shrinks, the reveal still fits
    const long = timeline.turns[2]!;
    expect(long.turnMs).toBe(3400);
    expect(long.startMs + 160 + long.typeMs).toBeLessThan(3400 + long.startMs);
    // EN copy derives its own (different) loop — content-driven timing
    const enTimeline = buildChatTimeline([
      { from: 'glitch', text: en['landing.chat.bubble1'] },
      { from: 'pip', text: en['landing.chat.bubble2'] },
      { from: 'glitch', text: en['landing.chat.bubble3'] },
      { from: 'pip', text: en['landing.chat.bubble4'] }
    ]);
    expect(enTimeline.loopMs).not.toBe(timeline.loopMs);
  });

  it('reduced motion: no typewriter, no loop — all four bubbles render statically; the dialogue lines re-stack; the caret stays visible', () => {
    const chat = source('src/lib/components/landing/LandingChatStrip.svelte');
    expect(chat).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(chat).toMatch(/\.chat-bubble\s*\{[^}]*animation:\s*none[^}]*opacity:\s*1/);
    expect(chat).toMatch(/\.chat-bubble-text\s*\{[^}]*animation:\s*none[^}]*clip-path:\s*none/);
    const dialog = source('src/lib/components/landing/LandingDialogueBox.svelte');
    expect(dialog).toMatch(/@media \(prefers-reduced-motion: reduce\)/);
    expect(dialog).toMatch(/\.dialog-line\s*\{[^}]*animation:\s*none[^}]*position:\s*static[^}]*opacity:\s*1/);
  });

  it('renders the framed cards: the stat card (BLOOM) and the agent character card (VECTOR) with the single TALK action', () => {
    const { container } = render(LandingPage, { props: {} });
    // stat card (§4.20.G-a)
    const stat = container.querySelector('.stat-card');
    expect(stat?.querySelector('.stat-title')?.textContent).toBe(ru['landing.stat.title']);
    expect(stat?.textContent).toContain(ru['landing.stat.line1']);
    expect(stat?.textContent).toContain(ru['landing.stat.line2']);
    expect(stat?.textContent).toContain(ru['landing.stat.line3']);
    expect(stat?.querySelector('[data-figure="bloom"]')).toBeTruthy();
    // agent character card (§4.20.G-b) — one TALK pill, no fake second action
    const agents = container.querySelector('#agents');
    expect(agents?.querySelector('[data-figure="vector"]')).toBeTruthy();
    expect(agents?.querySelector('.agent-name')?.textContent).toBe(ru['landing.agent.name']);
    expect(agents?.querySelector('.agent-badge')?.textContent).toBe(ru['landing.agent.badge']);
    expect(agents?.querySelector('.agent-traits')?.textContent).toBe(ru['landing.agent.traits']);
    expect(agents?.querySelector('.agent-quote')?.textContent).toBe(ru['landing.agent.quote']);
    const actions = [...(agents?.querySelectorAll('button') ?? [])];
    expect(actions).toHaveLength(1);
    expect(actions[0]?.textContent?.trim()).toBe(ru['landing.agent.cta']);
    // both cards are strong pixel-frames (the §4.20.A --frame-strong modifier)
    expect(stat?.className).toContain('pixel-frame--strong');
    expect(agents?.querySelector('.card')?.className).toContain('pixel-frame--strong');
  });

  it('the tutorial is EXACTLY 3 pixel-icon steps — FIND → CHAT → SHARE (search → chatting → contacts sharing) — with pixel-chevron connectors', () => {
    const { container } = render(LandingPage, { props: {} });
    const steps = [...container.querySelectorAll('#tutorial .step')];
    expect(steps).toHaveLength(3);
    expect(steps.map((s) => s.querySelector('.step-label')?.textContent)).toEqual([
      ru['landing.tutorial.search'],
      ru['landing.tutorial.chat'],
      ru['landing.tutorial.share']
    ]);
    // order = the §31 tutorial: search → chatting → contacts sharing
    expect(steps.map((s) => s.querySelector('svg')?.getAttribute('viewBox'))).toEqual([
      '0 0 16 16',
      '0 0 16 16',
      '0 0 16 16'
    ]);
    expect(steps.every((s) => s.querySelector('.step-icon svg'))).toBe(true);
    // icons sit in 48px tap targets; labels are visible (icons aria-hidden)
    expect(steps.every((s) => s.querySelector('.step-icon svg')?.getAttribute('aria-hidden') === 'true')).toBe(true);
    // two pixel-chevron connectors between the three steps
    const chevrons = container.querySelectorAll('#tutorial .chevron');
    expect(chevrons).toHaveLength(2);
    expect(chevrons[0]?.querySelectorAll('svg').length).toBe(2);
    // the third glyph is the one added §4.4 icon (contacts sharing)
    expect(ICON_RECTS['contact-share'].length).toBeGreaterThan(0);
  });

  it('renders the footer blocks: the positioning block and the START-NOW badge block (a link to /income)', () => {
    const { container } = render(LandingPage, { props: {} });
    const ftpos = container.querySelector('.area-ftpos');
    expect(ftpos?.querySelector('.brand-name')?.textContent).toBe('bleak-web');
    expect(ftpos?.querySelector('.foot-line')?.textContent).toBe(ru['landing.footer.line']);
    expect(ftpos?.querySelector('.foot-copy')?.textContent).toBe(ru['landing.footer.copyright']);
    const badge = container.querySelector('.badge-block');
    expect(badge?.tagName).toBe('A');
    expect(badge?.getAttribute('href')).toBe('/income');
    expect(badge?.querySelector('.badge-label')?.textContent).toBe(ru['landing.footer.badge']);
  });

  it('the mascot cast: six DISTINCT figures, no figure art reused across regions (§4.20.J)', () => {
    const { container } = render(LandingPage, { props: {} });
    const kinds = [...container.querySelectorAll('[data-figure]')].map(
      (el) => el.getAttribute('data-figure')
    );
    for (const kind of ['nova', 'byte', 'vector', 'bloom', 'pip', 'glitch']) {
      expect(kinds, `${kind} on the page`).toContain(kind);
    }
    // each region carries its own figure — VECTOR only in the agent card,
    // BLOOM only in the stat card, PIP only in the chat strip
    expect(container.querySelectorAll('.agent-card [data-figure="bloom"]')).toHaveLength(0);
    expect(container.querySelectorAll('.stat-card [data-figure="vector"]')).toHaveLength(0);
    expect(container.querySelectorAll('.agent-card [data-figure="pip"]')).toHaveLength(0);
    // NOVA/BYTE exist ONLY inside the hero scene (each has exactly one node)
    expect(container.querySelectorAll('[data-figure="nova"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-figure="byte"]')).toHaveLength(1);
    // the cast table (figures.ts) declares exactly the four figure kinds
    const data = source('src/lib/components/landing/figures.ts');
    for (const kind of ['vector', 'bloom', 'pip', 'glitch']) {
      expect(data).toMatch(new RegExp(`^  ${kind}: \\{`, 'm'));
    }
  });
});

describe('/ — behavior (§4.20.L)', () => {
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
});

describe('/ — RU/EN parity (the 35 §4.20.M keys, the working switch)', () => {
  it('every landing key exists in BOTH dictionaries, non-empty', () => {
    expect(LANDING_KEYS).toHaveLength(35);
    for (const key of LANDING_KEYS) {
      expect(ru, `ru missing ${key}`).toHaveProperty(key);
      expect(en, `en missing ${key}`).toHaveProperty(key);
      expect((ru as Record<string, string>)[key]?.trim().length).toBeGreaterThan(0);
      expect((en as Record<string, string>)[key]?.trim().length).toBeGreaterThan(0);
    }
  });

  it('verbatim §4.20.M copy in both languages', () => {
    expect(ru['landing.tagline.left.1']).toBe('ЗНАКОМСТВА — ЭТО ИГРА.');
    expect(en['landing.tagline.left.1']).toBe('NETWORKING IS A GAME.');
    expect(ru['landing.headline.accent']).toBe('ВАС');
    expect(en['landing.headline.accent']).toBe('YOU');
    expect(ru['landing.cta']).toBe('НАЧАТЬ');
    expect(en['landing.cta']).toBe('START');
    expect(ru['landing.agent.cta']).toBe('ПОГОВОРИТЬ');
    expect(en['landing.agent.cta']).toBe('TALK');
    expect(ru['landing.footer.badge']).toBe('СТАРТ СЕЙЧАС — 6 ЦИФР ДЛЯ ВХОДА');
    expect(en['landing.footer.badge']).toBe('START NOW — 6 DIGITS TO JOIN');
    expect(ru['landing.tutorial.share']).toBe('ПОДЕЛИСЬ');
    expect(en['landing.tutorial.share']).toBe('SHARE');
  });

  it('the switch re-renders EVERY landing string (headline, accent word, taglines, dialogue lines, bubbles, cards, tutorial, footer) without a reload', async () => {
    const { container } = render(LandingPage, { props: {} });
    // RU first (the default)
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
    expect(container.querySelector('.agent-badge')?.textContent).toBe(en['landing.agent.badge']);
    expect(container.querySelector('.agent-quote')?.textContent).toBe(en['landing.agent.quote']);
    expect(container.querySelector('.stat-title')?.textContent).toBe(en['landing.stat.title']);
    expect(container.querySelector('.chat-label')?.textContent).toBe(en['landing.chat.label']);
    expect(container.textContent).toContain(en['landing.chat.bubble4']);
    expect(container.textContent).toContain(en['landing.dialog.line3']);
    const labels = [...container.querySelectorAll('.step-label')].map((l) => l.textContent);
    expect(labels).toEqual([
      en['landing.tutorial.search'],
      en['landing.tutorial.chat'],
      en['landing.tutorial.share']
    ]);
    expect(container.querySelector('.foot-line')?.textContent).toBe(en['landing.footer.line']);
    expect(container.querySelector('.badge-label')?.textContent).toBe(en['landing.footer.badge']);
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

describe('/ — adaptive layout + palette discipline (§4.20.K/§4.20.A, source pins)', () => {
  it('mobile-first: single-column stacking in the §4.20.K order, no fixed widths that overflow 320px', () => {
    const css = source('src/routes/+page.svelte');
    // base canvas = one column (flex), the DOM order IS the mobile order
    expect(css).toMatch(/\.canvas\s*\{[^}]*display:\s*flex[^}]*flex-direction:\s*column/);
    const canvas = css.match(/\.canvas\s*\{[\s\S]*?\n\s*\}/)?.[0] ?? '';
    const order = ['area-copy', 'area-hero', 'area-chat', 'area-agents', 'area-stat', 'area-tutorial', 'area-ftpos', 'area-badge'];
    const positions = order.map((name) => css.indexOf(name, css.indexOf('<main')));
    expect(positions.every((p) => p > 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    // the canvas is capped at the 1000px desktop composition width
    expect(css).toMatch(/max-width:\s*1000px/);
    // the hero scene scales down to the viewport (no horizontal scroll at 320px)
    const scene = source('src/lib/components/landing/LandingHeroScene.svelte');
    expect(scene).toMatch(/width:\s*min\(320px, 100%\)/);
    expect(canvas || css).toBeTruthy();
  });

  it('desktop ≥720px: the example\'s 3-column composition (26% 1fr 26%) via CSS-only grid areas', () => {
    const css = source('src/routes/+page.svelte');
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*grid-template-columns:\s*26% 1fr 26%/);
    const areaSrc = css.match(/grid-template-areas:([\s\S]*?;)/)?.[1] ?? '';
    const rows = [...areaSrc.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '');
    expect(rows).toEqual([
      'copy  hero agents',
      'stat  hero chat',
      'ftpos hero badge',
      'tut   tut  tut'
    ]);
    // the headline scales 36px → 44px (≥480px) → 64px (≥720px)
    expect(css).toMatch(/\.headline\s*\{[^}]*font-size:\s*36px/);
    expect(css).toMatch(/@media \(min-width: 480px\)\s*\{[\s\S]*?font-size:\s*44px/);
    expect(css).toMatch(/@media \(min-width: 720px\)[\s\S]*?\.headline\s*\{[^}]*font-size:\s*64px/);
  });

  it('palette discipline: no raw hex anywhere in the landing sources; the accent is the approved violet token', () => {
    for (const file of LANDING_SOURCES) {
      const src = source(file);
      const withoutComments = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(withoutComments, `${file} carries a raw hex`).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    }
    // the purple bloom maps onto the existing approved Deepa violet (§4.1)
    const page = source('src/routes/+page.svelte');
    expect(page).toMatch(/var\(--color-deepa-4\)/);
    expect(page).not.toMatch(/--color-accent/);
  });

  it('no new dependencies, no canvas element, no animation library (§4.20 / AC 13)', () => {
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

describe('layout: the pre-room routes carry no tab bar (tz12-02)', () => {
  it('the isJoin check covers the landing AND the re-homed /income routes', () => {
    const layout = source('src/routes/+layout.svelte');
    expect(layout).toMatch(/pathname === '\/'/);
    expect(layout).toMatch(/pathname\.startsWith\('\/income'\)/);
  });
});
