import type { ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

import { cn } from '@/lib/utils'

/**
 * Two shapes, and the button is always the shape, so the wash and the
 * click target agree:
 *
 * - **row** (the default): the last row of a Box. The whole row is the
 *   button, like every other clickable row in a Box.
 * - **pill**: under a grid, the shelf's covers. A bar the width of a whole
 *   grid darkening at once reads as a giant button, so there the target
 *   is a pill in the middle of the row.
 */
export type DoorShape = 'row' | 'pill'

const quiet =
  'flex cursor-pointer items-center justify-center gap-1 text-xs text-muted-foreground transition-colors duration-150 ease-out hover:bg-muted/50 hover:text-foreground motion-reduce:transition-none [&_svg]:size-4'

function DoorButton({
  shape,
  className,
  ...props
}: { shape: DoorShape; className?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  if (shape === 'row') {
    return <button type="button" className={cn(quiet, 'h-row w-full', className)} {...props} />
  }
  return (
    <div className={cn('flex h-row items-center justify-center', className)}>
      <button type="button" className={cn(quiet, 'h-control-sm rounded-md px-3')} {...props} />
    </div>
  )
}

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
  shape = 'row',
  className,
}: {
  open: boolean
  /** How many there are in all: the door names what it opens onto. */
  total: number
  onToggle: () => void
  shape?: DoorShape
  className?: string
}) {
  const Chevron = open ? ChevronUp : ChevronDown
  return (
    <DoorButton shape={shape} onClick={onToggle} aria-expanded={open} className={className}>
      {open ? 'Show fewer' : `Show all ${total}`}
      <Chevron aria-hidden />
    </DoorButton>
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
  shape = 'row',
  className,
  children,
}: {
  icon: ReactNode
  onClick: () => void
  shape?: DoorShape
  className?: string
  children: ReactNode
}) {
  return (
    <DoorButton shape={shape} onClick={onClick} className={className}>
      {icon}
      {children}
    </DoorButton>
  )
}
