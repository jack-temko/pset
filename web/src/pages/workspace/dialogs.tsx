import { useEffect, useLayoutEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { CoverPicker } from '@/components/book-cover'
import { Button, IconButton } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { Dialog } from '@/components/dialog'
import { AutoTextarea, Field, Input } from '@/components/input'
import type { CoverHue } from '@/lib/covers'

/**
 * The workspace's dialogs. Making a homework set and filling it are
 * deliberately separate steps (pretending otherwise made one dialog
 * that did both badly) and the book has its own.
 *
 * Spec: design/workspace.md.
 */

/** One row of the add-questions stack, before it becomes a question. */
export type QuestionDraft = { text: string; inBook: boolean }

/**
 * In-place confirm for a destructive act inside a dialog. Dialogs never
 * nest, so "are you sure" doesn't open a second one: the dialog itself
 * turns into the question. The body says what goes; the footer is Cancel
 * (back to editing) and the act, named.
 */
function ConfirmBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-3 text-sm">{children}</div>
}

function ConfirmFooter({
  action,
  onCancel,
  onConfirm,
}: {
  action: string
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <>
      <Button variant="ghost" onClick={onCancel}>
        Cancel
      </Button>
      <Button variant="destructive" onClick={onConfirm}>
        {action}
      </Button>
    </>
  )
}

/**
 * New homework, and the same dialog again for editing one. A title and,
 * if you like, a due date; nothing about questions: the set is a
 * container, and it exists the moment you name it. The title is required
 * because an unnamed set would still appear in the list and on Home.
 *
 * Editing adds Delete at the footer's left, confirmed in place.
 */
export function HomeworkDialog({
  open,
  editing,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  /** Present when editing: the set's current values and size. */
  editing?: { title: string; due: string; questions: number }
  onClose: () => void
  onSave: (title: string, due: string) => void
  onDelete?: () => void
}) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [confirming, setConfirming] = useState(false)

  // A dialog is a fresh start every time it opens, never a resumed draft.
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDue(editing?.due ?? '')
      setConfirming(false)
    }
    // Seeded on open only: `editing` is a fresh object every render, and
    // re-seeding on it would wipe what you're typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const unchanged = !!editing && title === editing.title && due === editing.due

  const submit = () => {
    if (!title.trim() || unchanged) return
    onSave(title.trim(), due)
    onClose()
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? 'Edit homework' : 'New homework'}
      footer={
        confirming && editing ? (
          <ConfirmFooter
            action="Delete"
            onCancel={() => setConfirming(false)}
            onConfirm={() => {
              onDelete?.()
              onClose()
            }}
          />
        ) : (
          <>
            {editing && (
              <Button
                variant="ghost"
                className="mr-auto text-destructive"
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!title.trim() || unchanged}>
              {editing ? 'Save' : 'Create'}
            </Button>
          </>
        )
      }
    >
      {confirming && editing ? (
        <ConfirmBody>
          <p>
            Delete <span className="font-medium">{editing.title}</span> and its{' '}
            {editing.questions} questions, with everything you revealed and completed?
          </p>
          <p className="text-muted-foreground">There's no undo.</p>
        </ConfirmBody>
      ) : (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Field
          label="Title"
          hint={editing ? undefined : title ? undefined : 'Give it a name, anything like Problem set 4.'}
        >
          <Input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Problem set 4"
          />
        </Field>
        <Field label="Due date" hint="Optional. Leave it blank and it won't appear on Home.">
          <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
        </Field>
      </form>
      )}
    </Dialog>
  )
}

/**
 * The book: its name, and the one number every page number in the app
 * hangs on. Title and author start as the PDF's metadata; the offset as
 * whatever the engine read at import. Both are yours to correct.
 *
 * Remove sits at the footer's left, confirmed in place, and says what
 * goes with the book.
 */
export function BookDialog({
  open,
  book,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean
  book: { title: string; author: string; offset: number; cover: CoverHue; pages: number; imported: string; homework: number }
  onClose: () => void
  onSave: (next: { title: string; author: string; offset: number; cover: CoverHue }) => void
  onRemove: () => void
}) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [firstPage, setFirstPage] = useState('')
  const [cover, setCover] = useState<CoverHue>(book.cover)
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(book.title)
      setAuthor(book.author)
      // Asked the way a person checks it: find printed page 1 in the scan
      // and read off its PDF page. The offset is that minus one.
      setFirstPage(String(book.offset + 1))
      setCover(book.cover)
      setConfirming(false)
    }
    // Seeded on open only, for the same reason as HomeworkDialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const pdfOfFirst = Number(firstPage.match(/\d+/)?.[0] ?? 0)
  const valid = title.trim() && pdfOfFirst >= 1 && pdfOfFirst <= book.pages
  const unchanged =
    title === book.title && author === book.author && pdfOfFirst === book.offset + 1 && cover === book.cover

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit book"
      footer={
        confirming ? (
          <ConfirmFooter
            action="Remove book"
            onCancel={() => setConfirming(false)}
            onConfirm={onRemove}
          />
        ) : (
          <>
            <Button
              variant="ghost"
              className="mr-auto text-destructive"
              onClick={() => setConfirming(true)}
            >
              Remove book
            </Button>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button
              disabled={!valid || unchanged}
              onClick={() => {
                onSave({ title: title.trim(), author: author.trim(), offset: pdfOfFirst - 1, cover })
                onClose()
              }}
            >
              Save
            </Button>
          </>
        )
      }
    >
      {confirming ? (
        <ConfirmBody>
          <p>
            Remove <span className="font-medium">{book.title}</span> from your library, with its{' '}
            {book.homework} homework sets and its conversation?
          </p>
          <p className="text-muted-foreground">
            There's no undo. You can import the PDF again, but it starts fresh.
          </p>
        </ConfirmBody>
      ) : (
      <div className="space-y-4">
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Author">
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <Field
          label="Printed page 1 is PDF page"
          hint="Every page number in the app counts from this. Found at import. Fix it here if the numbers are off."
        >
          <Input
            inputMode="numeric"
            value={firstPage}
            onChange={(e) => setFirstPage(e.target.value)}
            className="w-24 font-mono"
          />
        </Field>
        <Field label="Cover">
          <CoverPicker value={cover} onChange={setCover} />
        </Field>
        <p className="font-mono text-xs text-muted-foreground">
          {book.pages} PDF pages · imported {book.imported}
        </p>
      </div>
      )}
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
 * its own "In this book" checkbox, because a set is often mixed (a
 * problem lifted from the textbook and one the professor wrote) and both
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
            {filled.length === 0 ? 'Add questions' : filled.length === 1 ? 'Add 1 question' : `Add ${filled.length} questions`}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          One question per row. Untick In this book if a question isn't from this scan, and the guide
          is written from your text alone.
        </p>
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

        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => addRow()}>
          <Plus />
          Add row
        </Button>
      </div>
    </Dialog>
  )
}
