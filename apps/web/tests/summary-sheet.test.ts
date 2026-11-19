/** SummarySheet component tests (CONCEPT §13.1.5, DESIGN §4.13.5 — new
 * surface, named growth reason): the donut arc math (pure lib/chats/summary),
 * the checklist closed/open states, the > 80 fireworks threshold, the
 * embedded ShareContactSlide (tz5-04 reuse) and the Deepa hue background
 * pairing. The hosting-page trigger behaviors live in transcript-page tests;
 * the sharing/gesture logic is covered by the ShareContactSlide control's
 * own suite. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
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
import { codeHue } from '../src/lib/avatar/traits';
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

  it('§4.14.4 checkbox CSS contract: bordered square, green check via the token, no raw hex', () => {
    // jsdom resolves no component CSS — the box geometry contract is pinned
    // at the source level (same pattern as the §4.14.4 width contract).
    const boxBlock = SHEET_SOURCE.match(/\.checkpoint \.box\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(boxBlock).toContain('border:');
    // SQUARE: width === height (no pill rounding, no aspect distortion)
    const width = boxBlock.match(/width:\s*([\d.]+px)/)?.[1];
    const height = boxBlock.match(/height:\s*([\d.]+px)/)?.[1];
    expect(width).toBeTruthy();
    expect(height).toBe(width);
    // the green check sign comes from the token, never raw hex (§2.4)
    expect(SHEET_SOURCE).toContain('.checkpoint .check');
    const checkBlock = SHEET_SOURCE.match(/\.checkpoint \.check\s*\{[\s\S]*?\}/)?.[0] ?? '';
    expect(checkBlock).toContain('var(--color-check-green)');
    expect(SHEET_SOURCE).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    // the token exists in tokens.css (sourced from the approved Deepa green)
    const tokensCss = readFileSync(join(WEB_ROOT, 'src/lib/styles/tokens.css'), 'utf8');
    expect(tokensCss).toMatch(/--color-check-green:\s*var\(--color-deepa-1\)/);
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

  it('the sheet background pairs the interlocutor Deepa hue with its ink token class', () => {
    renderSheet({ summary: summaryFixture(50) });
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.classList.contains(codeHue(ALICE.address))).toBe(true);
    expect(dialog?.className).toMatch(/deepa-[1-5]/);
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
