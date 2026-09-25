import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Check, Ellipsis } from 'lucide-react'

import { IconButton } from '@/components/button'
import { ConfirmPopover } from '@/components/confirm'
import { cn } from '@/lib/utils'

const Close = createContext<() => void>(() => {})

/**
 * An overflow menu: the actions a bar has room to name but not to show.
 * A "⋯" trigger opens a floating card of rows under it, right-aligned to
 * the trigger.
 *
 * It closes on Esc, on a click anywhere else, and after any item runs.
 * Arrow keys move between items, and focus goes back to the trigger when
 * it closes. It portals to the body with fixed positioning, like the
 * Tooltip, so no scrolling pane can clip it.
 */
export function Menu({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ top: number; right: number } | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)

  const close = () => {
    setOpen(false)
    trigger.current?.focus()
  }

  useLayoutEffect(() => {
    if (!open || !trigger.current) return
    const r = trigger.current.getBoundingClientRect()
    setAt({ top: r.bottom + 4, right: window.innerWidth - r.right })
  }, [open])

  // Once the panel exists (it waits for its position), focus the first
  // item; close on any press outside, and on Esc wherever focus is.
  useEffect(() => {
    if (!open || !at) return
    panel.current?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      // A confirm opened from an item is part of the menu, not outside it.
      if ((t as Element).closest?.('[data-confirm]')) return
      if (!panel.current?.contains(t) && !trigger.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, at])

  const onKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? [])]
    const i = items.indexOf(document.activeElement as HTMLElement)
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      const step = e.key === 'ArrowDown' ? 1 : -1
      items[(i + step + items.length) % items.length]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <>
      <IconButton
        ref={trigger}
        variant="ghost"
        size="sm"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(open && 'bg-muted/50 text-foreground')}
      >
        <Ellipsis />
      </IconButton>
      {open &&
        at &&
        createPortal(
          <div
            ref={panel}
            role="menu"
            aria-label={label}
            onKeyDown={onKeyDown}
            style={{ top: at.top, right: at.right }}
            // No padding and no divider margin: every pixel of the card belongs to
            // a row, so a hover wash reaches the edge and the divider exactly.
            // overflow-hidden clips the first and last wash to the radius.
            className="fixed z-50 min-w-48 overflow-hidden rounded-md border bg-card shadow-floating"
          >
            <Close value={close}>{children}</Close>
          </div>,
          document.body,
        )}
    </>
  )
}

const item =
  'flex h-control w-full cursor-pointer items-center gap-2 px-3 text-left text-sm text-foreground outline-none hover:bg-muted/50 focus-visible:bg-muted/50 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

/** One action. Runs, then closes the menu. A hint is a short, muted fact
 *  at the row's end, worth knowing before you choose it ("3 still being
 *  found"). */
export function MenuItem({
  icon,
  hint,
  onSelect,
  children,
}: {
  icon?: ReactNode
  hint?: ReactNode
  onSelect: () => void
  children: ReactNode
}) {
  const close = useContext(Close)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={item}
      onClick={() => {
        close()
        onSelect()
      }}
    >
      {icon ?? <span className="size-4" />}
      {children}
      {hint && <span className="ml-auto pl-4 text-xs text-muted-foreground">{hint}</span>}
    </button>
  )
}

/** A destructive act. Choosing it asks first, in a ConfirmPopover under
 *  its row, and the menu stays open behind the question: Cancel or Esc
 *  lands you back on the row, and only the act closes the menu. It sits
 *  last, below a divider, in destructive ink. */
export function MenuConfirmItem({
  icon,
  question,
  detail,
  action,
  onConfirm,
  children,
}: {
  icon?: ReactNode
  question: ReactNode
  detail?: ReactNode
  action: string
  onConfirm: () => void
  children: ReactNode
}) {
  const close = useContext(Close)
  const [asking, setAsking] = useState(false)
  const row = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button
        ref={row}
        type="button"
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="dialog"
        aria-expanded={asking}
        // While it asks, the row keeps its wash: it's the one being answered.
        className={cn(item, 'text-destructive [&_svg]:text-destructive', asking && 'bg-muted/50')}
        onClick={() => setAsking(true)}
      >
        {icon ?? <span className="size-4" />}
        {children}
      </button>
      {asking && (
        <ConfirmPopover
          anchor={row}
          question={question}
          detail={detail}
          action={action}
          onCancel={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false)
            close()
            onConfirm()
          }}
        />
      )}
    </>
  )
}

/** A fact you can take back, like Turned in: a check when it's true, in
 *  the icon column so the labels stay aligned. */
export function MenuCheckItem({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: () => void
  children: ReactNode
}) {
  const close = useContext(Close)
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={checked}
      tabIndex={-1}
      className={item}
      onClick={() => {
        close()
        onChange()
      }}
    >
      {checked ? <Check className="text-primary!" /> : <span className="size-4" />}
      {children}
    </button>
  )
}

export function MenuDivider() {
  return <div role="separator" className="h-px bg-border-muted" />
}
