import { useEffect, useState, type ReactNode } from 'react'

import { GRACE_MS } from '@/lib/settled'
import { cn } from '@/lib/utils'

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** The part of a TanStack query result `Loaded` reads. */
type Query<T> = { data: T | undefined; isPending: boolean; isError: boolean }

/**
 * The one way anything that waits on data is drawn. While the query is
 * pending it holds the `skeleton`'s space from the first frame: invisible for
 * the first GRACE_MS, so a quick answer never blinks, then fading in over
 * 150ms and shimmering. When the data arrives after the skeleton showed, the
 * two crossfade in one grid cell (the content 0 to 1 on top, the skeleton 1
 * to 0 underneath, then it unmounts), so there is no frame where neither is
 * drawn. Data that arrives within the grace, or was cached at the first
 * render, shows at once with no fade. A failed query with nothing to show is
 * one line of muted destructive text (`errorText`). Reduced motion swaps
 * instantly.
 *
 * The tree never changes shape: one wrapper, one content element, and the
 * skeleton a layer that comes and goes, so the content never remounts and its
 * fade never replays.
 *
 * The skeleton must be the content's size: nothing here moves the box to make
 * up for one that isn't (a height animation was tried and dropped, it
 * jittered), and the jump check (`make jumps`) fails a skeleton off by more
 * than 2px.
 *
 * `className` goes on the skeleton and on the content, so both share its
 * layout (a `space-y-4` stack, a grid).
 */
export function Loaded<T>({
  query,
  skeleton,
  children,
  className,
  errorText = "Couldn't load this. Try again in a moment.",
}: {
  query: Query<T>
  skeleton: ReactNode
  children: (data: T) => ReactNode
  className?: string
  /** The line shown when the query failed and there is nothing to show. */
  errorText?: string
}) {
  const pending = query.isPending
  // The grace is per wait: it starts again when a new pending phase does.
  const [aged, setAged] = useState(false)
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setAged(true), GRACE_MS)
    return () => clearTimeout(t)
  }, [pending])

  // The skeleton stays under the content for the length of the crossfade,
  // but only if it was ever seen.
  const [wasPending, setWasPending] = useState(pending)
  const [swapping, setSwapping] = useState(false)
  if (wasPending !== pending) {
    setWasPending(pending)
    if (pending) {
      setAged(false)
      setSwapping(false)
    } else if (aged && !reducedMotion()) {
      setSwapping(true)
    }
  }
  useEffect(() => {
    if (!swapping) return
    const t = setTimeout(() => setSwapping(false), 170)
    return () => clearTimeout(t)
  }, [swapping])

  if (!pending && query.isError && query.data === undefined) {
    return (
      <p role="status" className="text-sm text-destructive/80">
        {errorText}
      </p>
    )
  }
  return (
    <div className="grid" aria-busy={pending || undefined}>
      {(pending || swapping) && (
        <div
          aria-hidden
          className={cn(
            className,
            '[grid-area:1/1]',
            pending ? ['transition-opacity duration-150 ease-out motion-reduce:transition-none', aged ? 'opacity-100' : 'opacity-0'] : 'fade-out pointer-events-none',
          )}
        >
          {skeleton}
        </div>
      )}
      <div className={cn(className, '[grid-area:1/1]', swapping && 'fade-in')}>{pending ? null : children(query.data as T)}</div>
    </div>
  )
}
