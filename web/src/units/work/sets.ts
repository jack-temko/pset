import type { ProblemData } from '@/units/problem/types';

/** The set being worked, as the pane reads it. */
export interface WorkSet {
  id: string;
  name: string;
  /** A local calendar date: build it with `parseDueDate`. */
  due?: Date;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
  /** What the finish card says it took. */
  minutesSpent?: number;
  problems: ProblemData[];
  turnedIn?: boolean;
}

/** The items of the set menu (P: set menu). `undo-delete` is the Undo on
 *  "Deleted". */
export type SetMenuItem =
  | 'add'
  | 'box'
  | 'edit'
  | 'print'
  | 'turn-in'
  | 'take-back'
  | 'delete'
  | 'undo-delete';

/** How many problems are marked done. A part a note skips is not a problem,
 *  so it never counts. */
export const doneCount = (problems: readonly ProblemData[]) =>
  problems.filter((p) => p.done).length;

/** The id of the next problem still to do after `from`, going on past the
 *  end to the start; nothing when none is left. */
export function nextUnfinished(
  problems: readonly ProblemData[],
  from: string,
): string | undefined {
  const at = problems.findIndex((p) => p.id === from);
  for (let k = 1; k <= problems.length; k++) {
    const p = problems[(at + k) % problems.length];
    if (!p.done) return p.id;
  }
  return undefined;
}

/** How long "Removed 4.62 · Undo" stays (P8). */
export const UNDO_MS = 6000;
