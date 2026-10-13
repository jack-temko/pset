import type { Rule } from './rules';

export type Kind = 'component' | 'pane' | 'view';

/** Where a unit sends the student: another unit, and the state of it they
 *  land in. */
export interface Target {
  unit: string;
  state?: string;
}

export interface UnitState<S extends string = string> {
  id: S;
  name: string;
  /** When it happens. */
  when: string;
  /** The exact text it shows, for a state that is empty or failed. */
  text?: string;
  /** The skeleton it draws while it waits. Required when the unit reads data. */
  skeleton?: string;
}

export interface Action<A extends string = string> {
  id: A;
  /** The exact label on screen. */
  label: string;
  /** The shortcut key, if it has one. */
  key?: string;
  does: string;
  target?: Target;
}

export interface Flow<A extends string = string> {
  id: string;
  name: string;
  /** Action ids of this unit, in order. A step may land in any unit. */
  steps: readonly A[];
}

export interface ComponentUse {
  unit: string;
  use: string;
}

export interface DataRead {
  reads: string;
  call: string;
  waiting: string;
  failed: string;
}

export interface Input {
  name: string;
  type: string;
  default: string;
  does: string;
}

export interface LocalRule extends Rule {
  /** Local rules bind this unit only. */
  scope: string;
}

export interface Decision {
  /** Permanent. */
  id: string;
  decision: string;
  why: string;
  beat: string;
  date: string;
  /** The id of the decision that replaces this one. */
  supersededBy?: string;
}

/** The fields of a spec, in page order. Every field added after the first
 *  release must be optional, and keep its meaning (A3). */
export interface Spec<
  S extends string = string,
  A extends string = string,
  D extends readonly DataRead[] = readonly DataRead[],
> {
  id: string;
  kind: Kind;
  title: string;
  group: string;
  /** One sentence. */
  purpose: string;
  states: readonly UnitState<S>[];
  /** What the worst case is: the longest, the most, the empty. */
  stress: string;
  /** Pane and view: the student's journeys. */
  flows?: readonly Flow<NoInfer<A>>[];
  /** Pane and view: the components it is made of, checked against imports. */
  components?: readonly ComponentUse[];
  actions: readonly Action<A>[];
  /** When it reads data. */
  data?: D;
  inputs: readonly Input[];
  priority: {
    /** What the student sees first. */
    first: string;
    /** The one main action. */
    main?: NoInfer<A>;
  };
  sizes: {
    /** The narrowest width it must work at, in px. */
    narrowest: number;
    /** What gives way first, in order. */
    gives: readonly string[];
  };
  rules: {
    /** Ids from the rulebook. */
    cite: readonly string[];
    local?: readonly LocalRule[];
  };
  decisions: readonly Decision[];
  /** The word-for-word grill log, as a path from the repo root. */
  log?: string;
}

/** Any spec, for code that does not care about its ids. */
export type AnySpec = Spec;

/** The one way to write a spec: it keeps the ids as literal types, so a
 *  flow step or `priority.main` that is not an action of the unit fails
 *  the typecheck. */
export function defineSpec<
  const S extends string,
  const A extends string,
  const D extends readonly DataRead[] = readonly [],
>(spec: Spec<S, A, D>): Spec<S, A, D> {
  return spec;
}
