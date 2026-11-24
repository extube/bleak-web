/**
 * The shared BLEAK personage (DESIGN §4.22.E, Concept §34 item 3): the
 * agent-card pixel personage (renamed per §4.22.D, the rect data
 * UNCHANGED) promoted out of `landing/figures.ts` into ONE shared
 * module, so both the landing agent card (LandingFigure) and every
 * `/income*` mascot mount (BleakMascot: CodeEntry 96, RoomPreview 96,
 * CreationWizard 96 + 112, MessageBubble mascot rows 28) render the SAME
 * figure — one source of truth, zero art duplication.
 *
 * §4.26.I (Concept §38.5, tz12-10): the module also carries
 * `BLEAK_WAVE_FIGURE` — the §38.5 Final-CTA waving mascot. It reuses the
 * BLEAK art as the base on a 36×32 grid (every base rect byte-identical
 * except the two specced deltas: the monocle visor group AND the left dot
 * eye are replaced by cyber-glasses frame + lenses + glints, and the wave
 * arm/hand/sparkle groups are added) — one source of truth, zero art
 * duplication.
 *
 * §4.3 technique: hand-authored SVG `<rect>` art on its own grid,
 * crispEdges, dot eyes, chunky pixels, token fills only (§4.1), transparent
 * background — NO background plate (Concept §23.1.1; plate-less by
 * construction, the figure carries itself on any surface).
 */
import type { Figure } from '../landing/figures';

export const BLEAK_FIGURE: Figure = {
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
};

/**
 * BLEAK_WAVE_FIGURE (§4.26.I): the Final-CTA waving mascot — the BLEAK
 * personage REUSED as the base, extended per the §4.26.I byte-table
 * (36×32 grid; BLEAK parts at identical coordinates except the two
 * deltas: (a) the monocle visor group AND the left dot eye are replaced
 * by the cyber-glasses frame + lenses + glints; (b) the wave
 * arm/hand/sparkle groups are added; every other rect is byte-identical).
 */
export const BLEAK_WAVE_FIGURE: Figure = {
  grid: 36,
  viewW: 36,
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
      rects: [[10, 6, 12, 10]] // face
    },
    {
      fill: 'var(--color-surface)',
      rects: [[14, 13, 4, 1]] // mouth
    },
    {
      // cyber-glasses frame (replaces the monocle visor + left dot eye)
      fill: 'var(--color-surface)',
      rects: [
        [9, 9, 15, 1], // frame bar
        [9, 10, 1, 2], // left temple
        [23, 10, 1, 2] // right temple
      ]
    },
    {
      fill: 'var(--color-deepa-5)',
      rects: [
        [10, 10, 5, 2], // lens, left
        [17, 10, 5, 2] // lens, right
      ]
    },
    {
      fill: 'var(--color-text)',
      rects: [
        [10, 10, 2, 1], // glint, left
        [17, 10, 2, 1] // glint, right
      ]
    },
    {
      fill: 'var(--color-surface-elevated)',
      rects: [
        [7, 18, 18, 2], // shoulders
        [8, 20, 16, 8], // torso
        [12, 20, 2, 6], // lapel, left
        [18, 20, 2, 6], // lapel, right
        [24, 16, 3, 3], // wave arm, upper
        [25, 12, 3, 4] // wave arm, raised
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
      rects: [
        [15, 21, 2, 5], // accent tie
        [29, 7, 1, 1], // wave sparkle a
        [30, 10, 1, 1] // wave sparkle b
      ]
    },
    {
      fill: 'var(--color-art-skin-1)',
      rects: [[25, 9, 3, 3]] // wave hand
    }
  ]
};
