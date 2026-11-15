import type { ProblemShape } from '@/units/problem';
import type { ProblemData } from '@/units/problem/types';
import type { SummaryShape } from '@/units/summary';
import { timeLeft } from '@/units/set-line/dates';
import { sessionMemory, summaryKey, type Memory } from './memory';
import type { WorkSet } from './sets';

/** What sizes the work pane while its set loads: the set line's parts, how
 *  many problems the strip holds, and what the set opens on, with that
 *  thing's own shape (work-d23). */
export interface WorkShape {
  count: number;
  /** The set line has a time left. */
  minutes: boolean;
  turnedIn: boolean;
  opens:
    | { kind: 'empty' }
    | { kind: 'summary'; summary: SummaryShape }
    | { kind: 'problem'; problem: ProblemShape };
}

function problemShape(p: ProblemData): ProblemShape {
  return {
    status: p.found.status,
    note: p.note !== undefined && p.note.length > 0,
    figures: p.figures.length,
    parts: p.parts.length,
    again: p.found.status === 'failed' && p.found.tries >= 2,
    tried: p.found.status === 'failed' ? p.found.tried.length : 0,
    done: p.done,
  };
}

/** Where the pane opens and what it holds, by the rule the loaded pane uses:
 *  the problem asked for, else where the student left, else the first one
 *  to do; the summary for a finished or turned-in set. */
export function workShape(d: {
  set: WorkSet;
  startAt?: string;
  startSummary?: boolean;
  memory?: Memory;
}): WorkShape {
  const { set } = d;
  const memory = d.memory ?? sessionMemory;
  const problems = set.problems;
  const turnedIn = set.turnedInAt !== undefined;
  const all = problems.length > 0 && problems.every((p) => p.done);
  const wanted = d.startAt ?? memory.get(set.id);
  const current =
    problems.find((p) => p.id === wanted) ??
    problems.find((p) => !p.done) ??
    problems.at(0);
  const kept = memory.get(summaryKey(set.id));
  const summary =
    d.startSummary ??
    (d.startAt !== undefined
      ? false
      : kept !== undefined
        ? kept === '1'
        : turnedIn || all);
  const minutes = problems.reduce((n, p) => n + (p.minutes ?? 0), 0);
  const base = {
    count: problems.length,
    minutes: set.minutesLeft !== undefined && timeLeft(set.minutesLeft) !== '',
    turnedIn,
  };
  if (problems.length === 0) return { ...base, opens: { kind: 'empty' } };
  if (summary || current === undefined)
    return {
      ...base,
      opens: {
        kind: 'summary',
        summary: {
          count: problems.length,
          turnedIn,
          line: minutes > 0 || (all && set.finishedAt !== undefined),
          timed: minutes > 0,
          longest: minutes > 0,
          next: !turnedIn && !all,
        },
      },
    };
  return {
    ...base,
    opens: { kind: 'problem', problem: problemShape(current) },
  };
}
