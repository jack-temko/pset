import type { Book, Phase, Task } from '@/lib/types'

// Everything here turns a task row into the words a student reads. The
// engine's own vocabulary — ingest, OCR, embed, batch — never reaches the
// screen: a book is examined, read, indexed, and made searchable.

export function isActiveTask(task: Task): boolean {
  return task.status === 'queued' || task.status === 'running'
}

/** A task the student still has to decide something about. Pausing is not
 *  one: they paused it on purpose, and the library card already says so. */
export function needsAttention(task: Task): boolean {
  return task.status === 'failed'
}

export function taskKindLabel(task: Task): string {
  return task.kind === 'prepare' ? 'Preparing' : 'Writing'
}

/** The phase doing work right now. */
export function activePhase(task: Task): Phase | null {
  return task.phases.find((p) => p.status === 'running') ?? null
}

/** The phase to show when nothing is running: the one that failed, else the
 *  last one that finished. */
export function focusPhase(task: Task): Phase | null {
  return (
    activePhase(task) ??
    task.phases.find((p) => p.status === 'failed') ??
    [...task.phases].reverse().find((p) => p.status === 'done') ??
    task.phases[0] ??
    null
  )
}

/** Where the task is in its plan, for the pip strip. The four phases of a
 *  preparation are wildly unequal — examining takes seconds, reading can
 *  take forty minutes — so one overall bar would lie. The bar shows the
 *  phase; the pips show the position. */
export function phasePosition(task: Task): { index: number; total: number } {
  const running = task.phases.findIndex((p) => p.status === 'running')
  if (running >= 0) return { index: running, total: task.phases.length }
  const done = task.phases.filter((p) => p.status === 'done').length
  return { index: Math.min(done, task.phases.length - 1), total: task.phases.length }
}

export interface Progress {
  done: number
  total: number
}

/** The counted work of the running phase. Uncounted work renders as an
 *  indeterminate bar rather than a fake percentage. */
export function taskProgress(task: Task): Progress | null {
  const phase = activePhase(task)
  return phase && phase.total > 0 ? { done: phase.done, total: phase.total } : null
}

/** The unit a task counts in, so the line reads like a sentence. */
export function taskUnit(task: Task, count: number): string {
  const unit = task.kind === 'homework' ? 'question' : 'page'
  return count === 1 ? unit : `${unit}s`
}

/** "Reading Calculus, 8th ed." — what is happening, in plain words. */
export function taskHeadline(task: Task): string {
  const phase = activePhase(task)
  if (phase) return `${phaseVerb(phase)} ${task.title}`
  switch (task.status) {
    case 'queued':
      return `Waiting to prepare ${task.title}`
    case 'paused':
      return task.title
    case 'failed':
      return task.title
    default:
      return task.title
  }
}

/** Phase names are written as nouns on the plan ("Read the pages") and as
 *  verbs in the headline ("Reading"). */
function phaseVerb(phase: Phase): string {
  switch (phase.key) {
    case 'examine':
      return 'Examining'
    case 'read':
      return 'Reading'
    case 'index':
      return 'Indexing'
    case 'search':
      return 'Building search for'
    case 'extract':
      return 'Reading'
    case 'walkthroughs':
      return 'Writing walkthroughs for'
    default:
      return 'Working on'
  }
}

/** The one line a resting task shows: why it stopped, in the student's
 *  terms. A paused task explains itself by where it got to. */
export function taskReason(task: Task): string | null {
  switch (task.status) {
    case 'queued':
      return 'Waiting'
    case 'paused': {
      const phase = focusPhase(task)
      if (phase && phase.total > 0 && phase.done > 0) {
        return `You stopped this at ${phase.done} of ${phase.total} ${taskUnit(task, phase.total)}.`
      }
      return 'You stopped this.'
    }
    case 'failed':
      return task.error
    default:
      return null
  }
}

/** The heading a not-ready book's card leads with. */
export function taskStateLabel(task: Task): string {
  switch (task.status) {
    case 'queued':
      return 'Waiting'
    case 'running':
      return 'Preparing'
    case 'paused':
      return 'Paused'
    case 'failed':
      return task.failKind === 'permanent' ? 'Can’t be prepared' : 'Couldn’t prepare'
    case 'done':
      return 'Done'
  }
}

/** The label on the door out of a resting state. A permanent failure gets
 *  no Try again: it would fail identically, so offering one is a lie. */
export function taskActionLabel(task: Task): string | null {
  if (!task.retryable) return null
  switch (task.status) {
    case 'paused':
      return 'Resume'
    case 'done':
      // The task finished but its book is no longer complete — data went
      // missing after the fact, and this rebuilds only what is absent.
      return 'Rebuild what’s missing'
    default:
      return 'Try again'
  }
}

export function formatEta(seconds: number): string {
  if (seconds < 60) return `about ${Math.max(Math.round(seconds), 1)}s left`
  const minutes = Math.ceil(seconds / 60)
  if (minutes < 60) return `about ${minutes} min left`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest > 0 ? `about ${hours}h ${rest}m left` : `about ${hours}h left`
}

export function taskEtaLine(task: Task): string | null {
  const phase = activePhase(task)
  return phase && phase.etaSeconds !== null && phase.etaSeconds > 0
    ? formatEta(phase.etaSeconds)
    : null
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  return rest > 0 ? `${minutes}m ${rest}s` : `${minutes}m`
}

export function taskDurationLine(task: Task): string | null {
  const start = Date.parse(task.startedAt ?? '')
  const end = Date.parse(task.finishedAt ?? '')
  if (Number.isNaN(start) || Number.isNaN(end)) return null
  const seconds = Math.max(Math.round((end - start) / 1000), 0)
  return seconds > 0 ? formatDuration(seconds) : null
}

/** "as of 2 min ago" — the stamp on numbers the UI can no longer vouch for. */
export function staleStamp(lastBeat: number | null, now: number): string | null {
  if (lastBeat === null) return null
  const seconds = Math.max(Math.round((now - lastBeat) / 1000), 0)
  if (seconds < 60) return 'as of a moment ago'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `as of ${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return `as of ${hours}h ago`
}

// — books ------------------------------------------------------------------------------

/** Why a book is not ready, in one sentence, when no task explains it. This
 *  is the honest fallback for a book whose data went missing. */
export function bookMissingLine(book: Book): string | null {
  if (book.ready) return null
  switch (book.readiness.missing) {
    case 'examine':
      return 'This book has no pages yet.'
    case 'read':
      if (book.readiness.pagesFailed > 0) {
        const n = book.readiness.pagesFailed
        return `${n} ${n === 1 ? 'page' : 'pages'} couldn’t be read.`
      }
      return 'The pages haven’t all been read yet.'
    case 'index':
      return 'The chapters haven’t been worked out yet.'
    case 'search':
      return 'Search isn’t built yet.'
    default:
      return null
  }
}
