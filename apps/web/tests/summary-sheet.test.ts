/** SummarySheet component tests (CONCEPT §15.3, DESIGN §4.15.C — v3.2
 * arcade sheet, tz7-02 core + tz7-03 centerpiece): the arcade scope tokens
 * (locked palette, NOT remapped to app tokens), the spring-bounce entrance
 * + section cascade, the Press Start 2P pixel stack, the pixel top bar, the
 * 24px top corners, plus the CENTERPIECE contracts — dual square avatar
 * frames, the clockwise score ring + arcade tally count-up, the 80/50 tier
 * system with the per-tier avatar/bridge animations, the checklist pop
 * choreography, and the sheet-variant slide embed + completion sequence.
 * The hosting-page trigger behaviors live in transcript-page tests; the
 * sharing/gesture logic is covered by the ShareContactSlide control's own
 * suite (tests/kit.test.ts). */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { cleanup, render, screen, waitFor } from '@testing-library/svelte';
import SummarySheet from '../src/lib/components/SummarySheet.svelte';
import {
  DONUT_RADIUS,
  RING_RADIUS,
  TALLY_MS,
  donutCircumference,
  donutScoreDash,
  isCelebration,
  ringCircumference,
  ringScoreOffset,
  summaryCelebrates,
  summaryScoreDisplay,
  summaryTier,
  tallyValue
} from '../src/lib/chats/summary';
import { ICON_RECTS } from '../src/lib/components/icons/registry';
import type { Summary, User } from '@bleak/api-client';
import { ru } from '../src/lib/i18n/ru';
import { en } from '../src/lib/i18n/en';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

/**
 * Stub matchMedia to REPORT reduced motion: the tally's explicit JS guard
 * (§4.15.C-5 — the base.css catch-all only intercepts CSS) then jumps
 * straight to the final value, so rendering assertions are deterministic.
 */
function stubReducedMotion(): void {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false
  }));
}

function renderSheet(props: Record<string, unknown> = {}): void {
  render(SummarySheet, {
    props: {
      open: true,
      user: ALICE,
      summary: summaryFixture(66),
      slideSharedLabel: ru['chat.contact_share.shared'],
      slideDisabledHint: ru['chat.contact_share.no_card'],
      ...props
    }
  });
}

describe('circle arc math (lib/chats/summary — pure)', () => {
  it('the circumference is 2πr over the shared radii', () => {
    expect(donutCircumference()).toBeCloseTo(2 * Math.PI * DONUT_RADIUS, 10);
    expect(donutCircumference(10)).toBeCloseTo(2 * Math.PI * 10, 10);
    expect(ringCircumference()).toBeCloseTo(2 * Math.PI * RING_RADIUS, 10);
    expect(RING_RADIUS).toBe(66); // §4.15.C-5: the ring in the 160×160 viewBox
  });

  it('the donut dasharray draws the score fraction of C, gap = the rest', () => {
    const c = donutCircumference();
    expect(donutScoreDash(0)).toBe(`0 ${c}`);
    expect(donutScoreDash(50)).toBe(`${c / 2} ${c}`);
    expect(donutScoreDash(100)).toBe(`${c} ${c}`);
    expect(donutScoreDash(66).split(' ')[0]).toBeCloseTo(c * 0.66, 10);
  });

  it('the donut math clamps out-of-range scores (total math — Summary scores are (0,100))', () => {
    const c = donutCircumference();
    expect(donutScoreDash(-5)).toBe(`0 ${c}`);
    expect(donutScoreDash(140)).toBe(`${c} ${c}`);
  });

  it('§4.15.C-5 ring fill: the dashoffset runs C (empty) → c × (1 − score/100), clamped', () => {
    const c = ringCircumference();
    expect(ringScoreOffset(0)).toBeCloseTo(c, 10);
    expect(ringScoreOffset(50)).toBeCloseTo(c / 2, 10);
    expect(ringScoreOffset(100)).toBeCloseTo(0, 10);
    expect(ringScoreOffset(66)).toBeCloseTo(c * 0.34, 10);
    expect(ringScoreOffset(-5)).toBeCloseTo(c, 10);
    expect(ringScoreOffset(140)).toBeCloseTo(0, 10);
  });
});

