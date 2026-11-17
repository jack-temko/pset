/** How long a bar takes to grow to its value and a number to roll to it,
 *  once the data comes (bone-d5). The same for both, so they land together. */
export const ARRIVE_MS = 700;

/** Whether to move: the browser can animate and the student has not asked
 *  for less motion. Tests run where neither exists. */
export function moves(el: Element): boolean {
  return (
    'animate' in el &&
    'matchMedia' in window &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}
