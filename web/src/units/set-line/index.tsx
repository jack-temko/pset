import { Clock } from 'lucide-react';

import { ProgressBar } from '@/units/progress-bar';
import { Tag } from '@/units/tag';
import { daysUntil, SOON_DAYS, timeLeft, WEEKDAY } from './dates';

export interface SetLineProps {
  /** The set's name. */
  set: string;
  done: number;
  total: number;
  /** Shown only when PSet knows it. */
  minutesLeft?: number;
  due?: Date;
  /** Where the line goes: the set in the workspace. */
  href: string;
  /** The day "within 2 days" counts from (the design page and tests). */
  today?: Date;
}

/** The grid is fixed so lines align down the page. Narrower, the time column
 *  goes first, then the progress count. */
const GRID =
  'grid-cols-[minmax(0,1fr)_88px_104px] @min-[440px]:grid-cols-[minmax(0,1fr)_140px_104px] @min-[600px]:grid-cols-[minmax(0,1fr)_140px_140px_104px]';

/** One active set on one line: opens the set in the workspace
 *  (set-line-d3). It has no course name: the course row around it names it. */
export function SetLine({
  set,
  done,
  total,
  minutesLeft,
  due,
  href,
  today = new Date(),
}: SetLineProps) {
  const days = due ? daysUntil(due, today) : undefined;
  const soon = days !== undefined && days <= SOON_DAYS;
  return (
    <a
      href={href}
      className="@container block h-10 min-w-0 rounded-(--ds-radius-control) hover:bg-(--ds-hover)"
    >
      <span className={`grid h-full items-center gap-4 px-3 ${GRID}`}>
        <span className="ds-body min-w-0 truncate font-medium text-(--ds-fg)">
          {set}
        </span>
        <span className="min-w-0 @max-[439px]:[&_[data-count]]:hidden">
          <ProgressBar done={done} total={total} />
        </span>
        <span
          data-column="time"
          className="ds-small hidden min-w-0 truncate text-(--ds-fg-muted) @min-[600px]:block"
        >
          {minutesLeft === undefined ? '' : timeLeft(minutesLeft)}
        </span>
        <span className="ds-small ds-tabular flex min-w-0 justify-end text-(--ds-fg-muted)">
          {due === undefined ? (
            'No date'
          ) : soon ? (
            <Tag tone="attention" icon={Clock}>
              Due {WEEKDAY.format(due)}
            </Tag>
          ) : (
            `Due ${WEEKDAY.format(due)} ${String(due.getDate())}`
          )}
        </span>
      </span>
    </a>
  );
}
