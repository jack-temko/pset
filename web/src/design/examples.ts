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

/** The error a component gets when its props and the spec's inputs differ:
 *  it names each prop the spec lacks and each input the component lacks. */
type Mismatch<P, I extends string> = {
  [
    K in Exclude<
      keyof P & string,
      I
    > as `prop missing from the spec inputs: ${K}`
  ]: never;
} & {
  [
    K in Exclude<I, keyof P & string> as `input that is not a prop: ${K}`
  ]: never;
};

/** The component itself, or the error naming the props that differ. */
type Matching<P, I extends string> = [keyof Mismatch<P, I>] extends [never]
  ? unknown
  : Mismatch<P, I>;

/** Pairs a spec with its renders and with the component they show. A state
 *  without a render, a missing stress render, a state without a skeleton
 *  (when the spec reads data), or a component whose props are not exactly
 *  the spec's inputs, fails the typecheck. */
export function defineExamples<
  S extends string,
  A extends string,
  D extends readonly DataRead[],
  I extends string,
  P,
>(
  _spec: Spec<S, A, D, I>,
  _component: ((props: P) => ReactNode) & Matching<P, I>,
  examples: Examples<S, D>,
): Examples<S, D> {
  return examples;
}

/** Any examples, for code that does not care about its ids. */
export type AnyExamples = {
  states: Record<string, () => ReactNode>;
  stress: () => ReactNode;
  skeletons?: Record<string, () => ReactNode>;
};
