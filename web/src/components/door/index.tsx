import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * The way through truncated content, everywhere: a full-width quiet row at
 * the bottom of the thing it extends — the last row of a Box, or the row
 * under a grid. "Show all N" opens in place; "Show fewer" closes.
 *
 * Nothing in a document page scrolls by itself, so every long list ends in
 * one of these instead of a scrollbar.
 */
export function Door({
  open,
  total,
  onToggle,
  className,
}: {
  open: boolean
  /** How many there are in all — the door names what it opens onto. */
  total: number
  onToggle: () => void
  className?: string
}) {
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      className={cn(
        'group flex h-row w-full items-center justify-center text-xs text-muted-foreground hover:text-foreground',
        className,
      )}
    >
      {/* The wash hugs the words rather than filling the row — a bar the
          width of a whole grid darkening at once reads as a giant button. */}
      <span className="flex h-control-sm items-center gap-1 rounded-md px-3 transition-colors duration-150 ease-out group-hover:bg-muted/50 motion-reduce:transition-none">
        {open ? 'Show fewer' : `Show all ${total}`}
        <Chevron aria-hidden className="size-4" />
      </span>
    </button>
  )
}
