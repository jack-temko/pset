import { describe, expect, it } from 'vitest';

import type { Block } from './gen/doc';
import type { Question } from './gen/homework';
import { hasAnswers, openingOf, openingQuestion } from './opening';

const blocks = (...types: string[]) =>
  types.map((type) => ({ type }) as unknown as Block);

const full = {
  hint: blocks('hint'),
  walkthrough: blocks('step', 'answer'),
  reading: [[]],
  readingDoubts: [[]],
  boxes: [{}],
  statement: [{}],
  revealed: [] as string[],
} as unknown as Question;

describe('the opening question the cache keeps', () => {
  // The same cases as TestOpeningKeepsOnlyThePanelsThatWereOpen in
  // internal/homework/opening_test.go: one rule on both sides.
  it.each([
    [[], 0, 0],
    [['hint'], 1, 0],
    [['walkthrough'], 0, 2],
    [['answers'], 0, 2],
    [['hint', 'walkthrough'], 1, 2],
  ])(
    'with %j open keeps hint %i and walkthrough %i',
    (revealed, hint, walk) => {
      const got = openingQuestion({ ...full, revealed });
      expect(got.hint).toHaveLength(hint);
      expect(got.walkthrough).toHaveLength(walk);
      expect(got.reading).toEqual([]);
      expect(got.readingDoubts).toEqual([]);
      expect(got.boxes).toEqual([]);
      expect(got.usage).toBeUndefined();
      expect(got.statement).toHaveLength(1);
    },
  );

  it('has the Answers row when not written yet or with an answer, as the server and helpRows do', () => {
    expect(hasAnswers([])).toBe(true);
    expect(hasAnswers(blocks('step', 'answer'))).toBe(true);
    expect(hasAnswers(blocks('step', 'para'))).toBe(false);
    expect(openingOf({ ...full, walkthrough: blocks('para') }).hasAnswers).toBe(
      false,
    );
  });
});
