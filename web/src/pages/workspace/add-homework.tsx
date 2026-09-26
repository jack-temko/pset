import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react'

import { Button } from '@/components/button'
import { Checkbox } from '@/components/checkbox'
import { Dialog } from '@/components/dialog'
import { AutoTextarea, Field, Input } from '@/components/input'
import { Label } from '@/components/label'
import { SegmentedControl } from '@/components/segmented-control'
import { Spinner } from '@/components/spinner'
import { ApiError } from '@/api/client'
import {
  useAssignmentRead,
  useAssignmentSource,
  useBookHomework,
  useDismissRead,
  useImportAssignment,
  useAddQuestions,
  useNewHomework,
  useStartRead,
  type AssignmentFrom,
  type LineReading,
  type Summary,
} from '@/api/homework'
import { cn, plural } from '@/lib/utils'
import { NumberingCheck, QuestionRows, draftsOf, emptyRow, rowsCount } from './dialogs'
import { ReadsAs, useLiveReadings } from './reads-as'
import {
  actionLabel,
  importOf,
  isEarlier,
  keptGroups,
  localToday,
  pending,
  questionCount,
  reviewOf,
  shownGroups,
  sourceName,
  type ReviewGroup,
  type ReviewRow,
} from './import-state'

/**
 * New homework and Add questions: one dialog, four ways in (2026-09-25,
 * Jack: "collapse the add questions after the fact to being the same
 * style as starting a homework... Make them one"). **Write** the
 * questions yourself, a row each, each saying what it reads as; or give
 * the professor's own document, a **File** (PDF or photo), the course's
 * **Web page**, or its text **Pasted** in, which is read out into due
 * dates and lines. Reading runs in the background: the dialog can close
 * while it reads, and the read waits in the Homework list for its review.
 * Nothing is added from a document until the student has looked: the
 * review is an editable list, a set a due date and a question a line.
 *
 * For a new set, Write asks its title and due date too, so a set is
 * started and filled in one step (the questions can wait). For a set
 * that exists, a document is read as an update to it: what's new, whose
 * instructions changed, and what it no longer lists. Spec:
 * design/workspace.md, "Adding homework".
 */

type Mode = 'write' | 'file' | 'page' | 'paste'

const modes = [
  { value: 'write', label: 'Write' },
  { value: 'file', label: 'File' },
  { value: 'page', label: 'Web page' },
  { value: 'paste', label: 'Paste' },
] as const

