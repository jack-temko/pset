import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

import type { Usage } from '@/api/gen/usage'
import { useUsageDetail, type UsageSource } from '@/api/usage'
import { UsageModal } from '@/components/usage-modal'
import { atLeast, clock, cost, shortModel, tokens } from '@/lib/usage-format'
import { cn } from '@/lib/utils'

/** The line's words: the model that did the most work (and how many more
 *  served the job), the time, the tokens, the cost. Plain text; the trigger
 *  makes it a button. Nothing without a call. */
export function UsageSummary({ usage, className }: { usage: Usage; className?: string }) {
  const head = usage.rows[0]
  if (!head) return null
  const partial = (usage.total.uncounted ?? 0) > 0
  const more = usage.rows.length - 1
  return (
    <span
      title={`${usage.rows.map((r) => r.model).join(', ')}. Time adds up every call, so calls made at once count in full.`}
      className={cn('inline-flex items-center gap-x-1 text-xs tabular-nums', className)}
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

/**
 * What a finished job spent, as one quiet line that opens the details: the
 * line (model, time, tokens, cost) with a small chevron, muted, both turning
 * to the accent on hover and focus. A button, so it is on the keyboard; the
 * modal it opens fetches the job's stages and calls when it opens.
 *
 * `detail` is for /components and tests, where there is no server: given it,
 * the modal shows that instead of fetching.
 *
 * It is `data-copy-skip` (an answer's copy button leaves it out), and it
 * appears only once a job is done or failed, which the caller decides.
 */
export function UsageTrigger({
  usage,
  source,
  name,
  detail,
  block,
  className,
}: {
  usage: Usage
  source: UsageSource
  /** What the modal's title names: "Problem 3.14", "Ask answer". */
  name: string
  detail?: React.ComponentProps<typeof UsageModal>['detail']
  /** On a line of its own, under a guide or an answer. */
  block?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  if (!usage.rows[0]) return null
  return (
    <>
      <button
        type="button"
        data-copy-skip
        aria-haspopup="dialog"
        aria-label={`Usage details for ${name}`}
        onClick={() => setOpen(true)}
        className={cn(
          block ? 'flex w-fit' : 'inline-flex',
          'max-w-full cursor-pointer items-center gap-1 rounded-sm text-left align-baseline text-muted-foreground',
          'hover:text-primary focus-visible:text-primary',
          className,
        )}
      >
        <UsageSummary usage={usage} className="flex-wrap" />
        <ChevronRight className="size-3 shrink-0" aria-hidden />
      </button>
      {open && <Loaded open source={source} name={name} detail={detail} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The modal with its detail fetched: mounted only while open, so nothing
 *  is asked for until it is wanted. */
function Loaded({
  open,
  source,
  name,
  detail,
  onClose,
}: {
  open: boolean
  source: UsageSource
  name: string
  detail?: React.ComponentProps<typeof UsageModal>['detail']
  onClose: () => void
}) {
  const q = useUsageDetail(source, open && detail === undefined)
  return (
    <UsageModal
      open={open}
      onClose={onClose}
      name={name}
      detail={detail ?? q.data}
      loading={detail === undefined && q.isPending}
      error={detail === undefined && q.isError}
    />
  )
}
