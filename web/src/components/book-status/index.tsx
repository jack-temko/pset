import { Spinner } from '@/components/spinner'
import { IMPORT_PHASES, type BookState } from '@/api/library'
import { cn } from '@/lib/utils'

/**
 * What is happening to a book that isn't ready yet, as one line, or
 * nothing at all.
 *
 * Ready is the normal state and says nothing. Everything this draws is
 * therefore worth reading.
 *
 * The engine names its own phases ("Read the pages"), and so does this:
 * a student should see the same words the log does. Where the phase can
 * count, it counts and fills a bar; where it can't, it spins. A number
 * you can watch is worth more than a shape that turns, so the spinner is
 * the fallback and never the default.
 *
 * It carries no controls: the row it sits in owns those.
 */
export function BookStatus({ state, className }: { state: BookState; className?: string }) {
  if (state.kind === 'ready') return null

  if (state.kind === 'failed') {
    return <span className={cn('text-destructive', className)}>{state.reason}</span>
  }

  // Queued gets no spinner. Nothing is happening to this book yet (the
  // runner prepares one at a time) and a turning shape would say
  // otherwise for the next forty minutes.
  if (state.kind === 'queued') {
    return <span className={className}>Queued</span>
  }

  const name = state.phase ? IMPORT_PHASES[state.phase] : 'Preparing'
  const counted = state.total !== undefined && state.done !== undefined
  const pct = counted ? Math.round((state.done! / Math.max(state.total!, 1)) * 100) : 0

  return (
    <span className={cn('flex items-center gap-3', className)}>
      {!counted && <Spinner className="size-3 text-warning" label={name} />}
      <span className="shrink-0">
        {name}
        {counted && (
          <>
            {' · '}
            <span className="tabular-nums">
              {state.done} of {state.total}
            </span>
          </>
        )}
      </span>
      {counted && (
        <span
          className="block h-1 w-40 shrink-0 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={name}
        >
          <span
            className="block h-full rounded-full bg-primary transition-[width] duration-150 ease-out motion-reduce:transition-none"
            style={{ width: `${pct}%` }}
          />
        </span>
      )}
    </span>
  )
}

/** Whether a book can be opened at all. A book that isn't ready is visible
 *  in its import row and usable nowhere. */
export function isReady(state: BookState): boolean {
  return state.kind === 'ready'
}
