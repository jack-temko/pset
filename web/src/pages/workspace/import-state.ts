import type {
  Assignment,
  AssignmentGroup,
  AssignmentImport,
  AssignmentRow,
  ImportGroup,
  NotesChange,
  SetQuestion,
} from '@/api/homework'

/**
 * The review of an assignment read, as the student edits it: which due
 * dates become sets or update the sets they match, which lines become
 * questions, which changed instructions are taken, and which questions a
 * document no longer lists are removed. Kept apart from the dialog so the
 * choices it starts from can be tested.
 */

export type ReviewRow = AssignmentRow & {
  id: number
  /** Becomes a question (in an update: one the set doesn't have yet). */
  keep: boolean
  /** Found in the book, or written from its text alone. */
  inBook: boolean
  /** Changed since it was read, so the labels read out may be stale. */
  edited: boolean
  /** Each changed instruction, and whether to take it. */
  changes: (NotesChange & { apply: boolean })[]
}

export type ReviewGroup = {
  id: number
  title: string
  due: string
  /** The set this date updates, instead of making one. */
  setId: string
  /** A set was made from this very document for this date before. */
  imported: boolean
  /** Due before today. */
  past: boolean
  /** Becomes a set, or applies its changes to the set it updates. */
  keep: boolean
  rows: ReviewRow[]
  /** What the set has that the document doesn't list, and whether to
   *  take it out. */
  gone: (SetQuestion & { remove: boolean })[]
}

let nextId = 0

/** Today in the student's own time zone, as the server writes dates. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** A line the set it updates doesn't have yet (or has only in part). */
const isNew = (r: AssignmentRow) => r.kind !== 'other' && !r.added

/** Whether a date read against a set has anything to change in it. */
export const hasChanges = (g: AssignmentGroup) =>
  g.rows.some((r) => isNew(r) || r.changed.some((c) => c.now.length > 0)) || g.gone.length > 0

/**
 * The review as it opens.
 *
 * A new date is ticked unless it has passed: a semester's table checked
 * in October shouldn't bring back September. A sheet with one date is
 * ticked even late, since it was brought in for that date.
 *
 * A date that updates a set is ticked when there's something new in it.
 * Its new lines and its changed instructions are ticked; what the set no
 * longer has listed is offered, never ticked: removing a question is the
 * student's call. Read to update one set, only the first date with
 * changes starts ticked, since two dates merged into one set is rarely
 * meant.
 *
 * Lines that aren't homework (reading, a quiz done in class) show, never
 * ticked, so the student can take one anyway.
 */
export function reviewOf(a: Assignment, today: string): ReviewGroup[] {
  let updateTaken = false
  return a.groups.map((g) => {
    const past = g.due !== '' && g.due < today
    const setId = g.setId ?? ''
    let keep: boolean
    if (!setId) keep = !past || a.groups.length === 1
    else if (g.imported) keep = hasChanges(g)
    else {
      keep = hasChanges(g) && !updateTaken
      updateTaken ||= keep
    }
    return {
      id: nextId++,
      title: g.title,
      due: g.due,
      setId,
      imported: !!g.imported,
      past,
      keep,
      gone: g.gone.map((q) => ({ ...q, remove: false })),
      rows: g.rows.map((r) => ({
        ...r,
        id: nextId++,
        keep: setId ? isNew(r) : r.kind !== 'other',
        inBook: r.kind === 'book',
        edited: false,
        changes: r.changed.map((c) => ({ ...c, apply: c.now.length > 0 })),
      })),
    }
  })
}

/** The lines of a group that will become questions. */
export const keptRows = (g: ReviewGroup) => g.rows.filter((r) => r.keep && r.text.trim())

const appliedChanges = (g: ReviewGroup) => g.rows.flatMap((r) => r.changes.filter((c) => c.apply))
const removals = (g: ReviewGroup) => g.gone.filter((q) => q.remove)

/** Whether a kept group does anything: a new set needs a title and a line;
 *  an update, anything to add, change or remove. */
const acts = (g: ReviewGroup) =>
  g.setId
    ? keptRows(g).length + appliedChanges(g).length + removals(g).length > 0
    : g.title.trim() !== '' && keptRows(g).length > 0

/** The groups that will make or update a set. */
export const keptGroups = (groups: ReviewGroup[]) => groups.filter((g) => g.keep && acts(g))

/** What the server makes and updates the sets from. */
export function importOf(readId: string, source: string, groups: ReviewGroup[]): AssignmentImport {
  return {
    readId,
    source,
    groups: keptGroups(groups).map((g): ImportGroup => {
      const rows = keptRows(g).map((r) => ({ text: r.text.trim(), inBook: r.inBook }))
      if (!g.setId) return { title: g.title.trim(), due: g.due, rows }
      return {
        title: g.title.trim(),
        due: g.due,
        setId: g.setId,
        rows,
        notes: appliedChanges(g).map((c) => ({ questionId: c.questionId, notes: c.now })),
        remove: removals(g).map((q) => q.questionId),
      }
    }),
  }
}

/** How many questions a group's kept lines add, as far as the review
 *  knows: a line read as several problems is several (less the ones the
 *  set it updates has), and one changed since it was read counts once. */
export const questionCount = (g: ReviewGroup) =>
  keptRows(g).reduce(
    (n, r) => n + (r.inBook && !r.edited && r.labels.length > 1 ? r.labels.length - r.present.length : 1),
    0,
  )

/** A date gone by, or one already added with nothing new: folded away
 *  until asked for, since a semester's table checked in October is
 *  mostly September. */
export const isEarlier = (g: ReviewGroup) => (g.setId ? g.imported && !pending(g) : g.past)

/** Whether a date that updates a set has anything for it, whatever's
 *  ticked: new lines, changed instructions, or questions no longer
 *  listed. One that doesn't is already in, and there's nothing to do. */
export const pending = (g: ReviewGroup) =>
  g.gone.length > 0 || g.rows.some((r) => isNew(r) || r.changes.some((c) => c.now.length > 0))

/** The groups the review shows: the ones to come, and any earlier one
 *  ticked (hiding a ticked one would hide a set about to be made). */
export const shownGroups = (groups: ReviewGroup[], showEarlier: boolean) =>
  groups.filter((g) => showEarlier || !isEarlier(g) || g.keep)

/** The primary action, saying what it will do. */
export function actionLabel(groups: ReviewGroup[]): string {
  const kept = keptGroups(groups)
  const made = kept.filter((g) => !g.setId).length
  const updated = kept.length - made
  const sets = (n: number) => (n === 1 ? '1 set' : `${n} sets`)
  if (made && updated) return `Add ${sets(made)}, update ${updated}`
  if (updated) return `Update ${sets(updated)}`
  return made ? `Add ${sets(made)}` : 'Add sets'
}

/** Where it was read from, as a person reads it: a web address without
 *  its escapes, the text pasted, or the file's name. */
export function sourceName(source: string): string {
  if (source === 'pasted') return 'the text you pasted'
  try {
    return decodeURI(source)
  } catch {
    return source
  }
}
