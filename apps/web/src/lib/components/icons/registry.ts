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
  | 'copy'
  | 'radar-dot'
  | 'star'
  | 'edit'
  | 'refresh'
  | 'scan'
  | 'face'
  | 'badge';

/** Tab glyphs (§1.2) reference the same set. */
export const TAB_ICONS = {
  '/room': 'radar-dot',
  '/people': 'face',
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
  ]
};
