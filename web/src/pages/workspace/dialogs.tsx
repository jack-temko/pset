import { useEffect, useLayoutEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button, IconButton } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { Dialog } from '@/components/dialog'
import { AutoTextarea, Field, Input } from '@/components/input'

/**
 * The two homework dialogs. They are deliberately separate steps: making
 * a homework set is not the same act as filling it, and pretending
 * otherwise made one dialog that did both badly.
 *
 * Spec: design/workspace.md.
 */

/** One row of the add-questions stack, before it becomes a question. */
export type QuestionDraft = { text: string; inBook: boolean }

/**
 * New homework: a title and, if you like, a due date. Nothing about
 * questions — the set is a container, and it exists the moment you name
 * it. The title is required because an unnamed set would still appear in
 * the list and on Home.
 */
export function NewHomeworkDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  onCreate: (title: string, due: string) => void
}) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  // A dialog is a fresh start every time it opens, never a resumed draft.
  useEffect(() => {
    if (open) {
      setTitle('')
      setDue('')
    }
  }, [open])

  const submit = () => {
    if (!title.trim()) return
    onCreate(title.trim(), due)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New homework"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim()}>
            Create
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field label="Title">
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Problem set 4"
          />
        </Field>
        <Field label="Due date" hint="Optional — leave it blank and it won't appear on Home.">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  )
}

let nextRowId = 0
const emptyRow = (): QuestionDraft & { id: number } => ({
  id: nextRowId++,
  text: '',
  inBook: true,
})

/**
 * Add questions: a stack of rows, one question each. Every row carries
 * its own "In this book" checkbox, because a set is often mixed — a
 * problem lifted from the textbook and one the professor wrote — and both
 * need a walkthrough. An unchecked row simply skips the locate stage: it
 * gets no page chip and nothing to jump to, and is otherwise identical.
 *
 * Enter adds a row below and moves into it, so a whole set is typed
 * without the mouse. Cmd/Ctrl+Enter submits.
 */
export function AddQuestionsDialog({
  open,
  onClose,
  onAdd,
}: {
  open: boolean
  onClose: () => void
  onAdd: (drafts: QuestionDraft[]) => void
}) {
  const [rows, setRows] = useState(() => [emptyRow()])
  // The row to put the caret in once React has actually rendered it.
  // Focusing inside the state updater is a frame too early, and the next
  // keystrokes land in the row you just left.
  const [focusRow, setFocusRow] = useState<number | null>(null)

  useEffect(() => {
    if (open) setRows([emptyRow()])
  }, [open])

  useLayoutEffect(() => {
    if (focusRow === null) return
    document.querySelector<HTMLTextAreaElement>(`[data-row="${focusRow}"]`)?.focus()
    setFocusRow(null)
  }, [focusRow])

  const filled = rows.filter((r) => r.text.trim())

  const submit = () => {
    if (!filled.length) return
    onAdd(filled.map(({ text, inBook }) => ({ text: text.trim(), inBook })))
    onClose()
  }

  const addRow = (after?: number) =>
    setRows((rs) => {
      const row = emptyRow()
      const at = after === undefined ? rs.length : rs.findIndex((r) => r.id === after) + 1
      const next = [...rs]
      next.splice(at, 0, row)
      // The new row is the one you're about to type in.
      setFocusRow(row.id)
      return next
    })

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add questions"
      width="wide"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!filled.length}>
            {filled.length === 1 ? 'Add 1 question' : `Add ${filled.length} questions`}
          </Button>
        </>
      }
    >
      <div className="divide-y divide-border-muted">
        {rows.map((row) => (
          <div key={row.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex items-start gap-2">
              <AutoTextarea
                data-row={row.id}
                autoFocus={rows.length === 1}
                value={row.text}
                placeholder="A reference like 3.B.4, or paste the question"
                onChange={(e) =>
                  setRows((rs) =>
                    rs.map((r) => (r.id === row.id ? { ...r, text: e.target.value } : r)),
                  )
                }
                onKeyDown={(e) => {
                  if (e.key !== 'Enter') return
                  e.preventDefault()
                  if (e.metaKey || e.ctrlKey) submit()
                  else addRow(row.id)
                }}
              />
              {/* Always there, and disabled on the only row: the dialog is
                  never empty, and the control never has to be hunted for. */}
              <IconButton
                variant="ghost"
                aria-label="Remove this question"
                disabled={rows.length === 1}
                onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
              >
                <Trash2 />
              </IconButton>
            </div>
            <Checkbox
              checked={row.inBook}
              onChange={() =>
                setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, inBook: !r.inBook } : r)))
              }
              className="-ml-2 text-muted-foreground"
            >
              In this book
            </Checkbox>
          </div>
        ))}
      </div>

      <Button variant="ghost" size="sm" className="mt-3 -ml-2" onClick={() => addRow()}>
        <Plus />
        Add row
      </Button>
    </Dialog>
  )
}
