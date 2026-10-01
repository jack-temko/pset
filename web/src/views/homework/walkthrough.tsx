import { useEffect, useState, type KeyboardEvent } from 'react'
import { BookOpen, Check, Flag, ChevronLeft, ChevronDown, ChevronUp, Pencil, Plus, Printer, SquareDashedMousePointer, Trash2, TriangleAlert } from 'lucide-react'
import { Button, IconButton } from '@/components/button'
import { Label } from '@/components/label'
import { Menu, MenuCheckItem, MenuConfirmItem, MenuDivider, MenuItem } from '@/components/menu'
import { ProgressBar } from '@/components/progress-bar'
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
import { Runs } from '@/components/document'
import { guideAbout, questionSource, type PendingSel } from '@/components/document/selection'
import { runsSource, runsText } from '@/components/document/runs'
import type { About } from '@/api/ask'
import { useTimeLeft } from '@/lib/eta'
import { PageMap, usePages } from '@/lib/pages'
import { useSettled } from '@/lib/settled'
import { cn, plural } from '@/lib/utils'
import { FailedQuestion } from './failed-question'
import { HelpRows } from './help'
import { Finish } from './finish'
import { helpRows, type HelpName } from './help-meta'
import { isTyping, walkthroughKey } from './keys'
import { PRIMARY_LABEL, barLabel, countWords, firstUnfinished, nextUnfinished, ordinal, primaryOf, queuePlace, segments, stageWord, timeLeftWords, isWorking, type HomeworkSet, type Q } from './progress'

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
  // "3rd in line" once there is a line: the questions before it still owed work.
  const place = queuePlace(q, questions)
  const inLine = place > 1 ? ` It is ${ordinal(place)} in line.` : ''
  if (toFind(q)) {
    return (ahead.some(toFind) ? 'Queued: it starts when the questions ahead of it are found.' : 'Queued: it starts in a moment.') + inLine
  }
  const lead = q.page !== undefined ? `Found on p. ${pages.label(q.page)}. Its guide starts` : 'Queued: it starts'
  if (questions.some((x) => x.id !== q.id && toFind(x))) return `${lead} once every question is found.${inLine}`
  if (ahead.some(outstanding)) return `${lead} once the questions ahead of it are written.${inLine}`
  return `${lead} in a moment.`
}

/** One question at a time, and the set's progress always in view: the
 *  header holds the count (which opens the list of questions), the time
 *  left and the bar; the footer has one primary button. The help is three
 *  rows that open in place. Spec: web/src/views/homework/spec.md. */
