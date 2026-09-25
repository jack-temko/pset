import type { Run } from '@/api/gen/pagenum'
import type { Form, Style, Where } from '@/api/gen/probnum'
import { PageMap } from '@/lib/pages'

/* What the Book dialog's two numbering fields edit, and how it turns back
   into what the server stores. Apart from the fields, so they stay
   components only. */

/** One row of the field, as typed: a PDF page and the number printed on
 *  it. Strings, so a half-typed row stays as you left it. */
export interface PageAnchor {
  pdf: string
  printed: string
}

/** A book's runs as the rows a person checks: for each run, a page in it
 *  and what it says. The first run is asked about printed page 1, the way
 *  you find it in a scan; each later one at the page where it starts. */
export function anchorsOf(runs: Run[]): PageAnchor[] {
  return new PageMap(runs).runs.map((r, i) =>
    i === 0 ? { pdf: String(r.offset + 1), printed: '1' } : { pdf: String(r.from), printed: String(r.from - r.offset) },
  )
}

const num = (s: string) => Number(s.match(/^\s*(\d+)\s*$/)?.[1] ?? NaN)

/** The rows back as runs, or why they can't be: every row whole, inside
 *  the book, and no two on one PDF page. */
export function runsOf(anchors: PageAnchor[], pageCount: number): { runs: Run[] } | { error: string } {
  const rows = anchors.map((a) => ({ pdf: num(a.pdf), printed: num(a.printed) }))
  if (rows.length === 0) return { error: 'Say where printed page 1 is.' }
  if (rows.some((r) => !(r.pdf >= 1) || !(r.printed >= 1))) return { error: 'Give every row both numbers.' }
  if (rows.some((r) => r.pdf > pageCount)) return { error: `The PDF has ${pageCount} pages.` }
  if (new Set(rows.map((r) => r.pdf)).size !== rows.length) return { error: 'Two rows name the same PDF page.' }
  const [first, ...rest] = rows
  const runs = [{ from: 1, offset: first.pdf - first.printed }]
  for (const r of [...rest].sort((a, b) => a.pdf - b.pdf)) runs.push({ from: r.pdf, offset: r.pdf - r.printed })
  return { runs: new PageMap(runs).runs }
}

/** The style as the field edits it: a form and where the problems sit,
 *  or nothing chosen yet. */
export interface StyleChoice {
  form: Form | ''
  where: Where
}

export const choiceOf = (s: Style | undefined): StyleChoice => ({
  form: s?.form ?? '',
  where: s?.where ?? 'section',
})

/** Where problems sit follows from the form, but for one that prints the
 *  section: those books keep them either way. */
const whereOf = (form: Form, where: Where): Where =>
  form === 'local' ? 'section' : form === 'chapter' ? 'chapter' : where

export const settled = (c: StyleChoice): { form: Form; where: Where } | null =>
  c.form ? { form: c.form, where: whereOf(c.form, c.where) } : null

