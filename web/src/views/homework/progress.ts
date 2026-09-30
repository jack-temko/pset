import type { Question, Summary } from '@/api/homework'
import type { ProgressMark, ProgressSegment } from '@/components/progress-bar/weights'
import { outstanding } from '@/api/homework'

/**
 * What the walkthrough works out from a set's questions: its marks and
 * weights for the bar, where Next goes, what the one button does, and the
 * time left in words. Pure, so the flow can be tested without a screen.
 */

/** What the backend will add to a question (how hard it is against the rest
 *  of the set, how long the student has spent on it) and to a set (the time
 *  left). The wire types do not carry them yet, so they are read through
 *  here, and each may be missing. */
export type QuestionExtra = { difficulty?: number; seconds?: number }
export type SetExtra = { estimate?: Estimate }
/** Seconds left at the student's pace, and the range it could fall in. */
export type Estimate = { seconds: number; low?: number; high?: number }

export type Q = Question & QuestionExtra
export type HomeworkSet = Summary & SetExtra

/** The bar's segment for a question: a failed one is marked whatever else
 *  is true, then done, then the one you are on, then what waits. */
export function markOf(q: Question, here: boolean): ProgressMark {
  if (q.state === 'failed') return 'failed'
  if (q.done) return 'done'
  return here ? 'current' : 'waiting'
}

export const segments = (questions: Q[], at: number): ProgressSegment[] =>
  questions.map((q, i) => ({ mark: markOf(q, i === at), weight: q.difficulty }))

export const doneCount = (questions: Question[]) => questions.filter((q) => q.done).length

/** "2 of 8", the count that opens the list. */
export const countWords = (questions: Question[]) => `${doneCount(questions)} of ${questions.length}`

/** What the bar says in words, for a screen reader. */
export const barLabel = (questions: Question[]) => `${countWords(questions)} done`

/** The first question not yet done, where a set opens. Null when every one
 *  is done (the finish page) or there are none. */
export function firstUnfinished(questions: Question[]): number | null {
  const i = questions.findIndex((q) => !q.done)
  return i === -1 ? null : i
}

/** The next question not done after `from`, wrapping round the end, never
 *  `from` itself. Null when nothing else is left. */
export function nextUnfinished(questions: Question[], from: number): number | null {
  for (let step = 1; step < questions.length; step++) {
    const i = (from + step) % questions.length
    if (!questions[i].done) return i
  }
  return null
}

/** What the one primary button does. A done question takes its mark back;
 *  one that cannot be finished yet (being written, failed, with no guide)
 *  is skipped, never marked done; any other is done and moved on from. */
export type Primary = 'next' | 'incomplete' | 'skip'

export function primaryOf(q: Question): Primary {
  if (q.done) return 'incomplete'
  if (q.state === 'failed' || q.state === 'unwritten' || outstanding(q)) return 'skip'
  return 'next'
}

export const PRIMARY_LABEL: Record<Primary, string> = {
  next: 'Next question',
  incomplete: 'Mark incomplete',
  skip: 'Skip for now',
}

/** A word for a question's state in the count's list. */
export function stateWord(q: Question, here: boolean): string {
  if (q.state === 'failed') return 'Failed'
  if (q.done) return 'Done'
  if (here) return 'Here'
  if (q.state === 'pending' || q.state === 'located') return 'Queued'
  if (outstanding(q)) return 'Being written'
  return 'To do'
}

// ---------------------------------------------------------------- time left

/** Fewer timed questions than this and the student's pace is a guess. */
export const MIN_TIMED = 2
/** A range this wide against its middle is shown as a range. */
const WIDE = 0.5

/** Seconds as the nearest five minutes, in words: "25 min", "1 h 40 m". */
function span(seconds: number): string {
  const minutes = Math.max(5, Math.round(seconds / 300) * 5)
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} m`
}

/**
 * The time left on a set, or nothing. Nothing until two questions have been
 * timed, and nothing once every question is done. Otherwise "about",
 * rounded to five minutes, and a range when the spread is wide. Never a
 * countdown: it changes when a question is finished, not by the second. The
 * one thing the student would regret is being told it confidently and being
 * wrong, so when in doubt it says nothing.
 */
export function timeLeftWords(set: HomeworkSet | undefined, questions: Q[]): string | null {
  const e = set?.estimate
  if (!e || !(e.seconds > 0)) return null
  if (questions.every((q) => q.done)) return null
  if (questions.filter((q) => (q.seconds ?? 0) > 0).length < MIN_TIMED) return null
  const { low, high } = e
  if (low !== undefined && high !== undefined && high > low && (high - low) / e.seconds > WIDE) {
    return `${span(low)} to ${span(high)} left`
  }
  return `about ${span(e.seconds)} left`
}
