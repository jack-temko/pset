import type { Assignment, AssignmentImport, AssignmentRow } from '@/api/homework'

/**
 * The review of an imported assignment, as the student edits it: which
 * due dates become sets, which lines become questions, and what each
 * says. Kept apart from the dialog so the choices it starts from can be
 * tested.
 */

export type ReviewRow = AssignmentRow & {
  id: number
  /** Becomes a question. */
  keep: boolean
  /** Found in the book, or written from its text alone. */
  inBook: boolean
  /** Changed since it was read, so the labels read out may be stale. */
  edited: boolean
}

export type ReviewGroup = {
  id: number
  title: string
  due: string
  /** A set from this source already has this due date. */
  imported: boolean
  /** Due before today. */
  past: boolean
  /** Becomes a set. */
  keep: boolean
  rows: ReviewRow[]
}

let nextId = 0

/** Today in the student's own time zone, as the server writes dates. */
export function localToday(now = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/**
 * The review as it opens. A due date is ticked unless it's already been
 * added or has passed: a semester table checked in October shouldn't
 * bring back September. A sheet with one date is ticked even late, since
 * it was brought in for that date. Every line is ticked except the ones that aren't
 * homework (reading, a quiz done in class), which show so the student
 * can take one anyway.
 */
export function reviewOf(a: Assignment, today: string): ReviewGroup[] {
  return a.groups.map((g) => {
    const past = g.due !== '' && g.due < today
    return {
      id: nextId++,
      title: g.title,
      due: g.due,
      imported: !!g.imported,
      past,
      keep: !g.imported && (!past || a.groups.length === 1),
      rows: g.rows.map((r) => ({
        ...r,
        id: nextId++,
        keep: r.kind !== 'other',
        inBook: r.kind === 'book',
        edited: false,
      })),
    }
  })
}

/** The lines of a group that will become questions. */
export const keptRows = (g: ReviewGroup) => g.rows.filter((r) => r.keep && r.text.trim())

/** The groups that will become sets: ticked, named, and with a line left. */
export const keptGroups = (groups: ReviewGroup[]) =>
  groups.filter((g) => g.keep && !g.imported && g.title.trim() && keptRows(g).length > 0)

/** What the server makes the sets from. */
export function importOf(source: string, groups: ReviewGroup[]): AssignmentImport {
  return {
    source,
    groups: keptGroups(groups).map((g) => ({
      title: g.title.trim(),
      due: g.due,
      rows: keptRows(g).map((r) => ({ text: r.text.trim(), inBook: r.inBook })),
    })),
  }
}

/** How many questions a group's kept lines become, as far as the review
 *  knows: a line read as several problems is several, and one changed
 *  since it was read counts once. */
export const questionCount = (g: ReviewGroup) =>
  keptRows(g).reduce((n, r) => n + (r.inBook && !r.edited && r.labels.length > 1 ? r.labels.length : 1), 0)

/** A date gone by or already added: folded away until asked for, since
 *  a semester's table checked in October is mostly September. */
export const isEarlier = (g: ReviewGroup) => g.past || g.imported

/** The groups the review shows: the ones to come, and any earlier one
 *  ticked (hiding a ticked one would hide a set about to be made). */
export const shownGroups = (groups: ReviewGroup[], showEarlier: boolean) =>
  groups.filter((g) => showEarlier || !isEarlier(g) || (g.keep && !g.imported))

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
