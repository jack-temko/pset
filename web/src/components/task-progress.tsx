import { LoaderCircle } from 'lucide-react'

import { Progress } from '@/components/ui/progress'
import { taskEtaLine, taskHeadline, taskProgress, taskReason, taskUnit } from '@/lib/tasks'
import type { Task } from '@/lib/types'
import { cn } from '@/lib/utils'

/**
 * A single task's live state, for the object it is building: the book page
 * and the homework workspace. It says what is happening and how far along,
 * and nothing about how the engine is doing it.
 */
export function TaskProgress({
  task,
  showEta = false,
  className,
}: {
  task: Task
  showEta?: boolean
  className?: string
}) {
  const progress = taskProgress(task)
  const eta = taskEtaLine(task)
  const reason = taskReason(task)

  if (task.status !== 'running') {
    return reason ? (
      <p
        className={cn(
          'text-xs',
          task.status === 'failed' ? 'text-destructive' : 'text-muted-foreground',
          className,
        )}
        role={task.status === 'failed' ? 'alert' : undefined}
      >
        {reason}
      </p>
    ) : null
  }

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-baseline justify-between gap-3 text-xs text-muted-foreground">
        <span className="min-w-0 truncate">{taskHeadline(task)}</span>
        <span className="flex shrink-0 items-baseline gap-2 font-mono">
          {progress ? (
            <span>
              {progress.done}/{progress.total} {taskUnit(task, progress.total)}
            </span>
          ) : null}
          {showEta && eta ? <span className="text-foreground/70">{eta}</span> : null}
        </span>
      </div>
      {progress ? (
        <Progress
          value={Math.min(100, (progress.done / progress.total) * 100)}
          aria-label={taskHeadline(task)}
        />
      ) : (
        <div className="h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full w-1/2 animate-pulse rounded-full bg-primary/60" />
        </div>
      )}
    </div>
  )
}

export function TaskSpinner({ className }: { className?: string }) {
  return <LoaderCircle className={cn('size-4 shrink-0 animate-spin text-primary', className)} />
}
