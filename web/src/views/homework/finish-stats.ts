import type { Q } from './progress'

/** What the finish page says about the time: the total, the average over the
 *  questions that were timed, and the longest ones. Questions with no time
 *  (never opened in the walkthrough, or done before time was kept) are
 *  not counted as quick, they are left out. */
export type FinishStats = {
  /** Seconds across every timed question. */
  total: number
  /** Seconds a timed question took, on average. */
  average: number
  timed: number
  /** The longest two, longest first, when at least two were timed. */
  hardest: Q[]
  /** The most any one question took, for scaling the bars. */
  most: number
}

export function finishStats(questions: Q[]): FinishStats {
  const timed = questions.filter((q) => (q.seconds ?? 0) > 0)
  const total = timed.reduce((n, q) => n + (q.seconds ?? 0), 0)
  const longest = [...timed].sort((a, b) => (b.seconds ?? 0) - (a.seconds ?? 0))
  return {
    total,
    average: timed.length > 0 ? total / timed.length : 0,
    timed: timed.length,
    hardest: timed.length >= 2 ? longest.slice(0, 2) : [],
    most: longest[0]?.seconds ?? 0,
  }
}

/** Seconds as whole minutes for a stat (at least one, for anything timed). */
export const toMinutes = (seconds: number) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0)

/** "41m", "1h 5m": the row value for a question's time. */
export function shortTime(seconds: number): string {
  const m = toMinutes(seconds)
  if (m < 60) return `${m}m`
  return m % 60 === 0 ? `${m / 60}h` : `${Math.floor(m / 60)}h ${m % 60}m`
}

/** Why a question is listed as hard: the longest, and when it is also the
 *  highest in difficulty, which is what the bar weighted it by. */
export function hardWhy(q: Q, rank: number, all: Q[]): string {
  const top = Math.max(...all.map((x) => x.difficulty ?? 0))
  if (rank === 0) return top > 0 && q.difficulty === top ? 'Longest, and the highest difficulty in the set' : 'Longest'
  return 'Second longest'
}
