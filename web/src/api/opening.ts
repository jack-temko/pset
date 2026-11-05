import type { Block } from './gen/doc';
import type { Opening, Question } from './gen/homework';
import { answersOf } from '@/components/document/tree';

/**
 * A set's opening question as its list row carries it: the same rule as
 * the server's (internal/homework/estimate.go, `openingQuestion`), so the cache
 * can keep it current when the question changes. Only the help panels that were
 * open keep their content (the answers are cut from the walkthrough, so either
 * keeps it), and what only the question's own work needs (the figures'
 * readings, boxes, usage) is left out.
 */
export function openingQuestion(q: Question): Question {
  const has = (name: string) => q.revealed.includes(name);
  return {
    ...q,
    hint: has('hint') ? q.hint : [],
    walkthrough: has('walkthrough') || has('answers') ? q.walkthrough : [],
    reading: [],
    readingDoubts: [],
    boxes: [],
    usage: undefined,
  };
}

/** Whether the Answers row is drawn for a walkthrough: not written yet, or with
 *  an answer in it (the same rule as helpRows, and the server's `hasAnswers`). */
export const hasAnswers = (walkthrough: Block[]) =>
  walkthrough.length === 0 || answersOf(walkthrough).length > 0;

export const openingOf = (q: Question): Opening => ({
  question: openingQuestion(q),
  hasAnswers: hasAnswers(q.walkthrough),
});
