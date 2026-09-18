import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  CalendarClock,
  CircleCheck,
  Download,
  Pencil,
  Plus,
  Square,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'

import { MiniCover } from '@/components/book-chip'
import { HomeworkChatPanel } from '@/components/homework-chat'
import { TaskProgress, TaskSpinner } from '@/components/task-progress'
import { HomeworkQuestionCard } from '@/components/homework-question'
import { HomeworkSheet } from '@/components/homework-sheet'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useBooks } from '@/hooks/use-books'
import { api } from '@/lib/api'
import { coverHueFromSha } from '@/lib/covers'
import { useTasks } from '@/lib/events'
import { downloadHomeworkPdf, dueInfo } from '@/lib/homework'
import { taskActionLabel } from '@/lib/tasks'
import type { Homework, HomeworkQuestion, QuestionQueued, Task } from '@/lib/types'
import { cn } from '@/lib/utils'

/* ── live progress ─────────────────────────────────────────────────────── */

/**
 * Generation progress for the assignment being built.
 *
 * A question that couldn't be written never appears here: that failure lives
 * on the question's own card, next to the doors that repair it. This section
 * is only about the run as a whole.
 */
function GenerationProgress({ task }: { task: Task }) {
  const { retry, stop } = useTasks()
  const [busy, setBusy] = useState(false)
  const action = taskActionLabel(task)

  const run = (fn: () => Promise<unknown>) => {
    setBusy(true)
    void fn().finally(() => setBusy(false))
  }

  if (task.status === 'failed' || task.status === 'paused') {
    const failed = task.status === 'failed'
    return (
      <section
        aria-live="polite"
        className={cn(
          'space-y-2 rounded-2xl border p-4',
          failed ? 'border-destructive/40 bg-destructive/[0.05]' : 'border-border bg-card',
        )}
      >
        <p className={cn('text-sm font-medium', failed && 'text-destructive')}>
          {failed ? 'This homework didn’t finish.' : 'You stopped this.'}
        </p>
        {task.error ? (
          <p className="text-sm leading-relaxed text-destructive/90">{task.error}</p>
        ) : null}
        {action ? (
          <div className="flex items-center gap-2 pt-1">
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => retry(task.id))}>
              {busy ? <TaskSpinner /> : null}
              {action}
            </Button>
            <p className="text-xs text-muted-foreground">
              The walkthroughs it already wrote stay written.
            </p>
          </div>
        ) : null}
      </section>
    )
  }

  return (
    <section aria-live="polite" className="space-y-3 rounded-2xl border bg-card p-4">
      <TaskProgress task={task} showEta />
      <div className="flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">
          You can leave this page. It keeps going.
        </p>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => stop(task.id))}>
          Stop
        </Button>
      </div>
    </section>
  )
}

/* ── event application ─────────────────────────────────────────────────── */

/** The backend marshals empty Go slices as null; the UI renders arrays. */
function normalizeQuestion(q: HomeworkQuestion): HomeworkQuestion {
  return {
    ...q,
    diagrams: q.diagrams ?? [],
    understandingNotes: q.understandingNotes ?? [],
    guide: q.guide
      ? {
          ...q.guide,
          hints: q.guide.hints ?? [],
          steps: q.guide.steps ?? [],
          equations: q.guide.equations ?? [],
        }
      : null,
  }
}

function upsertQuestion(list: HomeworkQuestion[], raw: HomeworkQuestion): HomeworkQuestion[] {
  const q = normalizeQuestion(raw)
  const i = list.findIndex((x) => x.id === q.id)
  if (i === -1) return [...list, q].sort((a, b) => a.position - b.position)
  const next = list.slice()
  next[i] = q
  return next
}

/* ── header pieces ─────────────────────────────────────────────────────── */

