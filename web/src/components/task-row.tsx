import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Check,
  CircleAlert,
  CircleDashed,
  CirclePause,
  CircleSlash,
  Loader2,
  X,
} from 'lucide-react'

import { RemoveBookButton } from '@/components/remove-book-button'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { useTasks } from '@/lib/events'
import {
  formatEta,
  isActiveTask,
  taskActionLabel,
  taskDurationLine,
  taskReason,
  taskStateLabel,
} from '@/lib/tasks'
import type { Phase, Task } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * One task on /tasks: its state, why it is in that state, its whole plan
 * inline, and the doors out of it.
 *
 * The plan is always visible. There are only two kinds of task and at most
 * four phases each, so hiding them behind a chevron would trade a click for
 * nothing — and the plan is the thing you came here to read.
 */
export function TaskRow({ task }: { task: Task }) {
  const { stop, retry } = useTasks()
  const [busy, setBusy] = useState(false)
  const reason = taskReason(task)
  const action = taskActionLabel(task)
  const duration = taskDurationLine(task)

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn()
    setBusy(false)
  }

  return (
    <li className="space-y-3 p-4">
      <div className="flex items-start gap-3">
        <TaskStatusIcon task={task} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              {taskStateLabel(task)}
            </span>
            <TitleLink task={task} />
          </div>
          {reason ? <p className="mt-1 text-sm text-muted-foreground">{reason}</p> : null}
          {duration && task.status === 'done' ? (
            <p className="mt-1 text-xs text-muted-foreground">Took {duration}</p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isActiveTask(task) ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => stop(task.id))}>
              Stop
            </Button>
          ) : null}
          {action ? (
            <Button size="sm" disabled={busy} onClick={() => run(() => retry(task.id))}>
              {action}
            </Button>
          ) : null}
          {task.bookId && task.status !== 'done' ? <RemoveBookButton bookId={task.bookId} /> : null}
        </div>
      </div>

      <PhaseList phases={task.phases} />
    </li>
  )
}

function TitleLink({ task }: { task: Task }) {
  const to =
    task.kind === 'homework' && task.homeworkId
      ? `/homework/${task.homeworkId}`
      : task.bookId
        ? `/library/${task.bookId}`
        : null
  if (!to) return <span className="truncate font-medium">{task.title}</span>
  return (
    <Link to={to} className="truncate font-medium hover:underline">
      {task.title}
    </Link>
  )
}

function TaskStatusIcon({ task }: { task: Task }) {
  const className = 'mt-1 size-4 shrink-0'
  switch (task.status) {
    case 'running':
      return <Loader2 className={cn(className, 'animate-spin text-primary')} />
    case 'queued':
      return <CircleDashed className={cn(className, 'text-muted-foreground')} />
    case 'paused':
      return <CirclePause className={cn(className, 'text-muted-foreground')} />
    case 'failed':
      return task.failKind === 'permanent' ? (
        <CircleSlash className={cn(className, 'text-destructive')} />
      ) : (
        <CircleAlert className={cn(className, 'text-destructive')} />
      )
    case 'done':
      return <Check className={cn(className, 'text-success')} />
  }
}

/** The plan, inline. Every phase is named in the words a student reads. */
function PhaseList({ phases }: { phases: Phase[] }) {
  if (phases.length === 0) {
    return (
      <p className="pl-7 text-xs text-muted-foreground">
        This task finished before its plan was recorded.
      </p>
    )
  }
  return (
    <ol className="space-y-2 pl-7">
      {phases.map((phase) => {
        const message = phase.error ?? phase.note ?? ''
        return (
          <li key={phase.id} className="text-sm">
            <div className="flex items-center gap-2">
              <PhaseIcon phase={phase} />
              <span
                className={cn(
                  'min-w-0 truncate',
                  phase.status === 'waiting' && 'text-muted-foreground',
                  phase.status === 'failed' && 'text-destructive',
                )}
              >
                {phase.name}
              </span>
              {phase.status === 'running' && phase.total > 0 ? (
                <span className="ml-auto shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                  {phase.done}/{phase.total}
                </span>
              ) : null}
              {phase.status === 'running' && phase.etaSeconds ? (
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatEta(phase.etaSeconds)}
                </span>
              ) : null}
            </div>
            {phase.status === 'running' && phase.total > 0 ? (
              <Progress
                value={Math.min(100, (phase.done / phase.total) * 100)}
                className="mt-1 ml-5"
              />
            ) : null}
            {message && phase.status !== 'waiting' ? (
              <p
                className={cn(
                  'mt-1 text-xs',
                  phase.status === 'failed' ? 'text-destructive/80' : 'text-muted-foreground',
                )}
              >
                {message}
              </p>
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

function PhaseIcon({ phase }: { phase: Phase }) {
  const className = 'size-3 shrink-0'
  switch (phase.status) {
    case 'running':
      return <Loader2 className={cn(className, 'animate-spin text-primary')} />
    case 'done':
      return <Check className={cn(className, 'text-success')} />
    case 'failed':
      return <X className={cn(className, 'text-destructive')} />
    case 'waiting':
      return <CircleDashed className={cn(className, 'text-muted-foreground/50')} />
  }
}

export function TaskSectionLabel({ label, count }: { label: string; count: number }) {
  return (
    <h3 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
      {label} <span className="font-mono tabular-nums">({count})</span>
    </h3>
  )
}
