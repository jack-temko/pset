import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/button'

/**
 * Confirming a destructive act where it was asked for: no trip to the
 * middle of the screen. Two candidates, on /components side by side until
 * one is chosen.
 *
 * Both say what goes in one sentence, put focus on Cancel (the safe key
 * press), and close on Esc or a press elsewhere. The red act is never
 * drawn under the pointer that asked, so a double click can't confirm.
 */

/** Esc, or a press outside `ref`, cancels. */
function useDismiss(ref: RefObject<HTMLElement | null>, onCancel: () => void, active = true) {
  useEffect(() => {
    if (!active) return
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) onCancel()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onCancel()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [ref, onCancel, active])
}

/**
 * Candidate A, the control asks: the row that held the control becomes the
 * question. The sentence takes the row's width, then the act, then Cancel
 * at the end, where the control was.
 */
export function ConfirmRow({
  question,
  detail,
  action,
  onConfirm,
  onCancel,
}: {
  question: ReactNode
  detail?: ReactNode
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const row = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  useEffect(() => cancel.current?.focus(), [])
  useDismiss(row, onCancel)
  return (
    // One line where there's room; in a narrow panel the buttons wrap
    // under the sentence, right-aligned, Cancel still at the row's end.
    <div ref={row} role="group" aria-label={action} className="flex min-h-control flex-wrap items-center justify-end gap-x-3 gap-y-2">
      <p className="min-w-64 flex-1 text-sm">
        <span className="font-medium">{question}</span>
        {detail && <span className="text-muted-foreground"> {detail}</span>}
      </p>
      <span className="flex gap-2">
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {action}
        </Button>
        <Button ref={cancel} variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
      </span>
    </div>
  )
}

/**
 * Candidate B, a popover at the control: a small floating card under what
 * was pressed, right-aligned to it like the Menu's card. It portals to the
 * body with fixed positioning, so no scrolling pane can clip it.
 */
export function ConfirmPopover({
  anchor,
  question,
  detail,
  action,
  onConfirm,
  onCancel,
}: {
  anchor: RefObject<HTMLElement | null>
  question: ReactNode
  detail?: ReactNode
  action: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (r) setAt({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }, [anchor])
  useEffect(() => {
    if (at) cancel.current?.focus()
  }, [at])
  const back = () => {
    onCancel()
    anchor.current?.focus()
  }
  useDismiss(card, back, !!at)
  if (!at) return null
  return createPortal(
    <div
      ref={card}
      role="alertdialog"
      aria-label={action}
      style={{ top: at.top, right: at.right }}
      className="fixed z-50 w-80 space-y-3 rounded-md border bg-card p-3 text-sm shadow-floating"
    >
      <p>
        <span className="font-medium">{question}</span>
        {detail && <span className="text-muted-foreground"> {detail}</span>}
      </p>
      <div className="flex justify-end gap-2">
        <Button ref={cancel} variant="ghost" size="sm" onClick={back}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" onClick={onConfirm}>
          {action}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
