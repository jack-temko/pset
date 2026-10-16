import { Link } from '@/units/link';
import { ListRow } from '@/units/list-row';
import { narrowOnly } from '@/units/list-row/meta';
import { ProgressBar } from '@/units/progress-bar';
import { DueStatus } from '@/units/set-line';
import { dueBadge } from '@/units/set-line/badge';
import { timeLeft } from '@/units/set-line/dates';
import { openedAgo } from './opened';
import type { Reason } from './listed';

/** The aside is a fifth of the row, floored at 160 and capped at 320, so the
 *  bars align down the list. */
const ASIDE_WIDTH = 'clamp(160px, 20cqw, 320px)';

export interface AssignmentRowProps {
  /** The set's name; opens the set where the student left off. */
  set: string;
  href: string;
  /** The course's name; opens the course. */
  course: string;
  courseHref: string;
  done: number;
  total: number;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
  /** A local calendar date: build it with `parseDueDate`. */
  due?: Date;
  /** Why it is listed: `opened` shows when it was last opened. */
  reason: Reason;
  openedAt?: Date;
  /** The moment "Due soon" and "Opened 2 h ago" count from. */
  today?: Date;
}

/** One assignment as a list row, for Home: the set (with its due label) on
 *  line one, the course, time left and, for a recently opened one, when it
 *  was opened on line two, the due date and progress bar at the right
 *  (assignment-row-d1 to d4). */
export function AssignmentRow({
  set,
  href,
  course,
  courseHref,
  done,
  total,
  minutesLeft,
  due,
  reason,
  openedAt,
  today = new Date(),
}: AssignmentRowProps) {
  const time = minutesLeft === undefined ? '' : timeLeft(minutesLeft);
  return (
    <ListRow
      title={set}
      href={href}
      label={dueBadge(due, today)}
      status={<DueStatus due={due} today={today} />}
      meta={[
        <Link
          key="course"
          href={courseHref}
          tone="muted"
          size="small"
          className="[overflow-wrap:normal]"
        >
          {course}
        </Link>,
        narrowOnly(`${String(done)} of ${String(total)}`),
        ...(time ? [time] : []),
        ...(reason === 'opened' && openedAt !== undefined
          ? [openedAgo(openedAt, today)]
          : []),
      ]}
      aside={<ProgressBar done={done} total={total} />}
      asideWidth={ASIDE_WIDTH}
    />
  );
}
