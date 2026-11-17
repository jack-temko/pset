import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';

import { QuietSeen } from './arrival';
import { MOTION } from './tokens';

/** The loading contract, after the audit (ideas/skeleton-grill.md, "After
 *  the audit", D1 and D2). Moving between screens, the previous screen holds
 *  until the next one's data is in. A read that outlasts the grace shows the
 *  new screen's quiet form: its chrome, its title if the link carried it, and
 *  nothing past the first thing whose size is unknown. No shapes, no bars at
 *  a remembered size: nothing drawn ever moves. */

/** What a screen that waits declares: which props are data. Every other
 *  prop is known before it. */
export interface Loads<D> {
  data: readonly (keyof D & string)[];
}

/** The props of a screen that waits: what is always known (K), then all its
 *  data (D), or `loading` for its quiet form. While loading, a data prop that
 *  is passed is drawn real (the title from the clicked link). */
export type Waits<K, D> = K &
  ((D & { loading?: undefined }) | (Partial<D> & { loading: true }));

/** How the design page and the proofs force a screen into its quiet form. */
export const ForceLoading = createContext(false);

/** A screen that waits, carrying its `loads` for the checks. */
export type WaitingUnit<P> = ComponentType<P> & {
  loads: Loads<never>;
};

/** Marks a screen as one that waits. Under `ForceLoading`, a render given its
 *  full data draws its quiet form instead, the data props left out. So no
 *  loading example is written by hand: it is the same example, forced. */
export function waits<P extends { loading?: unknown }, D>(
  loads: Loads<D>,
  unit: (props: P) => ReactNode,
): ((props: P) => ReactNode) & { loads: Loads<D> } {
  function Waiting(props: P) {
    const forced = useContext(ForceLoading);
    const quiet = forced || props.loading !== undefined;
    // Whether the quiet form stayed up past the grace, so the student saw
    // it: then what replaces it fades in (Arrives).
    const [seen, setSeen] = useState(false);
    const [was, setWas] = useState(quiet);
    if (was !== quiet) {
      setWas(quiet);
      if (quiet) setSeen(false);
    }
    useEffect(() => {
      if (!quiet) return;
      const t = setTimeout(() => {
        setSeen(true);
      }, MOTION.grace);
      return () => {
        clearTimeout(t);
      };
    }, [quiet]);
    let drawn = props;
    if (forced && props.loading === undefined) {
      const known: Record<string, unknown> = { ...props };
      for (const k of loads.data) Reflect.deleteProperty(known, k);
      known.loading = true;
      drawn = known as P;
    }
    return createElement(
      QuietSeen.Provider,
      { value: seen },
      createElement(unit as ComponentType<P>, drawn),
    );
  }
  Waiting.displayName = `Waits(${unit.name})`;
  return Object.assign(Waiting, { loads });
}
