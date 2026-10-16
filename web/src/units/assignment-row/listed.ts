import { daysUntil } from '@/units/set-line/dates';

/** How many assignments Home lists before "Show all" (assignment-row-d4). */
export const ASSIGNMENT_CAP = 5;

/** The window, in days, for both "due within" and "opened in the last". */
export const ASSIGNMENT_DAYS = 7;

export interface Listable {
  /** A local calendar date; none when the course gave no date. */
  due?: Date;
  /** When the student last opened it. */
  openedAt?: Date;
}

export type Reason = 'due' | 'opened';

const DAY_MS = 86_400_000;

/** Why a set is listed: due within 7 days (or already past), else opened in
 *  the last 7 days, else not at all. A set that is both is a `due` one. */
export function reasonFor(
  s: Listable,
  today: Date,
): { reason: Reason } | undefined {
  if (s.due !== undefined && daysUntil(s.due, today) <= ASSIGNMENT_DAYS)
    return { reason: 'due' };
  if (
    s.openedAt !== undefined &&
    today.getTime() - s.openedAt.getTime() <= ASSIGNMENT_DAYS * DAY_MS
  )
    return { reason: 'opened' };
  return undefined;
}

/** The Home list: the sets that qualify, due ones first by date (the most
 *  overdue first), then opened ones, newest first; at most 5 shown, the rest
 *  counted for "Show all". */
export function listAssignments<T extends Listable>(
  sets: readonly T[],
  today: Date,
): { shown: (T & { reason: Reason })[]; more: number } {
  const all = sets.flatMap((s) => {
    const r = reasonFor(s, today);
    return r ? [{ ...s, ...r }] : [];
  });
  const due = all
    .filter((s) => s.reason === 'due')
    .sort(
      (a, b) =>
        daysUntil(a.due ?? today, today) - daysUntil(b.due ?? today, today),
    );
  const opened = all
    .filter((s) => s.reason === 'opened')
    .sort(
      (a, b) => (b.openedAt?.getTime() ?? 0) - (a.openedAt?.getTime() ?? 0),
    );
  const ordered = [...due, ...opened];
  return {
    shown: ordered.slice(0, ASSIGNMENT_CAP),
    more: Math.max(0, ordered.length - ASSIGNMENT_CAP),
  };
}
