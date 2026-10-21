import type { StudyDay } from '@/units/heatmap';
import { addDays, dayKey, mondayOf } from '@/units/heatmap/day';
import { LOOKAHEAD_DAYS, type GreetingSet } from '@/units/greeting/due';
import { daysUntil } from '@/units/set-line/dates';

export interface Change {
  direction: 'up' | 'down';
  /** "27%": the glyph says which way. */
  text: string;
}

const sum = (xs: readonly number[]) => xs.reduce((n, x) => n + x, 0);
const minutesOf = (d: StudyDay) => sum(d.courses.map((c) => c.minutes));

/** One figure this week and last week up to the same weekday. */
export interface Pair {
  week: number;
  last: number;
}

export interface HomeStats {
  time: Pair;
  questions: Pair;
  /** Monday to Sunday of this week. */
  days: { date: Date; minutes: number; today: boolean; future: boolean }[];
  /** The last 14 days, oldest first. */
  spark: { questions: number[]; left: number[] };
}

/** Every figure Home's stats show, worked out from the study days: weeks run
 *  Monday to Sunday and today is the last day counted (home-info-grill D8). */
export function homeStats(study: readonly StudyDay[], today: Date): HomeStats {
  const byDate = new Map(study.map((d) => [d.date, d]));
  const day = (d: Date) => byDate.get(dayKey(d));
  const over = (from: Date, to: Date, f: (d: StudyDay) => number) => {
    let n = 0;
    for (let d = from; d < to; d = addDays(d, 1)) {
      const s = day(d);
      if (s) n += f(s);
    }
    return n;
  };
  const monday = mondayOf(today);
  const end = addDays(today, 1);
  const pair = (f: (d: StudyDay) => number): Pair => ({
    week: over(monday, end, f),
    // Like with like: last week up to the same weekday (the days hold no
    // hours, so today counts whole).
    last: over(addDays(monday, -7), addDays(end, -7), f),
  });
  const questions = (d: StudyDay) => d.questions ?? 0;

  const first = (n: number) => addDays(today, -(n - 1));
  const lastDays = (f: (d: StudyDay) => number) =>
    Array.from({ length: 14 }, (_, i) => {
      const s = day(addDays(first(14), i));
      return s ? f(s) : 0;
    });

  return {
    time: pair(minutesOf),
    questions: pair(questions),
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(monday, i);
      const s = day(date);
      return {
        date,
        minutes: s ? minutesOf(s) : 0,
        today: dayKey(date) === dayKey(today),
        future: date > today,
      };
    }),
    spark: {
      questions: lastDays(questions),
      left: lastDays((d) => d.left ?? 0),
    },
  };
}

/** How a figure moved against the week before, or nothing when there is no
 *  week before to compare with or it did not move. */
export function changeOf(now: number, before: number): Change | undefined {
  if (!(before > 0)) return undefined;
  const pct = Math.round((Math.abs(now - before) / before) * 100);
  if (pct === 0) return undefined;
  return { direction: now > before ? 'up' : 'down', text: `${String(pct)}%` };
}

/** What is left to do among the sets due within a week, overdue ones
 *  included: the questions still to do and in how many sets. This is the
 *  number a student can act on tonight (home-d7). */
export function leftToDo(
  sets: readonly GreetingSet[],
  today: Date,
): { questions: number; sets: number } {
  let questions = 0;
  let count = 0;
  for (const s of sets) {
    if (s.due === undefined || daysUntil(s.due, today) > LOOKAHEAD_DAYS)
      continue;
    const todo = Math.max(s.total - s.done, 0);
    if (todo > 0) {
      questions += todo;
      count++;
    }
  }
  return { questions, sets: count };
}
