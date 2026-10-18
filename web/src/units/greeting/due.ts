import { daysUntil, dueClause } from '@/units/set-line/dates';

/** "Due next" looks this many days ahead; past that it is not "this week"
 *  (home-info-grill D11). */
export const LOOKAHEAD_DAYS = 7;

export interface GreetingSet {
  set: string;
  due?: Date;
  done: number;
  total: number;
}

/** The set the sub-line names: the nearest due date among the unfinished
 *  sets, so a past-due one comes first. None past the look-ahead. */
export function nextDue(
  sets: readonly GreetingSet[],
  today: Date,
): (GreetingSet & { due: Date }) | undefined {
  let best: (GreetingSet & { due: Date }) | undefined;
  for (const s of sets) {
    if (s.due === undefined || s.done >= s.total) continue;
    if (best === undefined || s.due < best.due) best = { ...s, due: s.due };
  }
  return best && daysUntil(best.due, today) <= LOOKAHEAD_DAYS
    ? best
    : undefined;
}

/** The sub-line: "Problem set 4 is due Thu.", "Problem set 4 was due Mon.",
 *  or "Nothing due this week." */
export function dueLine(sets: readonly GreetingSet[], today: Date): string {
  const next = nextDue(sets, today);
  if (!next) return 'Nothing due this week.';
  const { overdue, text } = dueClause(next.due, today);
  return `${next.set} ${overdue ? 'was' : 'is'} ${text}.`;
}
