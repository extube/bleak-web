/** SummarySheet component tests (CONCEPT §15.3, DESIGN §4.15.C — v3.2
 * arcade-sheet core, tz7-02): the arcade scope tokens (locked palette, NOT
 * remapped to app tokens), the spring-bounce entrance + section cascade,
 * the Press Start 2P pixel stack, the pixel top bar (label + X close),
 * the 24px top corners, plus the kept-working donut/checklist/slide
 * contracts. The hosting-page trigger behaviors live in transcript-page
 * tests; the sharing/gesture logic is covered by the ShareContactSlide
 * control's own suite. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen } from '@testing-library/svelte';
import SummarySheet from '../src/lib/components/SummarySheet.svelte';
import {
  DONUT_RADIUS,
  donutCircumference,
  donutScoreDash,
  isCelebration,
  summaryCelebrates,
  summaryScoreDisplay
} from '../src/lib/chats/summary';
import type { Summary, User } from '@bleak/api-client';
import { ru } from '../src/lib/i18n/ru';
import { en } from '../src/lib/i18n/en';

afterEach(() => {
  cleanup();
});

// Source-level CSS assertions (§4.14.4 width contract) read the component
// files — jsdom resolves no component CSS (same pattern as chats-page).
const WEB_ROOT = process.cwd().endsWith(sep + 'apps' + sep + 'web')
  ? process.cwd()
  : join(process.cwd(), 'apps', 'web');
const SHEET_SOURCE = readFileSync(join(WEB_ROOT, 'src/lib/components/SummarySheet.svelte'), 'utf8');
const TRANSCRIPT_SOURCE = readFileSync(
  join(WEB_ROOT, 'src/routes/chats/[address]/+page.svelte'),
  'utf8'
);

const ALICE: User = {
  address: '0xalice',
  room: '0xroom',
  name: 'Алиса',
  greeting: '',
  public_bio: 'Гончая студия',
  private_bio: '',
  language: 'ru',
  created_at: '2026-11-14T10:00:00Z',
  updated_at: '2026-11-14T10:00:00Z',
  deleted_at: null
};

function summaryFixture(score: number): Summary {
  return {
    chat: '0xchat1',
    checkpoints: [
      { key: 'introductions', label: 'Both introduced themselves', closed: true },
      { key: 'goals', label: 'Goals were exchanged', closed: true },
      { key: 'details', label: 'Project details were discussed', closed: false },
      { key: 'next_step', label: 'A next step was agreed', closed: false },
      { key: 'contact', label: 'Contact details were exchanged', closed: false }
    ],
    created_at: '2026-11-19T10:00:00Z',
    description: 'You discussed ceramics and agreed to exchange contacts.',
    room: '0xroom',
    score,
    user_a: '0xme',
    user_b: ALICE.address
  };
}

function renderSheet(props: Record<string, unknown> = {}): void {
  render(SummarySheet, {
    props: {
      open: true,
      user: ALICE,
      summary: summaryFixture(66),
      slideLabel: ru['chat.contact_share.label'],
      slideSharedLabel: ru['chat.contact_share.shared'],
      slideDisabledHint: ru['chat.contact_share.no_card'],
      ...props
    }
  });
}

describe('donut arc math (lib/chats/summary — pure)', () => {
  it('the circumference is 2πr over the shared DONUT_RADIUS', () => {
    expect(donutCircumference()).toBeCloseTo(2 * Math.PI * DONUT_RADIUS, 10);
    expect(donutCircumference(10)).toBeCloseTo(2 * Math.PI * 10, 10);
  });

  it('the dasharray draws the score fraction of C, gap = the rest', () => {
    const c = donutCircumference();
    expect(donutScoreDash(0)).toBe(`0 ${c}`);
    expect(donutScoreDash(50)).toBe(`${c / 2} ${c}`);
    expect(donutScoreDash(100)).toBe(`${c} ${c}`);
    expect(donutScoreDash(66).split(' ')[0]).toBeCloseTo(c * 0.66, 10);
  });

  it('clamps out-of-range scores (total math — Summary scores are (0,100))', () => {
    const c = donutCircumference();
    expect(donutScoreDash(-5)).toBe(`0 ${c}`);
    expect(donutScoreDash(140)).toBe(`${c} ${c}`);
  });
});

describe('celebration threshold (strictly above 80)', () => {
  it('80 is NOT a celebration, 80.01 and 100 are', () => {
    expect(isCelebration(80)).toBe(false);
    expect(isCelebration(80.01)).toBe(true);
    expect(isCelebration(100)).toBe(true);
    expect(isCelebration(50)).toBe(false);
  });

  it('summaryCelebrates is null-safe (loading / failed states)', () => {
    expect(summaryCelebrates(null)).toBe(false);
    expect(summaryCelebrates(summaryFixture(95))).toBe(true);
    expect(summaryCelebrates(summaryFixture(20))).toBe(false);
  });
});

describe('score display (§4.14.4: ceil integer)', () => {
  it('a fractional score rounds UP (66.4 → 67); integers pass through', () => {
    expect(summaryScoreDisplay(66.4)).toBe(67);
    expect(summaryScoreDisplay(0.5)).toBe(1);
    expect(summaryScoreDisplay(80.01)).toBe(81);
    expect(summaryScoreDisplay(66)).toBe(66);
    expect(summaryScoreDisplay(100)).toBe(100);
    expect(summaryScoreDisplay(0)).toBe(0);
  });
});

describe('SummarySheet rendering', () => {
  it('closed → nothing renders', () => {
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the dialog shows the interlocutor name, the i18n headings and the donut score', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(ru['chat.summary.title']);
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(screen.getByText(ru['chat.summary.title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.summary.checklist'])).toBeTruthy();
    expect(dialog.querySelector('.donut .score')?.textContent).toBe('66');
    expect(dialog.querySelector('.donut .arc')?.getAttribute('style')).toContain(
      donutScoreDash(66)
    );
  });

  it('§4.14.4: a fractional score displays as the CEIL integer (66.4 → 67), the arc keeps the raw score', () => {
    renderSheet({ summary: summaryFixture(66.4) });
    const dialog = screen.getByRole('dialog');
    // the displayed NUMBER is the ceil integer…
    expect(dialog.querySelector('.donut .score')?.textContent).toBe('67');
    // …and the aria wording embeds the same ceiled number
    expect(dialog.querySelector('.donut')?.getAttribute('aria-label')).toBe(
      ru['chat.summary.score.aria'].replace('{score}', '67')
    );
    // the ARC math stays on the raw score (donut arc math untouched)
    expect(dialog.querySelector('.donut .arc')?.getAttribute('style')).toContain(
      donutScoreDash(66.4)
    );
  });

  it('checkpoints render closed (check glyph) / open (muted, no glyph), labels verbatim', () => {
    renderSheet();
    const items = document.querySelectorAll('.checkpoint');
    expect(items).toHaveLength(5);
    expect(screen.getByText('Both introduced themselves')).toBeTruthy();
    expect(items[0]?.classList.contains('closed')).toBe(true);
    expect(items[0]?.querySelector('svg')).toBeTruthy();
    expect(items[2]?.classList.contains('closed')).toBe(false);
    expect(items[2]?.querySelector('svg')).toBeNull();
    expect(items[2]?.textContent).toContain('Project details were discussed');
  });

  it('§4.14.4: every checkpoint carries a SQUARE checkbox — green check inside when closed, empty square when open', () => {
    renderSheet();
    const items = document.querySelectorAll('.checkpoint');
    expect(items).toHaveLength(5);
    // every item renders its square box, closed or open
    const boxes = [...items].map((item) => item.querySelector('.box'));
    expect(boxes.every((box) => box !== null)).toBe(true);
    // closed: the check glyph lives INSIDE the square box
    expect(boxes[0]?.querySelector('svg')).toBeTruthy();
    // open: the square stays EMPTY (no glyph)
    expect(boxes[2]?.querySelector('svg')).toBeNull();
    expect(boxes[2]?.textContent).toBe('');
  });

  it('§4.14.4 checkbox CSS contract: bordered square, green check via the token, no raw hex outside the scope block', () => {
    // jsdom resolves no component CSS — the box geometry contract is pinned
    // at the source level (same pattern as the §4.14.4 width contract).
    const boxBlock = SHEET_SOURCE.match(/\.checkpoint \.box\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(boxBlock).toContain('border:');
    // SQUARE: width === height (no pill rounding, no aspect distortion)
    const width = boxBlock.match(/width:\s*([\d.]+px)/)?.[1];
    const height = boxBlock.match(/height:\s*([\d.]+px)/)?.[1];
    expect(width).toBeTruthy();
    expect(height).toBe(width);
    // the green check sign resolves through the sheet scope: --sheet-green
    // IS the approved --color-check-green token (§4.15.C-1 — no new hex)
    expect(SHEET_SOURCE).toContain('.checkpoint .check');
    const checkBlock = SHEET_SOURCE.match(/\.checkpoint \.check\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(checkBlock).toContain('var(--sheet-green)');
    // the token exists in tokens.css (sourced from the approved Deepa green)
    const tokensCss = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');
    expect(tokensCss).toMatch(/--color-check-green:\s*var\(--color-deepa-1\)/);
    // RAW HEX lives only in the .arcade-sheet scope block (the owner-locked
    // palette, §4.15.C-1) — everything outside consumes the --sheet-* vars.
    // Comments are prose (they may cite the hexes) — they are stripped.
    const scopeBlock = SHEET_SOURCE.match(/\.arcade-sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scopeBlock).toBeTruthy();
    const outside = SHEET_SOURCE.replace(scopeBlock, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(outside).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });

  it('the Summary description renders as a muted paragraph', () => {
    renderSheet();
    expect(document.querySelector('.description')?.textContent).toContain('ceramics');
  });

  it('loading state: a quiet status row, no donut and no checklist', () => {
    renderSheet({ summary: null, loading: true });
    expect(document.querySelector('[role="dialog"] .loading')).toBeTruthy();
    expect(document.querySelector('.donut')).toBeNull();
    expect(screen.queryByText(ru['chat.summary.checklist'])).toBeNull();
  });

  it('failure state: inline error + retry affordance, announced politely', () => {
    renderSheet({ summary: null, error: 'network' });
    expect(screen.getByText(ru['common.error.network'])).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();

    cleanup();
    const onretry = vi.fn();
    renderSheet({ summary: null, error: 'api', errorMessage: 'boom', onretry });
    screen.getByRole('button', { name: ru['common.retry'] }).click();
    expect(onretry).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/boom/)).toBeTruthy();
  });

  it('score > 80 → the celebrate class + sparks; <= 80 → none', () => {
    renderSheet({ summary: summaryFixture(90) });
    const celebrated = document.querySelector('[role="dialog"]');
    expect(celebrated?.classList.contains('celebrate')).toBe(true);
    expect(celebrated?.querySelectorAll('.spark').length).toBeGreaterThan(0);

    cleanup();
    renderSheet({ summary: summaryFixture(80) });
    const calm = document.querySelector('[role="dialog"]');
    expect(calm?.classList.contains('celebrate')).toBe(false);
    expect(calm?.querySelector('.fireworks')).toBeNull();
  });

  it('§4.15.C-1: the sheet background is the owner-locked purple via the arcade-sheet scope — no Deepa-hue classes remain', () => {
    renderSheet({ summary: summaryFixture(50) });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.classList.contains('arcade-sheet')).toBe(true);
    // the §13.1.5 Deepa-hue background pairing is superseded (§15.4): no
    // deepa-N class lands on the sheet anymore
    expect(dialog?.className).not.toMatch(/deepa-[1-5]/);
    // the background renders through the locked scope token
    const sheetBlock = SHEET_SOURCE.match(/\.sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sheetBlock).toContain('background: var(--sheet-bg)');
    expect(sheetBlock).toContain('color: var(--sheet-ink)');
  });

  it('the tz5-04 ShareContactSlide is embedded inside the dialog (same props)', () => {
    renderSheet({ slideDisabled: true });
    const dialog = screen.getByRole('dialog');
    const slide = dialog.querySelector('.slide');
    expect(slide).toBeTruthy();
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    expect(slide?.textContent).toContain(ru['chat.contact_share.no_card']);
  });

  it('the X close button dismisses the sheet and reports onclose', async () => {
    const onclose = vi.fn();
    renderSheet({ onclose });
    await screen.getByRole('button', { name: ru['common.close'] }).click();
    expect(onclose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the onshare passthrough fires from the embedded slide thumb', async () => {
    const onshare = vi.fn();
    renderSheet({ onshare });
    const thumb = document.querySelector('[role="dialog"] .thumb') as HTMLButtonElement;
    await thumb.click();
    expect(onshare).toHaveBeenCalledTimes(1);
  });

  it('§4.14.1 polish: the embedded shared slide shows no confetti replay and no stripes', () => {
    // the slide is embedded unchanged — the shared terminal state is plain
    // (stripes are armed-only) and an already-shared mount never replays the
    // confetti (it celebrates only a gesture completed here)
    renderSheet({ slideShared: true });
    const slide = screen.getByRole('dialog').querySelector('.slide');
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    expect(slide?.querySelector('.confetti')).toBeNull();
    expect(slide?.querySelector('.candy')).toBeNull();
  });

  it('EN interface: every sheet copy renders EN from the i18n table, never RU (DESIGN §4.14.5 bug round)', async () => {
    // The reported bug: hardcoded Russian («итоги встречи», «сетевой чек
    // лист») while the owner is in the EN interface. The regression guard:
    // switch the locale store to EN and assert the sheet copy verbatim.
    const { setLocale } = await import('../src/lib/i18n/locale');
    setLocale('en');
    renderSheet({
      slideLabel: en['chat.contact_share.label'],
      slideSharedLabel: en['chat.contact_share.shared'],
      slideDisabledHint: en['chat.contact_share.no_card']
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(en['chat.summary.title']);
    expect(screen.getByText('Meeting summary')).toBeTruthy();
    expect(screen.getByText('Networking checklist')).toBeTruthy();
    expect(document.querySelector('.checklist')?.getAttribute('aria-label')).toBe(
      en['chat.summary.checklist']
    );
    expect(dialog.querySelector('.donut')?.getAttribute('aria-label')).toBe(
      'Match: 66 out of 100'
    );
    // no RU sheet copy leaks into the EN interface
    expect(screen.queryByText(ru['chat.summary.title'])).toBeNull();
    expect(screen.queryByText(ru['chat.summary.checklist'])).toBeNull();
    // checkpoint labels stay server-verbatim (English data — not UI copy)
    expect(screen.getByText('Both introduced themselves')).toBeTruthy();
    // restore the default locale for the rest of the suite
    setLocale('ru');
  });
});

describe('§4.15.C arcade-sheet core (tz7-02): scope, entrance, typography, top bar', () => {
  it('the scope block carries the LOCKED palette — raw values, not app-token remaps', () => {
    // §4.15.C-1: the locked hexes live verbatim in the .arcade-sheet block
    // (owner-locked #8A12FF purple — NOT remapped to the app palette)
    const scopeBlock = SHEET_SOURCE.match(/\.arcade-sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scopeBlock).toContain('--sheet-bg: #8a12ff');
    expect(scopeBlock).toContain('--sheet-charcoal: #18181b');
    expect(scopeBlock).toContain('--sheet-yellow: #facc15');
    expect(scopeBlock).toContain('--sheet-white: #ffffff');
    expect(scopeBlock).toContain('--sheet-orange: #ff8a00');
    // green reuses the approved Deepa green token (no new hex); ink is white
    expect(scopeBlock).toContain('--sheet-green: var(--color-check-green)');
    expect(scopeBlock).toContain('--sheet-ink: var(--sheet-white)');
  });

  it('no --sheet-* token is consumed outside the sheet component (scope containment)', () => {
    // the app :root tokens are unchanged by the sheet: the --sheet-* family
    // is consumed (var(--sheet-*)) only inside SummarySheet's scope
    const srcDir = join(WEB_ROOT, 'src');
    const consumers: string[] = [];
    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          walk(full);
        } else if (/\.(svelte|ts|css)$/.test(entry.name)) {
          if (readFileSync(full, 'utf8').includes('var(--sheet-')) consumers.push(full);
        }
      }
    };
    walk(srcDir);
    expect(consumers).toEqual([join(srcDir, 'lib', 'components', 'SummarySheet.svelte')]);
  });

  it('§4.15.C-2 entrance: the spring-bounce arcade-rise supersedes the linear slide-up; the scrim keeps its 200ms fade', () => {
    const sheetBlock = SHEET_SOURCE.match(/\.sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sheetBlock).toContain(
      'animation: arcade-rise 460ms cubic-bezier(0.22, 1, 0.36, 1)'
    );
    const rise = SHEET_SOURCE.match(/@keyframes arcade-rise\s*\{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    // the three-overshoot bounce per the design keyframes
    expect(rise).toContain('0%');
    expect(rise).toContain('translateY(100%)');
    expect(rise).toContain('62%');
    expect(rise).toContain('translateY(-12px)');
    expect(rise).toContain('82%');
    expect(rise).toContain('translateY(4px)');
    expect(rise).toContain('translateY(0)');
    // the superseded linear slide-up is gone; the scrim fade stays
    expect(SHEET_SOURCE).not.toContain('@keyframes slide-up');
    const scrimBlock = SHEET_SOURCE.match(/\.scrim\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scrimBlock).toContain('animation: fade-in 200ms ease-out');
  });

  it('§4.15.C-2 cascade: sections stagger in at 120ms + i×50ms with a fade-and-slide-up', () => {
    const cascadeBlock = SHEET_SOURCE.match(/\.cascade\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(cascadeBlock).toContain('animation: cascade-in 240ms ease-out both');
    expect(cascadeBlock).toContain('animation-delay: calc(120ms + var(--cascade-i, 0) * 50ms)');
    const cascadeIn = SHEET_SOURCE.match(/@keyframes cascade-in\s*\{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(cascadeIn).toContain('translateY(10px)');
    expect(cascadeIn).toContain('translateY(0)');
    // every rendered section carries the cascade class with its index
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const cascades = [...dialog.querySelectorAll('.cascade')];
    const indices = cascades.map((el) =>
      Number((el as HTMLElement).style.getPropertyValue('--cascade-i'))
    );
    // top bar → identity → score stage → description → checklist → slide
    expect(indices).toEqual([0, 1, 2, 3, 4, 5]);
  });

  it('§4.15.C-3 typography: the pixel stack is Press Start 2P with the Handjet fallback, loaded via Fontsource subsets', () => {
    const scopeBlock = SHEET_SOURCE.match(/\.arcade-sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scopeBlock).toContain(
      "--sheet-font-pixel: 'Press Start 2P', 'Handjet Variable', 'Handjet', monospace"
    );
    // the Fontsource import lives in +layout.svelte (the existing mechanism)
    // with the latin + cyrillic(+ext) subset CSS files — RU/EN parity
    const layout = readFileSync(join(WEB_ROOT, 'src/routes/+layout.svelte'), 'utf8');
    expect(layout).toContain("@fontsource/press-start-2p/latin.css'");
    expect(layout).toContain("@fontsource/press-start-2p/cyrillic.css'");
    expect(layout).toContain("@fontsource/press-start-2p/cyrillic-ext.css'");
    // the authorized new dependency (owner-mandated authentic 8-bit face;
    // Cyrillic subset verified upstream) is recorded in package.json
    const pkg = JSON.parse(readFileSync(join(WEB_ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies['@fontsource/press-start-2p']).toBeTruthy();
    // pixel consumers: top-bar label, checklist header, score numeral —
    // body/checklist text stays Inter (--font-body)
    expect(SHEET_SOURCE.match(/\.sheet-label\s*\{[\s\S]*?\}/)?.[0]).toContain(
      'font-family: var(--sheet-font-pixel)'
    );
    expect(SHEET_SOURCE.match(/\.checklist h3\s*\{[\s\S]*?\}/)?.[0]).toContain(
      'font-family: var(--sheet-font-pixel)'
    );
    const scoreBlock = SHEET_SOURCE.match(/\.donut \.score\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scoreBlock).toContain('font-family: var(--sheet-font-pixel)');
    expect(scoreBlock).toContain('font-size: 28px');
    expect(SHEET_SOURCE.match(/\.identity h2\s*\{[\s\S]*?\}/)?.[0]).toContain(
      'font-family: var(--font-body)'
    );
  });

  it('§4.15.C-4 top bar: the i18n pixel MEETING SUMMARY label left + the pixel X close with scale(0.88) press and a 48px target', () => {
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const bar = dialog.querySelector('.top-bar');
    expect(bar).toBeTruthy();
    // the label renders the i18n'd title uppercase in the pixel face
    expect(bar?.querySelector('.sheet-label')?.textContent).toBe(ru['chat.summary.title']);
    // the X close: 48px (--touch-target), yellow glyph, pixel scale-down
    // press over 90ms, yellow :focus-visible ring
    const closeBlock = SHEET_SOURCE.match(/\.close\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(closeBlock).toContain('width: var(--touch-target)');
    expect(closeBlock).toContain('height: var(--touch-target)');
    expect(closeBlock).toContain('color: var(--sheet-yellow)');
    expect(SHEET_SOURCE).toMatch(/\.close:active\s*\{[\s\S]*?transform: scale\(0\.88\)/);
    expect(SHEET_SOURCE).toMatch(
      /\.close:focus-visible\s*\{[\s\S]*?outline: 2px solid var\(--sheet-yellow\)/
    );
    // the press still dismisses (behavior unchanged)
    // (the close behavior itself is covered by the rendering tests above)
  });

  it('§4.15.C-2 container: 24px top corners (radius-lg top-only), square elsewhere', () => {
    const sheetBlock = SHEET_SOURCE.match(/\.sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sheetBlock).toContain('border-radius: var(--radius-lg) var(--radius-lg) 0 0');
    // --radius-lg is the 24px token (tokens.css)
    const tokensCss = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');
    expect(tokensCss).toMatch(/--radius-lg:\s*24px/);
  });

  it('§4.15.C-6b container restyle: the celebrate sparks read the sheet scope (yellow/orange/white), the wash reads --sheet-white', () => {
    const sparkBlock = SHEET_SOURCE.match(/\.spark\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sparkBlock).toContain('background: var(--sheet-yellow)');
    expect(SHEET_SOURCE).toContain('--sheet-orange');
    const wash = SHEET_SOURCE.match(/\.celebrate::after\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(wash).toContain('background: var(--sheet-white)');
    const pulse = SHEET_SOURCE.match(/@keyframes brightness-pulse\s*\{[\s\S]*?\n {2}\}/)?.[0] ?? '';
    expect(pulse).toContain('opacity: 0.22');
  });
});

describe('§4.14.4 width contract: the sheet matches the dialog content box', () => {
  // The transcript column in routes/chats/[address] defines the dialog
  // content geometry: `.scroll` insets it by `--space-4` on each side
  // (phone), and from the 720px breakpoint up `.column` caps at 640px
  // centered. The sheet mirrors that exact mapping — its left/right edges
  // align with the messages' borders at every viewport. Both files are
  // read here so the two stay in lockstep (drift fails the test).
  function sheetBlock(): string {
    return SHEET_SOURCE.match(/\.sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
  }
  function sheetMediaBlock(): string {
    return SHEET_SOURCE.match(/@media \(min-width:[^)]*\)\s*\{[\s\S]*?\n {2}\}/)?.[0] ?? '';
  }

  it('phone: the sheet insets itself by the transcript column’s scroll insets', () => {
    // the transcript's horizontal inset token (the `.scroll` padding)
    const scrollBlock = TRANSCRIPT_SOURCE.match(/\.scroll\s*\{[\s\S]*?\}/)?.[0] ?? '';
    const inset = scrollBlock.match(/padding:\s*(var\(--space-\d+)\)\s+\1/)?.[1];
    expect(inset).toBeTruthy(); // uniform horizontal inset, e.g. --space-4
    // the sheet's width subtracts exactly two of that inset
    expect(sheetBlock()).toContain(`width: calc(100% - 2 * ${inset})`);
    // centered (the fixed sheet spans left/right 0 with auto inline margins)
    expect(sheetBlock()).toContain('margin-inline: auto');
  });

  it('desktop: the sheet caps at the transcript column’s max-width, at the same breakpoint', () => {
    // the transcript column cap + breakpoint
    const media = TRANSCRIPT_SOURCE.match(/@media \(min-width:\s*(\d+)px\)[\s\S]*?\n {2}\}/)?.[0] ?? '';
    const breakpoint = media.match(/min-width:\s*(\d+)px/)?.[1];
    const columnCap = media.match(/\.column\s*\{[\s\S]*?max-width:\s*(\d+)px/)?.[1];
    expect(breakpoint).toBeTruthy();
    expect(columnCap).toBeTruthy();
    // the sheet's media query mirrors the same breakpoint AND cap
    const sheetMedia = sheetMediaBlock();
    expect(sheetMedia).toContain(`min-width: ${breakpoint}px`);
    expect(sheetMedia).toContain(`max-width: ${columnCap}px`);
  });
});
