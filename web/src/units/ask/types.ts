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

export interface Series {
  name: string;
  points: readonly (readonly [number, number])[];
}

/** The answer is a document of blocks (ask-d1). */
export type Block =
  | { k: 'p'; runs: readonly Inline[] }
  | { k: 'math'; tex: string }
  | { k: 'statement'; name: string; ref?: PageRef; runs: readonly Inline[] }
  | { k: 'steps'; steps: readonly { tex: string; why?: string }[] }
  | { k: 'plot'; title: string; series: readonly Series[] }
  | {
      k: 'table';
      head: readonly string[];
      rows: readonly (readonly string[])[];
    }
  | { k: 'code'; code: string }
  | { k: 'callout'; runs: readonly Inline[] };

export type CallKind = 'search' | 'read' | 'look' | 'compute';

/** One call Ask made: what kind, and what it was about. */
export interface Call {
  kind: CallKind;
  /** The query, the page, the figure or the sum. */
  what: string;
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
  /** The calls that are finished. */
  calls: readonly Call[];
  /** The call in flight. Without one, a working turn is thinking. */
  inFlight?: Call;
  blocks: readonly Block[];
  /** A preference Ask saved while answering. */
  remembered?: string;
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

const quote = (c: Call) => (c.kind === 'search' ? `'${c.what}'` : c.what);

/** The call in flight, as the live line says it: "Searching 'eigenvalue'". */
export const liveLine = (c: Call) => `${liveText[c.kind]} ${quote(c)}`;

/** A finished call, as the opened list says it. */
export const doneLine = (c: Call) => `${doneText[c.kind]} ${quote(c)}`;

const times = (n: number) =>
  n === 1 ? 'once' : n === 2 ? 'twice' : `${String(n)} times`;

/** All the calls of an answer in one line: "Read 3 pages, searched twice". */
export function summary(calls: readonly Call[]): string {
  const count = (k: CallKind) => calls.filter((c) => c.kind === k).length;
  const pages = calls
    .filter((c) => c.kind === 'read')
    .reduce((n, c) => n + (c.pages ?? 1), 0);
  const parts = [
    pages > 0 && `read ${String(pages)} ${pages === 1 ? 'page' : 'pages'}`,
    count('search') > 0 && `searched ${times(count('search'))}`,
    count('look') > 0 &&
      `looked at ${count('look') === 1 ? 'a figure' : `${String(count('look'))} figures`}`,
    count('compute') > 0 && `computed ${times(count('compute'))}`,
  ].filter((p): p is string => p !== false);
  if (parts.length === 0) return 'Answered without looking anything up';
  const line = parts.join(', ');
  return line[0].toUpperCase() + line.slice(1);
}
