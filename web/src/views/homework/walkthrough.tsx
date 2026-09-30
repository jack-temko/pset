import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Pencil, Plus, Printer, SquareDashedMousePointer, Trash2 } from 'lucide-react'
import { Checkbox } from '@/components/checkbox'
import { Button, IconButton } from '@/components/button'
import { PageRef } from '@/components/transcript'
import { Veil } from '@/components/veil'
import { Label } from '@/components/label'
import { Menu, MenuCheckItem, MenuConfirmItem, MenuDivider, MenuItem } from '@/components/menu'
import { ConfirmPopover } from '@/components/confirm'
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { UsageLine } from '@/components/usage'
import { AddHomeworkDialog } from '@/pages/workspace/add-homework'
import { useBookHere } from '@/pages/workspace/book-here'
import { MemoryLines } from '@/pages/workspace/memory'
import { FigureReading } from '@/pages/workspace/reading'
import { ProfessorNotes } from '@/pages/workspace/notes'
import { useBoxing } from '@/pages/workspace/boxing-state'
import { figureURL, outstanding, questionStep, toFind, useHomeworkSet, useRemoveQuestion, useRedoReading, useRetryQuestion, useWriteGuide, useUpdateHomework, useUpdateQuestion, worksheetURL, type Question } from '@/api/homework'
import { AnswersOf, Document, Runs } from '@/components/document'
import { runsSource, runsText } from '@/components/document/runs'
import { answersOf } from '@/components/document/tree'
import type { About } from '@/api/ask'
import { useTimeLeft } from '@/lib/eta'
import { PageMap, usePages } from '@/lib/pages'
import { useSettled } from '@/lib/settled'
import { cn, plural } from '@/lib/utils'
import { FailedQuestion } from './failed-question'

/** A stage of the guide: the content is there from the start, behind
 *  frosted glass. One click lifts the veil: no buttons to sequence, and
 *  nothing spoiled by accident. */
function Stage({
  label,
  revealed,
  onReveal,
  children,
}: {
  label: string
  revealed: boolean
  onReveal: () => void
  children: ReactNode
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase">{label}</p>
      <Veil label={`Show ${label}`} revealed={revealed} onReveal={onReveal}>
        <div className="space-y-3 text-base">{children}</div>
      </Veil>
    </div>
  )
}

const STAGE_NAMES = ['hint', 'walkthrough', 'answers'] as const

/** A stage still being written: skeleton lines at a stage's usual size,
 *  so the guide lands in space already made for it. A hint runs two
 *  lines, a walkthrough about five and the answers two; the last stops
 *  short, as prose does. */
function StageSkeleton({ name, still }: { name: (typeof STAGE_NAMES)[number]; still?: boolean }) {
  const lines = name === 'walkthrough' ? 5 : 2
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground uppercase">{name}</p>
      <div className="space-y-1 text-base">
        {Array.from({ length: lines }, (_, j) => (
          <p key={j}>
            <Skeleton still={still} className={cn('h-3', j === lines - 1 ? 'w-2/3' : 'w-full')} />
          </p>
        ))}
      </div>
    </div>
  )
}

/** What the engine is doing to a question, while it does it: finding it,
 *  reading its figure, then whatever the guide's writer is doing (thinking, searching the
 *  book, computing), then writing. */
function workingLine(q: Question): string | null {
  if (q.state === 'locating') return q.activity || 'Finding it in the book…'
  if (q.state === 'reading') return q.activity || 'Reading the figure…'
  if (q.state === 'writing') return q.activity || 'Getting started…'
  return null
}

/** What the engine is doing to a question, and the time left on it
 *  (lib/eta) once past questions give an estimate. */
