import { useState } from 'react'
import { Plus } from 'lucide-react'

import { Button } from '@/components/button'
import type { Question } from '@/api/homework'
import { EditableLines } from './editable-lines'

/**
 * The professor's instructions for a problem: parts to do, what not to
 * use, numbers changed. Read from the reference as it was added ("4.25
 * (no PSpice)"), or written here; the guide follows them over the book,
 * so changing them writes it again. Spec: design/workspace.md, "The
 * professor's notes".
 */
export function ProfessorNotes({ q, onSave }: { q: Question; onSave: (lines: string[]) => void }) {
  const [adding, setAdding] = useState(false)
  const notes = q.notes ?? []
  // A guide on its way or written is written again; one not started just
  // reads them when it does.
  const rewrites = q.state === 'writing' || q.state === 'ready'

  if (notes.length === 0 && !adding) {
    return (
      <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
        <Plus />
        Add your professor's instructions
      </Button>
    )
  }
  return (
    <EditableLines
      key={adding ? 'adding' : 'notes'}
      title="From your professor"
      lines={notes}
      editLabel="Edit"
      editHint="One instruction a line: the parts to do, what not to use, numbers changed. The guide follows these over the book."
      saveLabel={rewrites ? 'Save and rewrite the guide' : 'Save'}
      editing={adding}
      onCancel={() => setAdding(false)}
      onSave={(lines) => {
        setAdding(false)
        onSave(lines)
      }}
    />
  )
}
