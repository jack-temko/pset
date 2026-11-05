/** The dialog caps at 80vh and its body scrolls, so a body that would reach
 *  the cap decides the dialog's height, and a skeleton a few pixels short of it
 *  (an error that wraps to more lines than the one drawn) would grow. A
 *  skeleton whose estimated height is within one row of the cap is drawn at the
 *  cap: never an undershoot. About 270px is the dialog around its tables, 42px
 *  a row, 22px more for a row with a second line. */
export const ROW = 42;
const TALL = 22;
const CHROME = 270;
export function reachesCap(
  shapes: { stages: number[]; runs: number[][] }[],
  extra = 0,
): boolean {
  let h = CHROME + extra;
  for (const sh of shapes) {
    const tables = [sh.stages, ...sh.runs];
    for (const t of tables)
      h += 39 + 24 + t.length * ROW + t.filter(Boolean).length * TALL;
  }
  return h + ROW + TALL > window.innerHeight * 0.8;
}
