import { cloneElement, useId, useState, type ReactElement } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '@/lib/utils'

type Handlers = {
  'aria-describedby'?: string
  onMouseEnter?: (e: React.MouseEvent<HTMLElement>) => void
  onMouseLeave?: (e: React.MouseEvent<HTMLElement>) => void
  onFocus?: (e: React.FocusEvent<HTMLElement>) => void
  onBlur?: (e: React.FocusEvent<HTMLElement>) => void
}

/**
 * A short label that explains a target, on hover after a beat and on
 * keyboard focus at once. Ink on paper, inverted: `foreground` ground,
 * `background` text, at the 15px floor.
 *
 * It renders into the body with fixed positioning, so no scrolling pane
 * can clip it: the workspace is all scrolling panes, and a page chip at
 * the top of one lost its label to the edge.
 *
 * It is a description, never the name. The target keeps its own label,
 * and the tooltip is wired to it with `aria-describedby`, so nothing that
 * matters may live only in a tooltip.
 */
export function Tooltip({
  label,
  side = 'top',
  children,
}: {
  label: string
  /** `left` for targets pinned to a pane's right edge. */
  side?: 'top' | 'left'
  children: ReactElement<Handlers>
}) {
  const id = useId()
  const [at, setAt] = useState<{ x: number; y: number; delay: boolean } | null>(null)

  const show = (el: HTMLElement, delay: boolean) => {
    const r = el.getBoundingClientRect()
    setAt(
      side === 'top'
        ? { x: r.left + r.width / 2, y: r.top, delay }
        : { x: r.left, y: r.top + r.height / 2, delay },
    )
  }
  const hide = () => setAt(null)
  const p = children.props

  return (
    <>
      {cloneElement(children, {
        'aria-describedby': id,
        onMouseEnter: (e) => (show(e.currentTarget, true), p.onMouseEnter?.(e)),
        onMouseLeave: (e) => (hide(), p.onMouseLeave?.(e)),
        // Focus explains at once; only hover waits.
        onFocus: (e) => (show(e.currentTarget, false), p.onFocus?.(e)),
        onBlur: (e) => (hide(), p.onBlur?.(e)),
      })}
      {createPortal(
        <span
          id={id}
          role="tooltip"
          style={at ? { left: at.x, top: at.y } : undefined}
          className={cn(
            'pointer-events-none fixed z-50 rounded-sm bg-foreground px-2 py-1 font-sans text-xs whitespace-nowrap text-background',
            // Opacity only: a tooltip appears, it doesn't travel.
            'transition-opacity duration-150 ease-out motion-reduce:transition-none',
            at ? 'opacity-100' : 'invisible opacity-0',
            at?.delay && 'delay-300',
            side === 'top' ? '-mt-2 -translate-x-1/2 -translate-y-full' : '-ml-2 -translate-x-full -translate-y-1/2',
          )}
        >
          {label}
        </span>,
        document.body,
      )}
    </>
  )
}
