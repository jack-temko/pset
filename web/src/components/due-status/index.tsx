import { Check, Clock, TriangleAlert } from 'lucide-react'

import { Label } from '@/components/label'

/** What a homework's state is worth saying out loud. Most homework has
 *  none — a set due next week is simply due next week. */
export type HomeworkStatus = 'soon' | 'overdue' | 'turned-in'

/**
 * A homework's deadline: the date always as words, and a status pill only
 * when there is a status.
 *
 * The two carry different jobs. The date is a fact you read — "Friday",
 * "next Friday", "in two weeks" — and it is always there, so a row never
 * makes you guess when something is due. The pill is a flag you scan, and
 * it earns its colour by being rare: most rows have no pill at all.
 */
export function DueStatus({ due, status }: { due: string; status?: HomeworkStatus }) {
  return (
    <span className="flex items-center gap-2">
      {status === 'turned-in' && (
        <Label tone="success">
          <Check />
          Turned in
        </Label>
      )}
      {status === 'overdue' && (
        <Label tone="danger">
          <TriangleAlert />
          Overdue
        </Label>
      )}
      {status === 'soon' && (
        <Label tone="warning">
          <Clock />
          Due soon
        </Label>
      )}
      <span className="text-xs font-normal text-muted-foreground">{due}</span>
    </span>
  )
}
