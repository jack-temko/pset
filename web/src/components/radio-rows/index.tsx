import { useRef, type KeyboardEvent, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type RadioRow<T extends string> = {
  value: T
  label: ReactNode
  /** A line under the label saying what choosing it means. */
  hint?: ReactNode
}

/**
 * One choice out of a few where each needs explaining: a Box of rows,
 * each a radio with its label and a hint under it. The SegmentedControl's
 * sibling for when a word or two can't carry the choice, like how a book
 * numbers its problems, where "2.1.4" means nothing until it's spelled
 * out.
 *
 * A real radio group: the chosen row is the one tab stop, and the arrow
 * keys move the choice, as the platform's radios do. The whole row is the
 * target.
 */
export function RadioRows<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** The accessible name of the group. */
  label: string
  options: readonly RadioRow<T>[]
  /** Nothing chosen yet is allowed: a question not answered. */
  value: T | ''
  onChange: (value: T) => void
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])
  const chosen = options.findIndex((o) => o.value === value)
  // With nothing chosen, the first row takes the tab stop.
  const stop = chosen === -1 ? 0 : chosen

  const move = (e: KeyboardEvent, from: number) => {
    const step =
      e.key === 'ArrowDown' || e.key === 'ArrowRight'
        ? 1
        : e.key === 'ArrowUp' || e.key === 'ArrowLeft'
          ? -1
          : 0
    if (!step) return
    e.preventDefault()
    const to = (from + step + options.length) % options.length
    onChange(options[to].value)
    refs.current[to]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('divide-y divide-border-muted overflow-hidden rounded-md border bg-card', className)}
    >
      {options.map((o, i) => {
        const on = i === chosen
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === stop ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => move(e, i)}
            className={cn(
              'flex w-full cursor-pointer items-start gap-3 px-3 py-2 text-left',
              on ? 'bg-primary-soft' : 'hover:bg-muted/50',
            )}
          >
            {/* The dot sits on the label's first line, however many the
                hint runs to. */}
            <span aria-hidden className="flex h-5 shrink-0 items-center">
              <span
                className={cn(
                  'grid size-4 place-items-center rounded-full border bg-card transition-colors duration-150 ease-out motion-reduce:transition-none',
                  on ? 'border-primary' : 'border-input',
                )}
              >
                {on && <span className="size-2 rounded-full bg-primary" />}
              </span>
            </span>
            <span className="min-w-0 space-y-1">
              <span className="block text-sm font-medium">{o.label}</span>
              {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
            </span>
          </button>
        )
      })}
    </div>
  )
}
