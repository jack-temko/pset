import type { Question, Summary } from '@/api/homework';
import type {
  ProgressMark,
  ProgressSegment,
} from '@/components/progress-bar/weights';
import { outstanding } from '@/api/homework';

/**
 * What the walkthrough works out from a set's questions: its marks and
 * weights for the bar, where Next goes, what the one button does, and the
 * time left in words. Pure, so the flow can be tested without a screen.
 */

/** A question and a set as the wire sends them: a question with its
 *  difficulty and the seconds spent on it, a set with its bar, how many
 *  questions its time left was learned from, and the time left. */
export type Q = Question;
export type HomeworkSet = Summary;

/** The bar's segment for a question: a failed one is marked whatever else
 *  is true, then done, then the one you are on, then what waits. */
export function markOf(q: Question, here: boolean): ProgressMark {
  if (q.state === 'failed') return 'failed';
  if (q.done) return 'done';
  return here ? 'current' : 'waiting';
}

export const segments = (questions: Q[], at: number): ProgressSegment[] =>
  questions.map((q, i) => ({
    mark: markOf(q, i === at),
    weight: q.difficulty,
  }));

/** A set's bar on the list, from what the list carries: the per-question
 *  entries when there are any, else equal segments, done first. */
export function listSegments(set: HomeworkSet): ProgressSegment[] {
  if (set.bar)
    return set.bar.map((b) => ({
      mark: b.failed ? 'failed' : b.done ? 'done' : 'waiting',
      weight: b.weight,
    }));
  return Array.from({ length: set.total }, (_, i) => ({
    mark: i < set.done ? 'done' : 'waiting',
  }));
}

export const doneCount = (questions: Question[]) =>
  questions.filter((q) => q.done).length;

/** "2 of 8", the count that opens the list. */
export const countWords = (questions: Question[]) =>
  `${doneCount(questions)} of ${questions.length}`;

/** What the bar says in words, for a screen reader. */
export const barLabel = (questions: Question[]) =>
  `${countWords(questions)} done`;
/** The same for a set's row in the list, which has only the counts. */
export const setBarLabel = (set: { done: number; total: number }) =>
  `${set.done} of ${set.total} done`;

/** The first question not yet done, where a set opens. Null when every one
 *  is done (the finish page) or there are none. */
export function firstUnfinished(questions: Question[]): number | null {
  const i = questions.findIndex((q) => !q.done);
  return i === -1 ? null : i;
}

/** The next question not done after `from`, wrapping round the end, never
 *  `from` itself. Null when nothing else is left. */
export function nextUnfinished(
  questions: Question[],
  from: number,
): number | null {
  for (let step = 1; step < questions.length; step++) {
    const i = (from + step) % questions.length;
    if (!questions[i].done) return i;
  }
  return null;
}

/** What the one primary button does. A done question takes its mark back;
 *  one that cannot be finished yet (being written, failed, with no guide)
 *  is skipped, never marked done; any other is done and moved on from. */
export type Primary = 'next' | 'incomplete' | 'skip';

export function primaryOf(q: Question): Primary {
  if (q.done) return 'incomplete';
  if (q.state === 'failed' || q.state === 'unwritten' || outstanding(q))
    return 'skip';
  return 'next';
}

export const PRIMARY_LABEL: Record<Primary, string> = {
  next: 'Next question',
  incomplete: 'Mark incomplete',
  skip: 'Skip for now',
};

/** What the count's list says at the end of a question's row: only work in
 *  progress, by its stage. Done is the check, failed is the alert icon, and
 *  a question to do or the one you are on says nothing. */
export function stageWord(q: Question): string | null {
  if (q.done) return null;
  switch (q.state) {
    case 'pending':
    case 'located':
      return 'Queued';
    case 'locating':
      return 'Finding it';
    case 'reading':
      return 'Reading the figure';
    case 'writing':
      return 'Writing the guide';
    default:
      return null;
  }
}

/** Whether the engine is working on it this moment (a spinner, where a
 *  queued question only says so). */
export const isWorking = (q: Question): boolean =>
  !q.done &&
  (q.state === 'locating' || q.state === 'reading' || q.state === 'writing');

/** 1st, 2nd, 3rd, 4th, 11th, 21st. */
export function ordinal(n: number): string {
  const teen = n % 100 >= 11 && n % 100 <= 13;
  const suffix = teen
    ? 'th'
    : (({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ??
      'th');
  return `${n}${suffix}`;
}

/** Where a waiting question is in line: one more than the questions ahead
 *  of it that the engine still owes work on. The engine takes a set in order,
 *  so this is the wait as the student would count it. */
export function queuePlace(q: Question, questions: Question[]): number {
  return (
    1 +
    questions.filter(
      (x) => x.id !== q.id && x.position < q.position && outstanding(x),
    ).length
  );
}

// ---------------------------------------------------------------- time left

/** Fewer timed questions than this and the student's pace is a guess. */
export const MIN_TIMED = 2;
/** A range this wide against its middle is shown as a range (the backend's
 *  calibration test, estimate_test.go, is written against this number). */
const WIDE = 0.8;

/** Seconds as the nearest five minutes, in words: "25 min", "1 h 40 m". */
function span(seconds: number): string {
  const minutes = Math.max(5, Math.round(seconds / 300) * 5);
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

/**
 * The time left on a set, or nothing. Nothing until two questions have been
 * timed, and nothing once every question is done. Otherwise "about",
 * rounded to five minutes, and a range when the spread is wide. Never a
 * countdown: it changes when a question is finished, not by the second. The
 * one thing the student would regret is being told it confidently and being
 * wrong, so when in doubt it says nothing.
 */
export function timeLeftWords(
  set: HomeworkSet | undefined,
  questions?: Q[],
): string | null {
  const e = set?.estimate;
  if (!e || !(e.seconds > 0)) return null;
  // The set's questions when they are at hand (the walkthrough), else what
  // its row in the list carries.
  const timed = questions
    ? questions.filter((q) => (q.seconds ?? 0) > 0).length
    : (set.timed ?? 0);
  const finished = questions
    ? questions.every((q) => q.done)
    : set.total > 0 && set.done === set.total;
  if (finished || timed < MIN_TIMED) return null;
  const { low, high } = e;
  if (
    low !== undefined &&
    high !== undefined &&
    high > low &&
    (high - low) / e.seconds > WIDE
  ) {
    return `${span(low)} to ${span(high)} left`;
  }
  return `about ${span(e.seconds)} left`;
}
