import type { Detail } from '@/api/homework';
import type { Variant } from '@/variants';
import { firstUnfinished, type HomeworkSet, type Q } from './progress';

export type SetVariant = Variant<'homeworkSet'>;

/** Which screen a set opens on, from what the list already knows of it
 *  (undefined when the list has not been seen). The same rule as the body's. */
/** Where a set opens: on the first question not yet done, or on the finish
 *  page when every one is. Worked out from the questions in the first render,
 *  never in an effect after a first screen has already shown. */
export function opening(questions: Q[]): { index: number; finishing: boolean } {
  const first = firstUnfinished(questions);
  return {
    index: first ?? 0,
    finishing: questions.length > 0 && first === null,
  };
}

export function summaryVariant(
  h: HomeworkSet | undefined,
): SetVariant | undefined {
  if (!h) return undefined;
  if (h.total === 0) return 'empty';
  if (h.done >= h.total) return h.turnedInAt ? 'turnedIn' : 'finish';
  return 'question';
}

/** The same, from the questions themselves. */
export function detailVariant(d: Detail): SetVariant {
  if (d.questions.length === 0) return 'empty';
  if (firstUnfinished(d.questions) !== null) return 'question';
  return d.homework.turnedInAt ? 'turnedIn' : 'finish';
}
