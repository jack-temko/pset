import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

/** The chart palette, by index. Tailwind only compiles literal class names,
 *  so the map is spelled out. */
export type Chart = 1 | 2 | 3 | 4 | 5
const dotBg: Record<Chart, string> = {
  1: 'bg-chart-1',
  2: 'bg-chart-2',
  3: 'bg-chart-3',
  4: 'bg-chart-4',
  5: 'bg-chart-5',
}

/**
 * A dashboard number: a label, a big mono value, one quiet line of context.
 *
 * The context line says what the number is: "so far this week", "across 3
 * problem sets". It never sets a target, shows a delta, or counts a streak:
 * the dashboard reports, it does not nag. A week with nothing in it shows
 * "0m" or "0" and "nothing yet this week".
 *
 * `chart` puts the activity's dot beside the label.
 */
export function StatTile({
  label,
  value,
  context,
  chart,
  className,
}: {
  label: string
  /** Already formatted. Unit letters go in `<small>`: see DurationValue. */
  value: ReactNode
  context: string
  chart?: Chart
  className?: string
}) {
  return (
    <div className={cn('flex flex-col gap-2 rounded-md border bg-card px-5 py-4', className)}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {chart && <span aria-hidden className={cn('size-2 rounded-full', dotBg[chart])} />}
        {label}
      </div>
      <div className="font-mono text-2xl font-normal tracking-normal tabular-nums [&_small]:text-xs [&_small]:font-normal [&_small]:text-muted-foreground">
        {value}
      </div>
      <p className="text-xs font-normal text-muted-foreground">{context}</p>
    </div>
  )
}

/**
 * Minutes as a stat value: "4h 23m", "40m", or "0m" for an empty week.
 * The unit letters drop to `text-xs` in muted ink so the figures carry.
 */
export function DurationValue({ minutes }: { minutes: number }) {
  if (minutes <= 0)
    return (
      <>
        0<small>m</small>
      </>
    )
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return (
    <>
      {h > 0 && (
        <>
          {h}
          {/* The space lives inside the small so it advances at 15px, not a
          full 24px mono cell. */}
          <small>h </small>
        </>
      )}
      {(m > 0 || h === 0) && (
        <>
          {m}
          <small>m</small>
        </>
      )}
    </>
  )
}
