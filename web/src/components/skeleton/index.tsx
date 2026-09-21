import { cn } from '@/lib/utils'

/**
 * The shape of content that hasn't arrived yet, at the size it will be,
 * so nothing moves when it does. A `muted` block, and nothing else.
 *
 * It does not pulse. The system allows one loop, the Spinner, because a
 * repeating motion means "waiting"; a page of pulsing blocks would say it
 * a dozen times at once. The skeleton's job is to hold the space.
 *
 * Inline by default, so a text-sized skeleton sits inside a line box and
 * the row keeps its real line height. Pass `block` sizes for figures.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('inline-block rounded-sm bg-muted align-middle', className)}
    />
  )
}
