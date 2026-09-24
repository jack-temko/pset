import { Spinner } from '@/components/spinner'
import { bookStep, IMPORT_PHASES, type BookState } from '@/api/library'
import { useTimeLeft } from '@/lib/eta'
import { useSettled } from '@/lib/settled'
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
 * Beside the phase, the time left on it, in rounded words (lib/eta): from
 * the pace of a phase that counts, from past imports for one that can't.
 * Until there's an honest estimate, nothing.
 *
 * Queued can be over in a moment (a book going from one of its steps to
 * the next), so it shows only once it has lasted: until then the line
 * before it stays, or a blank of the same height. `since` is when the book
 * last changed, its `updatedAt`.
 *
 * It carries no controls: the row it sits in owns those.
 */
export function BookStatus({
  bookId,
  state: now,
  since,
  className,
}: {
  bookId: string
  state: BookState
  since?: string
  className?: string
}) {
  const state = useSettled(now, now.kind === 'queued' && since ? Date.parse(since) : null)
  // The estimate follows the book's real state, not the settled one on
  // screen, so a brief step still counts toward its pace.
  const left = useTimeLeft(`book:${bookId}`, bookStep(now), now)
  if (!state) return <span className={className}>{'\u00a0'}</span>
  if (state.kind === 'ready') return null

  if (state.kind === 'failed') {
    return <span className={cn('text-destructive', className)}>{state.reason}</span>
  }

  // Queued gets no spinner. Nothing is happening to this book yet (the
  // runner prepares one at a time) and a turning shape would say
  // otherwise for the next forty minutes. A scan that stepped aside for
  // another book keeps the count it reached, still and without a bar.
  if (state.kind === 'queued') {
    if (state.phase === 'read' && state.done !== undefined && state.total !== undefined) {
      return (
        <span className={className}>
          Queued ·{' '}
          <span className="tabular-nums">
            {state.done} of {state.total}
          </span>{' '}
          pages read
        </span>
      )
    }
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
        {left && ` · ${left}`}
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
