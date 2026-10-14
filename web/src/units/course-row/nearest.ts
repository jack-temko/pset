import type { SetLineProps } from '@/units/set-line';
import { daysUntil } from '@/units/set-line/dates';

export type ActiveSet = Omit<SetLineProps, 'today'>;

/** The nearest active set: the earliest due date, undated ones last. */
export function nearest(
  active: readonly ActiveSet[],
  today: Date,
): ActiveSet | undefined {
  const key = (a: ActiveSet) =>
    a.due === undefined ? Infinity : daysUntil(a.due, today);
  return [...active].sort((a, b) => key(a) - key(b))[0];
}
