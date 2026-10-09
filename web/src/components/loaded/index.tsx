import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'

import { GRACE_MS } from '@/lib/settled'
import { cn } from '@/lib/utils'

/** Heights closer than this swap without a morph. */
const MORPH_SLACK_PX = 2

const reducedMotion = () => typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

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
 * When the content is not the skeleton's height (more than MORPH_SLACK_PX
 * off), the box morphs: its height eases from the skeleton's to the
 * content's over 200ms while the skeleton fades out and the content fades
 * in. A safety net, not a licence: the skeleton should match, and the jump
 * check still fails one that doesn't. Cached data and reduced motion get
 * neither the morph nor the fade.
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

  // The skeleton's height, kept while it is on screen: the morph starts there.
  const skeletonBox = useRef<HTMLDivElement>(null)
  const skeletonHeight = useRef(0)
  useLayoutEffect(() => {
    if (skeletonBox.current) skeletonHeight.current = skeletonBox.current.offsetHeight
  })

  // The morph: from the skeleton's height to the content's. `to` is set once
  // the content is measured, `go` a frame later so the start height is painted.
  const [morph, setMorph] = useState<{ from: number; to?: number; go?: boolean } | null>(null)
  const [wasPending, setWasPending] = useState(pending)
  if (wasPending !== pending) {
    setWasPending(pending)
    if (!pending && waited && !query.isError && !reducedMotion()) setMorph({ from: skeletonHeight.current })
  }
  const outer = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!morph || morph.to !== undefined || !content.current) return
    const to = content.current.offsetHeight
    setMorph(Math.abs(to - morph.from) <= MORPH_SLACK_PX ? null : { ...morph, to })
  }, [morph])
  const measured = morph?.to !== undefined
  useEffect(() => {
    if (!measured) return
    const id = requestAnimationFrame(() => {
      void outer.current?.offsetHeight // flush the start height before changing it
      setMorph((m) => m && { ...m, go: true })
    })
    return () => cancelAnimationFrame(id)
  }, [measured])
  const going = !!morph?.go
  useEffect(() => {
    if (!going) return
    const t = setTimeout(() => setMorph(null), 260)
    return () => clearTimeout(t)
  }, [going])

  if (pending) {
    return (
      <div ref={skeletonBox} aria-busy className={cn(className, !aged && 'invisible')}>
        {skeleton}
      </div>
    )
  }
  if (query.isError) {
    return <p className="text-sm text-destructive/80">Couldn't load this. Close it and try again.</p>
  }
  const fade = waited && !reducedMotion()
  const rendered = children(query.data as T)
  if (!morph) return <div className={cn(className, fade && 'fade-in')}>{rendered}</div>
  return (
    <div
      ref={outer}
      data-morph
      className="relative overflow-hidden"
      style={{
        height: morph.go ? morph.to : morph.from,
        transition: morph.go ? 'height 200ms ease-out' : undefined,
      }}
      onTransitionEnd={(e) => e.propertyName === 'height' && setMorph(null)}
    >
      <div ref={content} className={cn(className, 'fade-in')}>
        {rendered}
      </div>
      <div
        aria-hidden
        className={cn(className, 'pointer-events-none absolute inset-x-0 top-0 transition-opacity duration-150 ease-out', morph.go && 'opacity-0')}
      >
        {skeleton}
      </div>
    </div>
  )
}
