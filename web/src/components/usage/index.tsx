import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

import type { Usage } from '@/api/gen/usage'
import { atLeast, clock, cost, shortModel, tokens } from '@/lib/usage-format'
import { cn, plural } from '@/lib/utils'

/**
 * What a finished job spent, on one quiet line: the model that did the
 * most of the work, a dot, the time, and a chevron. It opens a light
 * popover that informs rather than asks — one row per model that served
 * the job, a Total row, and a footnote when any call failed.
 *
 * The popover is the ConfirmPopover's geometry with none of its asking:
 * under the control (over it when there's no room, right-aligned, clamped
 * to the window, portal to the body), but no buttons, no focus move, and
 * it follows its anchor on scroll and resize instead of detaching. It
 * closes on Esc and on a press outside; a press inside only selects, so
 * the numbers are copyable.
 *
 * It appears once the job has finished and made at least one call;
 * nothing shows while it runs. Nothing reflows when it opens.
 */
export function UsageLine({
  usage,
  defaultOpen = false,
  className,
}: {
  usage: Usage
  /** For the components page: open before anyone presses. */
  defaultOpen?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)
  const anchor = useRef<HTMLButtonElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const cardId = useId()

  // Under the line, or over it when there's no room below, right-aligned
  // to it, never past the window's edge — measured and written straight
  // onto the card, so it never shows anywhere else first. The transcript
  // scrolls under it as answers stream, so while it's open it is placed
  // again whenever anything moves: a popover that detached from its line
  // would be pointing at nothing.
  const place = () => {
    const r = anchor.current?.getBoundingClientRect()
    const el = card.current
    if (!r || !el) return
    const gap = 4
    const margin = 8
    const below = r.bottom + gap + el.offsetHeight <= window.innerHeight - margin
    el.style.top = `${below ? r.bottom + gap : Math.max(margin, r.top - gap - el.offsetHeight)}px`
    el.style.right = `${Math.min(window.innerWidth - r.right, window.innerWidth - el.offsetWidth - margin)}px`
  }

  useLayoutEffect(() => {
    if (open) place()
  })

  useEffect(() => {
    if (!open) return
    place()
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      // The line that opened it is its toggle: leave it to the click.
      if (card.current?.contains(t) || anchor.current?.contains(t)) return
      setOpen(false)
    }
    // Capture, and stop it there, as the ConfirmPopover does: this Esc
    // closes the card and nothing under it. Except from a text field: an
    // Esc typed in the composer is the composer's too, so it goes on.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      const t = e.target as HTMLElement | null
      if (t?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey, true)
    document.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  const head = usage.rows[0]
  if (!head) return null
  const uncounted = usage.total.uncounted ?? 0

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? cardId : undefined}
        onClick={() => setOpen((v) => !v)}
        // Machinery, not prose: an answer's copy button skips it.
        data-copy-skip
        className={cn(
          'inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline underline-offset-2',
          className,
        )}
      >
        {shortModel(head.model)}
        <span aria-hidden>·</span>
        <span className="whitespace-nowrap" title="Model time: each call's duration, added up">
          {clock(usage.total.ms)}
        </span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform duration-200 ease-out motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={card}
            id={cardId}
            role="dialog"
            aria-label="What this cost"
            // As wide as its numbers need (a 19-character model and a
            // seven-digit token count don't fit 20rem), never past the window.
            className="fixed z-50 w-max min-w-80 max-w-[calc(100vw-1rem)] rounded-md border bg-card p-3 shadow-floating"
          >
            <table className="w-full text-xs">
              <tbody>
                {usage.rows.map((row) => (
                  <tr key={row.model}>
                    <td className="py-1 pr-2 font-mono whitespace-nowrap" title={row.model}>
                      {shortModel(row.model)}
                    </td>
                    <td className="py-1 pl-2 text-right font-mono tabular-nums whitespace-nowrap">{clock(row.ms)}</td>
                    <td className="py-1 pl-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {atLeast(tokens(row.tokens), (row.uncounted ?? 0) > 0)}
                    </td>
                    <td className="py-1 pl-2 text-right font-mono tabular-nums whitespace-nowrap">
                      {atLeast(cost(row.cost), (row.uncounted ?? 0) > 0)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-border-muted">
                  <td className="pt-2 pr-2 whitespace-nowrap">Total · {plural(usage.total.calls, 'call')}</td>
                  <td className="pt-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">{clock(usage.total.ms)}</td>
                  <td className="pt-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">
                    {atLeast(tokens(usage.total.tokens), (usage.total.uncounted ?? 0) > 0)}
                  </td>
                  <td className="pt-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">
                    {atLeast(cost(usage.total.cost), (usage.total.uncounted ?? 0) > 0)}
                  </td>
                </tr>
              </tbody>
            </table>
            {/* w-0 min-w-full: the notes take the table's width and never set the
                card's, which would stretch it to one long line. */}
            <p className="mt-2 w-0 min-w-full text-xs text-muted-foreground">
              {uncounted > 0 && (
                <>
                  {uncounted} of {usage.total.calls} calls reported no usage
                  {usage.failed > 0 && <> ({usage.failed} failed, and a failed call still bills what it wrote)</>}, so
                  tokens and cost are at least what's shown.{' '}
                </>
              )}
              Time adds up every call, so calls made at once count in full.
            </p>
          </div>,
          document.body,
        )}
    </>
  )
}
