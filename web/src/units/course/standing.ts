import { dueClause } from '@/units/set-line/dates';
import type { CourseSet } from './sample';

export const plural = (n: number, one: string, many: string) =>
  `${String(n)} ${n === 1 ? one : many}`;

/** The muted line under the heading (course-d1): how many sets are to do
 *  and the next due date, or "Nothing due". */
export function standing(sets: readonly CourseSet[], today: Date): string {
  const todo = sets.filter((s) => s.done < s.total);
  const dues = todo.flatMap((s) => (s.due ? [s.due] : []));
  if (todo.length === 0 || dues.length === 0)
    return todo.length === 0
      ? 'Nothing due'
      : `${plural(todo.length, 'set', 'sets')} to do`;
  const first = dues.reduce((a, b) => (b < a ? b : a));
  const { overdue, text } = dueClause(first, today);
  return `${plural(todo.length, 'set', 'sets')} to do · ${overdue ? `was ${text}` : `next ${text}`}`;
}
