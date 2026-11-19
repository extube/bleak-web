/**
 * Finished-chat summary helpers (CONCEPT §13.1.5, DESIGN §4.13.5 R5) —
 * the pure, testable core of the SummarySheet surface:
 *
 * - the DONUT arc math: an SVG stroke-dasharray over the circle's
 *   circumference (no chart library — tokens/CSS only, tz constraint);
 * - the celebration threshold: score STRICTLY above 80 → the CSS fireworks
 *   + brightness-pulse class (the criteria's "> 80");
 *
 * Everything here is deterministic and framework-free so the sheet's
 * geometry can be asserted without mounting (tests/summary-sheet.test.ts).
 */
import type { Summary } from '@bleak/api-client';

/** Donut radius in the sheet's SVG user units (viewBox 120×120). */
export const DONUT_RADIUS = 44;

/** The full circle's circumference — the donut's 100% stroke length. */
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

/** Score strictly above 80 → the fireworks + brightness celebration. */
export function isCelebration(score: number): boolean {
  return score > 80;
}

/** The celebration verdict for a whole Summary (null-safe for the sheet). */
export function summaryCelebrates(summary: Summary | null): boolean {
  return summary !== null && isCelebration(summary.score);
}
