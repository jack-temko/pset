/**
 * A view's grill (`grill.md`, written by the grill skill) opens with the
 * part to read at a glance and goes on with the reversals, disagreements,
 * open questions and the verbatim Q&A log. /views shows the first part by
 * default: it is everything above the first of those later headings.
 */
const LATER = /^## (Reversals|Disagreements|Frontier|Log)\b/m

export function grillSummary(src: string): string {
  const at = src.search(LATER)
  return (at === -1 ? src : src.slice(0, at)).trimEnd() + '\n'
}
