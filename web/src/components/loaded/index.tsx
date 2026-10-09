import { useEffect, useState, type ReactNode } from 'react'

import { GRACE_MS } from '@/lib/settled'
import { cn } from '@/lib/utils'

/** The part of a TanStack query result `Loaded` reads. */
type Query<T> = { data: T | undefined; isPending: boolean; isError: boolean }

/**
 * The one way anything that waits on data is drawn. While the query is
 * pending it holds the `skeleton`'s space from the first frame (invisible
 * for the first GRACE_MS, so a quick answer never blinks, then shimmering);
 * when the data arrives, `children` replaces it in the same box and fades
 * in. Data that was there at the first render (cached) shows at once, with
 * no fade. A failed query is one line of muted destructive text.
 *
 * `className` goes on the one element, so the skeleton and the content
 * share its layout (a `space-y-4` stack, a grid).
 */
export function Loaded<T>({
  query,
  skeleton,
  children,
  className,
}: {
  query: Query<T>
  skeleton: ReactNode
  children: (data: T) => ReactNode
  className?: string
}) {
  const pending = query.isPending
  // Whether this box has ever waited: only content that replaces a skeleton fades.
  const [waited, setWaited] = useState(pending)
  if (pending && !waited) setWaited(true)
  const [aged, setAged] = useState(false)
  useEffect(() => {
    if (!pending) return
    const t = setTimeout(() => setAged(true), GRACE_MS)
    return () => clearTimeout(t)
  }, [pending])

  if (pending) {
    return (
      <div aria-busy className={cn(className, !aged && 'invisible')}>
        {skeleton}
      </div>
    )
  }
  if (query.isError) {
    return <p className="text-sm text-destructive/80">Couldn't load this. Close it and try again.</p>
  }
  return <div className={cn(className, waited && 'fade-in')}>{children(query.data as T)}</div>
}
