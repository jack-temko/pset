import type { ReactNode } from 'react';

const NARROW = Symbol('narrow-only');
export interface NarrowOnly {
  [NARROW]: true;
  node: ReactNode;
}

/** A meta item that shows only where the aside does not, such as a count
 *  the aside's own bar repeats (list-row-d3). */
export function narrowOnly(node: ReactNode): NarrowOnly {
  return { [NARROW]: true, node };
}

export function isNarrowOnly(x: unknown): x is NarrowOnly {
  return typeof x === 'object' && x !== null && NARROW in x;
}
