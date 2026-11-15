import { money } from '@/lib/format';
import { studyDay } from '@/units/heatmap/day';
import { homeStats } from '@/units/home/stats';
import { timeLeft } from '@/units/set-line/dates';
import type { CourseData, CourseSet } from './sample';

/** To do by due date, undated last; the finished apart. */
export function split(sets: readonly CourseSet[]) {
  const stamp = (s: CourseSet) => s.due?.getTime() ?? Infinity;
  return {
    todo: sets
      .filter((s) => s.done < s.total || s.readingMinutes !== undefined)
      .sort((a, b) => stamp(a) - stamp(b)),
    done: sets.filter(
      (s) => s.done >= s.total && s.readingMinutes === undefined,
    ),
  };
}

/** What sizes the course page while it loads: whether each assignment to do
 *  has a second line, how many are done (the switch), how many materials and
 *  memories, and how many characters each figure has, since the labels beside
 *  them align to the widest. The name and the line under it may wrap: each
 *  loads as one bar line and grows (bone-d4). */
export interface CourseShape {
  todo: readonly (1 | 2)[];
  done: number;
  materials: number;
  memories: number;
  figures: readonly [number, number];
}

const lines = (s: CourseSet): 1 | 2 =>
  s.readingMinutes !== undefined ||
  (s.minutesLeft !== undefined && timeLeft(s.minutesLeft) !== '')
    ? 2
    : 1;

export function courseShape(course: CourseData, today: Date): CourseShape {
  const { todo, done } = split(course.sets);
  const s = homeStats(course.study, studyDay(today));
  return {
    todo: todo.map(lines),
    done: done.length,
    materials: course.materials.length,
    memories: course.memories.length,
    figures: [String(s.questions.week).length, money(course.cost).length],
  };
}
