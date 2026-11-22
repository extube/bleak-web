/**
 * Finished-chat summary helpers (CONCEPT §15.3, DESIGN §4.15.C) — the pure,
 * testable core of the SummarySheet surface:
 *
 * - the RING arc math (§4.15.C-5): a thick white SVG progress ring that
 *   fills CLOCKWISE 0 → score via `stroke-dashoffset` (the shipped donut
 *   precedent — §4.13.5 already animates SVG stroke geometry); the
 *   geometry home stays here, framework-free;
 * - the SCORE TIERS at the owner-revised 80/50 cut (§4.15.C-6, 2026-11-20 —
 *   supersedes the drafted 70/40 and §13.1.5's ">80 fireworks");
 * - the ARCADE TALLY count-up: a pure frame→value helper (rAF loop in the
 *   sheet component, 700ms cubic ease-out, integer steps — the displayed
 *   number lands exactly on the CEIL integer per §4.14.4);
 * - the celebration verdict: `isCelebration` re-cut to score >= 80 (GREAT
 *   is inclusive of 80 per the revision's "80–100"); `summaryCelebrates`
 *   keys off the same constant.
 *
 * Everything here is deterministic and framework-free so the sheet's
 * geometry can be asserted without mounting (tests/summary-sheet.test.ts).
 */
import type { Summary } from '@bleak/api-client';

/** Legacy donut radius (viewBox 120×120) — kept for the shared circle math. */
export const DONUT_RADIUS = 44;

/** §4.15.C-5 ring radius in the sheet's SVG user units (viewBox 160×160). */
export const RING_RADIUS = 66;

/** The full circle's circumference — the donut's/ring's 100% stroke length. */
export function donutCircumference(radius: number = DONUT_RADIUS): number {
  return 2 * Math.PI * radius;
}

/**
 * The score arc's `stroke-dasharray` for a 0..100 score: the drawn dash is
 * the score's fraction of the circumference, the gap is the rest (so the
 * arc never wraps past one full turn). Scores are clamped — a strictly
 * inside (0,100) Summary never trips this, but the math stays total.
 */
export function donutScoreDash(score: number, radius: number = DONUT_RADIUS): string {
  const c = donutCircumference(radius);
  const clamped = Math.min(Math.max(score, 0), 100);
  return `${(c * clamped) / 100} ${c}`;
}

/**
 * §4.15.C-5 RING FILL: the arc is drawn with `stroke-dasharray` = the full
 * circumference and animates `stroke-dashoffset` from the full C (empty)
 * to `c × (1 − score/100)` (the score fraction, clockwise from 12 o'clock).
 * The raw score drives the geometry (the DISPLAY keeps the ceil —
 * summaryScoreDisplay below); scores are clamped (total math).
 */
export function ringCircumference(radius: number = RING_RADIUS): number {
  return donutCircumference(radius);
}

export function ringScoreOffset(score: number, radius: number = RING_RADIUS): number {
  const c = ringCircumference(radius);
  const clamped = Math.min(Math.max(score, 0), 100);
  return c * (1 - clamped / 100);
}

/**
 * The sheet's score number renders as a CEIL integer (DESIGN §4.14.4 sheet
 * polish): a fractional score (e.g. 66.4) displays as 67 — in the ring's
 * tally, in the aria wording that embeds the number, and as the tally's
 * landing value. The RING geometry itself keeps the raw score
 * (ringScoreOffset — untouched); only the displayed number rounds up.
 */
export function summaryScoreDisplay(score: number): number {
  return Math.ceil(score);
}

/**
 * Score >= 80 → the GREAT-tier celebration (§4.15.C-6, owner revision
 * 2026-11-20: GREAT is INCLUSIVE of 80 per the "80–100" band — re-cut from
 * the shipped `> 80`). The recolored spark burst + brightness pulse run on
 * this tier.
 */
export function isCelebration(score: number): boolean {
  return score >= 80;
}

/** The celebration verdict for a whole Summary (null-safe for the sheet). */
export function summaryCelebrates(summary: Summary | null): boolean {
  return summary !== null && isCelebration(summary.score);
}

/**
 * §4.15.C-6 SCORE TIERS — the owner-revised 80/50 cut on the RAW Summary
 * score (the display keeps the ceil: a raw 79.6 shows "80" but sits in
 * GOOD — server-truth-first, flagged in DESIGN §4.15.G).
 *   GREAT 80–100 · GOOD 50–79 · LOW 0–49.
 */
export type SummaryTier = 'great' | 'good' | 'low';

export function summaryTier(score: number): SummaryTier {
  if (isCelebration(score)) return 'great';
  return score >= 50 ? 'good' : 'low';
}

/**
 * §4.15.C-5 ARCADE TALLY: the pure frame→value helper behind the sheet's
 * rAF count-up. The value at `elapsedMs` (0..TALLY_MS) is the cubic
 * ease-out interpolation of the CEIL target, rounded UP at every step so
 * the tally shows integer steps and lands EXACTLY on ceil(score) at the
 * end (t = 1 → ease = 1 → the target itself).
 */
export const TALLY_MS = 700;

export function tallyEase(t: number): number {
  const x = Math.min(Math.max(t, 0), 1);
  return 1 - Math.pow(1 - x, 3);
}

export function tallyValue(elapsedMs: number, score: number): number {
  const target = summaryScoreDisplay(score);
  return Math.ceil(target * tallyEase(elapsedMs / TALLY_MS));
}
