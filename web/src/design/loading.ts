import {
  createContext,
  createElement,
  useContext,
  type ComponentType,
  type ReactNode,
} from 'react';

/** The loading contract (ideas/skeleton-plan.md, settled in
 *  ideas/skeleton-grill.md). A unit that waits on data has one component and
 *  one layout: it takes its data, or `loading` with its shape, the few facts
 *  of the data that decide a box size (how many rows, one line or two). The
 *  same code draws the same frame either way; unknown values are bones. */

/** Nothing is known yet (a first visit, a cold link): the unit draws only
 *  what every shape shares and leaves the rest quiet, never a guess (S2). */
export const UNKNOWN = 'unknown';
export type Unknown = typeof UNKNOWN;

/** What a unit that waits declares: which props are data, and how to read
 *  the shape from them. */
export interface Loads<D, S> {
  /** The props that are data. Every other prop is known before it. */
  data: readonly (keyof D & string)[];
  /** Every fact of the data that sizes a box, and nothing else. */
  shapeOf: (data: D) => S;
}

/** The props of a unit that waits: what is always known (K), then all its
 *  data (D), or `loading` with its shape. While loading, a data prop that is
 *  passed is drawn real (the name from the clicked link); every other value
 *  is a bone. */
export type Waits<K, D, S> = K &
  ((D & { loading?: undefined }) | (Partial<D> & { loading: S | Unknown }));

/** How the design page and the proofs force a unit into loading: with the
 *  shape of the data its example gave it, or with nothing known. */
export type Forced = 'shape' | 'unknown' | null;

export const ForceLoading = createContext<Forced>(null);

/** A unit that waits, carrying its `loads` for the checks. */
export type WaitingUnit<P> = ComponentType<P> & {
  loads: Loads<never, unknown>;
};

/** Marks a unit as one that waits. Under `ForceLoading`, a render given its
 *  full data draws as loading instead: the shape read from that data, the
 *  data props left out. So no loading example is written by hand: it is the
 *  same example, forced (S7). */
export function waits<P extends { loading?: unknown }, D, S>(
  loads: Loads<D, S>,
  unit: (props: P) => ReactNode,
): ((props: P) => ReactNode) & { loads: Loads<D, S> } {
  function Waiting(props: P) {
    const forced = useContext(ForceLoading);
    if (forced === null || props.loading !== undefined)
      return createElement(unit as ComponentType<P>, props);
    const known: Record<string, unknown> = { ...props };
    for (const k of loads.data) Reflect.deleteProperty(known, k);
    known.loading =
      forced === 'unknown' ? UNKNOWN : loads.shapeOf(props as unknown as D);
    return createElement(unit as ComponentType<P>, known as P);
  }
  Waiting.displayName = `Waits(${unit.name})`;
  return Object.assign(Waiting, { loads });
}
