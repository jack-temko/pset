import { parseDueDate } from '@/units/set-line/dates';

/** A fixed Tuesday noon, so "due soon" and "opened 2 h ago" read the same on
 *  every visit. */
export const TODAY = new Date(2026, 9, 13, 12);
const day = (d: number) =>
  parseDueDate(`2026-10-${String(d).padStart(2, '0')}`);
const ago = (hours: number) => new Date(TODAY.getTime() - hours * 3_600_000);

/** The sets, in no order: the list's own rule orders and caps them. */
export const SETS = [
  {
    set: 'Homework 3',
    course: 'Differential equations',
    done: 1,
    total: 3,
    minutesLeft: 130,
    due: day(27),
    openedAt: ago(72),
  },
  {
    set: 'Problem set 4',
    course: 'Circuits I',
    done: 0,
    total: 6,
    minutesLeft: 70,
    due: day(15),
  },
  {
    set: 'Problem set 6',
    course: 'Linear algebra',
    done: 1,
    total: 4,
    openedAt: ago(2),
  },
  {
    set: 'Homework 7',
    course: 'Signals and systems',
    done: 3,
    total: 5,
    minutesLeft: 45,
    due: day(18),
  },
  {
    set: 'Problem set 2',
    course: 'Thermodynamics',
    done: 3,
    total: 8,
    due: day(10),
  },
  {
    set: 'Homework 5',
    course: 'Circuits I',
    done: 2,
    total: 6,
    due: day(17),
  },
  {
    set: 'Problem set 1',
    course: 'Linear algebra',
    done: 4,
    total: 4,
    due: day(30),
    openedAt: ago(30 * 24),
  },
];
