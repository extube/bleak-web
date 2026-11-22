/**
 * Pixel icon registry (DESIGN §4.4): 16×16 grid glyphs, 2px visual weight,
 * drawn with `currentColor` so token colors are inherited. Geometry lives
 * here as rect data; PixelIcon.svelte renders it.
 */
export type IconName =
  | 'back'
  | 'close'
  | 'search'
  | 'plus'
  | 'dialog-lines'
  | 'lock'
  | 'key'
  | 'copy'
  | 'radar-dot'
  | 'star'
  | 'edit'
  | 'refresh'
  | 'scan'
  | 'face'
  | 'badge'
  | 'status-active'
  | 'status-finished'
  | 'check'
  | 'arrow-right'
  | 'phone'
  | 'contact-card'
  | 'heart'
  | 'contact-share';

/** Tab glyphs (§1.2) reference the same set. */
export const TAB_ICONS = {
  '/room': 'radar-dot',
  '/people': 'face',
  '/contacts': 'contact-card',
  '/chats': 'dialog-lines',
  '/profile': 'badge',
  '/host': 'star'
} as const satisfies Record<string, IconName>;

type Rect = readonly [number, number, number, number];

export const ICON_RECTS: Record<IconName, readonly Rect[]> = {
  back: [
    [2, 7, 2, 2],
    [4, 5, 2, 2],
    [4, 9, 2, 2],
    [6, 3, 2, 2],
    [6, 11, 2, 2],
    [6, 7, 8, 2]
  ],
  close: [
    [3, 3, 2, 2],
    [5, 5, 2, 2],
    [7, 7, 2, 2],
    [9, 9, 2, 2],
    [11, 11, 2, 2],
    [11, 3, 2, 2],
    [9, 5, 2, 2],
    [5, 9, 2, 2],
    [3, 11, 2, 2]
  ],
  search: [
    [5, 2, 4, 2],
    [2, 5, 2, 4],
    [10, 5, 2, 4],
    [5, 10, 4, 2],
    [3, 3, 2, 2],
    [9, 3, 2, 2],
    [3, 9, 2, 2],
    [9, 9, 2, 2],
    [11, 11, 3, 2],
    [12, 9, 2, 2]
  ],
  plus: [
    [7, 3, 2, 10],
    [3, 7, 10, 2]
  ],
  'dialog-lines': [
    [3, 4, 10, 2],
    [3, 7, 8, 2],
    [3, 10, 6, 2]
  ],
  lock: [
    [5, 3, 6, 2],
    [4, 5, 2, 2],
    [10, 5, 2, 2],
    [4, 8, 8, 5],
    [7, 10, 2, 2]
  ],
  key: [
    [3, 7, 6, 2],
    [3, 5, 2, 2],
    [3, 9, 2, 2],
    [5, 11, 2, 2],
    [9, 5, 4, 2],
    [11, 7, 2, 4],
    [9, 9, 4, 2]
  ],
  copy: [
    [8, 3, 6, 2],
    [12, 5, 2, 4],
    [10, 5, 2, 3],
    [4, 8, 8, 6]
  ],
  'radar-dot': [
    [7, 7, 2, 2],
    [4, 4, 2, 2],
    [10, 4, 2, 2],
    [4, 10, 2, 2],
    [10, 10, 2, 2],
    [2, 2, 2, 2],
    [12, 2, 2, 2],
    [2, 12, 2, 2],
    [12, 12, 2, 2]
  ],
  star: [
    [6, 6, 4, 4],
    [7, 2, 2, 4],
    [7, 10, 2, 4],
    [2, 7, 4, 2],
    [10, 7, 4, 2]
  ],
  edit: [
    [11, 2, 2, 2],
    [9, 4, 2, 2],
    [7, 6, 2, 2],
    [5, 8, 2, 2],
    [3, 10, 2, 2],
    [2, 12, 2, 2]
  ],
  refresh: [
    [5, 2, 6, 2],
    [3, 4, 2, 8],
    [5, 12, 6, 2],
    [11, 3, 2, 2],
    [12, 5, 2, 2],
    [11, 6, 2, 3]
  ],
  scan: [
    [2, 2, 6, 2],
    [2, 4, 2, 4],
    [8, 2, 6, 2],
    [12, 4, 2, 4],
    [2, 12, 6, 2],
    [2, 8, 2, 4],
    [8, 12, 6, 2],
    [12, 8, 2, 4],
    [5, 7, 6, 2]
  ],
  face: [
    [3, 3, 10, 2],
    [3, 11, 10, 2],
    [2, 5, 2, 6],
    [12, 5, 2, 6],
    [5, 6, 2, 2],
    [9, 6, 2, 2],
    [6, 9, 4, 2]
  ],
  badge: [
    [3, 2, 10, 2],
    [3, 12, 10, 2],
    [2, 4, 2, 8],
    [12, 4, 2, 8],
    [5, 5, 3, 3],
    [9, 5, 4, 2],
    [9, 8, 4, 2]
  ],
  // Chat status (Concept §10.1.7): ACTIVE → a loading-style glyph — three
  // dots, the in-progress/typing rhythm (ink pairing via currentColor).
  'status-active': [
    [3, 7, 2, 2],
    [7, 7, 2, 2],
    [11, 7, 2, 2]
  ],
  // FINISHED → a reminder-style mark: the bold «!» exclamation; the card
  // colors it with the danger token.
  'status-finished': [
    [7, 2, 2, 8],
    [7, 11, 2, 2]
  ],
  // DONE / completed state mark (DESIGN §4.13.3: the contact-share slide's
  // "already shared" state) — a bold pixel check mark.
  check: [
    [3, 7, 2, 2],
    [5, 9, 2, 2],
    [7, 11, 2, 2],
    [9, 9, 2, 2],
    [11, 7, 2, 2],
    [13, 5, 2, 2]
  ],
  // RIGHT arrow (DESIGN §4.13.3): the swipe-right slide thumb glyph — the
  // mirrored `back` geometry (shaft x2..9, head x8..12).
  'arrow-right': [
    [12, 7, 2, 2],
    [10, 5, 2, 2],
    [10, 9, 2, 2],
    [8, 3, 2, 2],
    [8, 11, 2, 2],
    [2, 7, 8, 2]
  ],
  // PHONE handset (DESIGN §4.15.A): the Slide-to-Share v2 thumb glyph — a
  // 45° diagonal receiver, chunky earpiece top-left / mouthpiece
  // bottom-right, drawn with currentColor (the slide colors it with the
  // check-green token).
  phone: [
    [2, 2, 4, 2],
    [2, 4, 2, 2],
    [4, 4, 2, 2],
    [6, 6, 2, 2],
    [8, 8, 2, 2],
    [10, 10, 2, 2],
    [10, 12, 4, 2]
  ],
  // Contacts tab (DESIGN §4.14.2): a contact card with an arrow dropping
  // INTO it — the "shared with you" direction (the recipient's view).
  'contact-card': [
    [7, 1, 2, 2],
    [5, 3, 2, 2],
    [9, 3, 2, 2],
    [5, 5, 6, 2],
    [2, 7, 12, 2],
    [2, 9, 2, 4],
    [12, 9, 2, 4],
    [2, 13, 12, 2]
  ],
  // HEART (DESIGN §4.15.C-6b / §4.15.G): the GREAT-tier sparkle popper —
  // a chunky 8-bit heart (two lobes, tapering body, point), drawn with
  // currentColor (the sheet's poppers color it yellow/orange/white).
  heart: [
    [2, 3, 4, 3],
    [10, 3, 4, 3],
    [4, 6, 8, 2],
    [5, 8, 6, 2],
    [7, 10, 2, 3]
  ],
  // CONTACTS SHARING (DESIGN §4.20.H): the one added §4.4 glyph for the
  // landing tutorial's third step — two overlapping squares (the shared
  // contact sets) with an outbound arrow handing a contact over. Same
  // construction rules as the rest of the set: 16×16 grid, 2px weight,
  // currentColor.
  'contact-share': [
    [2, 7, 6, 2],
    [2, 11, 6, 2],
    [2, 9, 2, 2],
    [6, 9, 2, 2],
    [8, 3, 6, 2],
    [12, 5, 2, 2],
    [8, 5, 2, 2],
    [11, 1, 2, 2],
    [13, 0, 2, 2],
    [13, 2, 2, 2]
  ]
};
