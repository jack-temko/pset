import { CircleAlert, FileCheck, X } from 'lucide-react'

import { Box, BoxRow } from '@/components/box'
import { Button, IconButton } from '@/components/button'
import { Spinner } from '@/components/spinner'
import {
  readStep,
  useAssignmentReads,
  useBookHomework,
  useDismissRead,
  useRetryRead,
  type AssignmentRead,
} from '@/api/homework'
import { useTimeLeft } from '@/lib/eta'
import { plural } from '@/lib/utils'
import { sourceName } from './import-state'

/**
 * The assignments being read in the background, and the ones read and
 * waiting to be looked over, at the top of the Homework list: a read
 * needn't be watched, so it waits here until it's reviewed or dismissed.
 * Spec: design/workspace.md, "Importing an assignment".
 */
export function AssignmentReads({ bookId, onReview }: { bookId: string; onReview: (id: string) => void }) {
  const reads = useAssignmentReads(bookId).data ?? []
  const titles = Object.fromEntries((useBookHomework(bookId).data ?? []).map((h) => [h.id, h.title]))
  if (reads.length === 0) return null
  return (
    <Box>
      {reads.map((r) => (
        <AssignmentReadRow
          key={r.id}
          r={r}
          setTitle={r.setId ? titles[r.setId] : undefined}
          onReview={() => onReview(r.id)}
        />
      ))}
    </Box>
  )
}

/**
 * What a read under way is doing, and the time left on it once past reads
 * give an estimate (lib/eta): "Thinking it over…", then "Found 12 lines so
 * far · about a minute left". A read is one long model call, so it says
 * how it's going rather than leaving a spinner with nothing to go on.
 */
export function ReadWorking({ r }: { r: AssignmentRead }) {
  const left = useTimeLeft(`read:${r.id}`, readStep(r))
  const text = r.activity || 'Reading…'
  // As on a question's working line: with an estimate after it, the words
  // drop their ellipsis so it doesn't run into the dot.
  return (
    <span>
      {left ? text.replace(/…$/, '') : text}
      {left && <span className="whitespace-nowrap"> · {left}</span>}
    </span>
  )
}

/** One read: reading, with a way to stop; read, with Review; or failed,
 *  saying why, with Try again. */
export function AssignmentReadRow({
  r,
  setTitle,
  onReview,
}: {
  r: AssignmentRead
  /** The set it was read to update, if it was. */
  setTitle?: string
  onReview: () => void
}) {
  const dismiss = useDismissRead()
  const retry = useRetryRead()
  const name = r.assignment?.title || sourceName(r.source)
  const dismissButton = (label: string) => (
    <IconButton variant="ghost" size="sm" aria-label={label} onClick={() => dismiss.mutate(r)}>
      <X />
    </IconButton>
  )

  if (r.state === 'reading') {
    return (
      <BoxRow
        leading={<Spinner className="size-4" label="Reading" />}
        title={`Reading ${sourceName(r.source)}`}
        description={
          <>
            {setTitle && `An update for ${setTitle}. `}
            <ReadWorking r={r} />
          </>
        }
        trailing={dismissButton('Stop reading')}
      />
    )
  }
  if (r.state === 'failed') {
    return (
      <BoxRow
        leading={<CircleAlert className="text-warning" />}
        title={`Couldn't read ${sourceName(r.source)}`}
        description={<span className="text-warning">{r.error}</span>}
        trailing={
          <span className="flex items-center gap-1">
            <Button variant="ghost" size="sm" disabled={retry.isPending} onClick={() => retry.mutate(r.id)}>
              Try again
            </Button>
            {dismissButton('Dismiss')}
          </span>
        }
      />
    )
  }
  const groups = r.assignment?.groups ?? []
  return (
    <BoxRow
      leading={<FileCheck className="text-primary" />}
      title={name}
      description={
        setTitle ? `An update for ${setTitle}` : `${plural(groups.length, 'due date')} to look over`
      }
      trailing={
        <span className="flex items-center gap-1">
          <Button size="sm" onClick={onReview}>
            Review
          </Button>
          {dismissButton('Dismiss')}
        </span>
      }
    />
  )
}
