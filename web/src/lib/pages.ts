import { createContext, useContext } from 'react'

/**
 * Page numbers. The app speaks the number printed on the page (the one
 * a syllabus, the index and the professor use) everywhere: page chips,
 * the rail, the scan pill, anything you type. The PDF index is plumbing,
 * surfaced only in a tooltip.
 *
 * One number per book connects the two: the offset, where
 * PDF page = printed page + offset. The engine works it out at import and
 * the book dialog can correct it. PDF pages before printed page 1 are
 * front matter and get roman numerals, as the book does.
 */

export const PageOffset = createContext(0)

export const usePageOffset = () => useContext(PageOffset)

export function pdfOf(printed: number, offset: number): number {
  return printed + offset
}

export function printedLabel(pdf: number, offset: number): string {
  return pdf > offset ? String(pdf - offset) : roman(pdf)
}

function roman(n: number): string {
  const table: [number, string][] = [
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i'],
  ]
  let out = ''
  for (const [v, s] of table) while (n >= v) (out += s), (n -= v)
  return out
}
