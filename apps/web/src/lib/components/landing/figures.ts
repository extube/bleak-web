/**
 * Landing mascot cast — part data (DESIGN §4.20.J + §4.21.A, §4.3 rules):
 * six DISTINCT original figures; no figure reuses another's parts and none
 * is the shared app mascot. All are hand-authored SVG `<rect>` art on their
 * own grid, `crispEdges`, dot eyes, chunky pixels, transparent background —
 * NO background plates (Concept §23/§32; the §4.21.B background IMAGE is
 * the composition block's own scenery, not a figure plate). NOVA + ASTRA
 * are the hero pair (LandingHeroScene.svelte, §4.21.A — the owner kept the
 * left personage and redid the right one: ASTRA is a copy of NOVA with
 * only the head changed — white hair + two small purple horns; BYTE
 * retires with the §4.20.D node+beam); VECTOR / BLOOM / PIP / GLITCH
 * render through LandingFigure.svelte from this table.
 *
 * Fills are token references only (§4.1) — the landing accent is the
 * approved Deepa violet (--color-deepa-4, the example's purple bloom);
 * shading stays in `color-mix` alpha variants of existing tokens. The
 * white-hair palette (§4.21.A) is the nearest-white token --color-text
 * plus its 72% surface-elevated under-shade — zero new values.
 */
export type FigureName = 'vector' | 'bloom' | 'pip' | 'glitch' | 'nova' | 'astra';

export interface FigurePart {
  fill: string;
  rects: readonly (readonly [number, number, number, number])[];
}

export interface Figure {
  /** Logical grid size. */
  grid: number;
  /** Explicit viewBox dims (§4.21.A: the hero pair is a non-square 16×31). */
  viewW: number;
  viewH: number;
  parts: readonly FigurePart[];
}

/* The §4.21.A shared 16×31 head fills: NOVA keeps the §4.20.D warm hair
 * mix; ASTRA's white hair = the nearest-white token (--color-text) with a
 * 72% surface-elevated under-shade — the §4.3 two-shade art discipline. */
const NOVA_HAIR = 'color-mix(in srgb, var(--color-art-hair-3) 65%, var(--color-surface))';
const ASTRA_HAIR_LOW =
  'color-mix(in srgb, var(--color-text) 72%, var(--color-surface-elevated))';

export const LANDING_FIGURES: Record<FigureName, Figure> = {
  /* VECTOR (§4.20.G-b): the agent character card portrait — an agent in a
   * sharp suit, monocle visor, accent tie. 32×32 → 96px. */
  vector: {
    grid: 32,
    viewW: 32,
    viewH: 32,
    parts: [
      {
        fill: 'var(--color-surface)',
        rects: [
          [9, 3, 14, 3], // slicked hair, top
          [9, 6, 2, 3], // hair, left
          [21, 6, 2, 3] // hair, right
        ]
      },
      {
        fill: 'var(--color-art-skin-1)',
        rects: [
          [10, 6, 12, 10], // face
          [19, 10, 2, 2] // monocle lens interior
        ]
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [13, 10, 2, 2], // left dot eye
          [14, 13, 4, 1] // mouth
        ]
      },
      {
        // monocle visor ring (the single accent lens, right eye)
        fill: 'var(--color-deepa-4)',
        rects: [
          [18, 9, 4, 1],
          [18, 12, 4, 1],
          [18, 10, 1, 2],
          [21, 10, 1, 2]
        ]
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [7, 18, 18, 2], // shoulders
          [8, 20, 16, 8], // torso
          [12, 20, 2, 6], // lapel, left
          [18, 20, 2, 6] // lapel, right
        ]
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [14, 18, 4, 2], // shirt collar
          [15, 20, 2, 3] // shirt front
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [[15, 21, 2, 5]] // accent tie
      }
    ]
  },

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

  /* GLITCH (§4.20.F + §4.20.B): the robo-cat agent — round charcoal head,
   * accent ears, dot eyes. 16×16 → 48px (chat strip) / 24px (tagline glyph). */
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
  },

  /* NOVA (§4.21.A): the hero scene's LEFT figure — the owner kept it ("the
   * left personage is good"). Back three-quarter view, warm-neutral hair,
   * accent-striped scarf. 16×31 grid (explicit non-square viewBox). */
  nova: {
    grid: 16,
    viewW: 16,
    viewH: 31,
    parts: [
      {
        fill: NOVA_HAIR,
        rects: [
          [4, 3, 8, 2], // hair top
          [2, 5, 12, 8], // hair mid
          [3, 13, 10, 3] // hair low (under-shade)
        ]
      },
      {
        fill: 'var(--color-art-skin-2)',
        rects: [[6, 16, 4, 2]] // neck
      },
      {
        fill: 'var(--color-text)',
        rects: [[1, 18, 14, 4]] // scarf
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [4, 18, 2, 4], // scarf stripe, left
          [10, 18, 2, 4] // scarf stripe, right
        ]
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [2, 22, 12, 5], // coat
          [0, 23, 2, 5], // arm, left
          [14, 23, 2, 5], // arm, right
          [3, 27, 4, 4], // leg, left
          [9, 27, 4, 4] // leg, right
        ]
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [2, 30, 5, 1], // shoe, left
          [9, 30, 5, 1] // shoe, right
        ]
      }
    ]
  },

  /* ASTRA (§4.21.A): the hero scene's RIGHT figure — a copy of NOVA (same
   * body/proportions/pose) with only the head changed: WHITE hair
   * (--color-text lit rows + the 72% surface-elevated under-shade) and two
   * small PURPLE horns (--color-deepa-4 2×3u columns rising from the hair
   * top, each with a --color-text glint cell). BYTE retires (§4.21.A). */
  astra: {
    grid: 16,
    viewW: 16,
    viewH: 31,
    parts: [
      {
        fill: 'var(--color-deepa-4)',
        rects: [[3, 0, 2, 3]] // horn, left
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [[11, 0, 2, 3]] // horn, right
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [3, 0, 2, 1], // horn glint, left
          [11, 0, 2, 1], // horn glint, right
          [4, 3, 8, 2], // hair top (white, lit)
          [2, 5, 12, 8] // hair mid (white, lit)
        ]
      },
      {
        fill: ASTRA_HAIR_LOW,
        rects: [[3, 13, 10, 3]] // hair low (white under-shade)
      },
      {
        fill: 'var(--color-art-skin-2)',
        rects: [[6, 16, 4, 2]] // neck
      },
      {
        fill: 'var(--color-text)',
        rects: [[1, 18, 14, 4]] // scarf
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [4, 18, 2, 4], // scarf stripe, left
          [10, 18, 2, 4] // scarf stripe, right
        ]
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [2, 22, 12, 5], // coat
          [0, 23, 2, 5], // arm, left
          [14, 23, 2, 5], // arm, right
          [3, 27, 4, 4], // leg, left
          [9, 27, 4, 4] // leg, right
        ]
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [2, 30, 5, 1], // shoe, left
          [9, 30, 5, 1] // shoe, right
        ]
      }
    ]
  }
};
