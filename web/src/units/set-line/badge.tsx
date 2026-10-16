import { Clock, TriangleAlert } from 'lucide-react';

import { Tag } from '@/units/tag';
import { dueText } from './dates';

/** The badge beside the name: an attention "Due soon" within 2 days, a danger
 *  "Overdue" when past, and undefined otherwise (set-line-d7). */
export function dueBadge(due: Date | undefined, today = new Date()) {
  if (due === undefined) return undefined;
  const { kind } = dueText(due, today);
  if (kind === 'overdue')
    return (
      <Tag tone="danger" icon={TriangleAlert}>
        Overdue
      </Tag>
    );
  if (kind === 'soon')
    return (
      <Tag tone="attention" icon={Clock}>
        Due soon
      </Tag>
    );
  return undefined;
}