function WorkingLine({ q, text }: { q: Question; text: string }) {
  const left = useTimeLeft(`question:${q.id}`, questionStep(q))
  return (
    <p className="flex items-center gap-2 text-xs text-muted-foreground">
      <Spinner className="size-3" />
      {/* An ellipsis run into the dot reads as a smudge ("memory… ·"):
          with an estimate after it, the words drop their ellipsis, and the
          spinner still says it's under way. The estimate wraps whole. */}
      <span>
        {left ? text.replace(/…$/, '') : text}
        {left && <span className="whitespace-nowrap"> · {left}</span>}
      </span>
    </p>
  )
}

/** What a queued question is waiting for. Every question is found before
 *  any guide is written, so one still to be found waits only on the finds
 *  ahead of it, and a guide waits on every find in the set, then on the
 *  questions ahead of it. */
function waitingLine(q: Question, questions: Question[], pages: PageMap): string {
  const ahead = questions.filter((x) => x.position < q.position)
  if (toFind(q)) {
    return ahead.some(toFind) ? 'Queued: it starts when the questions ahead of it are found.' : 'Queued: it starts in a moment.'
  }
  const lead = q.page !== undefined ? `Found on p. ${pages.label(q.page)}. Its guide starts` : 'Queued: it starts'
  if (questions.some((x) => x.id !== q.id && toFind(x))) return `${lead} once every question is found.`
  if (ahead.some(outstanding)) return `${lead} once the questions ahead of it are written.`
  return `${lead} in a moment.`
}

/** One question at a time. Both stages sit veiled below the statement:
 *  the walkthrough carries the solution, and Complete is a checkbox that
 *  does exactly one thing. Spec: design/workspace.md. */
