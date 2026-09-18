import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarClock,
  CircleCheck,
  ListTodo,
  LoaderCircle,
  NotebookPen,
  Plus,
  Search,
} from 'lucide-react'

import { CoverDot } from '@/components/book-chip'
import { TaskSectionLabel } from '@/components/task-row'
import { useTasks } from '@/lib/events'
import { PageShell } from '@/components/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useRefetchOnHomeworkSettle, useHomeworks } from '@/hooks/use-homeworks'
import { coverHueFromSha } from '@/lib/covers'
import { relTime } from '@/lib/format'
import { dueInfo, dueSoon, type DueTone } from '@/lib/homework'
import type { Homework } from '@/lib/types'
import { cn } from '@/lib/utils'
import { NewHomeworkDialog } from './new-homework-dialog'

const dueToneClasses: Record<DueTone, string> = {
  overdue: 'border-destructive/40 bg-destructive/10 text-destructive',
  today: 'border-warning/50 bg-warning/10 text-warning',
  soon: 'border-primary/30 bg-primary/10 text-primary',
  later: 'border-border bg-muted/40 text-muted-foreground',
  none: 'border-border bg-muted/40 text-muted-foreground',
}

function DueChip({ due, className }: { due: string | null; className?: string }) {
  const info = dueInfo(due)
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-1 text-[0.65rem] font-medium whitespace-nowrap',
        dueToneClasses[info.tone],
        className,
      )}
    >
      <CalendarClock aria-hidden className="size-3" />
      {info.label}
    </span>
  )
}

function BookLine({ hw }: { hw: Homework }) {
  return (
    <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
      <CoverDot hue={coverHueFromSha(hw.bookSha256)} className="size-3 shrink-0" />
      <span className="min-w-0 truncate" title={hw.bookTitle}>
        {hw.bookTitle}
      </span>
    </span>
  )
}

/** The urgent strip: ready, unturned homework due within 7 days, overdue
 *  first. Disappears entirely when nothing qualifies. */
