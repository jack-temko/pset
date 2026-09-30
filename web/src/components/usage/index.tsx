import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown } from 'lucide-react'

import type { Usage } from '@/api/gen/usage'
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
    // closes the card and nothing under it.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      setOpen(false)
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

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
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
        <span className="whitespace-nowrap">{clock(usage.total.ms)}</span>
        <ChevronDown
          className={cn(
            'size-4 shrink-0 transition-transform duration-150 ease-out motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
      </button>
      {open &&
        createPortal(
          <div
            ref={card}
            role="dialog"
            aria-label="What this cost"
            className="fixed z-50 w-80 rounded-md border bg-card p-3 shadow-floating"
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
                      {row.tokens === undefined ? '–' : row.tokens.toLocaleString('en-US')}
                    </td>
                    <td className="py-1 pl-2 text-right font-mono tabular-nums whitespace-nowrap">{cost(row.cost)}</td>
                  </tr>
                ))}
                <tr className="border-t border-border-muted">
                  <td className="pt-2 pr-2 whitespace-nowrap">Total · {plural(usage.total.calls, 'call')}</td>
                  <td className="pt-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">{clock(usage.total.ms)}</td>
                  <td className="pt-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">
                    {usage.total.tokens === undefined ? '–' : usage.total.tokens.toLocaleString('en-US')}
                  </td>
                  <td className="pt-2 pl-2 text-right font-mono tabular-nums whitespace-nowrap">{cost(usage.total.cost)}</td>
                </tr>
              </tbody>
            </table>
            {usage.failed > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Includes {usage.failed} failed {usage.failed === 1 ? 'call' : 'calls'}.
              </p>
            )}
          </div>,
          document.body,
        )}
    </>
  )
}

/** The model as it reads on the card: the vendor prefix dropped
 *  ("deepseek-v4.1-flash"), the full slug left in the title. */
function shortModel(model: string): string {
  const i = model.lastIndexOf('/')
  return i === -1 ? model : model.slice(i + 1)
}

/** The models' time, their call durations summed: one decimal under ten
 *  seconds ("2.1s"), whole seconds at ten and up ("14s"), "1m 03s" from a
 *  minute. */
function clock(ms: number): string {
  const s = ms / 1000
  if (s < 10) return `${s.toFixed(1)}s`
  if (s < 60) return `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  let rest = Math.round(s % 60)
  if (rest === 60) {
    rest = 0
    return `${m + 1}m 00s`
  }
  return `${m}m ${String(rest).padStart(2, '0')}s`
}

/** Dollars, four decimals under one ("$0.0031"), two from one ("$1.24"),
 *  and "$0.0000" when a local model served for free. Absent — the
 *  provider didn't say — is a dash, never a zero. */
function cost(dollars: number | undefined): string {
  if (dollars === undefined) return '–'
  return `$${dollars.toFixed(dollars < 1 ? 4 : 2)}`
}
