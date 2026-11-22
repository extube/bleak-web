/**
 * §4.26 decorative pixel-art data (DESIGN §4.26.C/§4.26.G/§4.26.H,
 * Concept §38 owner batch, tz12-10): the three step-card mini-illustrations
 * (24×24, top-right of each step card), the three §4.26.G privacy icons
 * (16×16, 48px) and the four §4.26.H use-case icons (16×16, 40px).
 *
 * §4.3 technique: hand-authored SVG `<rect>` art on their own grids,
 * `crispEdges`, token fills only (§4.1), transparent background — NO
 * background plates, original art, no figure reuses another's parts.
 */
export interface ArtPart {
  fill: string;
  rects: readonly (readonly [number, number, number, number])[];
  /** The accent glow (§4.26.C: the radar group's drop-shadow). */
  glow?: boolean;
}

export interface ArtPiece {
  viewW: number;
  viewH: number;
  parts: readonly ArtPart[];
}

/* ---- the three step-card mini-illustrations (§4.26.C, 24×24 grid) ---- */

export const STEP_ART: Record<'find' | 'chat' | 'share', ArtPiece> = {
  /* 01 FIND — the radar character (a pixel figure holding a glowing
   * radar/scanner); the radar group carries the accent glow. */
  find: {
    viewW: 24,
    viewH: 24,
    parts: [
      {
        fill: 'var(--color-surface)',
        rects: [
          [5, 2, 10, 2], // hair, top
          [4, 4, 2, 3], // hair, left
          [16, 4, 2, 3] // hair, right
        ]
      },
      {
        fill: 'var(--color-art-skin-1)',
        rects: [[6, 4, 10, 7]] // face
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [8, 7, 2, 2], // dot eye, left
          [13, 7, 2, 2] // dot eye, right
        ]
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [4, 12, 12, 8], // body
          [2, 13, 2, 5], // arm, left
          [16, 13, 2, 4], // arm, right
          [5, 20, 4, 3], // leg, left
          [11, 20, 4, 3] // leg, right
        ]
      },
      {
        fill: 'var(--color-surface)',
        rects: [[18, 10, 5, 7]] // radar body
      },
      {
        fill: 'var(--color-deepa-4)',
        glow: true,
        rects: [
          [19, 11, 3, 1], // radar ring, top
          [19, 15, 3, 1], // radar ring, bottom
          [18, 12, 1, 3], // radar ring, left
          [22, 12, 1, 3] // radar ring, right
        ]
      },
      {
        fill: 'var(--color-deepa-1)',
        glow: true,
        rects: [[20, 13, 1, 1]] // radar blip
      }
    ]
  },

  /* 02 CHAT — two pixel avatars facing each other with a speech bubble. */
  chat: {
    viewW: 24,
    viewH: 24,
    parts: [
      {
        fill: 'var(--color-surface)',
        rects: [
          [1, 6, 8, 3], // avatar L hair, top
          [1, 9, 2, 4] // avatar L hair, side
        ]
      },
      {
        fill: 'var(--color-art-skin-1)',
        rects: [[2, 8, 6, 6]] // avatar L face
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [15, 6, 8, 3], // avatar R hair, top
          [21, 9, 2, 4] // avatar R hair, side
        ]
      },
      {
        fill: 'var(--color-art-skin-3)',
        rects: [[16, 8, 6, 6]] // avatar R face
      },
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [2, 15, 6, 5], // avatar L body
          [16, 15, 6, 5] // avatar R body
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        glow: true,
        rects: [
          [9, 2, 7, 1], // bubble frame, top
          [9, 6, 7, 1], // bubble frame, bottom
          [8, 3, 1, 3], // bubble frame, left
          [16, 3, 1, 3], // bubble frame, right
          [11, 7, 2, 1], // bubble tail
          [12, 8, 1, 1], // bubble tail, tip
          [11, 4, 1, 1], // bubble dot, left
          [13, 4, 1, 1], // bubble dot, mid
          [15, 4, 1, 1] // bubble dot, right
        ]
      }
    ]
  },

  /* 03 SHARE — two pixel characters doing a fist-bump with sparkles. */
  share: {
    viewW: 24,
    viewH: 24,
    parts: [
      {
        fill: 'var(--color-surface-elevated)',
        rects: [
          [1, 9, 7, 4], // arm, left
          [16, 9, 7, 4] // arm, right
        ]
      },
      {
        fill: 'var(--color-art-skin-2)',
        rects: [[8, 8, 5, 5]] // fist, left
      },
      {
        fill: 'var(--color-art-skin-4)',
        rects: [[11, 8, 5, 5]] // fist, right
      },
      {
        fill: 'var(--color-deepa-4)',
        glow: true,
        rects: [
          [12, 3, 2, 2], // impact star
          [11, 5, 1, 1], // impact star, ray
          [14, 5, 1, 1], // impact star, ray
          [4, 3, 2, 2] // sparkle a
        ]
      },
      {
        fill: 'var(--color-deepa-2)',
        rects: [[19, 4, 2, 2]] // sparkle b
      },
      {
        fill: 'var(--color-text)',
        rects: [[12, 14, 2, 1]] // sparkle c
      }
    ]
  }
};

export type StepArtName = keyof typeof STEP_ART;

