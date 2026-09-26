import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { cn } from '@/lib/utils'

/** A key press moves the edge this far; with Shift, four times as far. */
const STEP = 16

/**
 * The seam between two panes, made draggable. It takes no width of its
 * own: it sits on the panes' shared hairline, with a 16px strip either
 * side of it to catch the pointer, and a small grip at its middle so you
 * can tell, before touching it, that the edge moves. Hover, a drag or
 * keyboard focus turn the hairline and the grip to `ring`.
 *
 * It sizes one pane, the one on its `pane` side; dragging toward the
 * other pane grows it. Arrow keys step 16px (Shift for 64), Home and End
 * go to the limits, and a double-click or Enter puts the default back.
 */
export function ResizeHandle({
  label,
  pane,
  value,
  min,
  max,
  onChange,
  onCommit,
  onReset,
  className,
}: {
  /** What it resizes, for a screen reader: "Resize the contents". */
  label: string
  /** Which side of the handle the sized pane is on. */
  pane: 'before' | 'after'
  /** The pane's width now, in pixels. */
  value: number
  min: number
  max: number
  /** Called as the edge moves, already held to min and max. */
  onChange: (px: number) => void
  /** Called once when a move ends: the moment to save. */
  onCommit: () => void
  onReset: () => void
  className?: string
}) {
  const [dragging, setDragging] = useState(false)
  const start = useRef({ x: 0, value: 0 })
  const dir = pane === 'before' ? 1 : -1
  const clamp = (px: number) => Math.round(Math.min(Math.max(px, min), max))

  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, value }
    setDragging(true)
  }
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (dragging) onChange(clamp(start.current.value + dir * (e.clientX - start.current.x)))
  }
  const up = () => {
    if (!dragging) return
    setDragging(false)
    onCommit()
  }

  const key = (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.shiftKey ? STEP * 4 : STEP
    const to = {
      ArrowRight: value + dir * step,
      ArrowLeft: value - dir * step,
      Home: min,
      End: max,
    }[e.key]
    if (to !== undefined) {
      e.preventDefault()
      onChange(clamp(to))
      onCommit()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      onReset()
    }
  }

  return (
    <div className={cn('relative z-10 w-0 shrink-0', className)}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={Math.round(min)}
        aria-valuemax={Math.round(max)}
        tabIndex={0}
        data-dragging={dragging || undefined}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onDoubleClick={onReset}
        onKeyDown={key}
        className="group absolute inset-y-0 -left-2 w-4 cursor-col-resize touch-none outline-none"
      >
        <span
          aria-hidden
          className={cn(
            'absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-transparent transition-colors duration-150',
            'group-hover:bg-ring group-focus-visible:bg-ring group-data-dragging:bg-ring',
          )}
        />
        <span
          aria-hidden
          className={cn(
            'absolute top-1/2 left-1/2 h-8 w-1 -translate-1/2 rounded-full bg-input transition-colors duration-150',
            'group-hover:bg-ring group-focus-visible:bg-ring group-data-dragging:bg-ring',
          )}
        />
      </div>
      {/* While dragging, the pointer may cross the scan's pages or the
          panel's text: this veil keeps the resize cursor and stops the
          drag from selecting what it passes over. */}
      {dragging && <div aria-hidden className="fixed inset-0 z-50 cursor-col-resize select-none" />}
    </div>
  )
}
