import { Plus, X } from 'lucide-react'

import type { Run } from '@/api/gen/pagenum'
import { Button, IconButton } from '@/components/button'
import { Input } from '@/components/input'
import { PageMap } from '@/lib/pages'

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

/** What a jump in the numbering means, in a sentence. */
function gapSentence(g: { at: number; missing: number[]; extra: number }): string {
  if (g.missing.length === 1) return `Printed page ${g.missing[0]} is missing from the scan.`
  if (g.missing.length > 1)
    return `Printed pages ${g.missing[0]}–${g.missing[g.missing.length - 1]} are missing from the scan.`
  return g.extra === 1
    ? `The page before PDF page ${g.at} isn't numbered in the book.`
    : `The ${g.extra} pages before PDF page ${g.at} aren't numbered in the book.`
}

/**
 * How a book's printed page numbers line up with its PDF pages: a row for
 * printed page 1, and one more wherever the numbering jumps, as it does
 * where a scan lost a page. Found at import; every page number in the app
 * counts from these rows. Spec: design/workspace.md, "The book".
 */
export function PageNumbersField({
  anchors,
  pageCount,
  onChange,
}: {
  anchors: PageAnchor[]
  pageCount: number
  onChange: (next: PageAnchor[]) => void
}) {
  const parsed = runsOf(anchors, pageCount)
  const gaps = 'runs' in parsed ? new PageMap(parsed.runs).gaps() : []
  const set = (i: number, key: keyof PageAnchor, value: string) =>
    onChange(anchors.map((a, j) => (j === i ? { ...a, [key]: value } : a)))

  return (
    <fieldset className="space-y-2">
      <legend className="mb-1 text-sm font-medium">Page numbers</legend>
      {anchors.map((a, i) => (
        <div key={i} className="flex items-center gap-2 text-sm">
          {i === 0 ? (
            <>
              <span>Printed page 1 is PDF page</span>
              <Input
                aria-label="PDF page of printed page 1"
                inputMode="numeric"
                value={a.pdf}
                onChange={(e) => set(i, 'pdf', e.target.value)}
                className="w-16 font-mono"
              />
            </>
          ) : (
            <>
              <span>PDF page</span>
              <Input
                aria-label={`Where jump ${i} starts, as a PDF page`}
                inputMode="numeric"
                value={a.pdf}
                onChange={(e) => set(i, 'pdf', e.target.value)}
                className="w-16 font-mono"
              />
              <span>is printed page</span>
              <Input
                aria-label={`Printed number on that page, jump ${i}`}
                inputMode="numeric"
                value={a.printed}
                onChange={(e) => set(i, 'printed', e.target.value)}
                className="w-16 font-mono"
              />
              <IconButton
                variant="ghost"
                size="sm"
                aria-label="Remove this jump"
                onClick={() => onChange(anchors.filter((_, j) => j !== i))}
              >
                <X />
              </IconButton>
            </>
          )}
        </div>
      ))}
      {'error' in parsed ? (
        <p className="text-xs text-destructive">{parsed.error}</p>
      ) : (
        gaps.map((g) => (
          <p key={g.at} className="text-xs text-muted-foreground">
            {gapSentence(g)}
          </p>
        ))
      )}
      <Button variant="ghost" size="sm" onClick={() => onChange([...anchors, { pdf: '', printed: '' }])}>
        <Plus />
        Add a jump
      </Button>
      <p className="text-xs text-muted-foreground">
        Every page number in the app counts from these. Found at import; fix them if the numbers are off, and add
        a row where they jump.
      </p>
    </fieldset>
  )
}
