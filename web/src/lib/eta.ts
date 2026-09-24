import { useEffect, useState } from 'react'

/**
 * Time left on a step that takes a while, in rounded words: "about 3
 * minutes left". Never a countdown clock: the further out, the coarser.
 *
 * A step is something an entity (a book, a question) is doing, named by
 * kind ("import:read", "homework:writing"). There are two sorts:
 *
 * - **Counted** (140 of 312 pages): the step measures its own pace, and
 *   time left is what remains at that pace.
 * - **Uncounted** (one model call): it can't, so it is estimated from how
 *   long the same kind of step took the last few times in this browser.
 *   Past that it is "taking longer than usual". With no history yet there
 *   is nothing to say, and the caller keeps its spinner.
 *
 * The data layer reports where each entity is with `observe` as events
 * arrive, so a step is timed even while nothing on screen shows it. A
 * step counts toward history only when it was seen from its start to its
 * end. Everything here is this browser's alone and may be empty.
 */

// ---------------------------------------------------------------- words

export const LONGER_THAN_USUAL = 'taking longer than usual'

/** Milliseconds left as a phrase that reads mid-sentence: "a few seconds
 *  left", "less than a minute left", "about 3 minutes left", "about 25
 *  minutes left", "about an hour left", "about 2 hours left". */
export function timeLeftWords(ms: number): string {
  const s = Math.max(ms, 0) / 1000
  if (s < 10) return 'a few seconds left'
  if (s < 50) return 'less than a minute left'
  if (s < 90) return 'about a minute left'
  const m = s / 60
  if (m < 10) return `about ${Math.round(m)} minutes left`
  if (m < 50) return `about ${Math.round(m / 5) * 5} minutes left`
  if (m < 90) return 'about an hour left'
  return `about ${Math.round(m / 60)} hours left`
}

// ---------------------------------------------------------------- watching

/** A counted step's pace is measured over its last few minutes, so it
 *  follows a pace that changes, and only once it has run a few seconds. */
const PACE_WINDOW = 3 * 60_000
const PACE_MIN_SPAN = 5_000

type Sample = { t: number; done: number; total: number }

type Watch = {
  /** The step's kind, or undefined while the entity is in none. */
  step: string | undefined
  since: number
  /** Whether the step was seen to start, not found under way. */
  witnessed: boolean
  samples: Sample[]
}

const watching = new Map<string, Watch>()

/** Reports where an entity is: `step` is the kind of step it's in, or
 *  undefined when it's in none (queued, done, failed). A counted step
 *  passes its count. Repeating the same report changes nothing. */
export function observe(
  entity: string,
  step: string | undefined,
  count?: { done?: number; total?: number },
  now = Date.now(),
) {
  let w = watching.get(entity)
  if (w && w.step !== step) {
    // The step ended. An uncounted step seen whole is history.
    if (w.step && w.witnessed && w.samples.length === 0) record(w.step, now - w.since)
    w = { step, since: now, witnessed: true, samples: [] }
    watching.set(entity, w)
  } else if (!w) {
    w = { step, since: now, witnessed: false, samples: [] }
    watching.set(entity, w)
  }
  if (!step || count?.done === undefined || count.total === undefined) return
  const last = w.samples.at(-1)
  if (last && last.done === count.done && last.total === count.total) return
  w.samples.push({ t: now, done: count.done, total: count.total })
  // Keep the window, and the one sample just before it to measure from.
  const start = w.samples.findIndex((x) => x.t >= now - PACE_WINDOW)
  if (start > 1) w.samples.splice(0, start - 1)
}

/** Forgets an entity (removed, or gone from view for good). */
export function forget(entity: string) {
  watching.delete(entity)
}

/** Time left on the entity's current step, in words, or undefined when
 *  there's nothing honest to say yet. */
export function timeLeft(entity: string, now = Date.now()): string | undefined {
  const w = watching.get(entity)
  if (!w?.step) return undefined
  if (w.samples.length > 0) {
    const first = w.samples[0]
    const last = w.samples.at(-1)!
    const span = last.t - first.t
    if (span < PACE_MIN_SPAN || last.done <= first.done) return undefined
    const perItem = span / (last.done - first.done)
    // Time since the last count is progress toward the next item, but no
    // more than one item's worth: a stalled step doesn't count down.
    const left = (last.total - last.done) * perItem - Math.min(now - last.t, perItem)
    return timeLeftWords(left)
  }
  const usual = typical(w.step)
  if (usual === undefined) return undefined
  const elapsed = now - w.since
  if (elapsed > usual + Math.max(10_000, usual / 4)) return LONGER_THAN_USUAL
  return timeLeftWords(usual - elapsed)
}

// ---------------------------------------------------------------- history

/** How many past runs of a kind of step are kept; the estimate is their
 *  median, so one odd run doesn't swing it. */
const HISTORY = 5
const HISTORY_MAX = 60 * 60_000
const historyKey = (step: string) => `pset:step-times:${step}`

function readHistory(step: string): number[] {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(historyKey(step)) ?? '[]')
    return Array.isArray(v) ? v.filter((x): x is number => typeof x === 'number' && x > 0) : []
  } catch {
    return []
  }
}

function record(step: string, ms: number) {
  if (ms <= 0 || ms > HISTORY_MAX) return
  try {
    localStorage.setItem(historyKey(step), JSON.stringify([...readHistory(step), ms].slice(-HISTORY)))
  } catch {
    /* an estimate is a nicety: losing it is fine */
  }
}

/** The usual duration of a kind of step here, or undefined with no
 *  history. */
export function typical(step: string): number | undefined {
  const h = readHistory(step).sort((a, b) => a - b)
  if (h.length === 0) return undefined
  const mid = Math.floor(h.length / 2)
  return h.length % 2 ? h[mid] : (h[mid - 1] + h[mid]) / 2
}

// ---------------------------------------------------------------- hooks

/** The time, ticking every `ms` while `active`. */
export function useNow(ms: number, active = true): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms, active])
  return now
}

/** Time left on what `entity` is doing, kept current while it runs. The
 *  component reports what it shows too, so an entity loaded before any
 *  event (already under way) is at least timed from here on. */
export function useTimeLeft(
  entity: string,
  step: string | undefined,
  count?: { done?: number; total?: number },
): string | undefined {
  const now = useNow(1000, step !== undefined)
  const done = count?.done
  const total = count?.total
  useEffect(() => observe(entity, step, { done, total }), [entity, step, done, total])
  return step ? timeLeft(entity, now) : undefined
}