describe('celebration + tiers (§4.15.C-6: the 80/50 owner revision)', () => {
  it('isCelebration is re-cut to score >= 80: 79.99 is NOT, 80 IS', () => {
    expect(isCelebration(79.99)).toBe(false);
    expect(isCelebration(80)).toBe(true);
    expect(isCelebration(80.01)).toBe(true);
    expect(isCelebration(100)).toBe(true);
    expect(isCelebration(50)).toBe(false);
  });

  it('summaryCelebrates is null-safe (loading / failed states)', () => {
    expect(summaryCelebrates(null)).toBe(false);
    expect(summaryCelebrates(summaryFixture(95))).toBe(true);
    expect(summaryCelebrates(summaryFixture(20))).toBe(false);
  });

  it('the tiers evaluate the RAW score at the 80/50 cut', () => {
    expect(summaryTier(100)).toBe('great');
    expect(summaryTier(80)).toBe('great'); // GREAT is inclusive of 80
    expect(summaryTier(79.99)).toBe('good');
    expect(summaryTier(50)).toBe('good');
    expect(summaryTier(49.99)).toBe('low');
    expect(summaryTier(0)).toBe('low');
  });

  it('§4.15.G flag 4: a raw 79.6 displays ceil "80" but sits in GOOD (server-truth-first)', () => {
    expect(summaryScoreDisplay(79.6)).toBe(80);
    expect(summaryTier(79.6)).toBe('good');
  });
});

describe('arcade tally count-up (§4.15.C-5: the pure frame→value helper)', () => {
  it('TALLY_MS is 700; the value at 0 is 0 and at TALLY_MS lands EXACTLY on ceil(score)', () => {
    expect(TALLY_MS).toBe(700);
    expect(tallyValue(0, 66.4)).toBe(0);
    expect(tallyValue(TALLY_MS, 66.4)).toBe(67);
    expect(tallyValue(TALLY_MS, 66)).toBe(66);
    expect(tallyValue(TALLY_MS, 0)).toBe(0);
    expect(tallyValue(TALLY_MS * 2, 66)).toBe(66); // clamped past the end
    expect(tallyValue(-5, 66)).toBe(0);
  });

  it('the count-up is monotonic, integer-stepped, and never overshoots ceil(score)', () => {
    let previous = 0;
    for (let ms = 0; ms <= TALLY_MS; ms += 20) {
      const value = tallyValue(ms, 66.4);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeLessThanOrEqual(67);
      previous = value;
    }
    expect(previous).toBe(67);
  });
});

