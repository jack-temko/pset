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
import { Check, ChevronDown, Ellipsis } from 'lucide-react'

import { Button, IconButton } from '@/components/button'
import { ConfirmPopover } from '@/components/confirm'
import type { PrefetchIntent } from '@/lib/prefetch-intent'
import { cn } from '@/lib/utils'

const Close = createContext<() => void>(() => {})


/** The one menu that is open, if any. Opening a menu closes it: menus never
 *  stack, whether they were opened by a press or from the keyboard. */
let active: (() => void) | null = null

/**
 * A dropdown of actions or choices: the ones a bar has room to name but not
 * to show. By default a "⋯" trigger opens a floating card of rows under it,
 * right-aligned to it. A `trigger` (a count, a name and a chevron) replaces
 * the "⋯" and the card then opens left-aligned under it.
 *
 * Only one menu is open at a time. It closes on Esc, on a press anywhere
 * else, and after any item runs. Arrow keys move between items, Home and End
 * jump, and focus goes back to the trigger when it closes. Opening focuses
 * the `current` row if there is one, else the first. It portals to the body
 * with fixed positioning, like the Tooltip, so no scrolling pane can clip
 * it, and it scrolls inside itself when it is taller than the room below.
 */
export function Menu({
  label,
  trigger,
  align,
  intent,
  children,
}: {
  /** The accessible name of the trigger and of the menu. */
  label: string
  /** What the trigger shows instead of "⋯": a count, a name, a chevron. */
  trigger?: ReactNode
  /** Which edge of the trigger the card lines up with. */
  align?: 'start' | 'end'
  /** `usePrefetchIntent`'s handlers, to warm what an item will open as the
   *  pointer rests on the trigger. */
  intent?: PrefetchIntent
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [at, setAt] = useState<{ top: number; left?: number; right?: number; max: number; w: number } | null>(null)
  const [shown, setShown] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  // One stable function that only closes, so the registry can hold it.
  const hide = useRef(() => setOpen(false))
  const side = align ?? (trigger ? 'start' : 'end')

  const close = () => {
    setOpen(false)
    button.current?.focus()
  }

  // Only one menu at a time.
  useEffect(() => {
    if (!open) return
    const mine = hide.current
    if (active && active !== mine) active()
    active = mine
    return () => {
      if (active === mine) active = null
    }
  }, [open])

  useLayoutEffect(() => {
    if (!open || !button.current) return
    const r = button.current.getBoundingClientRect()
    setAt({
      w: r.width,
      // The card joins the trigger: it starts one pixel up so their borders are one line.
      top: r.bottom - 1,
      left: side === 'start' ? r.left : undefined,
      right: side === 'end' ? window.innerWidth - r.right : undefined,
      max: Math.max(160, window.innerHeight - r.bottom - 16),
    })
  }, [open, side])

  // The card eases in (a short fade and settle), unless motion is reduced.
  useEffect(() => {
    if (!at) return
    const id = requestAnimationFrame(() => setShown(true))
    return () => {
      cancelAnimationFrame(id)
      setShown(false)
    }
  }, [at])

  // Once the card exists (it waits for its position), focus the current
  // item or the first; close on any press outside, and on Esc wherever focus is.
  useEffect(() => {
    if (!open || !at) return
    const items = panel.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]')
    const first = panel.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? items?.[0]
    first?.focus()
    first?.scrollIntoView?.({ block: 'nearest' })
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      // A confirm opened from an item is part of the menu, not outside it.
      if ((t as Element).closest?.('[data-confirm]')) return
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      button.current?.focus()
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
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault()
      items[e.key === 'Home' ? 0 : items.length - 1]?.focus()
    } else if (e.key === 'Tab') {
      setOpen(false)
    }
  }

  return (
    <>
      {trigger ? (
        <Button
          ref={button}
          variant="ghost"
          size="sm"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          {...intent}
          onClick={() => setOpen((o) => !o)}
          className={cn('tabular-nums', open && 'relative z-[60] rounded-b-none border-border bg-card hover:bg-card')}
        >
          {trigger}
          <ChevronDown className={cn('transition-transform duration-200 motion-reduce:transition-none', open && 'rotate-180')} />
        </Button>
      ) : (
        <IconButton
          ref={button}
          variant="ghost"
          size="sm"
          aria-label={label}
          aria-haspopup="menu"
          aria-expanded={open}
          {...intent}
          onClick={() => setOpen((o) => !o)}
          className={cn(open && 'relative z-[60] rounded-b-none border-border bg-card text-foreground hover:bg-card')}
        >
          <Ellipsis />
        </IconButton>
      )}
      {open &&
        at &&
        createPortal(
          <div
            style={{ top: at.top, left: at.left, right: at.right }}
            className={cn(
              'fixed z-50 min-w-64 transition duration-200 ease-out motion-reduce:transition-none',
              side === 'start' ? 'origin-top-left' : 'origin-top-right',
              shown ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
            )}
          >
            <div
              ref={panel}
              role="menu"
              aria-label={label}
              onKeyDown={onKeyDown}
              style={{ maxHeight: at.max }}
              // No padding: every pixel of the card belongs to a row, so a hover
              // wash runs to the card's edge. The card clips the first and last
              // wash to its radius. It joins its trigger at one corner, which is
              // squared; it is a large floating surface, so radius-lg and the shadow.
              className={cn(
                'relative overflow-y-auto rounded-lg border bg-card shadow-floating',
                side === 'start' ? 'rounded-tl-none' : 'rounded-tr-none',
              )}
            >
              <Close value={close}>{children}</Close>
            </div>
          </div>,
          document.body,
        )}
    </>
  )
}

const item =
  'flex min-h-row w-full cursor-pointer items-center gap-3 px-3 text-left text-sm text-foreground outline-none hover:bg-muted focus-visible:bg-muted [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground'

/** One action or choice. Runs, then closes the menu. A hint is a short, muted
 *  fact at the row's end, worth knowing before you choose it ("3 still being
 *  found", "Done"). `current` marks the row you are on in a list of places:
 *  it is washed and in primary ink, and it is where the menu opens focus. */
export function MenuItem({
  icon,
  hint,
  current,
  onSelect,
  intent,
  children,
}: {
  icon?: ReactNode
  hint?: ReactNode
  current?: boolean
  onSelect: () => void
  /** `usePrefetchIntent`'s handlers for this item. */
  intent?: PrefetchIntent
  children: ReactNode
}) {
  const close = useContext(Close)
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      aria-current={current || undefined}
      {...intent}
      className={cn(item, current && 'bg-muted font-medium text-primary [&_svg]:text-primary')}
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
        className={cn(item, 'text-destructive [&_svg]:text-destructive', asking && 'bg-muted')}
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
