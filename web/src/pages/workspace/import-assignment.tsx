import { useEffect, useRef, useState } from 'react'
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
  useAssignmentSource,
  useImportAssignment,
  useReadAssignment,
  type AssignmentFrom,
  type Summary,
} from '@/api/homework'
import { cn, plural } from '@/lib/utils'
import { NumberingCheck } from './dialogs'
import {
  importOf,
  isEarlier,
  keptGroups,
  localToday,
  questionCount,
  reviewOf,
  shownGroups,
  sourceName,
  type ReviewGroup,
  type ReviewRow,
} from './import-state'

/**
 * Import an assignment: the professor's PDF, a photo of it, the course's
 * homework page, or its text pasted in, read out into due dates and
 * lines. Nothing is added until the student has looked: the review is an
 * editable list, a set a due date and a question a line, and only what
 * stays ticked is made. Spec: design/workspace.md, "Importing an
 * assignment".
 */

type Mode = 'file' | 'page' | 'paste'

const modes = [
  { value: 'file', label: 'File' },
  { value: 'page', label: 'Web page' },
  { value: 'paste', label: 'Paste' },
] as const

type Step =
  { at: 'source' } | { at: 'reading'; what: string } | { at: 'review'; source: string; title: string }

export function ImportAssignmentDialog({
  open,
  bookId,
  onClose,
  onDone,
}: {
  open: boolean
  bookId: string
  onClose: () => void
  /** The sets made, for landing in one when there's only one. */
  onDone: (sets: Summary[]) => void
}) {
  const remembered = useAssignmentSource(bookId).data ?? ''
  const read = useReadAssignment(bookId)
  const make = useImportAssignment(bookId)
  const [mode, setMode] = useState<Mode>('file')
  const [url, setUrl] = useState('')
  const [text, setText] = useState('')
  const [step, setStep] = useState<Step>({ at: 'source' })
  const [groups, setGroups] = useState<ReviewGroup[]>([])
  const [error, setError] = useState('')
  const picker = useRef<HTMLInputElement>(null)
  // A read still running when the dialog closes, or is sent back, is
  // dropped when it lands: only the latest one counts.
  const reading = useRef(0)

  // A fresh start every time it opens, on the course page it last read
  // when there is one: checking it again is the common case.
  useEffect(() => {
    if (!open) return
    reading.current++
    setMode(remembered ? 'page' : 'file')
    setUrl(remembered)
    setText('')
    setStep({ at: 'source' })
    setGroups([])
    setError('')
    make.reset()
    // Seeded on open only: the remembered page arriving later mustn't
    // reset what you've started.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const start = (from: AssignmentFrom, what: string) => {
    const mine = ++reading.current
    setError('')
    setStep({ at: 'reading', what })
    read.mutate(from, {
      onSuccess: (a) => {
        if (mine !== reading.current) return
        setGroups(reviewOf(a, localToday()))
        setStep({ at: 'review', source: a.source, title: a.title })
      },
      onError: (e) => {
        if (mine !== reading.current) return
        setError(e instanceof ApiError ? e.message : "Couldn't read it.")
        setStep({ at: 'source' })
      },
    })
  }

  const back = () => {
    reading.current++
    setStep({ at: 'source' })
  }

  const kept = keptGroups(groups)
  const canRead = mode === 'file' || (mode === 'page' ? url.trim() !== '' : text.trim() !== '')

  const primary =
    step.at === 'review' ? (
      <Button
        disabled={kept.length === 0 || make.isPending}
        onClick={() =>
          make.mutate(importOf(step.source, groups), {
            onSuccess: (sets) => {
              onDone(sets)
              onClose()
            },
          })
        }
      >
        {make.isPending && <Spinner className="size-3" />}
        {kept.length === 0 ? 'Add sets' : kept.length === 1 ? 'Add 1 set' : `Add ${kept.length} sets`}
      </Button>
    ) : (
      <Button
        disabled={step.at === 'reading' || !canRead}
        onClick={() => {
          if (mode === 'file') picker.current?.click()
          else if (mode === 'page') start({ url: url.trim() }, 'the page')
          else start({ text }, 'the assignment')
        }}
      >
        {mode === 'file' ? 'Choose a file' : 'Read it'}
      </Button>
    )

  return (
    <Dialog
      open={open}
      onClose={() => {
        reading.current++
        onClose()
      }}
      title="Import an assignment"
      width="wide"
      footer={
        <>
          {step.at === 'review' && (
            <Button variant="ghost" className="mr-auto -ml-2" onClick={back}>
              <ArrowLeft />
              Back
            </Button>
          )}
          <Button
            variant="ghost"
            onClick={() => {
              reading.current++
              onClose()
            }}
          >
            Cancel
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
          if (file) start({ file }, file.name)
        }}
      />
      {step.at === 'reading' ? (
        <ReadingNote what={step.what} />
      ) : step.at === 'review' ? (
        <AssignmentReview
          source={step.source}
          title={step.title}
          groups={groups}
          onChange={setGroups}
          error={make.error instanceof ApiError ? make.error.message : make.error ? "Couldn't add them." : ''}
          onLeave={() => {
            reading.current++
            onClose()
          }}
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
          text={text}
          onText={setText}
          error={error}
          onSubmit={() => {
            if (!canRead) return
            if (mode === 'page') start({ url: url.trim() }, 'the page')
            else if (mode === 'paste') start({ text }, 'the assignment')
          }}
        />
      )}
    </Dialog>
  )
}

