import { CircleAlert } from 'lucide-react'

import { Spinner } from '@/components/spinner'
import { IMPORT_PHASES, type BookState } from '@/lib/sample'
import { cn } from '@/lib/utils'

/**
 * What is wrong with a book, or what is happening to it — or nothing at
 * all.
 *
 * Ready is the normal state and says nothing: a shelf of ready books
 * should be quiet. Everything this draws is therefore worth reading.
 *
 * The engine names its own phases ("Read the pages"), and so does this —
 * a student should see the same words the log does. Where the phase can
 * count, it counts and fills a bar; where it can't, it spins. A number
 * you can watch is worth more than a shape that turns, so the spinner is
 * the fallback and never the default.
 */
export function BookStatus({
  state,
  onRetry,
  onDismiss,
  className,
}: {
  state: BookState
  onRetry?: () => void
  onDismiss?: () => void
  className?: string
}) {
  if (state.kind === 'ready') return null

  if (state.kind === 'failed') {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="flex items-start gap-2 text-xs text-destructive">
          {/* A line box the height of the text's line-height, so the icon
              centres on the FIRST line and stays there when the reason wraps. */}
          <span className="flex h-5 shrink-0 items-center">
            <CircleAlert className="size-4" />
          </span>
          <span className="min-w-0">{state.reason}</span>
        </p>
        {(onRetry || onDismiss) && (
          <p className="flex gap-3 text-xs">
            {onRetry && <TileAction onClick={onRetry}>Try again</TileAction>}
            {onDismiss && <TileAction onClick={onDismiss}>Dismiss</TileAction>}
          </p>
        )}
      </div>
    )
  }

  // Queued gets no spinner. Nothing is happening to this book yet — the
  // runner prepares one at a time — and a turning shape would say
  // otherwise for the next forty minutes.
  if (state.kind === 'queued') {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-xs text-muted-foreground">Queued</p>
        {onDismiss && (
          <p className="text-xs">
            <TileAction onClick={onDismiss}>Cancel</TileAction>
          </p>
        )}
      </div>
    )
  }

  const name = IMPORT_PHASES[state.phase]
  const counted = state.total !== undefined && state.done !== undefined
  const pct = counted ? Math.round((state.done! / Math.max(state.total!, 1)) * 100) : 0

  return (
    <div className={cn('space-y-2', className)}>
      <p className="flex items-center gap-2 text-xs text-warning">
        {!counted && <Spinner className="size-3" label={name} />}
        <span className="min-w-0 truncate">
          {name}
          {counted && ` · ${state.done} of ${state.total}`}
        </span>
      </p>
      {counted && (
        <div
          className="h-1 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={name}
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
      {onDismiss && (
        <p className="text-xs">
          <TileAction onClick={onDismiss}>Stop</TileAction>
        </p>
      )}
    </div>
  )
}

/** A quiet inline action under a tile. Too small and too rare for a
 *  Button, and it must not compete with the cover above it. */
function TileAction({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="cursor-pointer text-muted-foreground underline underline-offset-2 transition-colors duration-150 ease-out hover:text-foreground motion-reduce:transition-none"
    >
      {children}
    </button>
  )
}

/** Whether a book can be opened at all. A book that isn't ready is visible
 *  everywhere and usable nowhere. */
export function isReady(state: BookState): boolean {
  return state.kind === 'ready'
}
