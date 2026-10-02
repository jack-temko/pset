import type { Usage } from '@/api/gen/usage'
import { atLeast, clock, cost, shortModel, tokens } from '@/lib/usage-format'
import { cn } from '@/lib/utils'

/**
 * What a finished job spent, as one muted line and not a control: the model
 * that did the most of the work (and how many more served the job), the time,
 * the tokens, the cost, in that order, the order a student cares about, the
 * number to skim past last. It is plain text where the thing it describes is
 * (a question's guide, an Ask answer, an assignment read's row).
 *
 * Tokens and cost carry a "≥" when a call reported nothing (a failed call
 * still bills), and a dash where nothing was reported at all, never a zero,
 * which would say free. Nothing shows without a call, or while the job runs.
 * It is `inline`: give it `className="block"` to stand on its own line.
 */
export function UsageLine({ usage, className }: { usage: Usage; className?: string }) {
  const head = usage.rows[0]
  if (!head) return null
  const partial = (usage.total.uncounted ?? 0) > 0
  const more = usage.rows.length - 1
  return (
    <span
      // Machinery, not prose: a copy button skips it.
      data-copy-skip
      title={`${usage.rows.map((r) => r.model).join(', ')}. Time adds up every call, so calls made at once count in full.`}
      className={cn('inline-flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground tabular-nums', className)}
    >
      <span>
        {shortModel(head.model)}
        {more > 0 && ` +${more}`}
      </span>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">{clock(usage.total.ms)}</span>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">{atLeast(tokens(usage.total.tokens), partial)} tokens</span>
      <span aria-hidden>·</span>
      <span className="whitespace-nowrap">{atLeast(cost(usage.total.cost), partial)}</span>
    </span>
  )
}
