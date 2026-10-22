import type { ProblemData } from '@/units/problem/types';

/** The set being worked, as the pane reads it. */
export interface WorkSet {
  id: string;
  name: string;
  /** A local calendar date: build it with `parseDueDate`. */
  due?: Date;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
  problems: ProblemData[];
  /** When the last problem was marked done. */
  finishedAt?: Date;
  /** When it was turned in; set means turned in. */
  turnedInAt?: Date;
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

/** The id of the next problem still to do after `from`, going forward only;
 *  nothing when there is none, which is when Next goes to the summary. */
export function nextToDo(
  problems: readonly ProblemData[],
  from: string,
): string | undefined {
  const at = problems.findIndex((p) => p.id === from);
  return problems.slice(at + 1).find((p) => !p.done)?.id;
}

/** How long "Removed 4.62 · Undo" stays (P8). */
export const UNDO_MS = 6000;
