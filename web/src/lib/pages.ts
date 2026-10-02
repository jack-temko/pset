import { createContext, useContext } from 'react'

import type { Run } from '@/api/gen/pagenum'

/**
 * Page numbers. The app speaks the number printed on the page (the one
 * a syllabus, the index and the professor use) everywhere: page chips,
 * the rail, the scan pill, anything you type. The PDF index is plumbing,
 * surfaced only in a tooltip, and it is what every page travels as:
 * only this map turns one into the other.
 *
 * A book's printed numbers run in stretches: from a PDF page on, PDF page
 * = printed page + offset, until the next run. Most books have one run; a
 * scan that lost a page has two, one apart (internal/pagenum is the same
 * map on the server). PDF pages before printed page 1 are front matter
 * and get roman numerals, as the book does.
 */
export class PageMap {
  readonly runs: Run[]

  constructor(runs: Run[] = []) {
    const sorted = [...runs].sort((a, b) => a.from - b.from)
    const out: Run[] = []
    for (const r of sorted) {
      const last = out[out.length - 1]
      if (last && last.from === r.from) out[out.length - 1] = { ...r }
      else if (!last || last.offset !== r.offset) out.push({ ...r })
    }
    if (out.length === 0) out.push({ from: 1, offset: 0 })
    out[0] = { ...out[0], from: 1 }
    this.runs = out
  }

  static single(offset: number): PageMap {
    return new PageMap([{ from: 1, offset }])
  }

  /** The offset in force on a PDF page. */
  offset(pdf: number): number {
    let off = this.runs[0].offset
    for (const r of this.runs) {
      if (r.from > pdf) break
      off = r.offset
    }
    return off
  }

  /** The number printed on a PDF page, or null for front matter. */
  printed(pdf: number): number | null {
    const n = pdf - this.offset(pdf)
    return n >= 1 ? n : null
  }

  /** The PDF page a printed number is on, or null when the scan lost it. */
  pdf(printed: number): number | null {
    for (let i = 0; i < this.runs.length; i++) {
      const p = printed + this.runs[i].offset
      const next = this.runs[i + 1]
      if (p >= this.runs[i].from && (!next || p < next.from)) return p
    }
    return null
  }

  /** The PDF page of a printed number, or of the page beside where a lost
   *  one would be. */
  nearest(printed: number): number {
    const p = this.pdf(printed)
    if (p !== null) return p
    for (const r of this.runs) if (printed + r.offset < r.from) return Math.max(1, r.from)
    return Math.max(1, printed + this.runs[this.runs.length - 1].offset)
  }

  /** A PDF page as the book numbers it: "112", or "vii" in front matter. */
  label(pdf: number): string {
    return String(this.printed(pdf) ?? roman(pdf))
  }

  /** Where the numbering jumps: printed pages the scan lost, or pages it
   *  has that the numbering skips (unnumbered plates). */
  gaps(): Gap[] {
    const out: Gap[] = []
    for (let i = 1; i < this.runs.length; i++) {
      const prev = this.runs[i - 1]
      const cur = this.runs[i]
      const d = prev.offset - cur.offset
      const last = cur.from - 1 - prev.offset
      out.push({
        at: cur.from,
        missing: d > 0 ? Array.from({ length: d }, (_, k) => last + k + 1) : [],
        extra: d < 0 ? -d : 0,
      })
    }
    return out
  }
}

export interface Gap {
  /** The first PDF page after the jump. */
  at: number
  missing: number[]
  extra: number
}

export const Pages = createContext(new PageMap())

export const usePages = () => useContext(Pages)

function roman(n: number): string {
  const table: [number, string][] = [
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ]
  let out = ''
  for (const [v, s] of table) {
    while (n >= v) {
      out += s
      n -= v
    }
  }
  return out
}
