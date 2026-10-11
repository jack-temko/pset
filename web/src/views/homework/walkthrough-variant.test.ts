import { describe, expect, it } from 'vitest';

import { detailVariant, opening, summaryVariant } from './walkthrough-variant';

const q = (done: boolean) => ({ done }) as never;
const detail = (done: boolean[], turnedInAt?: string) =>
  ({ homework: { turnedInAt }, questions: done.map(q) }) as never;
const row = (done: number, total: number, turnedInAt?: string) =>
  ({ done, total, turnedInAt }) as never;

describe('the walkthrough picks its screen from what is known', () => {
  it('opens on the first question not done, or on the finish page when all are', () => {
    expect(opening([q(true), q(false), q(false)])).toEqual({
      index: 1,
      finishing: false,
    });
    expect(opening([q(true), q(true)])).toEqual({ index: 0, finishing: true });
    expect(opening([])).toEqual({ index: 0, finishing: false });
  });

  it("names a set's variant from the list's row and from the questions the same way", () => {
    const cases: [ReturnType<typeof row>, ReturnType<typeof detail>, string][] =
      [
        [row(1, 3), detail([true, false, false]), 'question'],
        [row(3, 3), detail([true, true, true]), 'finish'],
        [row(3, 3, 'x'), detail([true, true, true], 'x'), 'turnedIn'],
        [row(0, 0), detail([]), 'empty'],
      ];
    for (const [r, d, want] of cases) {
      expect(summaryVariant(r)).toBe(want);
      expect(detailVariant(d)).toBe(want);
    }
    expect(summaryVariant(undefined)).toBeUndefined();
  });

  it('a turned-in set with questions left is still on a question', () => {
    expect(summaryVariant(row(1, 3, 'x'))).toBe('question');
    expect(detailVariant(detail([true, false], 'x'))).toBe('question');
  });
});
