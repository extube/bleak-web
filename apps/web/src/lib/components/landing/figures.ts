/**
 * Landing mascot cast — part data (DESIGN §4.20.J as amended by §4.22.D/§I
 * and §4.22.1, §4.3 rules): two DISTINCT original figures — BLEAK (the
 * agent-card portrait, promoted to the shared personage module §4.22.E)
 * and BLOOM — no figure reuses another's parts and none is drawn twice on
 * the page. All are hand-authored SVG `<rect>` art on their own grid,
 * `crispEdges`, dot eyes, chunky pixels, transparent background — NO
 * background plates (Concept §23/§32). The §4.21.A drawn hero pair is
 * RETIRED with the drawn hero scene (§4.22.G — the video carries its own
 * cast); BYTE retired earlier (§4.21.A); PIP + GLITCH retired with the
 * mascot-chat strip (§4.22.1 owner amendment).
 *
 * BLEAK's rect data lives in `personage/bleakFigure.ts` (the ONE shared
 * source consumed by both the landing card and every `/income*` mascot
 * mount) and is re-exported here as the `bleak` entry — byte-identical art,
 * only the name changed (§4.22.D).
 *
 * Fills are token references only (§4.1) — the landing accent is the
 * approved Deepa violet (--color-deepa-4, the example's purple bloom);
 * shading stays in `color-mix` alpha variants of existing tokens.
 */
import { BLEAK_FIGURE } from '../personage/bleakFigure';

export type FigureName = 'bleak' | 'bloom';

export interface FigurePart {
  fill: string;
  rects: readonly (readonly [number, number, number, number])[];
}

export interface Figure {
  /** Logical grid size. */
  grid: number;
  /** Explicit viewBox dims (§4.21.A interface kept; the square figures are 32×32 / 16×16). */
  viewW: number;
  viewH: number;
  parts: readonly FigurePart[];
}

export const LANDING_FIGURES: Record<FigureName, Figure> = {
  /* BLEAK (renamed per §4.22.D): the agent character card portrait — an
   * agent in a sharp suit, monocle visor, accent tie. 32×32 → 96px. The
   * rect data is the shared personage module's (byte-identical to the
   * pre-rename agent-card art; §4.22.E: also the /income* mascot figure). */
  bleak: BLEAK_FIGURE,

  /* BLOOM (§4.20.G-a): the stat-card glyph — a pixel flower with a
   * signal-antenna bloom, accent center. 32×32 → 56px. */
  bloom: {
    grid: 32,
    viewW: 32,
    viewH: 32,
    parts: [
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [15, 0, 2, 2], // antenna tip
          [12, 1, 1, 1], // signal arc, left
          [19, 1, 1, 1] // signal arc, right
        ]
      },
      {
        fill: 'var(--color-text-muted)',
        rects: [[15, 2, 2, 3]] // antenna stem
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [14, 6, 4, 2], // petals: cross
          [10, 10, 2, 4],
          [20, 10, 2, 4],
          [14, 16, 4, 2],
          [11, 7, 2, 2], // petals: diagonals
          [19, 7, 2, 2],
          [11, 15, 2, 2],
          [19, 15, 2, 2]
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [13, 9, 6, 6], // accent center
          [14, 8, 4, 1],
          [14, 15, 4, 1],
          [12, 10, 1, 4],
          [19, 10, 1, 4]
        ]
      },
      {
        fill: 'var(--color-text)',
        rects: [[15, 11, 2, 2]] // center highlight
      },
      {
        fill: 'var(--color-deepa-1)',
        rects: [
          [15, 18, 2, 10], // stem
          [10, 21, 5, 2], // leaf
          [9, 20, 2, 2]
        ]
      }
    ]
  }
};
