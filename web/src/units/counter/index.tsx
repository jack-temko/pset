import type { ReactNode } from 'react';

/** A small pill holding a number, set beside a title (counter-d1). It never
 *  truncates: a number that does not fit overflows rather than lie. Padding
 *  is a whole step: the theme locks fractional spacing out, and a
 *  fractional class here compiles to nothing (counter-d2). */
export function Counter({
  loading,
  children,
}: {
  /** While its number loads: the counter's own pill, empty, as wide as one
   *  digit (counter-d3). A bone this small read as nothing on the dark
   *  ground. */
  loading?: boolean;
  children?: ReactNode;
}) {
  if (loading === true)
    return (
      <span
        aria-hidden
        className="ds-small ds-tabular inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-(--ds-pressed) px-2 whitespace-nowrap"
      >
        <span className="invisible">0</span>
      </span>
    );
  return (
    <span className="ds-small ds-tabular inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-(--ds-pressed) px-2 whitespace-nowrap text-(--ds-fg)">
      {children}
    </span>
  );
}
