import type { Run } from '@/units/problem/types';

/** A place in a material: the material's id in the course and a printed
 *  page. A page chip hands it to the workspace (ask-d9). */
export interface PageRef {
  material: string;
  page: number;
}

/** What a paragraph is made of: runs as the wire sends them, and page
 *  chips, which the workspace turns into a page of the material. */
export type Inline = Run | { ref: PageRef };

/** A short label the model writes (a caption, a column head, a step): plain
 *  text, or runs when it holds math, so "V_0" draws as math (ask-d27). */
export type Label = string | readonly Run[];

export interface Series {
  name: string;
  points: readonly (readonly [number, number])[];
}

/** The answer is a document of blocks (ask-d1). */
type Part =
  | { k: 'p'; runs: readonly Inline[] }
  | { k: 'math'; tex: string }
  | { k: 'statement'; name: string; ref?: PageRef; runs: readonly Inline[] }
  | { k: 'steps'; steps: readonly { tex: string; why?: Label }[] }
  | { k: 'plot'; title: Label; series: readonly Series[] }
  | {
      k: 'table';
      head: readonly Label[];
      rows: readonly (readonly Label[])[];
    }
  | { k: 'code'; code: string }
  | { k: 'callout'; runs: readonly Inline[] }
  /** A run of steps Ask took, where it took them (ask-d15). The one in
   *  flight, if any, is `current`; the rest are done. */
  | { k: 'run'; calls: readonly Call[]; current?: Call };

/** A part of the answer in the order it happened: a block of the document,
 *  or a run of steps. `own` marks text the model added on its own, which
 *  does not come from the course (ask-d21). */
export type Block = Part & { own?: boolean };

export type CallKind = 'search' | 'read' | 'look' | 'compute';

/** One call Ask made: what kind, and what it was about. */
export interface Call {
  kind: CallKind;
  /** The query, the page, the figure or the sum. */
  what: Label;
  /** For a read: how many pages it took in (one if left out). */
  pages?: number;
}

export type TurnStatus = 'working' | 'done' | 'stopped' | 'failed';

export interface Turn {
  id: string;
  /** The day it was asked, as the divider says it: "Sep 12", "Yesterday". */
  day: string;
  question: string;
  /** What the question was about: "3.A.4 · (a)". */
  about?: string;
  /** A picture that came with the question. */
  image?: string;
  status: TurnStatus;
  /** The answer in order: text, and the runs of steps between it. A working
   *  turn with nothing here yet is thinking. */
  blocks: readonly Block[];
  /** A memory Ask saved while answering. */
  remembered?: Label;
  failure?: {
    why: string;
    /** The key or the setup is the cause: Open Settings is offered. */
    setup?: boolean;
  };
}

/** What the composer hands over when a question is sent. */
export interface Question {
  text: string;
  about?: string;
  image?: string;
}

const liveText: Record<CallKind, string> = {
  search: 'Searching',
  read: 'Reading',
  look: 'Looking at',
  compute: 'Computing',
};

const doneText: Record<CallKind, string> = {
  search: 'Searched',
  read: 'Read',
  look: 'Looked at',
  compute: 'Computed',
};

/** A label as runs, for a line that joins it with words. */
export const runsOf = (l: Label): readonly Run[] =>
  typeof l === 'string' ? [{ t: l }] : l;

/** A label as plain text, for a tooltip or the clipboard. */
export const textOf = (l: Label): string =>
  typeof l === 'string' ? l : l.map((r) => r.t ?? r.m ?? '').join('');

const quote = (c: Call): readonly Run[] =>
  c.kind === 'search' ? [{ t: `'${textOf(c.what)}'` }] : runsOf(c.what);

/** The call in flight, as the live line says it: "Searching 'time constant'". */
export const liveLine = (c: Call): readonly Run[] => [
  { t: `${liveText[c.kind]} ` },
  ...quote(c),
];

/** A finished call, as the opened list says it. */
export const doneLine = (c: Call): readonly Run[] => [
  { t: `${doneText[c.kind]} ` },
  ...quote(c),
];

const times = (n: number) =>
  n === 1 ? 'once' : n === 2 ? 'twice' : `${String(n)} times`;

/** A run of steps in one line: "Searched twice, read 3 pages". */
export function summary(calls: readonly Call[]): string {
  const count = (k: CallKind) => calls.filter((c) => c.kind === k).length;
  const pages = calls
    .filter((c) => c.kind === 'read')
    .reduce((n, c) => n + (c.pages ?? 1), 0);
  const parts = [
    count('search') > 0 && `searched ${times(count('search'))}`,
    pages > 0 && `read ${String(pages)} ${pages === 1 ? 'page' : 'pages'}`,
    count('look') > 0 &&
      `looked at ${count('look') === 1 ? 'a figure' : `${String(count('look'))} figures`}`,
    count('compute') > 0 && `computed ${times(count('compute'))}`,
  ].filter((p): p is string => p !== false);
  if (parts.length === 0) return '';
  const line = parts.join(', ');
  return line[0].toUpperCase() + line.slice(1);
}
