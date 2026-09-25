import { useEffect, useLayoutEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { CoverPicker } from '@/components/book-cover'
import { Button, IconButton } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { Dialog } from '@/components/dialog'
import { AutoTextarea, Field, Input } from '@/components/input'
import type { CoverHue } from '@/lib/covers'
import type { Run } from '@/api/gen/pagenum'
import { PageMap } from '@/lib/pages'
import { PageNumbersField } from './page-numbers'
import { ProblemStyleField } from './problem-style'
import { anchorsOf, choiceOf, runsOf, settled, type PageAnchor, type StyleChoice } from './book-numbering'
import { numberingUnsure, useBookHere } from './book-here'
import type { Form, Style, Where } from '@/api/gen/probnum'

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
 * New homework, and the same dialog again for editing one. A title and,
 * if you like, a due date; nothing about questions: the set is a
 * container, and it exists the moment you name it. The title is required
 * because an unnamed set would still appear in the list and on Home.
 *
 * It only edits: deleting a set is in the walkthrough's menu, with the
 * set's other actions.
 */
export function HomeworkDialog({
  open,
  editing,
  onClose,
  onSave,
}: {
  open: boolean
  /** Present when editing: the set's current values. */
  editing?: { title: string; due: string }
  onClose: () => void
  onSave: (title: string, due: string) => void
}) {
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')

  // A dialog is a fresh start every time it opens, never a resumed draft.
  useEffect(() => {
    if (open) {
      setTitle(editing?.title ?? '')
      setDue(editing?.due ?? '')
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
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!title.trim() || unchanged}>
            {editing ? 'Save' : 'Create'}
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
    </Dialog>
  )
}

/**
 * The book: its name, and how its printed page numbers line up with the
 * PDF, which every page number in the app hangs on. Title and author
 * start as the PDF's metadata; the numbering as the engine read it at
 * import, a row per run. Both are yours to correct.
 *
 * It only edits: removing the book is in the book's menu in the top bar.
 */
export function BookDialog({
  open,
  book,
  onClose,
  onSave,
}: {
  open: boolean
  book: { title: string; author: string; runs: Run[]; problems?: Style; cover: CoverHue; pages: number; imported: string }
  onClose: () => void
  onSave: (next: {
    title: string
    author: string
    runs: Run[]
    problems?: { form: Form; where: Where }
    cover: CoverHue
  }) => void
}) {
  const [title, setTitle] = useState('')
  const [author, setAuthor] = useState('')
  const [anchors, setAnchors] = useState<PageAnchor[]>(() => anchorsOf(book.runs))
  const [cover, setCover] = useState<CoverHue>(book.cover)
  const [style, setStyle] = useState<StyleChoice>(() => choiceOf(book.problems))
  // Saying the detected style is right, or picking one, is the student's
  // word, and saves even when it matches what was detected.
  const [styleTouched, setStyleTouched] = useState(false)

  useEffect(() => {
    if (open) {
      setTitle(book.title)
      setAuthor(book.author)
      // Asked the way a person checks it: find printed page 1 in the scan
      // and read off its PDF page, then the same where the numbers jump.
      setAnchors(anchorsOf(book.runs))
      setStyle(choiceOf(book.problems))
      setStyleTouched(false)
      setCover(book.cover)
    }
    // Seeded on open only, for the same reason as HomeworkDialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const parsed = runsOf(anchors, book.pages)
  const runs = 'runs' in parsed ? parsed.runs : null
  const valid = title.trim() && runs !== null
  const unchanged =
    title === book.title &&
    author === book.author &&
    JSON.stringify(runs) === JSON.stringify(new PageMap(book.runs).runs) &&
    !styleTouched &&
    cover === book.cover

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Edit book"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={!valid || unchanged}
            onClick={() => {
              const problems = styleTouched ? (settled(style) ?? undefined) : undefined
              if (runs) onSave({ title: title.trim(), author: author.trim(), runs, problems, cover })
              onClose()
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Title">
          <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Author">
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
        </Field>
        <PageNumbersField anchors={anchors} pageCount={book.pages} onChange={setAnchors} />
        <ProblemStyleField
          style={book.problems}
          value={style}
          confirmed={styleTouched}
          onChange={(next) => {
            setStyle(next)
            setStyleTouched(true)
          }}
          onConfirm={() => setStyleTouched(true)}
        />
        <Field label="Cover">
          <CoverPicker value={cover} onChange={setCover} />
        </Field>
        <p className="font-mono text-xs text-muted-foreground">
          {book.pages} PDF pages · imported {book.imported}
        </p>
      </div>
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
  const here = useBookHere()

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
        <NumberingCheck onLeave={onClose} />
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
                  placeholder={`A reference like ${here.problems?.example?.label ?? '3.B.4'}, or paste the question`}
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

/**
 * Asked once, where it matters: what "3.1 #7" means depends on how the
 * book numbers its problems, so a dialog that reads references asks the
 * student to check it when PSet isn't sure. Checking it leaves the
 * dialog for the book's.
 */
export function NumberingCheck({ onLeave }: { onLeave: () => void }) {
  const here = useBookHere()
  if (!numberingUnsure(here.problems)) return null
  return (
    <div className="flex items-center justify-between gap-3">
      <p className="text-xs text-warning">
        PSet isn't sure how this book numbers its problems, which decides what a reference like "3.1 #7"
        means here.
      </p>
      <Button
        variant="ghost"
        size="sm"
        className="shrink-0"
        onClick={() => {
          onLeave()
          here.editBook()
        }}
      >
        Check it
      </Button>
    </div>
  )
}
