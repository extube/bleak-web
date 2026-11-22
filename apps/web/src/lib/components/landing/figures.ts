/**
 * Landing mascot cast — part data (DESIGN §4.20.J as amended by §4.22.D/§I,
 * §4.3 rules): four DISTINCT original figures — BLEAK (the agent-card
 * portrait, promoted to the shared personage module §4.22.E), BLOOM, PIP,
 * GLITCH — no figure reuses another's parts and none is drawn twice on the
 * page. All are hand-authored SVG `<rect>` art on their own grid,
 * `crispEdges`, dot eyes, chunky pixels, transparent background — NO
 * background plates (Concept §23/§32). The §4.21.A drawn hero pair is
 * RETIRED with the drawn hero scene (§4.22.G — the video carries its own
 * cast); BYTE retired earlier (§4.21.A).
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

export type FigureName = 'bleak' | 'bloom' | 'pip' | 'glitch';

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
  },

  /* PIP (§4.20.F): the mascot-chat strip's human attendee — warm neutrals.
   * 16×16 → 48px. */
  pip: {
    grid: 16,
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'color-mix(in srgb, var(--color-art-hair-3) 55%, var(--color-surface))',
        rects: [
          [3, 2, 10, 3], // hair
          [3, 5, 2, 3], // hair, left
          [11, 5, 2, 3] // hair, right
        ]
      },
      {
        fill: 'var(--color-art-skin-2)',
        rects: [[4, 5, 8, 6]] // face
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [5, 7, 2, 2], // left dot eye
          [9, 7, 2, 2], // right dot eye
          [7, 10, 2, 1] // smile
        ]
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [[3, 12, 10, 4]] // shoulders
      },
      {
        fill: 'var(--color-text)',
        rects: [[7, 12, 2, 2]] // collar
      }
    ]
  },

  /* GLITCH (§4.20.F): the robo-cat agent — round charcoal head, accent
   * ears, dot eyes. 16×16 → 48px (chat strip — now its ONLY appearance:
   * the header tagline-glyph slot retired with the taglines, §4.22.A). */
  glitch: {
    grid: 16,
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [3, 1, 1, 1], // ear tip, left
          [12, 1, 1, 1], // ear tip, right
          [2, 2, 3, 2], // ear, left
          [11, 2, 3, 2] // ear, right
        ]
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [4, 3, 8, 1], // round head: dome
          [3, 4, 10, 1],
          [2, 5, 12, 7],
          [3, 12, 10, 1]
        ]
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [5, 7, 2, 2], // left dot eye
          [9, 7, 2, 2], // right dot eye
          [4, 10, 8, 1], // panel line
          [6, 11, 4, 1] // muzzle
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [[7, 9, 2, 1]] // accent nose
      }
    ]
  }
};
