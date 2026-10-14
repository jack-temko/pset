import { Clock } from 'lucide-react';

import { ProgressBar } from '@/units/progress-bar';
import { Tag } from '@/units/tag';

/** A set due within this many days carries the attention tag (work-row-d2). */
export const SOON_DAYS = 2;

const DAY_MS = 86_400_000;

/** Whole calendar days from `today` to `due`, in the student's own days. */
export function daysUntil(due: Date, today: Date): number {
  const d = Date.UTC(due.getFullYear(), due.getMonth(), due.getDate());
  const t = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((d - t) / DAY_MS);
}

const WEEKDAY = new Intl.DateTimeFormat('en-US', { weekday: 'short' });

/** "About 1 h 10 m left". */
export function timeLeft(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  const parts = [h > 0 ? `${String(h)} h` : '', m > 0 ? `${String(m)} m` : ''];
  return `About ${parts.filter(Boolean).join(' ') || '0 m'} left`;
}

/** Where the work row lives: the grid is fixed so rows align down a list.
 *  Narrower, the time column goes first, then the progress count. */
const GRID =
  'grid-cols-[minmax(0,1fr)_88px_104px] @min-[440px]:grid-cols-[minmax(0,1fr)_140px_104px] @min-[600px]:grid-cols-[minmax(0,1fr)_140px_140px_104px]';

/** One set of homework, one line: opens the set in the workspace
 *  (work-row-d3). `today` is the design page's fixed day. */
export function WorkRow({
  set,
  course,
  done,
  total,
  minutesLeft,
  due,
  href,
  today = new Date(),
}: {
  set: string;
  course: string;
  done: number;
  total: number;
  minutesLeft?: number;
  due?: Date;
  href: string;
  today?: Date;
}) {
  const days = due ? daysUntil(due, today) : undefined;
  const soon = days !== undefined && days <= SOON_DAYS;
  return (
    <a
      href={href}
      className="@container block h-14 min-w-0 border-b border-(--ds-border-muted) hover:bg-(--ds-hover)"
    >
      <span className={`grid h-full items-center gap-4 px-4 ${GRID}`}>
        <span className="min-w-0">
          <span className="ds-body block truncate font-medium text-(--ds-fg)">
            {set}
          </span>
          <span className="ds-small block truncate text-(--ds-fg-muted)">
            {course}
          </span>
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
