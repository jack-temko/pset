import type { ReactNode } from 'react'

import { Box, BoxHeader } from '@/components/box'
import { cn } from '@/lib/utils'

/**
 * The pieces a structured guide is made of that prose, math and the answer
 * cards don't already cover: how a part and a step begin, an aside, a
 * callout, and the answers card. Spec: ideas/structured-guides.md ("Look");
 * they widen Newsreader from display and leads to guide headings.
 *
 * All of them are presentational and take plain props. The renderer that
 * maps a guide's blocks onto them lives with the segments.
 */

/**
 * Where a part of the problem begins: its label as a small blue eyebrow
 * over its title in the serif. A hairline above separates it from the part
 * before, so a long guide has visible seams; the first part of a guide
 * passes `first` and has none, since nothing is above it to separate from.
 */
export function PartHeader({ label, title, first }: { label: string; title: ReactNode; first?: boolean }) {
  return (
    <header className={cn('space-y-1', !first && 'border-t pt-6')}>
      <p className="text-xs tracking-wide text-primary">{label}</p>
      <h2 className="font-heading text-2xl">{title}</h2>
    </header>
  )
}

/**
 * Where a step inside a part begins. The renderer numbers steps, restarting
 * in each part; the number is Inter in the primary ink and sits before the
 * serif title, on its baseline.
 */
export function StepHeading({ number, title }: { number: number; title: ReactNode }) {
  return (
    <h3 className="flex items-baseline gap-3 font-heading text-xl">
      <span className="font-sans text-xs text-primary tabular-nums">{number}</span>
      {title}
    </h3>
  )
}

/**
 * A guide's paragraph: `text-reading` (18/30), with inline math slightly
 * larger than the text. The renderer wraps a `para` block's runs in it;
 * `Prose` takes the same look through `reading`.
 */
export function GuidePara({ children }: { children: ReactNode }) {
  return <p className="text-reading guide-prose">{children}</p>
}

/** An aside the reader can skip: a sanity check, a "why not the other way". */
export function Note({ children }: { children: ReactNode }) {
  return <p className="text-xs text-muted-foreground">{children}</p>
}

export type CalloutTone = 'insight' | 'caveat' | 'check'

/*
 * A status's soft tint is its only ground, so insight (success) and caveat
 * (warning) sit on theirs with a 2px rule of the status ink on the left.
 * Check isn't a status, it's a nudge, so it takes the muted fill, a hairline
 * frame and a rule in the secondary ink.
 */
const callouts: Record<CalloutTone, { frame: string; title: string }> = {
  insight: { frame: 'border-l-2 border-success bg-success-soft', title: 'text-success' },
  caveat: { frame: 'border-l-2 border-warning bg-warning-soft', title: 'text-warning' },
  check: { frame: 'border border-l-2 border-border border-l-muted-foreground bg-muted/50', title: 'text-muted-foreground' },
}

/**
 * What a reader shouldn't skip: `insight` says why a result is obviously
 * right, `caveat` the slip students make, `check` how to verify. A guide
 * has one or two at most. The title is optional and reads as the callout's
 * first line, in the tone's ink; the text is in the foreground ink.
 */
export function Callout({ tone, title, children }: { tone: CalloutTone; title?: ReactNode; children: ReactNode }) {
  const c = callouts[tone]
  return (
    <aside className={cn('space-y-1 rounded-r-md px-card py-3 text-base', c.frame)} data-tone={tone}>
      {title && <p className={cn('text-sm font-semibold', c.title)}>{title}</p>}
      <div className="space-y-2">{children}</div>
    </aside>
  )
}

/**
 * The results of a guide, one row per part: the part's label in the
 * primary ink in a narrow column, the answer beside it. It is what the
 * Answers veil holds, so a student can check paper work without seeing the
 * working, and it closes a walkthrough. An answer with no label is the
 * whole problem's and takes the full row.
 *
 * On a panel too narrow for both, the answer drops under its label
 * (wrapping, not a breakpoint: the panel is resizable).
 */
export function AnswersCard({
  title,
  answers,
}: {
  title?: string
  answers: { label?: string; children: ReactNode }[]
}) {
  return (
    <Box>
      {title && <BoxHeader>{title}</BoxHeader>}
      <ul>
        {answers.map((a, i) => (
          <li
            key={i}
            className="flex flex-wrap gap-x-3 border-t border-border-muted px-card py-2 text-base first:border-t-0"
          >
            {a.label && <span className="w-12 shrink-0 text-sm font-medium text-primary">{a.label}</span>}
            <div className="min-w-0 grow basis-40 space-y-1">{a.children}</div>
          </li>
        ))}
      </ul>
    </Box>
  )
}
