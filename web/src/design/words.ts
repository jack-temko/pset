/** PSet's word list (rule one-word-per-thing): each thing the student sees
 *  has one name, on every screen and on the design page. `not` lists the
 *  words that name the same thing and must not appear in a spec's screen
 *  text (state names and texts, action labels, flow names). A student's own
 *  names ("Problem set 4", "Homework 7") are theirs, so the check skips them. */
export interface Word {
  word: string;
  means: string;
  not: readonly string[];
}

export const WORDS: readonly Word[] = [
  {
    word: 'course',
    means: 'The container; everything belongs to exactly one.',
    not: ['class'],
  },
  {
    word: 'assignment',
    means: 'Something the student works through, made of problems.',
    not: ['set', 'sets', 'homework', 'homeworks', 'work item'],
  },
  {
    word: 'problem',
    means: 'One question inside an assignment.',
    not: ['question', 'questions', 'exercise', 'exercises'],
  },
  {
    word: 'material',
    means:
      'A document the student puts in: a textbook, slides, a sheet, a past exam.',
    not: ['book', 'books', 'source', 'sources', 'resource', 'resources'],
  },
  {
    word: 'memory',
    means: 'Something PSet remembers about how the student works.',
    not: ['preference', 'preferences', 'note to self'],
  },
  {
    word: 'pane',
    means: 'One side of the workspace; it holds tabs.',
    not: ['panel', 'panels', 'tile', 'tiles'],
  },
];

/** A student's own names, skipped by the check: "Problem set 4", "Homework 7". */
const OWN_NAMES = /\b(Problem set|Homework) \d+\b/g;

/** The words of the list a line uses where the list names another: for
 *  "One set to do", `["set (say assignment)"]`. */
export function offList(line: string): string[] {
  const text = line.replace(OWN_NAMES, '');
  const found: string[] = [];
  for (const w of WORDS)
    for (const n of w.not)
      if (new RegExp(`\\b${n}\\b`, 'i').test(text))
        found.push(`${n} (say ${w.word})`);
  return found;
}
