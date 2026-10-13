import type { ReactNode } from 'react';

import type { DataRead, Spec } from './spec';

type ByState<S extends string> = Record<S, () => ReactNode>;

/** The live renders of a unit, beside its spec. */
export type Examples<
  S extends string = string,
  D extends readonly DataRead[] = readonly DataRead[],
> = {
  /** One render per state id. */
  states: ByState<S>;
  /** The worst-case content: the longest, the most, the empty. */
  stress: () => ReactNode;
} & (D extends readonly []
  ? { skeletons?: ByState<S> }
  : { skeletons: ByState<S> });

/** Pairs a spec with its renders. A state without a render, a missing
 *  stress render, or (when the spec reads data) a state without a skeleton
 *  fails the typecheck. */
export function defineExamples<
  S extends string,
  A extends string,
  D extends readonly DataRead[],
>(_spec: Spec<S, A, D>, examples: Examples<S, D>): Examples<S, D> {
  return examples;
}

/** Any examples, for code that does not care about its ids. */
export type AnyExamples = {
  states: Record<string, () => ReactNode>;
  stress: () => ReactNode;
  skeletons?: Record<string, () => ReactNode>;
};