function PrintScaleSelect({
  label,
  value,
  options,
  onSave,
}: {
  label: string
  value: number
  options: number[]
  onSave: (v: number) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-muted-foreground">
      {label}
      <Select value={String(value)} onValueChange={(v) => onSave(Number(v))}>
        <SelectTrigger className="h-8 w-20" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((v) => (
            <SelectItem key={v} value={String(v)}>
              {v}%
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function DueEditor({ hw, onSaved }: { hw: Homework; onSaved: () => void }) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(hw.dueDate ?? '')
  const info = dueInfo(hw.dueDate)
  const save = (value: string) => {
    api
      .updateHomework(hw.id, { dueDate: value || null })
      .then(onSaved)
      .catch((e: Error) => toast.error(e.message))
    setOpen(false)
  }
  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o)
        if (o) setDraft(hw.dueDate ?? '')
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Change the due date"
          className={cn(
            'inline-flex min-w-0 items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none',
            info.tone === 'overdue'
              ? 'border-destructive/40 bg-destructive/10 text-destructive'
              : info.tone === 'today'
                ? 'border-warning/50 bg-warning/10 text-warning'
                : 'text-muted-foreground',
          )}
        >
          <CalendarClock aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{info.label}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 space-y-3">
        <label className="block space-y-1">
          <span className="text-[0.65rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            Due date
          </span>
          <Input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') save(draft)
            }}
          />
        </label>
        <div className="flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              save('')
            }}
          >
            Clear
          </Button>
          <Button size="xs" onClick={() => save(draft)}>
            Save
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

/* ── the outline ───────────────────────────────────────────────────────── */

const statusChips: Record<HomeworkQuestion['status'], { label: string; className: string } | null> = {
  ready: null,
  pending: { label: 'queued', className: 'text-muted-foreground' },
  locating: { label: 'finding', className: 'text-muted-foreground' },
  writing: { label: 'writing', className: 'text-muted-foreground' },
  stale: { label: 'out of date', className: 'text-warning' },
  failed: { label: 'failed', className: 'text-destructive' },
}

/** Add one question by hand: paste what the assignment asks for, and name
 *  the page if you already know it. Naming it turns searching the whole book
 *  into finding a region on one page, which is both faster and far more
 *  reliable — but it is optional, because half the time the sheet only says
 *  "3.41". */
function AddQuestionDialog({
  open,
  onOpenChange,
  busy,
  onAdd,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  onAdd: (transcription: string, page: number | undefined) => void
}) {
  const [text, setText] = useState('')
  const [page, setPage] = useState('')

  useEffect(() => {
    if (open) {
      setText('')
      setPage('')
    }
  }, [open])

  const pageNum = page.trim() === '' ? undefined : Number(page)
  const pageBad = pageNum !== undefined && (!Number.isInteger(pageNum) || pageNum < 1)
  const canAdd = text.trim() !== '' && !pageBad && !busy

  const submit = () => {
    if (!canAdd) return
    onAdd(text.trim(), pageNum)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">Add a question</DialogTitle>
          <DialogDescription>
            It gets found in the book and its walkthrough written, the same way
            the others were.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              The question
            </span>
            <Textarea
              autoFocus
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
              }}
              placeholder="3.41, or the whole question as printed"
              aria-label="The question"
            />
            <span className="block text-xs text-muted-foreground">
              A problem number is enough when it comes from the book.
            </span>
          </label>
          <label className="block space-y-2">
            <span className="text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
              Page <span className="font-normal normal-case">(optional)</span>
            </span>
            <Input
              type="number"
              min={1}
              value={page}
              onChange={(e) => setPage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submit()
              }}
              placeholder="143"
              aria-label="Page"
              aria-invalid={pageBad || undefined}
              className="w-32"
            />
            <span className="block text-xs text-muted-foreground">
              Knowing the page turns searching the whole book into reading one.
            </span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!canAdd} onClick={submit}>
            Add question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** The question list: what the assignment contains, what state each question
 *  is in, and the ordering and removal that belong to the outline rather
 *  than to the question you happen to be reading. */
