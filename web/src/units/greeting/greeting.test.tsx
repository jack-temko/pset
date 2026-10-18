import { describe, expect, it } from 'vitest';

import { dueLine, nextDue } from './due';

const today = new Date(2026, 9, 13); // Tuesday
const d = (n: number) => new Date(2026, 9, n);

describe('what is due next', () => {
  it('names the nearest unfinished set, by weekday', () => {
    const sets = [
      { set: 'Homework 7', due: d(18), done: 3, total: 5 },
      { set: 'Problem set 4', due: d(15), done: 0, total: 6 },
    ];
    expect(dueLine(sets, today)).toBe('Problem set 4 is due Thu.');
  });

  it('puts a past-due set first, in the past tense', () => {
    const sets = [
      { set: 'Problem set 4', due: d(15), done: 0, total: 6 },
      { set: 'Problem set 2', due: d(12), done: 1, total: 8 },
    ];
    expect(dueLine(sets, today)).toBe('Problem set 2 was due Mon.');
  });

  it('skips a finished set and one without a date', () => {
    const sets = [
      { set: 'Done', due: d(14), done: 4, total: 4 },
      { set: 'No date', done: 0, total: 3 },
    ];
    expect(nextDue(sets, today)).toBeUndefined();
    expect(dueLine(sets, today)).toBe('Nothing due this week.');
  });

  it('says nothing is due when the nearest is past a week', () => {
    expect(
      dueLine([{ set: 'Later', due: d(21), done: 0, total: 2 }], today),
    ).toBe('Nothing due this week.');
    expect(
      dueLine([{ set: 'Later', due: d(20), done: 0, total: 2 }], today),
    ).toBe('Later is due Oct 20.');
  });
});