export function AddHomeworkDialog({
  open,
  bookId,
  readId,
  set,
  onClose,
  onDone,
}: {
  open: boolean
  bookId: string
  /** Opens on a read already started: its review, or its wait. */
  readId?: string | null
  /** The set it adds to; a new one when absent. */
  set?: { id: string; title: string }
  onClose: () => void
  /** The sets made or updated, and whether they were written here (a
   *  new set, or questions added to this one) rather than read. */
  onDone: (sets: Summary[], wrote: boolean) => void
}) {
  const remembered = useAssignmentSource(bookId).data ?? ''
  const titles = Object.fromEntries((useBookHomework(bookId).data ?? []).map((h) => [h.id, h.title]))
  const start = useStartRead(bookId)
  const dismiss = useDismissRead()
  const make = useImportAssignment(bookId)
  const newSet = useNewHomework(bookId)
  const addTo = useAddQuestions(set?.id ?? '')
  const [mode, setMode] = useState<Mode>('write')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [rows, setRows] = useState(() => [emptyRow()])
  const readingOf = useLiveReadings(rows)
  // The read this dialog is showing: one it started, or the one it opened on.
  const [tracked, setTracked] = useState<string | null>(null)
  const read = useAssignmentRead(tracked).data
  // The review, seeded once per read when it's ready.
  const [review, setReview] = useState<{ readId: string; groups: ReviewGroup[] } | null>(null)
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)

  // A fresh start every time it opens, never a resumed draft; the course
  // page last read is filled in, for checking it again.
  useEffect(() => {
    if (!open) return
    setMode('write')
    setUrl(remembered)
    setText('')
    setTitle('')
    setDue('')
    setRows([emptyRow()])
    setTracked(readId ?? null)
    setReview(null)
    setError('')
    make.reset()
    newSet.reset()
    addTo.reset()
    // Seeded on open only: the remembered page arriving later mustn't
    // reset what you've started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // A read that failed goes back to where it was given, saying why.
  useEffect(() => {
    if (read?.state === 'failed') setError(read.error ?? "Couldn't read it.")
    if (read?.state === 'ready' && read.assignment && review?.readId !== read.id)
      setReview({ readId: read.id, groups: reviewOf(read.assignment, localToday()) })
  }, [read, review?.readId])

  const begin = (from: AssignmentFrom) => {
    setError('')
    // A failed read tried again from here replaces it.
    if (read?.state === 'failed') dismiss.mutate(read)
    start.mutate(
      { from, setId: set?.id },
      {
        onSuccess: (r) => setTracked(r.id),
        onError: (e) => setError(e instanceof ApiError ? e.message : "Couldn't start reading it."),
      },
    )
  }

  // Written: a new set with its questions, or questions added to this one.
  const drafts = draftsOf(rows)
  const count = rowsCount(rows, readingOf)
  const writing = newSet.isPending || addTo.isPending
  const canWrite = !writing && (set ? drafts.length > 0 : title.trim() !== '')
  const write = () => {
    if (!canWrite) return
    const done = (sets: Summary[]) => {
      onDone(sets, true)
      onClose()
    }
    const failed = (e: Error) => setError(e instanceof ApiError ? e.message : "Couldn't add them.")
    if (set) addTo.mutate(drafts, { onSuccess: () => done([]), onError: failed })
    else
      newSet.mutate(
        { title: title.trim(), dueDate: due, drafts },
        { onSuccess: (h) => done([h]), onError: failed },
      )
  }
  const writeLabel = set
    ? count === 0
      ? 'Add questions'
      : count === 1
        ? 'Add 1 question'
        : `Add ${count} questions`
    : count === 0
      ? 'Create'
      : count === 1
        ? 'Create with 1 question'
        : `Create with ${count} questions`

  const step =
    !tracked || read?.state === 'failed'
      ? 'source'
      : read?.state === 'ready' && review?.readId === read.id
        ? 'review'
        : 'reading'
  const groups = review?.groups ?? []
  const kept = keptGroups(groups)
  const canRead =
    !start.isPending && (mode === 'file' || (mode === 'page' ? url.trim() !== '' : text.trim() !== ''))

  const primary =
    step === 'review' && read ? (
      <Button
        disabled={kept.length === 0 || make.isPending}
        onClick={() =>
          make.mutate(importOf(read.id, read.assignment?.source ?? read.source, groups), {
            onSuccess: (sets) => {
              onDone(sets, false)
              onClose()
            },
          })
        }
      >
        {make.isPending && <Spinner className="size-3" />}
        {actionLabel(groups)}
      </Button>
    ) : step === 'source' && mode === 'write' ? (
      <Button disabled={!canWrite} onClick={write}>
        {writing && <Spinner className="size-3" />}
        {writeLabel}
      </Button>
    ) : step === 'source' ? (
      <Button
        disabled={!canRead}
        onClick={() => {
          if (mode === 'file') picker.current?.click()
          else if (mode === 'page') begin({ url: url.trim() })
          else begin({ text })
        }}
      >
        {mode === 'file' ? 'Choose a file' : 'Read it'}
      </Button>
    ) : null

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={set ? 'Add questions' : 'New homework'}
      width="wide"
      footer={
        <>
          {step === 'review' && read && !readId && (
            <Button
              variant="ghost"
              className="mr-auto -ml-2"
              onClick={() => {
                dismiss.mutate(read)
                setTracked(null)
              }}
            >
              <ArrowLeft />
              Back
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {step === 'reading' ? 'Close' : 'Cancel'}
          </Button>
          {primary}
        </>
      }
    >
      <input
        ref={picker}
        type="file"
        accept="application/pdf,image/*,text/plain"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) begin({ file })
        }}
      />
      {step === 'reading' ? (
        <ReadingNote what={read?.source ?? ''} />
      ) : step === 'review' && read?.assignment ? (
        <AssignmentReview
          source={read.assignment.source}
          title={read.assignment.title}
          groups={groups}
          titles={titles}
          onChange={(next) => setReview({ readId: read.id, groups: next })}
          error={make.error instanceof ApiError ? make.error.message : make.error ? "Couldn't add them." : ''}
          onLeave={onClose}
        />
      ) : (
        <AssignmentSourceFields
          mode={mode}
          onMode={(m) => {
            setMode(m)
            setError('')
          }}
          url={url}
          onUrl={setUrl}
          remembered={remembered !== '' && url.trim() === remembered}
          updating={set?.title}
          text={text}
          onText={setText}
          error={error}
          onLeave={onClose}
          onSubmit={() => {
            if (mode === 'write') return write()
            if (!canRead) return
            if (mode === 'page') begin({ url: url.trim() })
            else if (mode === 'paste') begin({ text })
          }}
          write={
            <div className="space-y-4">
              {!set && (
                <div className="flex items-start gap-2">
                  <Field label="Title" className="min-w-0 flex-1">
                    <Input
                      autoFocus
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Problem set 4"
                    />
                  </Field>
                  <Field label="Due date" className="w-40">
                    <Input type="date" value={due} onChange={(e) => setDue(e.target.value)} />
                  </Field>
                </div>
              )}
              <QuestionRows
                rows={rows}
                onRows={setRows}
                readingOf={readingOf}
                onSubmit={write}
                autoFocus={!!set}
              />
            </div>
          }
        />
      )}
    </Dialog>
  )
}

