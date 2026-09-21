import { cn } from '@/lib/utils'

/**
 * One choice out of a few, all visible at once: a `muted` track holding
 * the options, with the chosen one lifted onto `card`. For a handful of
 * short, mutually exclusive values — the theme's Paper / Night / System —
 * where a dropdown would hide the alternatives for no reason.
 *
 * It is a radiogroup: arrow keys aren't wired, but every option is its
 * own button in the tab order, and `aria-checked` says which is chosen.
 */
export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  className,
}: {
  /** The accessible name of the group. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex h-control items-center gap-1 rounded-md bg-muted p-1', className)}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              'flex h-full cursor-pointer items-center rounded-sm px-3 text-sm font-medium transition-colors duration-150 ease-out motion-reduce:transition-none',
              on
                ? 'bg-card text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.08)]'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
