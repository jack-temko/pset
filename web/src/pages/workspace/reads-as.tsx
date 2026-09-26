import { useRef } from 'react'

import { useLineReadings, type LineReading } from '@/api/homework'
import { useDebounced } from '@/lib/debounce'
import { useBookHere } from './book-here'

/**
 * What a typed line becomes, said under it while it's typed: the
 * problems it names in the book's labels, and the professor's notes it
 * carries; or that PSet doesn't read it as a reference. Read by the
 * server's own parser, the one Add uses, so what it says is what's
 * added. Shared by Add questions and the import review. Spec:
 * design/workspace.md, "A row is read in the book's numbering".
 */
export function ReadsAs({ reading, present = [] }: { reading: LineReading; present?: string[] }) {
  const example = useBookHere().problems?.example?.label
  if (reading.unread)
    return (
      <span className="text-xs text-warning">
        PSet doesn't read this as a reference itself. Once it's added, the model rewrites it in the book's
        form{example ? <> (&ldquo;{example}&rdquo;)</> : ''} if it names problems by number; if not, it's
        looked for by its words.
      </span>
    )
  // A note that's most of the line (the professor's changes to a book
  // problem, a paragraph after it) is already there to read above.
  const notes = reading.notes.join('; ')
  const adds = reading.labels.filter((l) => !present.includes(l))
  return (
    <span className="min-w-0 text-xs text-muted-foreground">
      {present.length > 0 ? (
        <>
          adds <span className="font-mono">{adds.join(', ')}</span> (
          <span className="font-mono">{present.join(', ')}</span> {present.length === 1 ? 'is' : 'are'} in the
          set)
        </>
      ) : (
        <>
          {reading.labels.length > 1 ? `${reading.labels.length} questions: ` : ''}
          <span className="font-mono">{reading.labels.join(', ')}</span>
        </>
      )}
      {notes && (
        <>
          {' '}
          ·{' '}
          {notes.length > 60
            ? "The rest of the line is your professor's instructions"
            : `From your professor: ${notes}`}
        </>
      )}
    </span>
  )
}

type Line = { id: number | string; text: string; inBook: boolean }

/**
 * Each line's reading while it's typed, by line id: asked once typing
 * pauses, and kept until the next one lands, so the caption changes
 * rather than blinking out on every key. Undefined for a line not yet
 * read, an empty one, or one not from the book.
 */
export function useLiveReadings(lines: Line[]): (id: Line['id']) => LineReading | undefined {
  const { bookId } = useBookHere()
  // Debounced as one string: a fresh array every render would never
  // settle.
  const texts = JSON.stringify([
    ...new Set(lines.filter((l) => l.inBook && l.text.trim()).map((l) => l.text.trim())),
  ])
  const settled = useDebounced(texts, 300)
  const { data } = useLineReadings(bookId, JSON.parse(settled) as string[])
  const last = useRef(new Map<Line['id'], LineReading>())
  for (const l of lines) {
    const r = data?.get(l.text.trim())
    if (r) last.current.set(l.id, r)
  }
  return (id) => {
    const line = lines.find((l) => l.id === id)
    if (!line || !line.inBook || !line.text.trim()) return undefined
    return last.current.get(id)
  }
}