/** Where the homework comes from: four ways in, one shown at a time. */
export function AssignmentSourceFields({
  mode,
  onMode,
  url,
  onUrl,
  remembered,
  updating,
  text,
  onText,
  error,
  onSubmit,
  onLeave,
  write,
}: {
  mode: Mode
  onMode: (m: Mode) => void
  /** Leaves the dialog, for checking the book's numbering. */
  onLeave: () => void
  /** The Write way's fields: the questions typed, a row each. */
  write: ReactNode
  url: string
  onUrl: (url: string) => void
  /** The address is the page this book's homework was last read from. */
  remembered: boolean
  /** The title of the set it will update, when it's an update. */
  updating?: string
  text: string
  onText: (text: string) => void
  /** Why the last read failed, said under the way it was tried. */
  error: string
  onSubmit: () => void
}) {
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
    >
      <SegmentedControl label="Where the homework is" options={modes} value={mode} onChange={onMode} />
      {mode === 'write' && (
        <>
          <NumberingCheck onLeave={onLeave} />
          {error && <p className="text-xs text-destructive">{error}</p>}
          {write}
        </>
      )}
      {updating && mode !== 'write' && (
        <p className="text-sm">
          The professor's assignment for <span className="font-medium">{updating}</span>, or a newer version
          of it. PSet compares it with the set: what's new, whose instructions changed, and what it no longer
          lists. Nothing already there is redone.
        </p>
      )}
      {mode === 'file' && (
        <div className="space-y-1">
          <p className="text-sm">
            The professor's PDF, or a photo of the assignment: a printout, a slide, the board.
          </p>
          <p className={cn('text-xs', error ? 'text-destructive' : 'text-muted-foreground')}>
            {error || 'PSet reads it and shows you what it found before anything is added.'}
          </p>
        </div>
      )}
      {mode === 'page' && (
        <Field
          label="The course's homework page"
          error={error}
          hint={
            remembered
              ? "Where this book's homework came from last time. Reading it again marks what's already added, and what changed."
              : 'A public page, like a semester table of problems. PSet remembers it, for checking again. A page behind a login can be pasted or photographed instead.'
          }
        >
          <Input
            autoFocus
            type="url"
            value={url}
            placeholder="https://people.example.edu/~prof/202/homework.htm"
            onChange={(e) => onUrl(e.target.value)}
          />
        </Field>
      )}
      {mode === 'paste' && (
        <Field
          label="The assignment's text"
          error={error}
          hint="As much as you have, due dates and all: an email, a Canvas page, a line like 3.1: 1, 7, 12."
        >
          <AutoTextarea
            autoFocus
            value={text}
            className="min-h-24"
            placeholder="Homework 3, due Friday: 3.1 #1, 7, 12 (do c)"
            onChange={(e) => onText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                onSubmit()
              }
            }}
          />
        </Field>
      )}
    </form>
  )
}

