import { useState, type ReactNode } from 'react'
import { Pencil } from 'lucide-react'

import { Box, BoxBody, BoxHeader } from '@/components/box'
import { Button } from '@/components/button'
import { Door } from '@/components/door'
import { AutoTextarea } from '@/components/input'
import { Label } from '@/components/label'
import { Prose } from '@/components/segments'

/** A value keeps its unit on its line: "9 Ω" never breaks after the 9. */
const keepUnits = (line: string) => line.replace(/(\d) (?=[kmMµ]?(Ω|A|V|W|F|H|s)\b|[kmMµ]?Ω)/g, '$1 ')

/**
 * A question's lines that the guide is written from and the student can
 * correct: how its figure reads, or the professor's notes. A Box of
 * lines, the first few shown and the rest behind a Door; the edit button
 * in its header turns it into a text box, a line each, where saving
 * writes the guide again from the new lines. Spec: design/workspace.md,
 * "The figure, as read" and "The professor's notes".
 */
export function EditableLines({
  title,
  lines,
  closed = 4,
  edited,
  editLabel,
  editHint,
  saveLabel,
  extra,
  onSave,
  editing: startEditing = false,
  onCancel,
}: {
  title: string
  lines: string[]
  /** How many lines show before the Door. */
  closed?: number
  /** A Label in the header, saying the student changed them. */
  edited?: string
  /** The header button that starts editing ("Correct", "Edit"). */
  editLabel: string
  /** A line above the text box, saying what saving does. */
  editHint: string
  saveLabel: string
  /** Another way out while editing, apart from Cancel and Save. */
  extra?: (stopEditing: () => void) => ReactNode
  onSave: (lines: string[]) => void
  /** Opens straight into editing, as adding the first line does. */
  editing?: boolean
  onCancel?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<string | null>(startEditing ? '' : null)
  const [error, setError] = useState('')

  const stop = () => {
    setDraft(null)
    setError('')
    onCancel?.()
  }

  if (draft !== null) {
    const save = () => {
      const next = draft
        .split('\n')
        .map((l) => l.replace(/^\s*[-*]\s+/, '').trim())
        .filter(Boolean)
      if (next.length === 0 && lines.length === 0) {
        setError('Write at least one line.')
        return
      }
      onSave(next)
      setDraft(null)
    }
    return (
      <Box>
        <BoxHeader>{title}</BoxHeader>
        <BoxBody className="space-y-3">
          <p className="text-xs text-muted-foreground">{editHint}</p>
          <AutoTextarea
            aria-label={title}
            autoFocus
            value={draft}
            className="py-2 text-sm"
            onChange={(e) => {
              setDraft(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') stop()
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save()
            }}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex items-center gap-2">
            {extra?.(stop)}
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={stop}>
              Cancel
            </Button>
            <Button size="sm" onClick={save}>
              {saveLabel}
            </Button>
          </div>
        </BoxBody>
      </Box>
    )
  }

  const shown = open ? lines : lines.slice(0, closed)
  return (
    <Box>
      <BoxHeader>
        <span className="flex items-center gap-2">
          {title}
          {edited && <Label>{edited}</Label>}
        </span>
        {/* Each line keeps its dash in the box, so a line that wraps still
            reads as one. */}
        <Button variant="ghost" size="sm" onClick={() => setDraft(lines.map((l) => `- ${l}`).join('\n'))}>
          <Pencil />
          {editLabel}
        </Button>
      </BoxHeader>
      <BoxBody className="text-sm">
        <ul className="list-disc space-y-1 pl-5">
          {shown.map((l, i) => (
            <li key={i}>
              <Prose text={keepUnits(l)} inline />
            </li>
          ))}
        </ul>
      </BoxBody>
      {lines.length > closed && (
        <Door open={open} total={lines.length} onToggle={() => setOpen(!open)} className="border-t border-border-muted" />
      )}
    </Box>
  )
}
