import type { ReactNode } from 'react';

import { Bone } from '@/units/bone';

/** A small pill holding a number, set beside a title (counter-d1). It never
 *  truncates: a number that does not fit overflows rather than lie. Padding
 *  is a whole step: the theme locks fractional spacing out, and a
 *  fractional class here compiles to nothing (counter-d2). */
export function Counter({
  loading,
  children,
}: {
  /** While its number loads: a small pill bar at the counter's height
   *  (counter-d3). */
  loading?: boolean;
  children?: ReactNode;
}) {
  if (loading === true)
    return (
      <span className="ds-small inline-flex h-5 shrink-0 items-center">
        <Bone ch={3} pill />
      </span>
    );
  return (
    <span className="ds-small ds-tabular inline-flex h-5 shrink-0 items-center justify-center rounded-full bg-(--ds-pressed) px-2 whitespace-nowrap text-(--ds-fg)">
      {children}
    </span>
  );
}
