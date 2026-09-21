import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

/** The quiet pill both rows share: the button IS the pill, so the wash
 *  and the click target are the same shape. A bar the width of a whole
 *  grid darkening at once reads as a giant button, and a target wider
 *  than what highlights lies about it. */
const pill =
  'flex h-control-sm cursor-pointer items-center gap-1 rounded-md px-3 text-xs text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted/50 hover:text-foreground motion-reduce:transition-none [&_svg]:size-4'

/**
 * The way through truncated content, everywhere: a full-width quiet row at
 * the bottom of the thing it extends: the last row of a Box, or the row
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
  /** How many there are in all: the door names what it opens onto. */
  total: number
  onToggle: () => void
  className?: string
}) {
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <div className={cn('flex h-row items-center justify-center', className)}>
      <button type="button" onClick={onToggle} aria-expanded={open} className={pill}>
        {open ? 'Show fewer' : `Show all ${total}`}
        <Chevron aria-hidden />
      </button>
    </div>
  )
}

/**
 * The Door's twin for adding to the list it closes: "+ New homework" as
 * the last row. Same row, same pill, so a list ends the same way whether
 * its last word is "show more" or "add one". Where a list has both, the
 * Door comes first: you finish reading before you add.
 */
export function DoorAction({
  icon,
  onClick,
  className,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  className?: string
  children: ReactNode
}) {
  return (
    <div className={cn('flex h-row items-center justify-center', className)}>
      <button type="button" onClick={onClick} className={pill}>
        {icon}
        {children}
      </button>
    </div>
  )
}
