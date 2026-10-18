/** The square and the gap between squares, fixed (heatmap-d3). */
export const SQUARE = 14;
export const GAP = 3;
export const ROWS = 7;
/** The grid's height, so a skeleton can hold the same room. */
export const GRID_HEIGHT = ROWS * SQUARE + (ROWS - 1) * GAP;

/** What the weeks on show are called: 26 weeks are "6 months" (D10), 52 or
 *  more "year". */
export function spanName(weeks: number): string {
  const months = Math.round(weeks / 4.345);
  if (months >= 12) return 'year';
  if (months >= 1) return `${String(months)} month${months === 1 ? '' : 's'}`;
  return `${String(weeks)} week${weeks === 1 ? '' : 's'}`;
}

/** How many weeks fit in `width`; with no width yet, all of them. */
export function weeksThatFit(width: number, weeks: number): number {
  if (!(width > 0)) return weeks;
  return Math.max(
    1,
    Math.min(weeks, Math.floor((width + GAP) / (SQUARE + GAP))),
  );
}
