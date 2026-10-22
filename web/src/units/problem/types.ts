import type { Run } from '@/api/gen/doc';

export type { Run };

/** The three steps of help, each opened on purpose (P3). */
export type HelpKind = 'hint' | 'walkthrough' | 'answer';

export const HELP_KINDS: readonly HelpKind[] = [
  'hint',
  'walkthrough',
  'answer',
];

export const HELP_TITLE: Record<HelpKind, string> = {
  hint: 'Hint',
  walkthrough: 'Walkthrough',
  answer: 'Answer',
};

/** One step of help: written, or still being written and when it should be
 *  (P10). */
export type Help =
  | { status: 'ready'; runs: Run[] }
  | { status: 'writing'; seconds: number };

/** A figure under the statement. `src` is a drawing or an image; the sample
 *  data draws its own. */
export interface Figure {
  id: string;
  caption: string;
  /** Where the picture is. */
  src: string;
}

/** A part of the problem. A part the note skips shows dimmed and gets no
 *  help (P7). */
export interface Part {
  label: string;
  runs: Run[];
  skipped?: boolean;
}

/** Where the problem stands: found and ready, still being found, or not
 *  found after `tries` goes (P10, P16). */
export type Found =
  | { status: 'ready' }
  | { status: 'queued' }
  | { status: 'finding'; seconds: number }
  | { status: 'failed'; tries: number; tried: string[] };

export interface ProblemData {
  id: string;
  /** "3.1 #7": the book's own label (P14). */
  label: string;
  /** A short generated title, 2 to 4 words: "RC step response". */
  title: string;
  /** The page it is on, in the book. */
  page: number;
  /** The professor's note, shown above the problem (P15). */
  note?: Run[];
  statement: Run[];
  figures: Figure[];
  parts: Part[];
  help: Record<HelpKind, Help>;
  found: Found;
  done: boolean;
  /** Opened, help read or time spent, but not done. */
  started?: boolean;
}

/** The items of a problem's menu: everything that is not the work itself
 *  (P4). */
export type ProblemMenuItem =
  | 'edit'
  | 'move'
  | 'notes'
  | 'check-figure'
  | 'wrong-problem'
  | 'remove';
