/** The wait before a bar shows: a read that answers inside it draws no bars
 *  and no fade (skeleton-grill, the reveal; loading-standard D2). */
export const GRACE_MS = 300;

/** The usual widths, in ch, so a title bar is the same on every screen.
 *  Three per slot, picked by row, so rows differ but a row always draws the
 *  same (bone-d3). */
export const RHYTHM = {
  title: [22, 16, 28],
  meta: [30, 24, 34],
  word: [8, 6, 10],
} as const;
