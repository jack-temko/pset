import { Check, CircleAlert, CircleSlash, Loader2 } from 'lucide-react'

import { RemoveBookButton } from '@/components/remove-book-button'
import { TaskProgress } from '@/components/task-progress'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useTasks } from '@/lib/events'
import { bookMissingLine, isActiveTask, taskActionLabel, taskStateLabel } from '@/lib/tasks'
import type { Book } from '@/lib/types'
import { useState } from 'react'

/**
 * A book is Ready, or it is Not ready — here's why, here's the button.
 *
 * Paused, Couldn't prepare and Needs you are the same card with a different
 * sentence and a different door. Neither stopping nor failing throws work
 * away, so the only deleting action is Remove book, which is always offered
 * alongside whatever else there is to do.
 */
export function BookReadiness({ book, onChanged }: { book: Book; onChanged?: () => void }) {
  const { stop, retry } = useTasks()
  const [busy, setBusy] = useState(false)
  const task = book.task

  if (book.ready) {
    return (
      <p className="flex items-center gap-2 text-sm text-success">
        <Check className="size-4 shrink-0" />
        Ready to read, ask about, and set homework from.
      </p>
    )
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    await fn()
    setBusy(false)
    onChanged?.()
  }

  const permanent = task?.status === 'failed' && task.failKind === 'permanent'
  const action = task ? taskActionLabel(task) : null

  return (
    <Card className="border-warning/40">
      <CardContent className="space-y-3 pt-6">
        <div className="flex items-start gap-3">
          <StateIcon permanent={permanent} running={task ? isActiveTask(task) : false} />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              Not ready{task ? ` · ${taskStateLabel(task)}` : ''}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {task?.error ?? bookMissingLine(book) ?? 'This book isn’t finished yet.'}
            </p>
          </div>
        </div>

        {task && task.status === 'running' ? <TaskProgress task={task} showEta /> : null}

        <FailedPages book={book} />

        <div className="flex flex-wrap items-center gap-2">
          {task && isActiveTask(task) ? (
            <Button variant="outline" size="sm" disabled={busy} onClick={() => run(() => stop(task.id))}>
              Stop
            </Button>
          ) : null}
          {task && action ? (
            <Button size="sm" disabled={busy} onClick={() => run(() => retry(task.id))}>
              {action}
            </Button>
          ) : null}
          <RemoveBookButton bookId={book.sha256} title={book.title} />
        </div>
      </CardContent>
    </Card>
  )
}

function StateIcon({ permanent, running }: { permanent: boolean; running: boolean }) {
  if (running) return <Loader2 className="mt-1 size-4 shrink-0 animate-spin text-primary" />
  if (permanent) return <CircleSlash className="mt-1 size-4 shrink-0 text-destructive" />
  return <CircleAlert className="mt-1 size-4 shrink-0 text-warning" />
}

/**
 * The pages a tool failed to read, named. A blank page never appears here —
 * the tools succeeded and the page genuinely has no text, so it is a
 * finished page and never blocks the book.
 */
function FailedPages({ book }: { book: Book }) {
  if (book.failedPages.length === 0) return null
  const shown = book.failedPages.slice(0, 6)
  const rest = book.failedPages.length - shown.length
  return (
    <div className="rounded-md bg-muted/50 p-3 text-xs">
      <p className="text-muted-foreground">
        {book.failedPages.length === 1
          ? 'One page couldn’t be read:'
          : `${book.failedPages.length} pages couldn’t be read:`}
      </p>
      <ul className="mt-1 space-y-1">
        {shown.map((p) => (
          <li key={p.page} className="flex gap-2">
            <span className="font-mono text-muted-foreground tabular-nums">p.{p.page}</span>
            <span className="min-w-0 truncate text-muted-foreground">{p.error}</span>
          </li>
        ))}
      </ul>
      {rest > 0 ? <p className="mt-1 text-muted-foreground">and {rest} more</p> : null}
    </div>
  )
}
