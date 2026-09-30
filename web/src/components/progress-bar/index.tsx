import { cn } from '@/lib/utils'

import { segmentWeights, type ProgressMark, type ProgressSegment } from './weights'

export type { ProgressMark, ProgressSegment }

const FILL: Record<ProgressMark, string> = {
  done: 'bg-primary',
  current: 'bg-primary/40',
  waiting: 'bg-muted',
  failed: 'bg-warning',
}

/**
 * How far along a set is, as a slim bar cut into its questions. Each segment
 * is as wide as its question is hard, so what is left is how much work is
 * left, not how many questions. Done is filled, the current one half, what
 * waits is quiet, a failed one is in warning ink.
 *
 * It is not a control: it says, and the count beside it (a menu) is how you
 * jump. It has a label for assistive tech, since colour alone says which is which.
 */
export function ProgressBar({
  segments,
  label,
  className,
}: {
  segments: ProgressSegment[]
  /** What it says in words: "2 of 8 done". */
  label: string
  className?: string
}) {
  const weights = segmentWeights(segments)
  return (
    <span role="img" aria-label={label} className={cn('flex gap-1', className)}>
      {segments.map((s, i) => (
        <span
          key={i}
          style={{ flexGrow: weights[i], flexBasis: 0 }}
          className={cn('h-1 rounded-full transition-[flex-grow,background-color] duration-200 ease-out motion-reduce:transition-none', FILL[s.mark])}
        />
      ))}
    </span>
  )
}
