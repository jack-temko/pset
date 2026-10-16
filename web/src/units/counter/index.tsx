import type { ReactNode } from 'react';

/** A small pill holding a number, set beside a title (counter-d1). It never
 *  truncates: a number that does not fit overflows rather than lie. Padding
 *  is a whole step: the theme locks fractional spacing out, and a
 *  fractional class here compiles to nothing (counter-d2). */
export function Counter({ children }: { children: ReactNode }) {
  return (
    <span className="ds-small ds-tabular inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-(--ds-pressed) px-2 whitespace-nowrap text-(--ds-fg)">
      {children}
    </span>
  );
}