function QuestionOutline({
  questions,
  selectedId,
  busy,
  taskFor,
  onSelect,
  onMove,
  onRemove,
  onAdd,
}: {
  questions: HomeworkQuestion[]
  selectedId: string | null
  busy: boolean
  /** The task working a question, if one is. */
  taskFor: (questionId: string) => Task | null
  onSelect: (id: string) => void
  onMove: (q: HomeworkQuestion, dir: -1 | 1) => void
  onRemove: (q: HomeworkQuestion) => void
  onAdd: () => void
}) {
  return (
    <nav aria-label="Questions" className="p-2">
      <ol className="space-y-1">
        {questions.map((q, i) => {
          const task = taskFor(q.id)
          const running = task?.phases.find((ph) => ph.status === 'running')
          const chip = statusChips[q.status]
          const active = q.id === selectedId
          return (
            <li key={q.id} className="group relative">
              <button
                type="button"
                onClick={() => onSelect(q.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-2 py-2 pr-16 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                  active ? 'bg-muted' : 'hover:bg-muted/60',
                )}
              >
                <span
                  className={cn(
                    'flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[0.7rem] font-medium',
                    active ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary',
                  )}
                >
                  {q.position}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm" title={q.transcription}>
                    {q.transcription || 'Question'}
                  </span>
                  {/* While a question is being worked, its own phase note is
                      what the row says — that is the progress that was
                      invisible before. */}
                  {running ? (
                    <span className="mt-1 flex items-center gap-2 font-mono text-[0.65rem] text-primary">
                      <TaskSpinner />
                      <span className="min-w-0 truncate">{running.note || running.name}</span>
                    </span>
                  ) : (
                    <span className="mt-1 flex items-center gap-2 font-mono text-[0.65rem] text-muted-foreground">
                      {q.standalone ? 'own text' : q.page !== null ? `p. ${q.page}` : 'no page'}
                      {chip && (
                        <>
                          <span aria-hidden>·</span>
                          <span className={chip.className}>{chip.label}</span>
                        </>
                      )}
                    </span>
                  )}
                </span>
              </button>
              <span className="absolute top-1 right-1 flex gap-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground"
                  aria-label={`Move question ${q.position} up`}
                  disabled={busy || i === 0}
                  onClick={() => onMove(q, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground"
                  aria-label={`Move question ${q.position} down`}
                  disabled={busy || i === questions.length - 1}
                  onClick={() => onMove(q, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="size-6 text-muted-foreground hover:text-destructive"
                  aria-label={`Remove question ${q.position}`}
                  disabled={busy}
                  onClick={() => onRemove(q)}
                >
                  <Trash2 />
                </Button>
              </span>
            </li>
          )
        })}
      </ol>
      <Button
        variant="ghost"
        size="sm"
        className="mt-1 w-full justify-start text-muted-foreground"
        disabled={busy}
        onClick={onAdd}
      >
        <Plus data-icon="inline-start" />
        Add question
      </Button>
    </nav>
  )
}

/** Narrow screens have no sidebar, so the outline collapses to a row of
 *  numbers above the question. */
function QuestionPicker({
  questions,
  selectedId,
  onSelect,
}: {
  questions: HomeworkQuestion[]
  selectedId: string | null
  onSelect: (id: string) => void
}) {
  return (
    <nav aria-label="Questions" className="flex flex-wrap gap-2">
      {questions.map((q) => {
        const active = q.id === selectedId
        return (
          <button
            key={q.id}
            type="button"
            onClick={() => onSelect(q.id)}
            aria-current={active ? 'true' : undefined}
            className={cn(
              'flex size-8 items-center justify-center rounded-lg border font-mono text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active ? 'border-primary bg-primary text-primary-foreground' : 'hover:bg-muted',
              q.status === 'stale' && !active && 'border-warning/50 text-warning',
              q.status === 'failed' && !active && 'border-destructive/50 text-destructive',
            )}
          >
            {q.position}
          </button>
        )
      })}
    </nav>
  )
}

/* ── page ──────────────────────────────────────────────────────────────── */

function WorkspaceSkeleton() {
  return (
    <div className="space-y-4 px-4 py-6 md:px-6">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <Skeleton className="h-7 w-2/3" />
        <Skeleton className="h-5 w-1/3" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    </div>
  )
}

function QuietMissing() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Square className="size-5" />
      </div>
      <p className="font-heading text-lg">This homework is gone.</p>
      <p className="max-w-prose text-sm text-muted-foreground">
        It may have been deleted.{' '}
        <Link to="/homework" className="text-primary underline-offset-4 hover:underline">
          Back to Homework
        </Link>
        .
      </p>
    </div>
  )
}

export function HomeworkWorkspace() {
  const { homeworkId } = useParams()
  const navigate = useNavigate()
  const { books } = useBooks()

  const [hw, setHw] = useState<Homework | null>(null)
  const [questions, setQuestions] = useState<HomeworkQuestion[]>([])
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)
  /** The question in the centre pane and the anchor of every chat message. */
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const [tab, setTab] = useState<string>('guide')
  const [renaming, setRenaming] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)

  const refreshDetail = useCallback(() => {
    if (!homeworkId) return
    let cancelled = false
    api
      .homework(homeworkId)
      .then(({ homework, questions }) => {
        if (cancelled) return
        setHw(homework)
        setQuestions(questions.map(normalizeQuestion))
        setMissing(false)
      })
      .catch(() => {
        if (!cancelled) setMissing(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [homeworkId])

  useEffect(() => refreshDetail(), [refreshDetail])

  // The centre pane always has something in it once there is something to
  // show, and a removed question hands the pane to its neighbour.
  useEffect(() => {
    if (questions.length === 0) {
      if (selectedId !== null) setSelectedId(null)
      return
    }
    if (selectedId === null || !questions.some((q) => q.id === selectedId)) {
      setSelectedId(questions[0].id)
    }
  }, [questions, selectedId])

  // Print-layout knobs live on the assignment itself and save straight to
  // the row, so the downloaded template picks them up.
  const savePrintScales = (patch: { questionScale?: number; figureScale?: number }) => {
    if (!hw) return
    api
      .updateHomework(hw.id, patch)
      .then(refreshDetail)
      .catch((e: Error) => toast.error(e.message))
  }

  // Live progress rides the shared task stream. Question state is not on the
  // task any more — it lives on the question rows — so the content refetch
  // follows the phase's own progress rather than a hash of step churn.
  const { tasks, taskForHomework, taskForQuestion } = useTasks()
  // Every question task of this assignment, which is where all the per-
  // question progress comes from now.
  const questionTasks = useMemo(
    () => (tasks ?? []).filter((t) => t.kind === 'question' && t.homeworkId === hw?.id),
    [tasks, hw?.id],
  )
  const task = taskForHomework(hw?.id)

  // A question task settling means that question's row changed underneath
  // us — it was written, or it failed. Refetch on the settle rather than on
  // a timer, and only when the set of settled tasks actually moves.
  const settledQuestions = questionTasks
    .filter((t) => t.status === 'done' || t.status === 'failed' || t.status === 'paused')
    .map((t) => `${t.id}:${t.status}`)
    .join(',')
  const seenSettled = useRef<string | null>(null)

  useEffect(() => {
    if (seenSettled.current === null) {
      seenSettled.current = settledQuestions
      return
    }
    if (settledQuestions === seenSettled.current) return
    seenSettled.current = settledQuestions
    const t = setTimeout(() => refreshDetail(), 250)
    return () => clearTimeout(t)
  }, [settledQuestions, refreshDetail])

  // The task settled: resync once more and say so when the assignment landed.
  const settledStatus = useRef<string | null>(null)
  useEffect(() => {
    const status = task?.status ?? null
    const prev = settledStatus.current
    settledStatus.current = status
    if (prev && prev !== status && status === 'done' && hw && hw.status === 'generating') {
      refreshDetail()
      toast.success(`${hw.title} is ready`, {
        description: 'Walkthrough and template are set.',
      })
    }
  }, [task, hw, refreshDetail])

  const bookExists = useMemo(
    () => !!hw && !!books?.some((b) => b.sha256 === hw.bookSha256),
    [hw, books],
  )

  const commitRename = () => {
    const title = titleDraft.trim()
    setRenaming(false)
    if (!hw || !title || title === hw.title) return
    api
      .updateHomework(hw.id, { title })
      .then(() => refreshDetail())
      .catch((e: Error) => toast.error(e.message))
  }

  const handleMove = (q: HomeworkQuestion, dir: -1 | 1) => {
    if (!hw) return
    api
      .moveQuestion(hw.id, q.id, q.position + dir)
      .then(({ question }) => setQuestions((qs) => upsertQuestion(qs, question)))
      .catch((e: Error) => toast.error(e.message))
  }

  const handleRemove = (q: HomeworkQuestion) => {
    if (!hw) return
    api
      .removeQuestion(hw.id, q.id)
      .then(({ question: removed }) => {
        setQuestions((qs) => qs.filter((x) => x.id !== q.id))
        toast.success(`Q${q.position} removed`, {
          action: {
            label: 'Undo',
            onClick: () => {
              api
                .addQuestion(hw.id, {
                  transcription: removed.transcription,
                  page: removed.page,
                  status: removed.status,
                  standalone: removed.standalone,
                  questionRect: removed.questionRect,
                  diagrams: removed.diagrams,
                  guide: removed.guide,
                })
                .then(({ question }) => setQuestions((qs) => upsertQuestion(qs, question)))
                .catch((e: Error) => toast.error(e.message))
            },
          },
        })
      })
      .catch((e: Error) => toast.error(e.message))
  }

  // — scoped repair -----------------------------------------------------
  //
  // Each door re-runs exactly the stage that was wrong, and nothing else in
  // the assignment is touched. Each is a task on that one question, so it
  // survives the page that asked for it, resumes after a restart, and can be
  // stopped and retried. Progress arrives on the shared event stream — all
  // this has to do is put the question in the centre pane and take the row
  // it is handed back.

  const queueRepair = (q: HomeworkQuestion, work: () => Promise<QuestionQueued>) => {
    if (!hw) return
    setSelectedId(q.id)
    work()
      .then(({ question }) => setQuestions((qs) => upsertQuestion(qs, normalizeQuestion(question))))
      .catch((e: Error) => toast.error(e.message))
  }

  /** Add one by hand. The insert is only a row — it has no place in the book
   *  and no walkthrough — so the find-and-write pass is queued straight
   *  after, as that question's own task. */
  const handleAdd = (transcription: string, page: number | undefined) => {
    if (!hw) return
    api
      .addQuestion(hw.id, { transcription, page: page ?? null, status: 'pending' })
      .then(({ question }) => {
        const fresh = normalizeQuestion(question)
        setQuestions((qs) => upsertQuestion(qs, fresh))
        queueRepair(fresh, () => api.relocateQuestion(hw.id, fresh.id, { page }))
      })
      .catch((e: Error) => toast.error(e.message))
  }

  /** The walkthrough is wrong, but the place in the book is right. */
  const handleRedo = (q: HomeworkQuestion) =>
    hw && queueRepair(q, () => api.rewriteQuestion(hw.id, q.id))

  /** It found the wrong problem. Naming a page turns searching the whole
   *  book into finding a region on one page. */
  const handleRelocate = (q: HomeworkQuestion, page: number | undefined, note: string) =>
    hw && queueRepair(q, () => api.relocateQuestion(hw.id, q.id, { page, note }))

  /** Hand corrections: a page, a reframed crop, or a question that turns out
   *  not to come from the book. Saves immediately, no model call. */
  const handleAdjust = (q: HomeworkQuestion, patch: Parameters<typeof api.adjustQuestion>[2]) =>
    hw &&
    api
      .adjustQuestion(hw.id, q.id, patch)
      .then((fresh) => setQuestions((qs) => upsertQuestion(qs, normalizeQuestion(fresh))))
      .catch((e: Error) => toast.error(e.message))

  if (loading) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] min-h-96">
        <WorkspaceSkeleton />
      </div>
    )
  }
  if (!hw || missing) {
    return (
      <div className="h-[calc(100dvh-3.5rem)] min-h-96">
        <QuietMissing />
      </div>
    )
  }

  const generating = hw.status === 'generating'
  // Anything being worked right now is a task, so "busy" is simply whether
  // this assignment has one in flight.
  const workingId = questionTasks.find((t) => t.status === 'running')?.questionId ?? null
  const busy = generating || questionTasks.some((t) => t.status === 'queued' || t.status === 'running')
  const activityNote =
    questionTasks
      .find((t) => t.status === 'running')
      ?.phases.find((ph) => ph.status === 'running')?.note ?? null
  const questionCount = questions.length
  const selected = questions.find((q) => q.id === selectedId) ?? null

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] min-h-96 flex-col">
      <h1 className="sr-only">{hw.title}</h1>

      <header className="shrink-0 space-y-2 border-b px-3 pt-3 pb-3 md:px-6">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon-sm"
            asChild
            aria-label="Back to homework"
            className="shrink-0"
          >
            <Link to="/homework">
              <ArrowLeft />
            </Link>
          </Button>
          {renaming ? (
            <Input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename()
                else if (e.key === 'Escape') setRenaming(false)
              }}
              onBlur={commitRename}
              aria-label="Rename homework"
              className="h-8 min-w-0 flex-1 text-sm"
            />
          ) : (
            <button
              type="button"
              onClick={() => {
                setTitleDraft(hw.title)
                setRenaming(true)
              }}
              aria-label="Rename homework"
              title={hw.title}
              className="group/rename flex min-w-0 flex-1 items-center gap-2 rounded-lg px-2 py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 hover:bg-muted/60"
            >
              <span className="min-w-0 truncate font-heading text-lg leading-tight font-medium">
                {hw.title}
              </span>
              <Pencil
                aria-hidden
                className="size-4 shrink-0 text-muted-foreground/60 transition-opacity group-hover/rename:opacity-100 sm:opacity-0"
              />
            </button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className={cn('shrink-0', hw.turnedIn && 'text-success')}
            aria-pressed={hw.turnedIn}
            disabled={generating}
            onClick={() =>
              api
                .updateHomework(hw.id, { turnedIn: !hw.turnedIn })
                .then(() => refreshDetail())
                .catch((e: Error) => toast.error(e.message))
            }
          >
            <CircleCheck data-icon="inline-start" className={cn(hw.turnedIn && 'text-success')} />
            <span>{hw.turnedIn ? 'Turned in' : 'Mark turned in'}</span>
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            className="shrink-0 text-muted-foreground hover:text-destructive"
            aria-label="Delete homework"
            onClick={() => setConfirmDelete(true)}
          >
            <Trash2 />
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pl-1">
          <span className="flex min-w-0 max-w-full items-center gap-2 text-xs text-muted-foreground">
            <MiniCover hue={coverHueFromSha(hw.bookSha256)} className="size-4 rounded-full" />
            <span className="min-w-0 truncate" title={hw.bookTitle}>
              {hw.bookTitle}
            </span>
          </span>
          <DueEditor hw={hw} onSaved={refreshDetail} />
          <span className="font-mono text-xs text-muted-foreground">
            {questionCount} {questionCount === 1 ? 'question' : 'questions'}
          </span>
        </div>
      </header>

      <Tabs
        value={tab}
        onValueChange={setTab}
        className="flex min-h-0 flex-1 flex-col gap-0 data-horizontal:flex-col"
      >
        <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2 md:px-6">
          <TabsList>
            <TabsTrigger value="guide">Guide</TabsTrigger>
            <TabsTrigger value="pdf">Template PDF</TabsTrigger>
          </TabsList>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" role="status">
            {activityNote}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            disabled={generating || questionCount === 0}
            onClick={() => downloadHomeworkPdf(hw.id)}
          >
            <Download data-icon="inline-start" />
            Download
          </Button>
        </div>

        {/* Outline left, the question you are working on in the middle, the
            tutor on the right. One conversation for the whole assignment
            that follows the selection around. */}
        <TabsContent
          value="guide"
          className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[16rem_minmax(0,1fr)_22rem] xl:grid-cols-[18rem_minmax(0,1fr)_26rem]"
        >
          <div className="hidden min-h-0 flex-col overflow-y-auto border-r lg:flex">
            {questionCount > 0 ? (
              <QuestionOutline
                questions={questions}
                selectedId={selectedId}
                busy={busy}
                onSelect={setSelectedId}
                onMove={handleMove}
                onRemove={handleRemove}
                taskFor={taskForQuestion}
                onAdd={() => setAdding(true)}
              />
            ) : (
              <p className="px-4 py-6 text-xs text-muted-foreground">
                {generating ? 'Questions appear as they are found.' : 'No questions yet.'}
              </p>
            )}
            {task && (generating || task.status === 'failed' || task.status === 'paused') ? (
              <div className="border-t p-3">
                <GenerationProgress task={task} />
              </div>
            ) : null}
          </div>

          <div className="min-h-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl space-y-4 px-4 py-5 md:px-6">
              {/* Small screens have no sidebar, so progress rides here. */}
              {task && (generating || task.status === 'failed' || task.status === 'paused') ? (
                <div className="lg:hidden">
                  <GenerationProgress task={task} />
                </div>
              ) : null}
              {hw.status === 'ready' && questionCount === 0 && (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <p className="font-heading text-lg">No questions on this assignment.</p>
                  <p className="max-w-prose text-sm text-muted-foreground">
                    Add one and it gets found in the book and written up.
                  </p>
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => setAdding(true)}>
                    <Plus data-icon="inline-start" />
                    Add question
                  </Button>
                </div>
              )}
              {questionCount > 0 && (
                <div className="flex items-center gap-2 lg:hidden">
                  <QuestionPicker
                    questions={questions}
                    selectedId={selectedId}
                    onSelect={setSelectedId}
                  />
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Add question"
                    disabled={busy}
                    onClick={() => setAdding(true)}
                  >
                    <Plus />
                  </Button>
                </div>
              )}
              {selected ? (
                <HomeworkQuestionCard
                  key={selected.id}
                  hw={hw}
                  q={selected}
                  n={selected.position}
                  bookExists={bookExists}
                  busy={busy}
                  onRedo={() => handleRedo(selected)}
                  onRelocate={(page, note) => handleRelocate(selected, page, note)}
                  onAdjust={(patch) => handleAdjust(selected, patch)}
                />
              ) : null}
            </div>
          </div>

          <div className="hidden min-h-0 border-l lg:block">
            <HomeworkChatPanel
              hw={hw}
              question={selected}
              questions={questions}
              disabled={generating}
              onQuestionChanged={(q) => setQuestions((qs) => upsertQuestion(qs, q))}
              onRewrite={(questionId) => {
                const q = questions.find((x) => x.id === questionId)
                if (q) handleRedo(q)
              }}
              rewriting={workingId}
            />
          </div>
        </TabsContent>

        <TabsContent value="pdf" className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl space-y-8 px-4 py-6 md:px-8">
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
                <span className="text-xs font-medium">Print layout</span>
                <PrintScaleSelect
                  label="Question size"
                  value={hw.questionScale}
                  options={[50, 60, 75, 90, 100]}
                  onSave={(v) => savePrintScales({ questionScale: v })}
                />
                <PrintScaleSelect
                  label="Figure size"
                  value={hw.figureScale}
                  options={[50, 75, 100, 125, 150, 200]}
                  onSave={(v) => savePrintScales({ figureScale: v })}
                />
                <span className="text-xs text-muted-foreground">
                  Bigger figures leave less room to work.
                </span>
              </div>
              <p className="text-center text-xs text-muted-foreground">
                Letter · one question per sheet · updates the moment questions change
              </p>
            </div>
            {generating ? (
              <Skeleton className="mx-auto aspect-[17/22] w-full max-w-[34rem] rounded-md" />
            ) : questionCount === 0 ? (
              <p className="py-16 text-center text-sm text-muted-foreground">
                Sheets appear once the assignment has questions.
              </p>
            ) : (
              questions.map((q, i) => (
                <HomeworkSheet
                  key={q.id}
                  hw={hw}
                  questions={questions}
                  q={q}
                  n={i + 1}
                  isFirst={i === 0}
                />
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>

      <AddQuestionDialog open={adding} onOpenChange={setAdding} busy={busy} onAdd={handleAdd} />

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Delete homework?</DialogTitle>
            <DialogDescription>
              “{hw.title}” and its {questionCount} {questionCount === 1 ? 'question' : 'questions'}{' '}
              will be removed. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                api
                  .deleteHomework(hw.id)
                  .then(() => navigate('/homework'))
                  .catch((e: Error) => toast.error(e.message))
              }}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
