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
  /** The exact text it shows, for a state that is empty or failed. A test
   *  renders the state and fails when this text is not on screen. */
  text?: string;
}

export interface Action<A extends string = string> {
  id: A;
  /** The exact label on screen. */
  label: string;
  does: string;
  target?: Target;
}

export interface Flow<A extends string = string> {
  id: string;
  name: string;
  /** Action ids of this unit, in order. A step may land in any unit. */
  steps: readonly A[];
}

export interface DataRead {
  reads: string;
  /** 'sample' until the unit is wired to the server; then the endpoint it
   *  calls, as the generated API types write it ('GET /api/week'). The
   *  checks read endpoints from the "X is GET /api/..." comments in
   *  `web/src/api/gen`, so an endpoint without such a comment fails until
   *  its comment is added. */
  call: string;
}

/** What a unit keeps for the student between visits (keep-the-place). */
export interface Remembered {
  /** What is kept: "the problem you were on". */
  what: string;
  /** Per what: a set, a course, a material. */
  per: string;
  /** For how long it is kept. */
  for: string;
}

export interface Input<I extends string = string> {
  /** A prop of the component (or an entry of its opening), checked against
   *  the component's props in both directions by the typecheck. */
  name: I;
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
 *  release must be optional, and keep its meaning (A3). The format changes
 *  only through its own grill, in one change that updates every spec and the
 *  checks together (F5, ideas/spec-format-grill.md). */
export interface Spec<
  S extends string = string,
  A extends string = string,
  D extends readonly DataRead[] = readonly DataRead[],
  I extends string = string,
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
  actions: readonly Action<A>[];
  /** When it reads data. */
  data?: D;
  /** What it keeps between visits, per what, for how long. */
  remembers?: readonly Remembered[];
  inputs: readonly Input<I>[];
  priority: {
    /** What the student sees first. */
    first: string;
    /** The one main action. */
    main?: NoInfer<A>;
  };
  sizes: {
    /** What gives way first, in order. */
    gives: readonly string[];
  };
  rules: {
    /** Ids from the rulebook. */
    cite: readonly string[];
    local?: readonly LocalRule[];
  };
  decisions: readonly Decision[];
  /** How wide the design page opens the example, in px or 'full'. Without
   *  it, a component opens at 480, a pane at 440 and a view across the page. */
  exampleWidth?: number | 'full';
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
  const I extends string = string,
>(spec: Spec<S, A, D, I>): Spec<S, A, D, I> {
  return spec;
}
