import { Check, Clock, TriangleAlert } from 'lucide-react'

import { Label } from '@/components/label'

/** What a homework's state is worth saying out loud. Most homework has
 *  none: a set due next week is simply due next week. */
export type HomeworkStatus = 'soon' | 'overdue' | 'turned-in'

/**
 * A homework's status as a pill, or nothing at all.
 *
 * The deadline itself is not here: it belongs in the row's meta line
 * ("· due Friday"), where it reads as one more fact about the homework.
 * This is the flag you scan for, and it earns its colour by being rare:
 * most rows in a list render nothing from this component.
 */
export function HomeworkStatusLabel({ status }: { status?: HomeworkStatus }) {
  if (status === 'turned-in') {
    return (
      <Label tone="success">
        <Check />
        Turned in
      </Label>
    )
  }
  if (status === 'overdue') {
    return (
      <Label tone="danger">
        <TriangleAlert />
        Overdue
      </Label>
    )
  }
  if (status === 'soon') {
    return (
      <Label tone="warning">
        <Clock />
        Due soon
      </Label>
    )
  }
  return null
}
