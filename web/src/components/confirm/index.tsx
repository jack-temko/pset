import { useEffect, useEffectEvent, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

import { Button } from '@/components/button'

/**
 * Confirming a destructive act where it was asked for, with no trip to
 * the middle of the screen: a small floating card under the control that
 * was pressed, right-aligned to it like the Menu's card. One sentence
 * says what goes; Cancel, then the act, named. Focus lands on Cancel, so
 * Enter is the safe key, and the act is never drawn under the pointer
 * that asked, so a double click can't confirm.
 *
 * It is the top layer while it's open: Esc closes it and nothing below
 * (a Menu it came from stays open), and a press anywhere else cancels it
 * too. Cancel and Esc hand focus back to the control; a press elsewhere
 * leaves focus where you put it.
 *
 * It portals to the body with fixed positioning, so no scrolling pane can
 * clip it. Menus know it: a press inside it doesn't close one.
 */
export function ConfirmPopover({
  anchor,
  question,
  detail,
  action,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  /** The control that asked, to sit under and to hand focus back to. */
  anchor: RefObject<HTMLElement | null>
  /** The question, in the ink: "Remove 3.A.4?" */
  question: ReactNode
  /** What goes with it, muted: "Its guide and Complete go with it." */
  detail?: ReactNode
  /** The act, named on its button: "Remove", "Delete homework". */
  action: string
  /** For an act that takes a while and stays open while it runs: the
   *  act's label meanwhile ("Resetting…"). Both buttons wait, and nothing
   *  cancels it. */
  busy?: string
  /** Why the act failed, in destructive ink under the sentence. */
  error?: ReactNode
  onConfirm: () => void
  onCancel: () => void
}) {
  const card = useRef<HTMLDivElement>(null)
  const cancel = useRef<HTMLButtonElement>(null)
  const sentence = useId()
  // Placed under the control before the first paint: measured and written
  // straight onto the card, so it never shows anywhere else first.
  useLayoutEffect(() => {
    const r = anchor.current?.getBoundingClientRect()
    if (!r || !card.current) return
    card.current.style.top = `${r.bottom + 4}px`
    card.current.style.right = `${window.innerWidth - r.right}px`
  }, [anchor])

  const back = () => {
    if (busy) return
    onCancel()
    anchor.current?.focus()
  }
  // The document listeners are wired once; these always reach the latest
  // props without rewiring them.
  const outside = useEffectEvent(() => !busy && onCancel())
  const escape = useEffectEvent(() => back())

  useEffect(() => {
    cancel.current?.focus()
    const onDown = (e: PointerEvent) => {
      if (!card.current?.contains(e.target as Node)) outside()
    }
    // Capture, and stop it there: a document listener in the capture phase
    // runs before any in the bubble phase, so a Menu underneath never
    // hears this Esc.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      escape()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
    }
  }, [])

  return createPortal(
    <div
      ref={card}
      role="alertdialog"
      aria-labelledby={sentence}
      data-confirm=""
      className="fixed z-50 w-80 space-y-3 rounded-md border bg-card p-3 text-sm shadow-floating"
    >
      <p id={sentence}>
        <span className="font-medium">{question}</span>
        {detail && <span className="text-muted-foreground"> {detail}</span>}
      </p>
      {error && <p className="text-destructive">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button ref={cancel} variant="ghost" size="sm" disabled={!!busy} onClick={back}>
          Cancel
        </Button>
        <Button variant="destructive" size="sm" disabled={!!busy} onClick={onConfirm}>
          {busy ?? action}
        </Button>
      </div>
    </div>,
    document.body,
  )
}