export function Walkthrough({
  setId,
  onEdit,
  onDelete,
  onBack,
  onJump,
  onAskAbout,
  onOpenSettings,
}: {
  setId: string
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
  onJump: (page: number) => void
  onAskAbout: (about: About) => void
  onOpenSettings: () => void
}) {
  const pages = usePages()
  const detail = useHomeworkSet(setId)
  const updateSet = useUpdateHomework(setId)
  const update = useUpdateQuestion(setId)
  const removeQ = useRemoveQuestion(setId)
  const retryQ = useRetryQuestion()
  const writeGuide = useWriteGuide()
  const redoReading = useRedoReading()
  const { bookId } = useBookHere()
  const boxing = useBoxing()
  const [adding, setAdding] = useState(false)
  const [index, setIndex] = useState<number | null>(null)
  // Removing a question asks first, under its trash button. It holds the
  // id it asked about, so moving to another question can't retarget it.
  const [removing, setRemoving] = useState<string | null>(null)
  const trash = useRef<HTMLButtonElement>(null)

  const set = detail.data?.homework
  const questions = detail.data?.questions ?? []
  // Open where you'd pick up: the first question not yet complete, once
  // the set has loaded.
  useEffect(() => {
    if (index === null && detail.data) {
      const i = detail.data.questions.findIndex((q) => !q.done)
      setIndex(i === -1 ? 0 : i)
    }
  }, [detail.data, index])
  // A question boxed on the page opens once it's in the set.
  const [openedBoxed, setOpenedBoxed] = useState<string | null>(null)
  useEffect(() => {
    if (!boxing.added || boxing.added === openedBoxed || !detail.data) return
    const i = detail.data.questions.findIndex((x) => x.id === boxing.added)
    if (i !== -1) {
      setIndex(i)
      setOpenedBoxed(boxing.added)
    }
  }, [boxing.added, openedBoxed, detail.data])
  const at = Math.min(index ?? 0, Math.max(questions.length - 1, 0))
  const q = questions[at] as Question | undefined
  const turnedIn = !!set?.turnedInAt
  // Until every question is found, the worksheet has bare labels in it.
  const finding = questions.filter(toFind).length
  // A question waits between its steps for a moment, often less: the wait
  // shows only once it has lasted, and until then the line before it
  // stays (its state and what it was doing), or a blank at first.
  const waits = q !== undefined && (q.state === 'pending' || q.state === 'located')
  const waitSince = waits ? Date.parse(q.updatedAt) : null
  const shownState = useSettled(q?.state, waitSince, q?.id)
  const shownActivity = useSettled(q?.activity, waitSince, q?.id)

  // Add questions: typed, or from the professor's document, read as an
  // update to the set. Typed ones land you on the first of them.
  const dialog = bookId && (
    <AddHomeworkDialog
      open={adding}
      bookId={bookId}
      set={{ id: setId, title: detail.data?.homework.title ?? '' }}
      onBox={() => boxing.start({ kind: 'add', setId })}
      onClose={() => setAdding(false)}
      onDone={(_, wrote) => {
        if (wrote) setIndex(questions.length)
      }}
    />
  )

  // The bar keeps what you read (where you are, which set, how far in)
  // and the menu holds what you do to the set. Turned in stays a fact you
  // can take back, as a checkable item.
  const header = (
    <div className="flex h-row shrink-0 items-center gap-2 border-b px-2">
      <IconButton variant="ghost" size="sm" aria-label="Back to homework" onClick={onBack}>
        <ChevronLeft />
      </IconButton>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {set ? set.title : <Skeleton className="h-3 w-40" />}
      </span>
      {turnedIn && <Label tone="success">Turned in</Label>}
      {questions.length > 0 && (
        <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
          {at + 1} of {questions.length}
        </span>
      )}
      <Menu label="Homework actions">
        <MenuItem icon={<Plus />} onSelect={() => setAdding(true)}>
          Add questions
        </MenuItem>
        {/* The other way to add one: show it on the page, which works for
            any book, however it numbers its problems. */}
        <MenuItem icon={<SquareDashedMousePointer />} onSelect={() => boxing.start({ kind: 'add', setId })}>
          Box one on the page
        </MenuItem>
        <MenuItem icon={<Pencil />} onSelect={onEdit}>
          Edit homework
        </MenuItem>
        {/* A worksheet: statements and figures with room to work, nothing
            revealed. It opens in a new tab, to print or save from there.
            While questions are still being found, the hint says how many
            would print as a bare label; it never stops you printing. */}
        <MenuItem
          icon={<Printer />}
          hint={finding > 0 ? `${finding} still being found` : undefined}
          onSelect={() => window.open(worksheetURL(setId), '_blank')}
        >
          Print worksheet
        </MenuItem>
        <MenuDivider />
        {/* An act until it's done, then a fact: "Turn in", then
            "Turned in" with its check. Choosing it again takes it back. */}
        <MenuCheckItem checked={turnedIn} onChange={() => updateSet.mutate({ turnedIn: !turnedIn })}>
          {turnedIn ? 'Turned in' : 'Turn in'}
        </MenuCheckItem>
        {/* Last and apart, as on the book's menu. It asks first, naming
            what goes; the set has to have loaded to say so. */}
        {set && (
          <>
            <MenuDivider />
            <MenuConfirmItem
              icon={<Trash2 />}
              question={`Delete ${set.title}?`}
              detail={
                set.total === 0
                  ? 'It has no questions yet.'
                  : `Its ${plural(set.total, 'question')} go with it, with their guides and what you checked off.`
              }
              action="Delete homework"
              onConfirm={onDelete}
            >
              Delete homework
            </MenuConfirmItem>
          </>
        )}
      </Menu>
    </div>
  )

  if (!detail.data) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="space-y-5 p-card">
          <Skeleton className="h-4 w-24" />
          <p className="space-y-1">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </p>
          <StageSkeleton name="hint" />
          <StageSkeleton name="walkthrough" />
        </div>
      </div>
    )
  }

  if (!q) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-card text-center">
          <p className="text-sm text-muted-foreground">
            No questions yet. Paste a reference or the question itself, one per row.
          </p>
          <Button onClick={() => setAdding(true)}>
            <Plus />
            Add questions
          </Button>
        </div>
        {dialog}
      </div>
    )
  }

  const move = (by: number) => {
    update.mutate({ id: q.id, patch: { position: q.position + by } })
    // Follow the question you just moved, not the slot it left.
    setIndex(at + by)
  }
  const working = shownState && workingLine({ ...q, state: shownState, activity: shownActivity })
  // Waiting to be found, or found and waiting for its guide: either way
  // nothing is happening to it yet.
  const queued = shownState === 'pending' || shownState === 'located'
  // The skeletons shimmer only for work: still while queued, and still
  // while it isn't known yet whether this is a wait.
  const still = queued || !shownState

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {header}

      {/* Keyed by the question: moving to another starts its body fresh
          (its notes, its reading, its failure's fields, the scroll), in
          one place. Keys scattered on the parts inside, beside the
          conditional parts and the figures, left stale copies behind
          (three "Add your professor's instructions" under one question). */}
      <div key={q.id} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-card">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-lg font-semibold">{q.label}</span>
          {/* A question that isn't in this book has nothing to jump to. */}
          {q.page !== undefined && <PageRef pdf={q.page} onJump={onJump} />}
          {q.done && <Check aria-label="Done" className="size-4 text-success" />}
          {/* Order and removal, inline and quiet: the set is editable from
              the question you are looking at. */}
          <IconButton variant="ghost" size="sm" aria-label="Move this question up" disabled={at === 0} onClick={() => move(-1)}>
            <ChevronUp />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Move this question down"
            disabled={at === questions.length - 1}
            onClick={() => move(1)}
          >
            <ChevronDown />
          </IconButton>
          <IconButton
            ref={trash}
            variant="ghost"
            size="sm"
            aria-label="Remove this question"
            aria-haspopup="dialog"
            aria-expanded={removing === q.id}
            onClick={() => setRemoving(q.id)}
            className={cn(removing === q.id && 'bg-muted/50 text-foreground')}
          >
            <Trash2 />
          </IconButton>
          {removing === q.id && (
            <ConfirmPopover
              anchor={trash}
              question={`Remove ${q.label}?`}
              detail="Its guide and your progress on it go with it."
              action="Remove"
              onCancel={() => setRemoving(null)}
              onConfirm={() => {
                setRemoving(null)
                removeQ.mutate(q.id)
                setIndex(Math.max(0, Math.min(at, questions.length - 2)))
              }}
            />
          )}
        </div>

        {/* A bare reference ("3.C.14") is already the label; saying it
            twice isn't a statement. While it's still being found, the
            statement is a skeleton the book's text will replace. */}
        {q.statement.length > 0 && runsText(q.statement) !== q.label ? (
          <div className="text-base">
            <Runs runs={q.statement} onJump={onJump} />
          </div>
        ) : (
          q.inBook &&
          (q.state === 'pending' || q.state === 'locating') && (
            <p className="space-y-1 text-base">
              <Skeleton still={still} className="h-3 w-full" />
              <Skeleton still={still} className="h-3 w-2/3" />
            </p>
          )
        )}
        {q.figures.map((f, i) => (
          <figure key={i} className="space-y-1">
            <img src={figureURL(q.id, i)} alt={f.label || 'Figure'} className="w-full rounded-md border bg-card" />
            {f.label && <figcaption className="text-xs text-muted-foreground">{f.label}</figcaption>}
          </figure>
        ))}
        {/* A find can land on the wrong problem; showing the right one is
            the same tool a failed find offers. */}
        {q.inBook && q.page !== undefined && q.state !== 'failed' && (
          <p className="text-xs text-muted-foreground">
            Not the right problem?{' '}
            <button
              type="button"
              className="text-primary underline-offset-2 hover:underline"
              onClick={() => boxing.start({ kind: 'find', questionId: q.id, label: q.label })}
            >
              Show me where it is
            </button>
          </p>
        )}

        {/* The professor's say on the problem, over the book's. */}
        <ProfessorNotes q={q} onSave={(notes) => update.mutate({ id: q.id, patch: { notes } })} />

        {/* The words the guide is written from, once there are any: a
            question still being found or read has none to check yet. */}
        {q.figures.length > 0 &&
          q.page !== undefined &&
          q.state !== 'pending' &&
          q.state !== 'locating' &&
          q.state !== 'reading' && (
            <FigureReading
              q={q}
              onCorrect={(lines) => redoReading.mutate({ id: q.id, lines })}
              onReread={() => redoReading.mutate({ id: q.id })}
            />
          )}

        {q.state === 'failed' ? (
          <>
            <FailedQuestion q={q} onRetry={(retry) => retryQ.mutate({ id: q.id, retry })} onOpenSettings={onOpenSettings} />
            {/* What the failed attempt spent: the calls cost even when
                the guide didn't land. */}
            {q.usage && <UsageLine usage={q.usage} />}
          </>
        ) : (
          <>
            {/* Queued is a word and no motion: nothing is happening to it
                yet. Working gets the spinner and the shimmer. */}
            {queued ? (
              <p className="text-xs text-muted-foreground">{waitingLine(q, questions, pages)}</p>
            ) : working ? (
              <WorkingLine q={q} text={working} />
            ) : (
              // A wait too young to show yet, with nothing shown before
              // it: a blank at the line's height, so nothing moves.
              outstanding(q) && <p className="text-xs">{'\u00a0'}</p>
            )}
            {q.state === 'unwritten' ? (
              // No guide yet: the ones written before documents were
              // deleted. Nothing writes one until it's asked for.
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">This question has no guide yet.</p>
                <Button variant="outline" onClick={() => writeGuide.mutate(q.id)}>
                  Write the guide
                </Button>
              </div>
            ) : (
              STAGE_NAMES.map((name) => {
                const blocks = name === 'hint' ? q.hint : q.walkthrough
                // Each stage fills in as it's written: the hint can be
                // there while the walkthrough is still a skeleton. The
                // answers are the walkthrough's answer blocks, so they
                // arrive with it.
                if (blocks.length === 0) return <StageSkeleton key={name} name={name} still={still} />
                if (name === 'answers' && answersOf(blocks).length === 0) return null
                return (
                  <Stage
                    key={name}
                    label={name}
                    revealed={q.revealed.includes(name)}
                    onReveal={() => update.mutate({ id: q.id, patch: { reveal: name } })}
                  >
                    {name === 'answers' ? (
                      <AnswersOf blocks={q.walkthrough} onJump={onJump} />
                    ) : (
                      <Document blocks={blocks} onJump={onJump} reading />
                    )}
                  </Stage>
                )
              })
            )}
            {set && <MemoryLines bookId={set.bookId} lines={q.memory} />}
            {/* What the whole production spent — find, figure read, guide
                — once it's over. A question still being written keeps its
                working lines and shows nothing here. */}
            {(q.state === 'ready' || q.state === 'unwritten') && q.usage && <UsageLine usage={q.usage} />}
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={() => onAskAbout({ label: q.label, text: runsSource(q.statement) || q.text })}>
          Ask about this
        </Button>
        <div className="flex items-center gap-2">
          <IconButton variant="ghost" size="sm" aria-label="Previous question" disabled={at === 0} onClick={() => setIndex(at - 1)}>
            <ChevronLeft />
          </IconButton>
          <IconButton
            variant="ghost"
            size="sm"
            aria-label="Next question"
            disabled={at === questions.length - 1}
            onClick={() => setIndex(at + 1)}
          >
            <ChevronRight />
          </IconButton>
          {/* Done must be as easy to take back as to claim, so it is a
              checkbox and it does not advance. */}
          <Checkbox checked={q.done} onChange={() => update.mutate({ id: q.id, patch: { done: !q.done } })}>
            Complete
          </Checkbox>
        </div>
      </div>

      {dialog}
    </div>
  )
}
