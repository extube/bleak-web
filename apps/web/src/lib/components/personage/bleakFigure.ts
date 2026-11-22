/**
 * The shared BLEAK personage (DESIGN §4.22.E, Concept §34 item 3): the
 * agent-card pixel personage (renamed per §4.22.D, the rect data
 * UNCHANGED) promoted out of `landing/figures.ts` into ONE shared
 * module, so both the landing agent card (LandingFigure) and every
 * `/income*` mascot mount (BleakMascot: CodeEntry 96, RoomPreview 96,
 * CreationWizard 96 + 112, MessageBubble mascot rows 28) render the SAME
 * figure — one source of truth, zero art duplication.
 *
 * §4.3 technique: hand-authored SVG `<rect>` art on its own 32×32 grid,
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
