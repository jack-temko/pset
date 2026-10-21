import { describe, expect, it } from 'vitest';

import { changeOf, homeStats, leftToDo } from './stats';

const today = new Date(2026, 9, 14); // a Wednesday
const day = (date: string, minutes: number, questions = 0) => ({
  date,
  courses: [{ course: 'Circuits I', minutes }],
  questions,
});

describe('changeOf', () => {
  it('says which way and by how much', () => {
    expect(changeOf(50, 100)).toEqual({ direction: 'down', text: '50%' });
    expect(changeOf(150, 100)).toEqual({ direction: 'up', text: '50%' });
  });

  it('says nothing without a week before or a move', () => {
    expect(changeOf(5, 0)).toBeUndefined();
    expect(changeOf(7, 7)).toBeUndefined();
  });
});

describe('homeStats', () => {
  const study = [
    day('2026-10-05', 60, 4), // last week
    day('2026-10-12', 30, 2), // this week, Monday
    day('2026-10-14', 45, 3), // today
    day('2026-09-20', 90),
  ];
  const s = homeStats(study, today);

  it('splits this week from the one before', () => {
    expect(s.time).toEqual({ week: 75, last: 60 });
    expect(s.questions).toEqual({ week: 5, last: 4 });
  });

  it('lays out Monday to Sunday with today marked', () => {
    expect(s.days.map((d) => [d.minutes, d.today, d.future])).toEqual([
      [30, false, false],
      [0, false, false],
      [45, true, false],
      [0, false, true],
      [0, false, true],
      [0, false, true],
      [0, false, true],
    ]);
    expect(s.spark.questions).toHaveLength(14);
    expect(s.spark.questions.at(-1)).toBe(3);
  });
});

describe('leftToDo', () => {
  const now = new Date(2026, 9, 14);
  it('counts the questions still to do in sets due within a week', () => {
    const sets = [
      { set: 'A', due: new Date(2026, 9, 10), done: 1, total: 4 }, // overdue
      { set: 'B', due: new Date(2026, 9, 21), done: 0, total: 6 }, // in 7 days
      { set: 'C', due: new Date(2026, 9, 22), done: 0, total: 9 }, // too far
      { set: 'D', due: new Date(2026, 9, 15), done: 5, total: 5 }, // finished
      { set: 'E', done: 0, total: 3 }, // no date
    ];
    expect(leftToDo(sets, now)).toEqual({ questions: 9, sets: 2 });
  });
});