/* ---- the §4.26.G privacy icons (16×16 grid, rendered at 48px) ---- */

export const PRIVACY_ICONS: Record<'ghost' | 'mutual' | 'gps', ArtPiece> = {
  /* A — pixel ghost/hoodie character (a white ghost with a hood). */
  ghost: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-text)',
        rects: [
          [4, 2, 8, 2], // hood, top
          [3, 4, 2, 5], // hood, left
          [11, 4, 2, 5], // hood, right
          [4, 6, 8, 6] // body
        ]
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [5, 12, 1, 1], // hem notch
          [7, 12, 1, 1], // hem notch
          [9, 12, 1, 1], // hem notch
          [6, 7, 1, 2], // eye, left
          [9, 7, 1, 2] // eye, right
        ]
      },
      {
        fill: 'color-mix(in srgb, var(--color-text) 72%, var(--color-surface))',
        rects: [
          [3, 9, 2, 2], // hood shade, left
          [11, 9, 2, 2] // hood shade, right
        ]
      }
    ]
  },

  /* B — pixel padlock & key. */
  mutual: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-text-muted)',
        rects: [
          [5, 2, 6, 1], // shackle, top
          [4, 3, 2, 3], // shackle, left
          [10, 3, 2, 3] // shackle, right
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [4, 6, 8, 6] // lock body
        ]
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [7, 8, 2, 3] // keyhole
        ]
      },
      {
        fill: 'var(--color-accent)',
        rects: [
          [11, 11, 4, 1], // key, shaft
          [14, 12, 1, 2], // key, bit
          [12, 12, 1, 1] // key, tooth
        ]
      }
    ]
  },

  /* C — pixel shield + radar. */
  gps: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-deepa-1)',
        rects: [
          [4, 2, 8, 1], // shield outline, top
          [3, 3, 1, 5], // shield outline, left
          [12, 3, 1, 5], // shield outline, right
          [4, 8, 8, 1], // shield outline, bottom
          [6, 9, 4, 1], // shield outline, taper
          [7, 10, 2, 1] // shield outline, tip
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [6, 4, 1, 1], // radar arc
          [9, 4, 1, 1], // radar arc
          [5, 5, 1, 1], // radar arc
          [10, 5, 1, 1], // radar arc
          [7, 6, 2, 1] // radar arc
        ]
      },
      {
        fill: 'var(--color-deepa-1)',
        rects: [
          [8, 5, 1, 1] // radar blip
        ]
      }
    ]
  }
};

export type PrivacyIconName = keyof typeof PRIVACY_ICONS;

/* ---- the §4.26.H use-case icons (16×16 grid, rendered at 40px) ---- */

export const USECASE_ICONS: Record<
  'conferences' | 'parties' | 'coworkings' | 'festivals',
  ArtPiece
> = {
  /* CONFERENCES — pixel badge (an id-card on a lanyard). */
  conferences: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-text-muted)',
        rects: [
          [7, 1, 2, 3], // lanyard, strap
          [6, 3, 1, 1], // lanyard, clasp
          [9, 3, 1, 1] // lanyard, clasp
        ]
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [4, 4, 8, 8] // card body
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [6, 6, 3, 3] // photo chip
        ]
      },
      {
        fill: 'var(--color-surface)',
        rects: [
          [10, 6, 1, 1], // line
          [10, 8, 1, 3] // line
        ]
      }
    ]
  },

  /* PARTIES & BARS — pixel neon glasses. */
  parties: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-text)',
        rects: [
          [2, 6, 5, 1], // frame, left brow
          [9, 6, 5, 1], // frame, right brow
          [7, 7, 2, 1], // frame, bridge
          [2, 7, 1, 3], // frame, left arm
          [6, 7, 1, 3], // frame, left inner
          [9, 7, 1, 3], // frame, right inner
          [13, 7, 1, 3] // frame, right arm
        ]
      },
      {
        fill: 'var(--color-deepa-5)',
        glow: true,
        rects: [
          [3, 7, 3, 3], // lens, left
          [10, 7, 3, 3] // lens, right
        ]
      }
    ]
  },

  /* COWORKINGS — pixel laptop. */
  coworkings: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-surface)',
        rects: [
          [3, 3, 10, 7] // screen
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [5, 5, 3, 1], // glow row
          [5, 7, 2, 1] // glow row
        ]
      },
      {
        fill: 'var(--color-text)',
        rects: [
          [2, 10, 12, 2] // base
        ]
      }
    ]
  },

  /* FESTIVALS — pixel headphones. */
  festivals: {
    viewW: 16,
    viewH: 16,
    parts: [
      {
        fill: 'var(--color-text)',
        rects: [
          [3, 3, 10, 2], // band, top
          [2, 4, 2, 3], // band, left
          [12, 4, 2, 3] // band, right
        ]
      },
      {
        fill: 'var(--color-deepa-2)',
        rects: [
          [3, 7, 3, 5], // cup, left
          [10, 7, 3, 5] // cup, right
        ]
      },
      {
        fill: 'var(--color-deepa-4)',
        rects: [
          [4, 8, 1, 1], // pad glint, left
          [11, 8, 1, 1] // pad glint, right
        ]
      }
    ]
  }
};

export type UsecaseIconName = keyof typeof USECASE_ICONS;
