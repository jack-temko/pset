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
        'flex h-row w-full items-center justify-center gap-1 text-xs text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted/50 hover:text-foreground motion-reduce:transition-none',
        className,
      )}
    >
      {open ? 'Show fewer' : `Show all ${total}`}
      <Chevron aria-hidden className="size-4" />
    </button>
  )
}