/** The wait while the model reads it, which needn't be watched: seconds
 *  for a one-date sheet, minutes for a semester's table on a slow model
 *  (the 202 page took three and a half on a flash model). */
function ReadingNote({ what }: { what: string }) {
  return (
    <div className="flex items-center gap-3 py-6">
      <Spinner className="text-muted-foreground" label="Reading" />
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm">Reading {sourceName(what)}…</p>
        <p className="text-xs text-muted-foreground">
          A one-page sheet takes seconds; a whole semester's page, or a scan, can take a few minutes. You can
          close this: it keeps reading, and waits in Homework for you to look it over.
        </p>
      </div>
    </div>
  )
}

/**
 * The review: a block per due date, each a new set if ticked, or the
 * changes to the set it updates; its lines below it, each a question if
 * ticked. A date that isn't ticked folds to its header, and the dates
 * gone by or already added with nothing new fold away behind one button.
 */
export function AssignmentReview({
  source,
  title,
  groups,
  titles,
  onChange,
  error,
  onLeave,
}: {
  source: string
  title: string
  groups: ReviewGroup[]
  /** Each set's title, by id, for naming the sets updated. */
  titles: Record<string, string>
  onChange: (groups: ReviewGroup[]) => void
  error?: string
  /** Leaves the dialog, for checking the book's numbering. */
  onLeave: () => void
}) {
  const [showEarlier, setShowEarlier] = useState(false)
  const setGroup = (id: number, change: Partial<ReviewGroup>) =>
    onChange(groups.map((g) => (g.id === id ? { ...g, ...change } : g)))
  const setRow = (g: ReviewGroup, id: number, change: Partial<ReviewRow>) =>
    setGroup(g.id, { rows: g.rows.map((r) => (r.id === id ? { ...r, ...change } : r)) })
  const readingOf = useLiveReadings(
    groups.flatMap((g) =>
      g.rows.filter((r) => r.edited).map((r) => ({ id: r.id, text: r.text, inBook: r.inBook })),
    ),
  )
  const earlier = groups.filter(isEarlier).length
  // Nothing to come (an old sheet read again): everything shows.
  const shown = shownGroups(groups, showEarlier || earlier === groups.length)

  return (
    <div className="space-y-3">
      <NumberingCheck onLeave={onLeave} />
      <p className="text-xs text-muted-foreground">
        {title ? <>{title}, read from </> : <>Read from </>}
        <span className="break-all">{sourceName(source)}</span>. Each ticked due date becomes a set, or
        updates the set it matches, and each ticked line a question.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {earlier > 0 && earlier < groups.length && (
        <Button variant="ghost" size="sm" className="-ml-2" onClick={() => setShowEarlier((s) => !s)}>
          {showEarlier ? <ChevronUp /> : <ChevronDown />}
          {showEarlier
            ? 'Hide the earlier due dates'
            : `Show ${plural(earlier, 'earlier due date')}, gone by or already added`}
        </Button>
      )}
      <div className="divide-y divide-border-muted">
        {shown.map((g) =>
          g.setId ? (
            <UpdateGroupBlock
              key={g.id}
              g={g}
              setTitle={titles[g.setId] ?? g.title}
              onGroup={(change) => setGroup(g.id, change)}
              onRow={(id, change) => setRow(g, id, change)}
              readingOf={readingOf}
            />
          ) : (
            <NewGroupBlock
              key={g.id}
              g={g}
              onGroup={(change) => setGroup(g.id, change)}
              onRow={(id, change) => setRow(g, id, change)}
              readingOf={readingOf}
            />
          ),
        )}
      </div>
    </div>
  )
}

