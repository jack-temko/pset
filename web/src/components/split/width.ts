/** Each pane stops here: today's narrowest panel. */
export const SPLIT_MIN = 360;
/** Where a split starts: equal halves. */
export const HALF = 0.5;

/** The left pane's width for a split `total` wide, from its ratio. It stays
 *  inside [min, total - min]; when the split is too narrow for two panes
 *  of `min`, the left one holds at `min` and the right takes what is left. */
export function leftWidth(total: number, ratio: number, min: number): number {
  const hi = Math.max(min, total - min);
  return Math.min(Math.max(ratio * total, min), hi);
}
