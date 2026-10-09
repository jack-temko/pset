import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { ChevronRight } from 'lucide-react'

import type { Usage } from '@/api/gen/usage'
import { prefetchUsageDetail, useUsageDetail, type UsageSource } from '@/api/usage'
import { UsageModal } from '@/components/usage-modal'
import { atLeast, cost, shortModel } from '@/lib/usage-format'
import { cn } from '@/lib/utils'

/** The line's words: the model that did the most work (and how many more
 *  served the job) and the cost; the time and tokens are in the modal. Plain
 *  inline text that wraps at its separator, never inside a figure; `after` rides on the last
 *  figure, so the trigger's chevron wraps with the last word. */
export function UsageSummary({ usage, className, after }: { usage: Usage; className?: string; after?: React.ReactNode }) {
  const head = usage.rows[0]
  if (!head) return null
  const partial = (usage.total.uncounted ?? 0) > 0
  const more = usage.rows.length - 1
  return (
    <span
      title={`${usage.rows.map((r) => r.model).join(', ')}. Click for the time, tokens and every call.`}
      className={cn('text-xs tabular-nums', className)}
    >
      <span className="whitespace-nowrap">
        {shortModel(head.model)}
        {more > 0 && ` +${more}`}
      </span>
      <span aria-hidden> · </span>
      <span className="whitespace-nowrap">
        {atLeast(cost(usage.total.cost), partial)}
        {after}
      </span>
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
  const client = useQueryClient()
  // Start the fetch as the pointer or focus reaches the line, so the modal
  // usually opens with its data.
  const prefetch = () => {
    if (detail === undefined) void prefetchUsageDetail(client, source)
  }
  if (!usage.rows[0]) return null
  return (
    <>
      <button
        type="button"
        data-copy-skip
        aria-haspopup="dialog"
        aria-label={`Usage details for ${name}`}
        onPointerEnter={prefetch}
        onFocus={prefetch}
        onClick={() => setOpen(true)}
        className={cn(
          block ? 'block' : 'inline',
          'max-w-full cursor-pointer rounded-sm text-left text-muted-foreground',
          'hover:text-primary focus-visible:text-primary',
          className,
        )}
      >
        <UsageSummary usage={usage} after={<ChevronRight className="ml-1 inline size-3 align-[-0.1em]" aria-hidden />} />
      </button>
      {open && <UsageDetail open source={source} name={name} detail={detail} onClose={() => setOpen(false)} />}
    </>
  )
}

/** The modal with its detail fetched: mounted only while open, so nothing
 *  is asked for until it is wanted. */
function UsageDetail({
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
      kind={source.kind}
      detail={detail ?? q.data}
      loading={detail === undefined && q.isPending}
      error={detail === undefined && q.isError}
    />
  )
}
