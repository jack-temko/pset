/** The square and the gap between squares at their natural size
 *  (heatmap-d3). A grown heatmap lets both stretch, to a square of 32. */
export const SQUARE = 14;
export const GAP = 3;
export const ROWS = 7;
export const MAX_SQUARE = 32;
/** The column of weekday names on the left, gap included. */
export const LABEL_W = 32;
/** The row of month names above the squares, and the space under it. */
export const MONTH_H = 18;
export const MONTH_GAP = 4;
export const LABELS_H = MONTH_H + MONTH_GAP;

/** The grid's height at a square and gap, so a skeleton can hold the room. */
export function gridHeight(size = SQUARE, gap = GAP): number {
  return ROWS * size + (ROWS - 1) * gap;
}
/** The natural grid's height. */
export const GRID_HEIGHT = gridHeight();

/** The width of `weeks` columns of squares at the natural size, labels
 *  included. */
export function naturalWidth(weeks: number): number {
  return LABEL_W + weeks * SQUARE + (weeks - 1) * GAP;
}

/** What the weeks on show are called: 26 weeks are "6 months" (D10), 52 or
 *  more "year". */
export function spanName(weeks: number): string {
  const months = Math.round(weeks / 4.345);
  if (months >= 12) return 'year';
  if (months >= 1) return `${String(months)} month${months === 1 ? '' : 's'}`;
  return `${String(weeks)} week${weeks === 1 ? '' : 's'}`;
}

/** How many weeks fit in `width` (the squares only, no labels); with no
 *  width yet, all of them. */
export function weeksThatFit(width: number, weeks: number): number {
  if (!(width > 0)) return weeks;
  return Math.max(
    1,
    Math.min(weeks, Math.floor((width + GAP) / (SQUARE + GAP))),
  );
}

export interface Grid {
  weeks: number;
  size: number;
  gap: number;
}

/** The weeks, the square and the gap for a container `width` wide, labels
 *  included. Natural: 14 and 3, as many weeks as fit. Grown: the same weeks,
 *  the square as big as fits up to 32, and the gap widened so the squares
 *  reach the right edge. */
export function gridFor(width: number, weeks: number, grow: boolean): Grid {
  const shown = weeksThatFit(width - LABEL_W, weeks);
  if (!grow || !(width > 0)) return { weeks: shown, size: SQUARE, gap: GAP };
  const room = width - LABEL_W;
  const size = Math.max(
    SQUARE,
    Math.min(MAX_SQUARE, Math.floor((room - (shown - 1) * GAP) / shown)),
  );
  const gap =
    shown > 1 ? Math.max(GAP, (room - shown * size) / (shown - 1)) : GAP;
  return { weeks: shown, size, gap };
}

/** Columns that carry a month name: the first week whose Monday falls in a
 *  new month. A name that would crowd the next one, or run off the right
 *  edge, is left out. */
export function monthColumns(
  mondays: readonly Date[],
): { col: number; name: string }[] {
  const names = new Intl.DateTimeFormat('en-US', { month: 'short' });
  const out: { col: number; name: string }[] = [];
  mondays.forEach((m, col) => {
    if (col === 0 || m.getMonth() !== mondays[col - 1].getMonth())
      out.push({ col, name: names.format(m) });
  });
  if (out.length > 1 && out[1].col < 2) out.shift();
  if (out.length > 0 && out[out.length - 1].col > mondays.length - 2) out.pop();
  return out;
}