export function Walkthrough({
  setId,
  onEdit,
  onDelete,
  onBack,
  onJump,
  onAskAbout,
  onPickSelection,
  onClearAbout,
  selection,
  onOpenSettings,
  onQuestion,
  wide = false,
}: {
  setId: string
  /** The question on screen (null on the finish page), for counting time. */
  onQuestion?: (id: string | null) => void
  /** Focus: the question stays put on the left while its help scrolls on the right. */
  wide?: boolean
  onEdit: () => void
  onDelete: () => void
  onBack: () => void
  onJump: (page: number) => void
  /** "Ask about this" on the question, or the toolbar on a selection:
   *  one context chip at a time, the selection replacing (or being
   *  replaced by) whatever was there. */
  onAskAbout: (about: About, selection?: PendingSel) => void
  /** A click picked an element of the guide: the outline before
   *  anything is asked. */
  onPickSelection: (selection: PendingSel) => void
  /** The chip's ✕, Esc, or sending: the selection goes with the chip. */
  onClearAbout: () => void
  /** The pending selection, for the outline while its chip rides. */
  selection: PendingSel | null
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
  // The finish page fills the pane once every question is done; it is where
  // the last Next lands, and where a set that is already all done opens.
  const [finishing, setFinishing] = useState(false)
  // What the student opened by hand, by question: the notes box for
  // editing, the figure's reading and the guide's memory lines, which are
  // behind the question's menu until asked for. And the help rows: a
  // question's open rows start as the ones it was left with.
  const [editingNotes, setEditingNotes] = useState<string | null>(null)
  const [peeked, setPeeked] = useState<Record<string, ('reading' | 'memory')[]>>({})
  const [rowsOpen, setRowsOpen] = useState<Record<string, string[]>>({})

  const set = detail.data?.homework as HomeworkSet | undefined
  const questions = (detail.data?.questions ?? []) as Q[]
  // Open where you'd pick up: the first question not yet done, once the
  // set has loaded.
  useEffect(() => {
    if (index !== null || !detail.data) return
    const first = firstUnfinished(detail.data.questions)
    setIndex(first ?? 0)
    if (first === null && detail.data.questions.length > 0) setFinishing(true)
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
  const q = questions[at] as Q | undefined
  const turnedIn = !!set?.turnedInAt
  // Only while every question is done: add one, or take a mark back, and it is over.
  const finished = finishing && questions.length > 0 && questions.every((x) => x.done)
  // Which question is on screen, so the workspace counts time against it.
  const onScreen = finished ? null : (q?.id ?? null)
  useEffect(() => {
    onQuestion?.(onScreen)
    return () => onQuestion?.(null)
  }, [onQuestion, onScreen])
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

  const left = timeLeftWords(set, questions)

  // The bar keeps what you read, in one row: where you are (the count,
  // which opens the questions), how long is left, and the bar as the
  // row's bottom edge. The menu holds what you do to the set. Turned in
  // stays a fact you can take back, as a checkable item.
  const header = (
    <div className="relative flex h-row shrink-0 items-center gap-1 border-b px-2">
      <IconButton variant="ghost" size="sm" aria-label="Back to homework" onClick={onBack}>
        <ChevronLeft />
      </IconButton>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">
        {set ? set.title : <Skeleton className="h-3 w-40" />}
      </span>
      {turnedIn && <Label tone="success">Turned in</Label>}
      {questions.length > 0 && (
        <Menu label="Questions" trigger={countWords(questions)} align="end">
          {questions.map((x, i) => (
            <MenuItem
              key={x.id}
              current={!finished && i === at}
              icon={
                x.done ? (
                  <Check className="text-success!" />
                ) : isWorking(x) ? (
                  <Spinner className="size-4" />
                ) : x.state === 'failed' ? (
                  <TriangleAlert className="text-warning!" />
                ) : undefined
              }
              hint={stageWord(x) ?? undefined}
              onSelect={() => {
                setIndex(i)
                setFinishing(false)
              }}
            >
              {x.label}
            </MenuItem>
          ))}
          {questions.every((x) => x.done) && (
            <>
              <MenuDivider />
              <MenuItem icon={<Flag />} current={finished} onSelect={() => setFinishing(true)}>
                All done
              </MenuItem>
            </>
          )}
        </Menu>
      )}
      {left && <span className="shrink-0 text-xs whitespace-nowrap text-muted-foreground tabular-nums">{left}</span>}
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
      {questions.length > 0 && (
        <ProgressBar segments={segments(questions, finished ? -1 : at)} label={barLabel(questions)} className="absolute inset-x-0 -bottom-px" />
      )}
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

  // The help rows this question has open, and how one opens or closes.
  const open = new Set(rowsOpen[q.id] ?? q.revealed)
  const toggleRow = (name: HelpName, to: boolean) => {
    setRowsOpen((all) => {
      const now = new Set(all[q.id] ?? q.revealed)
      if (to) now.add(name)
      else now.delete(name)
      return { ...all, [q.id]: [...now] }
    })
    if (to && !q.revealed.includes(name)) update.mutate({ id: q.id, patch: { reveal: name } })
  }

  // The figure's reading is out in the open only when it is flagged, and
  // the guide's memory lines only when asked for, from the question's menu.
  const peek = peeked[q.id] ?? []
  const peekAt = (what: 'reading' | 'memory') => setPeeked((all) => ({ ...all, [q.id]: [...(all[q.id] ?? []), what] }))
  const readingReady = q.figures.length > 0 && q.page !== undefined && !['pending', 'locating', 'reading'].includes(q.state)
  const flagged = !q.readingEdited && q.readingDoubts.length > 0
  const showReading = readingReady && (flagged || peek.includes('reading'))
  const showMemory = q.memory.length > 0 && peek.includes('memory')

  // What the one button does, and where it leads: done is marked and the
  // next question not yet done comes up, round the end; a skipped one is
  // not marked; a done one takes its mark back and stays.
  const primary = primaryOf(q)
  const next = nextUnfinished(questions, at)
  const press = () => {
    if (primary === 'incomplete') {
      update.mutate({ id: q.id, patch: { done: false } })
      return
    }
    if (primary === 'next') update.mutate({ id: q.id, patch: { done: true } })
    if (next !== null) setIndex(next)
    // The last one: nothing is left to go to, so it ends on the finish page.
    else if (primary === 'next') setFinishing(true)
  }

  // ← → browse and 1 2 3 open the rows, for a student whose hands are on
  // the keyboard: off while typing, in a menu or in a dialog.
  const onKeyDown = (e: KeyboardEvent) => {
    const key = walkthroughKey(e.key, e.metaKey || e.ctrlKey || e.altKey, isTyping(e.target))
    if (!key) return
    if (key.kind === 'browse') {
      const to = Math.max(0, Math.min(questions.length - 1, at + key.by))
      if (to !== at) setIndex(to)
    } else {
      const row = helpRows(q)[key.index]
      if (row && row.blocks.length > 0) toggleRow(row.name, !open.has(row.name))
    }
    e.preventDefault()
  }

  if (finished && set) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {header}
        <Finish
          title={set.title}
          questions={questions}
          turnedIn={turnedIn}
          onTurnIn={() => updateSet.mutate({ turnedIn: true })}
          onBack={onBack}
        />
        {dialog}
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col" onKeyDown={onKeyDown}>
      {header}

      {/* Keyed by the question: moving to another starts its body fresh
          (its notes, its reading, its failure's fields, the scroll), in
          one place. Keys scattered on the parts inside, beside the
          conditional parts and the figures, left stale copies behind
          (three "Add your professor's instructions" under one question). */}
      <div key={q.id} className={cn('min-h-0 flex-1', wide ? 'grid grid-cols-2 grid-rows-1' : 'grid grid-cols-1 auto-rows-max content-start gap-5 overflow-y-auto p-card')}>
        {/* The problem and the guide are the same two boxes in both layouts
            (one column, or two in Focus), so toggling Focus keeps what is
            half-typed in either. */}
        <div className={wide ? 'grid min-h-0 grid-cols-1 auto-rows-max content-start gap-5 overflow-y-auto border-r p-card' : 'contents'}>
          <div className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-lg font-semibold">{q.label}</span>
            {q.done && <Check aria-label="Done" className="size-4 shrink-0 text-success" />}
            {/* Takes the scan to the problem's page, and only when asked: a
                question that isn't in this book has nothing to show. */}
            {q.page !== undefined && (
              <Button variant="outline" size="sm" className="shrink-0" onClick={() => onJump(q.page as number)}>
                <BookOpen />
                Show in book
              </Button>
            )}
            {/* What you do to this question: order, what it is, what the
                professor said, what the guide read and remembered. */}
            <Menu label="Question actions">
              {at > 0 && (
                <MenuItem icon={<ChevronUp />} onSelect={() => move(-1)}>
                  Move up
                </MenuItem>
              )}
              {at < questions.length - 1 && (
                <MenuItem icon={<ChevronDown />} onSelect={() => move(1)}>
                  Move down
                </MenuItem>
              )}
              {(at > 0 || at < questions.length - 1) && <MenuDivider />}
              {/* A find can land on the wrong problem; showing the right one
                  is the same tool a failed find offers. */}
              {q.inBook && q.page !== undefined && q.state !== 'failed' && (
                <MenuItem
                  icon={<SquareDashedMousePointer />}
                  onSelect={() => boxing.start({ kind: 'find', questionId: q.id, label: q.label })}
                >
                  This isn't the right problem
                </MenuItem>
              )}
              <MenuItem icon={<Pencil />} onSelect={() => setEditingNotes(q.id)}>
                {q.notes.length > 0 ? "Edit the professor's instructions" : "Add your professor's instructions"}
              </MenuItem>
              {readingReady && !showReading && (
                <MenuItem icon={<Check />} onSelect={() => peekAt('reading')}>
                  Check how the figure reads
                </MenuItem>
              )}
              {q.memory.length > 0 && !showMemory && (
                <MenuItem onSelect={() => peekAt('memory')}>What the guide remembered</MenuItem>
              )}
              <MenuDivider />
              <MenuConfirmItem
                icon={<Trash2 />}
                question={`Remove ${q.label}?`}
                detail="Its guide and your progress on it go with it."
                action="Remove"
                onConfirm={() => {
                  removeQ.mutate(q.id)
                  setIndex(Math.max(0, Math.min(at, questions.length - 2)))
                }}
              >
                Remove this question
              </MenuConfirmItem>
            </Menu>
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

          {/* The professor's say on the problem, over the book's. Read-only:
              the question's menu is the one way to change it. */}
          <ProfessorNotes
            q={q}
            editing={editingNotes === q.id}
            onStop={() => setEditingNotes(null)}
            onSave={(notes) => update.mutate({ id: q.id, patch: { notes } })}
          />

          {/* The words the guide is written from: out only when a reading
              is flagged, or asked for. */}
          {showReading && (
            <FigureReading
              q={q}
              onCorrect={(lines) => redoReading.mutate({ id: q.id, lines })}
              onReread={() => redoReading.mutate({ id: q.id })}
            />
          )}

        </div>
        <div className={wide ? 'grid min-h-0 grid-cols-1 auto-rows-max content-start gap-5 overflow-y-auto p-card' : 'contents'}>
          {q.state === 'failed' ? (
            <>
              <FailedQuestion q={q} onRetry={(retry) => retryQ.mutate({ id: q.id, retry })} onOpenSettings={onOpenSettings} />
              {/* What the failed attempt spent: the calls cost even when
                  the guide didn't land. */}
              {q.usage && <UsageLine usage={q.usage} className="block" />}
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
                outstanding(q) && <p className="text-xs">{' '}</p>
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
                <HelpRows
                  key={q.id}
                  q={q}
                  queued={queued}
                  open={open}
                  onOpenChange={toggleRow}
                  onJump={onJump}
                  ask={{
                    selected: (stage) => {
                      const source = questionSource(q.id, stage)
                      return selection?.source === source ? selection.sel : null
                    },
                    pick: (stage, sel) => onPickSelection({ source: questionSource(q.id, stage), sel }),
                    ask: (stage, sel, blocks) =>
                      onAskAbout(
                        guideAbout({
                          question: q.label,
                          problem: runsSource(q.statement) || q.text,
                          blocks,
                          sel,
                          stage,
                          pages,
                        }),
                        { source: questionSource(q.id, stage), sel },
                      ),
                    clear: onClearAbout,
                  }}
                />
              )}
              {showMemory && set && <MemoryLines bookId={set.bookId} lines={q.memory} />}
              {/* What the whole production spent — find, figure read, guide
                  — once it's over. A question still being written keeps its
                  working lines and shows nothing here. */}
              {(q.state === 'ready' || q.state === 'unwritten') && q.usage && <UsageLine usage={q.usage} className="block" />}
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center justify-between border-t p-card">
        <Button variant="ghost" size="sm" onClick={() => onAskAbout({ label: q.label, text: runsSource(q.statement) || q.text })}>
          Ask about this
        </Button>
        {/* The one primary button: done is as easy to take back as to
            claim, and a question that can't be finished yet is skipped,
            never marked. */}
        <Button
          variant={primary === 'next' ? 'primary' : 'outline'}
          disabled={primary === 'skip' && next === null}
          onClick={press}
        >
          {PRIMARY_LABEL[primary]}
        </Button>
      </div>

      {dialog}
    </div>
  )
}
