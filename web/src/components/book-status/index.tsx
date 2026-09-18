import { CircleAlert } from 'lucide-react'

import type { BookState } from '@/lib/sample'
import { cn } from '@/lib/utils'

/**
 * What is wrong with a book, or nothing at all.
 *
 * Ready is the normal state and says nothing — a shelf of ready books
 * should be quiet. This renders only when a book can't be used yet, so
 * anything it draws is worth reading.
 */
export function BookStatus({ state, className }: { state: BookState; className?: string }) {
  if (state.kind === 'ready') return null

  if (state.kind === 'failed') {
    return (
      <p className={cn('flex items-start gap-2 text-xs text-destructive', className)}>
        <CircleAlert className="size-4 shrink-0" />
        <span className="min-w-0">{state.reason}</span>
      </p>
    )
  }

  const pct = Math.round((state.done / Math.max(state.total, 1)) * 100)
  return (
    <div className={cn('space-y-2', className)}>
      <p className="text-xs text-warning">
        Preparing · {state.done} of {state.total}
      </p>
      <div
        className="h-1 overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Preparing this book"
      >
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Whether a book can be opened at all. A book that isn't ready is visible
 *  everywhere and usable nowhere. */
export function isReady(state: BookState): boolean {
  return state.kind === 'ready'
}