function DueSoonStrip({ homeworks }: { homeworks: Homework[] }) {
  const soon = dueSoon(homeworks)
  if (soon.length === 0) return null
  return (
    <section className="space-y-3">
      <TaskSectionLabel label="Due soon" count={soon.length} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {soon.map((hw) => (
          <Link
            key={hw.id}
            to={`/homework/${hw.id}`}
            className="block min-w-0 rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <Card className="h-full gap-2 p-4 transition-colors hover:bg-muted/40">
              <CardContent className="space-y-2 p-0">
                <div className="flex items-start justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium" title={hw.title}>
                    {hw.title}
                  </span>
                  <DueChip due={hw.dueDate} />
                </div>
                <BookLine hw={hw} />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}

/**
 * What state an assignment is in, counted rather than named.
 *
 * Unlike a book, an assignment is a list: seventeen of eighteen walkthroughs
 * is genuinely useful, so the row says how far along it is instead of
 * treating anything short of finished as broken.
 */
function HomeworkStateBadge({ hw }: { hw: Homework }) {
  const { taskForHomework } = useTasks()
  const task = taskForHomework(hw.id)
  const walk = task?.phases.find((p) => p.key === 'walkthroughs')

  if (task && (task.status === 'running' || task.status === 'queued')) {
    return (
      <Badge variant="secondary" className="shrink-0 gap-1">
        <LoaderCircle className="animate-spin" />
        {walk && walk.total > 0 ? `${walk.done} of ${walk.total} walkthroughs` : 'Starting…'}
      </Badge>
    )
  }
  if (task && task.status === 'failed') {
    return (
      <Badge variant="destructive" className="shrink-0">
        Needs you
      </Badge>
    )
  }
  return null
}

function AssignmentRow({ hw }: { hw: Homework }) {
  return (
    <li>
      <Link
        to={`/homework/${hw.id}`}
        className="flex items-center gap-3 rounded-xl px-3 py-3 outline-none transition-colors hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-center gap-2">
            <span className="min-w-0 truncate text-sm font-medium" title={hw.title}>
              {hw.title}
            </span>
            <HomeworkStateBadge hw={hw} />
          </span>
          <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            {hw.turnedIn && <CircleCheck aria-label="Turned in" className="size-4 shrink-0 text-success" />}
            <BookLine hw={hw} />
            <span aria-hidden className="shrink-0">
              ·
            </span>
            <span className="shrink-0 font-mono">{hw.questionCount}</span>
            <span className="shrink-0">{hw.questionCount === 1 ? 'question' : 'questions'}</span>
            <span aria-hidden className="shrink-0">
              ·
            </span>
            <span className="shrink-0 whitespace-nowrap">{relTime(hw.updatedAt)}</span>
          </span>
        </span>
        <DueChip due={hw.dueDate} />
      </Link>
    </li>
  )
}

type StatusFilter = 'all' | 'open' | 'turned'

const statusFilters: [StatusFilter, string][] = [
  ['all', 'All'],
  ['open', 'Open'],
  ['turned', 'Turned in'],
]

function DashboardSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-20 rounded-xl" />
        </div>
      </div>
      <div className="space-y-3">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

export function Homework() {
  const { homeworks, loading, error, refetch } = useHomeworks()
  useRefetchOnHomeworkSettle(refetch)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [dialogOpen, setDialogOpen] = useState(false)

  const list = useMemo(() => homeworks ?? [], [homeworks])
  // One door per action (design/ui-rules.md): when the empty card carries
  // its own New homework button, the header action stands down.
  const empty = !loading && !error && list.length === 0

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return list
      .filter((h) => (status === 'all' ? true : status === 'turned' ? h.turnedIn : !h.turnedIn))
      .filter((h) => !q || [h.title, h.bookTitle].some((v) => v.toLowerCase().includes(q)))
      .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
  }, [list, query, status])

  return (
    <PageShell
      title="Homework"
      description="Paste an assignment and get a walkthrough plus a template to hand in."
      actions={
        !empty && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus data-icon="inline-start" />
            New homework
          </Button>
        )
      }
    >
      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Badge variant="destructive">Error</Badge>
            <p className="font-heading text-lg">Couldn’t load your homework.</p>
            <p className="max-w-prose text-sm text-muted-foreground">{error.message}</p>
            <Button variant="outline" className="mt-2" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <NotebookPen className="size-5" />
            </div>
            <p className="font-heading text-lg">No homework yet.</p>
            <p className="max-w-prose text-sm text-muted-foreground">
              Paste your first assignment and every question in it gets a walkthrough and a page of
              working space.
            </p>
            <Button className="mt-2" onClick={() => setDialogOpen(true)}>
              <Plus data-icon="inline-start" />
              New homework
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <DueSoonStrip homeworks={list} />

          <section className="space-y-3">
            <TaskSectionLabel label="All homework" count={list.length} />
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search title or book…"
                  className="pl-9"
                  aria-label="Search homework"
                />
              </div>
              <div
                role="group"
                aria-label="Filter by status"
                className="flex shrink-0 items-center gap-1 rounded-lg bg-muted p-[3px]"
              >
                {statusFilters.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatus(value)}
                    aria-pressed={status === value}
                    className={cn(
                      'rounded-md px-3 py-1 text-xs font-medium whitespace-nowrap transition-colors',
                      status === value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
                  <ListTodo className="size-5 text-muted-foreground" />
                  <p className="font-heading text-base">Nothing matches.</p>
                  <p className="text-sm text-muted-foreground">
                    Try a different search, or clear the filters.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-1"
                    onClick={() => {
                      setQuery('')
                      setStatus('all')
                    }}
                  >
                    Clear filters
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ul className="divide-y rounded-xl border bg-card">
                {filtered.map((hw) => (
                  <AssignmentRow key={hw.id} hw={hw} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <NewHomeworkDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </PageShell>
  )
}
