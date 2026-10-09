import type { Scenario } from '@/views/mock/scenario';

function state(id: string, title: string, note: string): Scenario {
  return {
    id,
    title,
    note,
    start: () => ({ routes: [], props: { state: id } }),
  };
}

/** One scenario per mockup (ideas/error-catalog-grill.md, F1). */
export const SCENARIOS: Scenario[] = [
  state(
    'inline',
    'A. Inline block',
    'The import of Calculus failed; the notice sits in place of the book’s row.',
  ),
  state(
    'banner',
    'B. Banner',
    'The same failure in the flash banner; the background row opens it again.',
  ),
  state(
    'toast',
    'C. Toast plus dialog',
    'A short toast with Try again; More opens the dialog with why, fix and Details.',
  ),
  state(
    'field',
    'Field short form',
    'A title left empty: one line under the field, no Details.',
  ),
  state(
    'settings',
    'Settings errors',
    'Past errors as a table, newest first and grouped by id, each with Clear all.',
  ),
];