/** Where the assignment comes from: three ways in, one shown at a time. */
export function AssignmentSourceFields({
  mode,
  onMode,
  url,
  onUrl,
  remembered,
  text,
  onText,
  error,
  onSubmit,
}: {
  mode: Mode
  onMode: (m: Mode) => void
  url: string
  onUrl: (url: string) => void
  /** The address is the page this book's homework was last read from. */
  remembered: boolean
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
      <SegmentedControl label="Where the assignment is" options={modes} value={mode} onChange={onMode} />
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
              ? "Where this book's homework came from last time. Reading it again offers only the due dates not added yet."
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

/** The wait while the model reads it: seconds for a one-date sheet, a few
 *  minutes for a semester's table on a slow model (the 202 page took
 *  three and a half on a flash model). */
function ReadingNote({ what }: { what: string }) {
  return (
    <div className="flex items-center gap-3 py-6">
      <Spinner className="text-muted-foreground" label="Reading" />
      <div className="min-w-0 space-y-1">
        <p className="truncate text-sm">Reading {what}…</p>
        <p className="text-xs text-muted-foreground">
          A one-page sheet takes seconds; a whole semester's page, or a scan, can take a few minutes.
        </p>
      </div>
    </div>
  )
}

/**
 * The review: a block per due date, each a set if ticked, its lines
 * below it, each a question if ticked. Titles, dates and lines are all
 * editable; a date that isn't ticked folds to its header, and the dates
 * gone by or already added fold away behind one button.
 */
export function AssignmentReview({
  source,
  title,
  groups,
  onChange,
  error,
  onLeave,
}: {
  source: string
  title: string
  groups: ReviewGroup[]
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
  const earlier = groups.filter(isEarlier).length
  // Nothing to come (an old sheet read again): everything shows.
  const shown = shownGroups(groups, showEarlier || earlier === groups.length)

  return (
    <div className="space-y-3">
      <NumberingCheck onLeave={onLeave} />
      <p className="text-xs text-muted-foreground">
        {title ? <>{title}, read from </> : <>Read from </>}
        <span className="break-all">{sourceName(source)}</span>. Each ticked due date becomes a set, and each
        ticked line a question.
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
        {shown.map((g) => (
          <ReviewGroupBlock
            key={g.id}
            g={g}
            onGroup={(change) => setGroup(g.id, change)}
            onRow={(id, change) => setRow(g, id, change)}
          />
        ))}
      </div>
    </div>
  )
}

function ReviewGroupBlock({
  g,
  onGroup,
  onRow,
}: {
  g: ReviewGroup
  onGroup: (change: Partial<ReviewGroup>) => void
  onRow: (id: number, change: Partial<ReviewRow>) => void
}) {
  const open = g.keep && !g.imported
  const count = questionCount(g)
  return (
    <section className="space-y-2 py-3 first:pt-0 last:pb-0">
      <div className="flex items-center gap-1">
        <Checkbox
          checked={open}
          disabled={g.imported}
          onChange={() => onGroup({ keep: !g.keep })}
          className="-ml-2"
        >
          <span className="sr-only">Add {g.title || 'this due date'}</span>
        </Checkbox>
        <Input
          aria-label="Set title"
          value={g.title}
          disabled={!open}
          onChange={(e) => onGroup({ title: e.target.value })}
          className="min-w-0 flex-1"
        />
        <Input
          aria-label="Due date"
          type="date"
          value={g.due}
          disabled={!open}
          onChange={(e) => onGroup({ due: e.target.value })}
          className="ml-1 w-40"
        />
      </div>
      <div className="flex items-center gap-2 pl-7 text-xs text-muted-foreground">
        {g.imported ? (
          <Label>Already added</Label>
        ) : open ? (
          <span>{count === 0 ? 'No lines ticked' : plural(count, 'question')}</span>
        ) : (
          <span>
            {g.past && 'Past due. '}
            {plural(g.rows.length, 'line')}; tick it to add them.
          </span>
        )}
        {open && !g.title.trim() && <span className="text-destructive">Give it a title.</span>}
      </div>
      {open && (
        <div className="space-y-3 pt-1 pl-7">
          {g.rows.map((r) => (
            <ReviewRowItem key={r.id} r={r} onChange={(change) => onRow(r.id, change)} />
          ))}
        </div>
      )}
    </section>
  )
}

/** A line: editable while ticked; left out, it's one quiet line, so the
 *  reading and quizzes a sheet lists don't crowd the homework. */
function ReviewRowItem({ r, onChange }: { r: ReviewRow; onChange: (change: Partial<ReviewRow>) => void }) {
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
          <RowReading r={r} />
        </div>
      </div>
    </div>
  )
}

/** What a kept line becomes, as far as the review knows. */
function RowReading({ r }: { r: ReviewRow }) {
  if (!r.inBook)
    return <span className="text-xs text-muted-foreground">Its guide is written from this text alone.</span>
  if (r.edited)
    return (
      <span className="text-xs text-muted-foreground">Read in the book's numbering when it's added.</span>
    )
  if (r.unread)
    return (
      <span className="text-xs text-warning">
        Not a reference PSet can read. Write it like the book does, or untick In this book.
      </span>
    )
  // A note that's most of the line (the professor's changes to a book
  // problem, a paragraph after it) is already there to read above.
  const notes = r.notes.join('; ')
  return (
    <span className="min-w-0 text-xs text-muted-foreground">
      <span className="font-mono">{r.labels.join(', ')}</span>
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