type GroupProps = {
  g: ReviewGroup
  onGroup: (change: Partial<ReviewGroup>) => void
  onRow: (id: number, change: Partial<ReviewRow>) => void
  /** A changed line's reading now, by row id. */
  readingOf: (id: number) => LineReading | undefined
}

/** A date that becomes a new set: its title and date editable, its lines
 *  below. */
function NewGroupBlock({ g, onGroup, onRow, readingOf }: GroupProps) {
  const count = questionCount(g)
  return (
    <section className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-1">
        <Checkbox checked={g.keep} onChange={() => onGroup({ keep: !g.keep })} className="-ml-2">
          <span className="sr-only">Add {g.title || 'this due date'}</span>
        </Checkbox>
        <Input
          aria-label="Set title"
          value={g.title}
          disabled={!g.keep}
          onChange={(e) => onGroup({ title: e.target.value })}
          className="min-w-0 flex-1"
        />
        <Input
          aria-label="Due date"
          type="date"
          value={g.due}
          disabled={!g.keep}
          onChange={(e) => onGroup({ due: e.target.value })}
          className="ml-1 w-40"
        />
      </div>
      <div className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
        {g.keep ? (
          <span>{count === 0 ? 'No lines ticked' : plural(count, 'question')}</span>
        ) : (
          <span>
            {g.past && 'Past due. '}
            {plural(g.rows.length, 'line')}; tick it to add them.
          </span>
        )}
        {g.keep && !g.title.trim() && <span className="text-destructive">Give it a title.</span>}
      </div>
      {g.keep && (
        <div className="space-y-3 pt-1 pl-7">
          {g.rows.map((r) => (
            <ReviewRowItem
              key={r.id}
              r={r}
              live={readingOf(r.id)}
              onChange={(change) => onRow(r.id, change)}
            />
          ))}
        </div>
      )}
    </section>
  )
}

/** A date that updates a set: what's new in it, whose instructions
 *  changed, and what the set has that it no longer lists. */
