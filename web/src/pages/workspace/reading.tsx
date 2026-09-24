import { useState } from 'react'
import { Pencil } from 'lucide-react'

import { Box, BoxBody, BoxHeader } from '@/components/box'
import { Button } from '@/components/button'
import { Door } from '@/components/door'
import { AutoTextarea } from '@/components/input'
import { Label } from '@/components/label'
import { Prose } from '@/components/segments'
import type { Question } from '@/api/homework'

/** How many lines a closed reading shows: the nodes, usually, with the
 *  parts behind the door. */
const closedLines = 4

/**
 * How a question's figure reads, one fact a line: the words its guide is
 * written from. A misread figure is the likeliest reason a guide is
 * wrong, so the reading is out in the open, and the student can correct
 * it: saving writes the guide again from their lines. A question whose
 * guide came before readings, or whose reading failed, can have its
 * figure read. Spec: design/workspace.md, "The figure, as read".
 */
export function FigureReading({
  q,
  onCorrect,
  onReread,
}: {
  q: Question
  onCorrect: (lines: string[]) => void
  onReread: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [error, setError] = useState('')
  const lines = q.reading ?? []
  // Saving rewrites a guide that's there or on its way; a guide that
  // hasn't started just waits for the new lines.
  const rewrites = q.state !== 'located'

  if (lines.length === 0) {
    // Only a guide already written without one offers a reading: while a
    // question is on its way, its reading is still to come.
    if (q.state !== 'ready') return null
    return (
      <Box>
        <BoxHeader>The figure, as read</BoxHeader>
        <BoxBody className="space-y-3">
          <p className="text-sm text-muted-foreground">
            This guide was written without the figure read out first. Reading it takes a minute or two, then
            the guide is written again from what it says, and you can check every line.
          </p>
          <Button variant="outline" size="sm" onClick={onReread}>
            Read the figure
          </Button>
        </BoxBody>
      </Box>
    )
  }

  if (draft !== null) {
    const save = () => {
      const next = draft
        .split('\n')
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean)
      if (next.length === 0) {
        setError('Write at least one line.')
        return
      }
      onCorrect(next)
      setDraft(null)
    }
    return (
      <Box>
        <BoxHeader>The figure, as read</BoxHeader>
        <BoxBody className="space-y-3">
          <p className="text-xs text-muted-foreground">
            One fact a line. The guide is written from these lines, so fixing one fixes the guide.
          </p>
          <AutoTextarea
            aria-label="The figure, as read"
            value={draft}
            className="py-2 text-sm"
            onChange={(e) => {
              setDraft(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setDraft(null)
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            {/* Throwing the lines away for a fresh look sits apart from
                the pair that saves or leaves. */}
            <Button variant="ghost" size="sm" onClick={() => {
                setDraft(null)
                onReread()
              }}>
              Read it again
            </Button>
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              {rewrites ? 'Save and rewrite the guide' : 'Save'}
            </Button>
          </div>
        </BoxBody>
      </Box>
    )
  }

  const shown = open ? lines : lines.slice(0, closedLines)
  return (
    <Box>
      <BoxHeader>
        <span className="flex items-center gap-2">
          The figure, as read
          {q.readingEdited && <Label>Corrected</Label>}
        </span>
        <Button variant="ghost" size="sm" onClick={() => setDraft(lines.join('\n'))}>
          <Pencil />
          Correct
        </Button>
      </BoxHeader>
      <BoxBody className="text-sm">
        <ul className="list-disc space-y-1 pl-5">
          {shown.map((l, i) => (
            <li key={i}>
              <Prose text={l} inline />
            </li>
          ))}
        </ul>
      </BoxBody>
      {lines.length > closedLines && (
        <Door open={open} total={lines.length} onToggle={() => setOpen(!open)} className="border-t border-border-muted" />
      )}
    </Box>
  )
}