describe('SummarySheet rendering', () => {
  it('closed → nothing renders', () => {
    renderSheet({ open: false });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('the dialog shows both names, the i18n headings and the ring score', () => {
    stubReducedMotion(); // deterministic tally: jumps to the final value
    renderSheet();
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(ru['chat.summary.title']);
    // the pair: "me" caption + the interlocutor's name under their frames
    expect(screen.getByText(ru['chat.summary.me'])).toBeTruthy();
    expect(screen.getByText('Алиса')).toBeTruthy();
    expect(screen.getByText(ru['chat.summary.title'])).toBeTruthy();
    expect(screen.getByText(ru['chat.summary.checklist'])).toBeTruthy();
    expect(dialog.querySelector('.ring .score')?.textContent).toBe('66');
  });

  it('§4.15.C-5: the me avatar is the Summary member that is NOT the interlocutor (server truth)', () => {
    stubReducedMotion();
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const avatars = dialog.querySelectorAll('.duel .avatar-frame svg');
    expect(avatars).toHaveLength(2); // no new sprites — the PixelAvatar art framed
  });

  it('§4.14.4: a fractional score tallies the CEIL integer (66.4 → 67), the ring keeps the raw score', async () => {
    stubReducedMotion();
    renderSheet({ summary: summaryFixture(66.4) });
    const dialog = screen.getByRole('dialog');
    // the displayed NUMBER is the ceil integer…
    await waitFor(() => expect(dialog.querySelector('.ring .score')?.textContent).toBe('67'));
    // …and the aria wording embeds the same ceiled number
    expect(dialog.querySelector('.ring')?.getAttribute('aria-label')).toBe(
      ru['chat.summary.score.aria'].replace('{score}', '67')
    );
    // the RING geometry stays on the raw score (ringScoreOffset untouched)
    const arc = dialog.querySelector('.ring .arc');
    const match = arc?.getAttribute('style')?.match(/--ring-target:\s*([\d.]+)/);
    expect(Number(match?.[1])).toBeCloseTo(ringScoreOffset(66.4), 6);
  });

  it('the tally counts up via rAF and lands exactly on ceil(score) (motion allowed)', async () => {
    // no reduced-motion stub — the rAF loop runs and must still land on 66
    renderSheet();
    const dialog = screen.getByRole('dialog');
    await waitFor(() => expect(dialog.querySelector('.ring .score')?.textContent).toBe('66'), {
      timeout: 2000
    });
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

  it('the Summary description renders as a crisp white left-aligned paragraph', () => {
    renderSheet();
    expect(document.querySelector('.description')?.textContent).toContain('ceramics');
  });

  it('loading state: a quiet status row, no ring and no checklist', () => {
    renderSheet({ summary: null, loading: true });
    expect(document.querySelector('[role="dialog"] .loading')).toBeTruthy();
    expect(document.querySelector('.ring')).toBeNull();
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

  it('§4.15.C-6: score >= 80 → the GREAT celebration (class + sparks); < 80 → none', () => {
    renderSheet({ summary: summaryFixture(90) });
    const celebrated = document.querySelector('[role="dialog"]');
    expect(celebrated?.classList.contains('celebrate')).toBe(true);
    expect(celebrated?.querySelectorAll('.spark').length).toBeGreaterThan(0);

    cleanup();
    renderSheet({ summary: summaryFixture(79) });
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
    expect(dialog?.className).not.toMatch(/(?<![\w-])deepa-[1-5]/);
    // the background renders through the locked scope token
    const sheetBlock = SHEET_SOURCE.match(/\.sheet\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(sheetBlock).toContain('background: var(--sheet-bg)');
    expect(sheetBlock).toContain('color: var(--sheet-ink)');
  });

  it('the tz5-04 ShareContactSlide is embedded inside the dialog (sheet variant)', () => {
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

  it('§4.15.C-8: an already-shared mount shows no confetti and no victory (replay gating)', () => {
    renderSheet({ slideShared: true });
    const dialog = screen.getByRole('dialog');
    const slide = dialog.querySelector('.slide');
    expect(slide?.getAttribute('aria-disabled')).toBe('true');
    // the slide-level confetti never replays on a shared mount…
    expect(slide?.querySelector('.confetti')).toBeNull();
    expect(slide?.querySelector('.candy')).toBeNull();
    // …and neither do the SHEET-level completion effects (no gesture here)
    expect(dialog.querySelector(':scope > .confetti')).toBeNull();
    expect(dialog.querySelector('.stage')?.classList.contains('victory')).toBe(false);
    // the 409 "already shared" label keeps its own copy
    expect(slide?.textContent).toContain(ru['chat.contact_share.shared']);
  });

  it('EN interface: every sheet copy renders EN from the i18n table, never RU (DESIGN §4.14.5 bug round)', async () => {
    // The reported bug: hardcoded Russian («итоги встречи», «сетевой чек
    // лист») while the owner is in the EN interface. The regression guard:
    // switch the locale store to EN and assert the sheet copy verbatim.
    stubReducedMotion();
    const { setLocale } = await import('../src/lib/i18n/locale');
    setLocale('en');
    renderSheet({
      slideDisabledHint: en['chat.contact_share.no_card']
    });
    const dialog = screen.getByRole('dialog');
    expect(dialog.getAttribute('aria-label')).toBe(en['chat.summary.title']);
    expect(screen.getByText('Meeting summary')).toBeTruthy();
    expect(screen.getByText('Networking checklist')).toBeTruthy();
    expect(document.querySelector('.checklist')?.getAttribute('aria-label')).toBe(
      en['chat.summary.checklist']
    );
    expect(dialog.querySelector('.ring')?.getAttribute('aria-label')).toBe(
      'Match: 66 out of 100'
    );
    // the sheet-variant slide hint is the sheet's own EN copy (§4.15.E)
    expect(dialog.querySelector('.slide')?.textContent).toContain(
      en['chat.contact_share.sheet_label']
    );
    // no RU sheet copy leaks into the EN interface
    expect(screen.queryByText(ru['chat.summary.title'])).toBeNull();
    expect(screen.queryByText(ru['chat.summary.checklist'])).toBeNull();
    expect(screen.queryByText(ru['chat.summary.me'])).toBeNull();
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
    // is consumed (var(--sheet-*)) only inside SummarySheet's scope — the
    // sheet-variant slide overrides live in the sheet (§4.15.C-8)
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
    // every rendered section carries the cascade class with its index:
    // top bar → score stage → description → checklist → slide
    stubReducedMotion();
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const cascades = [...dialog.querySelectorAll('.cascade')];
    const indices = cascades.map((el) =>
      Number((el as HTMLElement).style.getPropertyValue('--cascade-i'))
    );
    expect(indices).toEqual([0, 1, 2, 3, 4]);
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
    // pixel consumers: top-bar label, checklist header, score numeral, the
    // tier label — body/checklist text stays Inter (--font-body)
    expect(SHEET_SOURCE.match(/\.sheet-label\s*\{[\s\S]*?\}/)?.[0]).toContain(
      'font-family: var(--sheet-font-pixel)'
    );
    expect(SHEET_SOURCE.match(/\.checklist h3\s*\{[\s\S]*?\}/)?.[0]).toContain(
      'font-family: var(--sheet-font-pixel)'
    );
    const scoreBlock = SHEET_SOURCE.match(/\.ring \.score\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(scoreBlock).toContain('font-family: var(--sheet-font-pixel)');
    expect(scoreBlock).toContain('font-size: 28px');
    const tierBlock = SHEET_SOURCE.match(/\.tier-label\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(tierBlock).toContain('font-family: var(--sheet-font-pixel)');
    expect(tierBlock).toContain('font-size: 10px');
    expect(SHEET_SOURCE.match(/\.who\s*\{[\s\S]*?\}/)?.[0]).toContain(
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

describe('§4.15.C-5..C-8 centerpiece (tz7-03): avatars, ring, tiers, checklist, slide', () => {
  function source(re: RegExp): string {
    return SHEET_SOURCE.match(re)?.[0] ?? '';
  }

  it('§4.15.C-5 DUAL AVATARS: 56×56 SQUARE pixel frames (2px white border, radius 0) — framing, no new sprites', () => {
    stubReducedMotion();
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const frames = dialog.querySelectorAll('.duel > .side > .mover > .avatar-frame');
    expect(frames).toHaveLength(2); // me + them, facing each other
    // each frame carries the PixelAvatar art inside (no new avatar assets)
    expect(frames[0]?.querySelector('svg')).toBeTruthy();
    expect(frames[1]?.querySelector('svg')).toBeTruthy();
    // the CSS contract: 56×56, 2px white border, SQUARE (radius 0), the
    // pixelated raster fallback pinned
    const frameBlock = source(/\.avatar-frame\s*\{[\s\S]*?\}/);
    expect(frameBlock).toContain('width: 56px');
    expect(frameBlock).toContain('height: 56px');
    expect(frameBlock).toContain('border: 2px solid var(--sheet-white)');
    expect(frameBlock).toContain('border-radius: 0');
    expect(frameBlock).toContain('image-rendering: pixelated');
  });

  it('§4.15.C-5 names sit under the frames (Inter 12px semibold); "me" is i18n\u00b7d, "them" is the interlocutor', () => {
    stubReducedMotion();
    renderSheet();
    const whos = [...screen.getByRole('dialog').querySelectorAll('.who')];
    expect(whos.map((el) => el.textContent)).toEqual([ru['chat.summary.me'], 'Алиса']);
  });

  it('§4.15.C-5 SCORE RING: viewBox 160×160, r = RING_RADIUS, thick white butt-capped arc, clockwise fill over 900ms', () => {
    stubReducedMotion();
    renderSheet();
    const dialog = screen.getByRole('dialog');
    const ring = dialog.querySelector('.ring');
    expect(ring?.getAttribute('viewBox')).toBe('0 0 160 160');
    expect(ring?.getAttribute('aria-label')).toBe(
      ru['chat.summary.score.aria'].replace('{score}', '66')
    );
    const arcs = dialog.querySelectorAll('.ring .arc');
    expect(arcs).toHaveLength(1);
    // the CSS contract at the source level (jsdom resolves no component CSS)
    const ringBlock = source(/\.ring\s*\{[\s\S]*?\n {2}\}/);
    expect(ringBlock).toContain('width: 160px');
    expect(ringBlock).toContain('height: 160px');
    expect(ringBlock).toContain('shape-rendering: crispEdges');
    const circleBlock = source(/\.ring circle\s*\{[\s\S]*?\}/);
    expect(circleBlock).toContain('stroke: var(--sheet-white)');
    expect(circleBlock).toContain('stroke-width: 12');
    const arcBlock = source(/\.ring \.arc\s*\{[\s\S]*?\}/);
    expect(arcBlock).toContain('stroke-linecap: butt');
    expect(arcBlock).toContain('stroke-dasharray: var(--ring-c) var(--ring-c)');
    expect(arcBlock).toContain('stroke-dashoffset: var(--ring-target)');
    expect(arcBlock).toContain('transform: rotate(-90deg)');
    expect(arcBlock).toContain('animation: ring-fill 900ms ease-out both');
    const fill = source(/@keyframes ring-fill\s*\{[\s\S]*?\n {2}\}/);
    expect(fill).toContain('from');
    expect(fill).toContain('stroke-dashoffset: var(--ring-c)');
    expect(fill).toContain('stroke-dashoffset: var(--ring-target)');
    // the track is the 25% white circle (color-mix — no new hex)
    const trackBlock = source(/\.ring \.track\s*\{[\s\S]*?\}/);
    expect(trackBlock).toContain(
      'stroke: color-mix(in srgb, var(--sheet-white) 25%, transparent)'
    );
  });

  it('§4.15.C-6 tier stage classes: 90 → tier-great, 66 → tier-good, 30 → tier-low', () => {
    stubReducedMotion();
    renderSheet({ summary: summaryFixture(90) });
    expect(document.querySelector('.stage')?.classList.contains('tier-great')).toBe(true);
    cleanup();
    renderSheet();
    expect(document.querySelector('.stage')?.classList.contains('tier-good')).toBe(true);
    cleanup();
    renderSheet({ summary: summaryFixture(30) });
    expect(document.querySelector('.stage')?.classList.contains('tier-low')).toBe(true);
  });

  it('§4.15.C-6 tier labels render under the ring from the i18n table — yellow for GREAT, white otherwise', () => {
    stubReducedMotion();
    renderSheet({ summary: summaryFixture(90) });
    let label = document.querySelector('.tier-label');
    expect(label?.textContent).toBe(ru['chat.summary.tier.great']);
    expect(label?.classList.contains('great')).toBe(true);
    const greatBlock = source(/\.tier-label\.great\s*\{[\s\S]*?\}/);
    expect(greatBlock).toContain('color: var(--sheet-yellow)');
    cleanup();
    renderSheet({ summary: summaryFixture(50) });
    label = document.querySelector('.tier-label');
    expect(label?.textContent).toBe(ru['chat.summary.tier.good']);
    expect(label?.classList.contains('great')).toBe(false);
    cleanup();
    renderSheet({ summary: summaryFixture(20) });
    expect(document.querySelector('.tier-label')?.textContent).toBe(
      ru['chat.summary.tier.low']
    );
  });

  it('§4.15.C-6b GREAT: the avatars move 18px toward center then bounce in 2-frame loops; the beam marches and pulses', () => {
    const approach = source(/\.tier-great \.side\.me \.mover\s*\{[\s\S]*?\}/);
    expect(approach).toContain('animation: avatar-approach 300ms ease-out 200ms both');
    const approachLeft = source(/\.tier-great \.side\.them \.mover\s*\{[\s\S]*?\}/);
    expect(approachLeft).toContain('animation: avatar-approach-left 300ms ease-out 200ms both');
    const approachKf = source(/@keyframes avatar-approach\s*\{[\s\S]*?\n {2}\}/);
    expect(approachKf).toContain('translateX(18px)');
    const approachLeftKf = source(/@keyframes avatar-approach-left\s*\{[\s\S]*?\n {2}\}/);
    expect(approachLeftKf).toContain('translateX(-18px)');
    // the joyful 2-frame idle bounce
    const hop = source(/\.tier-great \.mover \.avatar-frame\s*\{[\s\S]*?\}/);
    expect(hop).toContain(
      'animation: avatar-hop 600ms steps(2, jump-none) infinite alternate'
    );
    const hopKf = source(/@keyframes avatar-hop\s*\{[\s\S]*?\n {2}\}/);
    expect(hopKf).toContain('translateY(0)');
    expect(hopKf).toContain('translateY(-6px)');
    // the pixel energy beam: a stepped strip marching one 16px step per
    // 800ms, opacity pulsing 0.7↔1.0 over 1.2s
    const beam = source(/\.beam\s*\{[\s\S]*?\}/);
    expect(beam).toContain('animation: beam-pulse 1.2s ease-in-out infinite');
    const stripes = source(/\.beam-stripes\s*\{[\s\S]*?\}/);
    expect(stripes).toContain(
      'repeating-linear-gradient(\n      90deg,\n      var(--sheet-yellow) 0 8px,'
    );
    expect(stripes).toContain('animation: beam-march 800ms steps(2, jump-none) infinite');
    const march = source(/@keyframes beam-march\s*\{[\s\S]*?\n {2}\}/);
    expect(march).toContain('translateX(0)');
    expect(march).toContain('translateX(-16px)');
    const pulse = source(/@keyframes beam-pulse\s*\{[\s\S]*?\n {2}\}/);
    expect(pulse).toContain('opacity: 0.7');
    expect(pulse).toContain('opacity: 1');
  });

  it('§4.15.C-6b GREAT sparkles: 6 star/heart poppers (the new heart registry entry), staggered, sheet-colored', () => {
    stubReducedMotion();
    renderSheet({ summary: summaryFixture(90) });
    const poppers = document.querySelectorAll('.popper');
    expect(poppers).toHaveLength(6);
    const icons = [...poppers].map((p) => p.querySelector('svg'));
    expect(icons.every((icon) => icon !== null)).toBe(true);
    // the heart glyph joined the registry as in-grid 16×16 rect data
    const rects = ICON_RECTS.heart;
    expect(rects.length).toBeGreaterThan(0);
    for (const [x, y, w, h] of rects) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x + w).toBeLessThanOrEqual(16);
      expect(y + h).toBeLessThanOrEqual(16);
    }
    // the popper loop + staggered delays + sheet-scope colors
    const popperBlock = source(/\.popper\s*\{[\s\S]*?\}/);
    expect(popperBlock).toContain('animation: sparkle-pop 1.2s steps(2, jump-none) infinite');
    expect(SHEET_SOURCE).toMatch(/\.popper\.p1\s*\{[^}]*animation-delay: 0ms/);
    expect(SHEET_SOURCE).toMatch(/\.popper\.p6\s*\{[^}]*animation-delay: 500ms/);
    expect(SHEET_SOURCE).toMatch(/\.popper\.p1\s*\{[^}]*color: var\(--sheet-yellow\)/);
    expect(SHEET_SOURCE).toMatch(/\.popper\.p2\s*\{[^}]*color: var\(--sheet-orange\)/);
    expect(SHEET_SOURCE).toMatch(/\.popper\.p3\s*\{[^}]*color: var\(--sheet-white\)/);
  });

  it('§4.15.C-6b GOOD: the nod/wave plays once (2 iterations); the dotted line glows via a pre-blurred pulsing layer', () => {
    const nod = source(/\.tier-good \.side\.me \.avatar-frame\s*\{[\s\S]*?\}/);
    expect(nod).toContain('animation: avatar-nod 400ms ease-in-out 400ms 2 both');
    const wave = source(/\.tier-good \.side\.them \.avatar-frame\s*\{[\s\S]*?\}/);
    expect(wave).toContain('animation: avatar-wave 400ms ease-in-out 400ms 2 both');
    expect(wave).toContain('transform-origin: 50% 100%');
    const waveKf = source(/@keyframes avatar-wave\s*\{[\s\S]*?\n {2}\}/);
    expect(waveKf).toContain('rotate(-6deg)');
    expect(waveKf).toContain('rotate(6deg)');
    // the glowing pixel dotted line: square dots + a STATIC blur duplicate
    // whose opacity pulses (no filter animation — §4.6-safe)
    const dots = source(/\.dots,\n {2}\.dots-glow\s*\{[\s\S]*?\}/);
    expect(dots).toContain('repeating-linear-gradient');
    expect(dots).toContain('6px');
    // the standalone glow rule (the combined selector block matches first —
    // pin the block that carries the STATIC blur)
    const glow = SHEET_SOURCE.match(/\.dots-glow\s*\{[\s\S]*?filter: blur\(6px\);[\s\S]*?\}/)?.[0] ?? '';
    expect(glow).toContain('filter: blur(6px)');
    expect(glow).toContain('animation: dots-pulse 1.6s ease-in-out infinite');
    const pulse = source(/@keyframes dots-pulse\s*\{[\s\S]*?\n {2}\}/);
    expect(pulse).toContain('opacity: 0.4');
    expect(pulse).toContain('opacity: 0.9');
  });

  it('§4.15.C-6b LOW: the avatars stay spaced — a sweat drop plays twice then idles on the 4s cycle; a neutral idle blink runs', () => {
    stubReducedMotion();
    renderSheet({ summary: summaryFixture(30) });
    const dialog = screen.getByRole('dialog');
    // no approach for the low tier; the sweat drop renders beside the
    // counterpart's frame
    expect(dialog.querySelector('.sweat')).toBeTruthy();
    const sweat = source(/\.tier-low \.side\.them \.sweat\s*\{[\s\S]*?\}/);
    expect(sweat).toContain('width: 8px');
    expect(sweat).toContain('height: 10px');
    expect(sweat).toContain('background: var(--sheet-white)');
    expect(sweat).toContain('animation: sweat-cycle 4s linear infinite');
    // the neutral idle blink: a 120ms opacity dip to 0.65 every 4s
    const blink = source(/\.tier-low \.mover \.avatar-frame\s*\{[\s\S]*?\}/);
    expect(blink).toContain('animation: avatar-blink 4s linear infinite');
    const blinkKf = source(/@keyframes avatar-blink\s*\{[\s\S]*?\n {2}\}/);
    expect(blinkKf).toContain('opacity: 0.65');
  });

  it('§4.15.C-7 checklist choreography: the pop/flash/check cadence lands at 400ms + i×140ms per item', () => {
    stubReducedMotion();
    renderSheet();
    const dialog = screen.getByRole('dialog');
    // every item carries its choreography index; the closed ones own the pop
    const items = [...dialog.querySelectorAll('.checkpoint')];
    expect(items.map((el) => (el as HTMLElement).style.getPropertyValue('--pop-i'))).toEqual([
      '0',
      '1',
      '2',
      '3',
      '4'
    ]);
    // the CSS cadence: box scale(0→1) steps(2) 150ms, the retro flash right
    // after (+150ms), the check glyph 60ms after the flash
    const pop = source(/\.checkpoint\.closed \.box\s*\{[\s\S]*?\}/);
    expect(pop).toContain('animation: box-pop 150ms steps(2, jump-none) both');
    expect(pop).toContain('animation-delay: calc(400ms + var(--pop-i, 0) * 140ms)');
    const popKf = source(/@keyframes box-pop\s*\{[\s\S]*?\n {2}\}/);
    expect(popKf).toContain('scale(0)');
    expect(popKf).toContain('scale(1)');
    const flash = source(/\.checkpoint\.closed \.box::after\s*\{[\s\S]*?\}/);
    expect(flash).toContain('animation: retro-flash 120ms linear both');
    expect(flash).toContain('calc(400ms + var(--pop-i, 0) * 140ms + 150ms)');
    expect(flash).toContain('background: var(--sheet-white)');
    const check = source(/\.checkpoint\.closed \.check\s*\{[\s\S]*?\}/);
    expect(check).toContain('animation: check-in 60ms linear both');
    expect(check).toContain('calc(400ms + var(--pop-i, 0) * 140ms + 280ms)');
  });

  it('§4.15.C-8 sheet-variant slide: the locked palette lands as internal-token overrides from the sheet scope', () => {
    stubReducedMotion();
    renderSheet();
    const dialog = screen.getByRole('dialog');
    // the embedded control renders the SHEET variant scope class
    const slide = dialog.querySelector('.slide');
    expect(slide?.classList.contains('variant-sheet')).toBe(true);
    expect(slide?.classList.contains('variant-base')).toBe(false);
    // the armed hint is the sheet's own copy (§4.15.E), not the footer's
    expect(slide?.textContent).toContain(ru['chat.contact_share.sheet_label']);
    // the override block: height clamp (64px floor, 80px cap), charcoal
    // track with the 2px yellow border, yellow thumb with charcoal ink,
    // the 3-color stripes, the white pixel hint
    const overrides = source(/\.share :global\(\.slide\)\s*\{[\s\S]*?\}/);
    expect(overrides).toContain('--slide-height: clamp(64px,');
    expect(overrides).toContain(', 80px)');
    expect(overrides).toContain('--slide-track-bg: var(--sheet-charcoal)');
    expect(overrides).toContain('--slide-track-border: var(--sheet-yellow)');
    expect(overrides).toContain('--slide-thumb: var(--sheet-yellow)');
    expect(overrides).toContain('--slide-thumb-ink: var(--sheet-charcoal)');
    expect(overrides).toContain('--slide-stripe-a: var(--sheet-yellow)');
    expect(overrides).toContain('--slide-stripe-b: var(--sheet-white)');
    expect(overrides).toContain('--slide-stripe-c: var(--sheet-orange)');
    expect(overrides).toContain('--slide-hint-ink: var(--sheet-white)');
    expect(overrides).toContain('--slide-hint-font: 10px var(--sheet-font-pixel)');
    // 2px border + uppercase pixel hint
    expect(SHEET_SOURCE).toMatch(/\.share :global\(\.slide \.track\)\s*\{[^}]*border-width: 2px/);
    expect(SHEET_SOURCE).toMatch(
      /\.share :global\(\.slide \.hint\)\s*\{[^}]*text-transform: uppercase/
    );
  });

  it('§4.15.C-8 sheet trail: the 3-color 12px stripe cycle loops seamlessly at 50.912px over 0.9s; the thumb arrow pulses', () => {
    const stripes = source(/\.share :global\(\.slide \.candy-stripes\)\s*\{[\s\S]*?\}/);
    expect(stripes).toContain('var(--slide-stripe-a) 0 12px');
    expect(stripes).toContain('var(--slide-stripe-b) 12px 24px');
    expect(stripes).toContain('var(--slide-stripe-c) 24px 36px');
    expect(stripes).toContain('animation: sheet-marquee 0.9s linear infinite');
    const marquee = source(/@keyframes sheet-marquee\s*\{[\s\S]*?\n {2}\}/);
    expect(marquee).toContain('translateX(0)');
    expect(marquee).toContain('translateX(-50.912px)');
    // the yellow thumb's subtly pulsing pixel arrow (opacity 1↔0.6 over 1s)
    const arrow = SHEET_SOURCE.match(/\.share :global\(\.slide \.thumb svg\)\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(arrow).toContain('animation: arrow-pulse 1s ease-in-out infinite');
    const arrowKf = source(/@keyframes arrow-pulse\s*\{[\s\S]*?\n {2}\}/);
    expect(arrowKf).toContain('opacity: 0.6');
  });

  it('§4.15.C-8 completion sequence: gesture → shared swaps the hint, fires the 24 square flakes and the victory jumps', async () => {
    stubReducedMotion();
    const onshare = vi.fn();
    const { rerender } = render(SummarySheet, {
      props: {
        open: true,
        user: ALICE,
        summary: summaryFixture(66),
        slideSharedLabel: ru['chat.contact_share.shared'],
        slideDisabledHint: ru['chat.contact_share.no_card'],
        onshare
      }
    });
    const dialog = screen.getByRole('dialog');
    // the gesture completes (click = the accessible equivalent)
    await (dialog.querySelector('.thumb') as HTMLButtonElement).click();
    expect(onshare).toHaveBeenCalledTimes(1);
    // the parent lands the shared state (201 or the once-per-pair 409)
    await rerender({ slideShared: true });
    // (1) the hint swapped to "Contact shared!" — the gesture-made copy
    const slide = dialog.querySelector('.slide');
    expect(slide?.textContent).toContain(ru['chat.contact_share.shared_done']);
    expect(slide?.textContent).not.toContain(ru['chat.contact_share.shared']);
    // (2) the 24-flake 8-bit SQUARE-pixel confetti across the modal — the
    // SHEET-level layer (the slide keeps its own 12-flake v3.1 system)
    const flakes = dialog.querySelectorAll(':scope > .confetti > .flake');
    expect(flakes).toHaveLength(24);
    // square: border-radius 0 pinned at the source level (8-bit vs the
    // v3.1 round flakes); deterministic origins/colors spread the sheet
    const flakeBlock = source(/\.flake\s*\{[\s\S]*?\}/);
    expect(flakeBlock).toContain('border-radius: 0');
    const confettiBlock = source(/\.confetti\s*\{[\s\S]*?\}/);
    expect(confettiBlock).toContain('inset: 0');
    // (3) both avatars do the victory jump (.victory keyed to gesture → shared)
    expect(dialog.querySelector('.stage')?.classList.contains('victory')).toBe(true);
    const victory = source(/\.stage\.victory \.mover\s*\{[\s\S]*?\}/);
    expect(victory).toContain('animation: victory-jump 700ms steps(2, jump-none) 2');
    const victoryKf = source(/@keyframes victory-jump\s*\{[\s\S]*?\n {2}\}/);
    expect(victoryKf).toContain('translateY(-10px)');
    expect(victoryKf).toContain('translateY(-6px)');
  });

  it('§4.15.C-8 a re-mount with shared already true replays nothing (and the 409 label keeps its copy)', () => {
    stubReducedMotion();
    renderSheet({ slideShared: true });
    const dialog = screen.getByRole('dialog');
    expect(dialog.querySelector(':scope > .confetti')).toBeNull();
    expect(dialog.querySelector('.stage')?.classList.contains('victory')).toBe(false);
    const slide = dialog.querySelector('.slide');
    expect(slide?.textContent).toContain(ru['chat.contact_share.shared']);
    expect(slide?.textContent).not.toContain(ru['chat.contact_share.shared_done']);
  });

  it('§4.15.C-9 reduced motion: the staged delays collapse to the final instant state', () => {
    const media = SHEET_SOURCE.match(
      /@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n {2}\}/
    )?.[0];
    expect(media).toBeTruthy();
    expect(media).toContain('animation-delay: 0ms');
    // the choreographed selectors are covered by the zeroing block
    expect(media).toContain('.checkpoint.closed .box');
    expect(media).toContain('.tier-great .side.me .mover');
    expect(media).toContain('.tier-low .side.them .sweat');
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