function UpdateGroupBlock({ g, setTitle, onGroup, onRow, readingOf }: GroupProps & { setTitle: string }) {
  const something = pending(g)
  const open = g.keep && something
  const fresh = g.rows.filter((r) => r.kind !== 'other' && !r.added)
  const changed = g.rows.flatMap((r) => r.changes.filter((c) => c.now.length > 0))
  const summary = [
    fresh.length > 0 &&
      `${plural(questionCount({ ...g, rows: fresh.map((r) => ({ ...r, keep: true })) }), 'new question')}`,
    changed.length > 0 && `${plural(changed.length, 'instruction')} changed`,
    g.gone.length > 0 && `${g.gone.length} no longer listed`,
  ].filter(Boolean)
  return (
    <section className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex min-h-control items-center gap-1">
        <Checkbox
          checked={open}
          disabled={!something}
          onChange={() => onGroup({ keep: !g.keep })}
          className="-ml-2"
        >
          <span className="sr-only">Update {setTitle}</span>
        </Checkbox>
        <p className="min-w-0 flex-1 truncate text-sm font-medium">Update {setTitle}</p>
        {g.due && <span className="shrink-0 text-xs text-muted-foreground">{shortDate(g.due)}</span>}
      </div>
      <div className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
        {something ? <span>{summary.join(' · ')}</span> : <Label>Already added</Label>}
      </div>
      {open && (
        <div className="space-y-3 pt-1 pl-7">
          {g.rows.map((r) =>
            r.kind !== 'other' && r.added ? (
              <AddedRow key={r.id} r={r} onChange={(change) => onRow(r.id, change)} />
            ) : (
              <ReviewRowItem
                key={r.id}
                r={r}
                live={readingOf(r.id)}
                onChange={(change) => onRow(r.id, change)}
              />
            ),
          )}
          {g.gone.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                In the set, but not in this version. Tick one to take it out of the set.
              </p>
              {g.gone.map((q) => (
                <Checkbox
                  key={q.questionId}
                  checked={q.remove}
                  onChange={() =>
                    onGroup({
                      gone: g.gone.map((x) =>
                        x.questionId === q.questionId ? { ...x, remove: !x.remove } : x,
                      ),
                    })
                  }
                  className="-ml-2 text-muted-foreground"
                >
                  Remove <span className="font-mono">{q.label}</span>
                </Checkbox>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

/** "Sep 4", for a date beside a set's name. */
function shortDate(due: string) {
  const [y, m, d] = due.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** A line the set already has: one quiet line, with its changed
 *  instructions under it to take or leave. */
function AddedRow({ r, onChange }: { r: ReviewRow; onChange: (change: Partial<ReviewRow>) => void }) {
  return (
    <div className="space-y-1">
      <p className="truncate text-sm text-muted-foreground">
        {r.text}
        <span className="text-xs"> · already in the set</span>
      </p>
      <Changes r={r} onChange={onChange} />
    </div>
  )
}

/** A problem's instructions as this version gives them, ticked to take
 *  them: its guide is written again, and nothing else is redone. */
function Changes({ r, onChange }: { r: ReviewRow; onChange: (change: Partial<ReviewRow>) => void }) {
  if (r.changes.length === 0) return null
  return (
    <div className="space-y-1">
      {r.changes.map((c) => (
        <div key={c.questionId}>
          <Checkbox
            checked={c.apply}
            onChange={() =>
              onChange({
                changes: r.changes.map((x) =>
                  x.questionId === c.questionId ? { ...x, apply: !x.apply } : x,
                ),
              })
            }
            className="-ml-2"
          >
            <span>
              <span className="font-mono">{c.label}</span>:{' '}
              {c.now.length ? <>now &ldquo;{c.now.join('; ')}&rdquo;</> : 'no instructions now'}
            </span>
          </Checkbox>
          <p className="pl-6 text-xs text-muted-foreground">
            {c.was.length ? <>Was &ldquo;{c.was.join('; ')}&rdquo;. </> : 'Had none. '}
            Its guide is written again.
          </p>
        </div>
      ))}
    </div>
  )
}

/** A line: editable while ticked; left out, it's one quiet line, so the
 *  reading and quizzes a sheet lists don't crowd the homework. */
function ReviewRowItem({
  r,
  live,
  onChange,
}: {
  r: ReviewRow
  live?: LineReading
  onChange: (change: Partial<ReviewRow>) => void
}) {
  const toggle = (
    <Checkbox checked={r.keep} onChange={() => onChange({ keep: !r.keep })} className="-ml-2">
      <span className="sr-only">Add this line</span>
    </Checkbox>
  )
  if (!r.keep) {
    return (
      <div className="flex items-center gap-1 text-muted-foreground">
        {toggle}
        <p className="min-w-0 flex-1 truncate text-sm">
          {r.text}
          <span className="text-xs"> · {r.kind === 'other' ? 'not homework' : 'left out'}</span>
        </p>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-1">
      {toggle}
      <div className="min-w-0 flex-1 space-y-1">
        <AutoTextarea
          aria-label="The line"
          value={r.text}
          onChange={(e) => onChange({ text: e.target.value, edited: true })}
        />
        <div className="flex flex-wrap items-center gap-x-2">
          <Checkbox
            checked={r.inBook}
            onChange={() => onChange({ inBook: !r.inBook })}
            className="-ml-2 text-muted-foreground"
          >
            In this book
          </Checkbox>
          <RowReading r={r} live={live} />
        </div>
        <Changes r={r} onChange={onChange} />
      </div>
    </div>
  )
}

/** What a kept line becomes: as it was read, or, once it's changed, as
 *  it reads now. */
function RowReading({ r, live }: { r: ReviewRow; live?: LineReading }) {
  if (!r.inBook)
    return <span className="text-xs text-muted-foreground">Its guide is written from this text alone.</span>
  const reading = r.edited ? live : r
  if (!reading) return null
  return <ReadsAs reading={reading} present={r.edited ? [] : r.present} />
}
