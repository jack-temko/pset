import { Link } from '@/units/link';
import { ListRow } from '@/units/list-row';
import { narrowOnly } from '@/units/list-row/meta';
import { ProgressBar } from '@/units/progress-bar';
import { DueStatus } from '@/units/set-line';
import { timeLeft } from '@/units/set-line/dates';
import { nearest, type ActiveSet } from './nearest';

/** The aside is a fifth of the row, so the bar grows on wide rows: 20cqw of
 *  the row container, floored at 160 so the count keeps its room, capped at
 *  320 (course-row-d6). */
const ASIDE_WIDTH = 'clamp(160px, 20cqw, 320px)';

/** One course as a list row: the course name (opens the course) on line
 *  one, the nearest active set and its count and time left on line two,
 *  and that set's due and progress bar at the right, centred in the row
 *  (course-row-d3, d4). Home sorts and caps the list (course-row-d2). */
export function CourseRow({
  name,
  href,
  active,
  today = new Date(),
}: {
  name: string;
  href: string;
  /** The course's active sets, usually one. */
  active: readonly ActiveSet[];
  today?: Date;
}) {
  const next = nearest(active, today);
  if (next === undefined)
    return <ListRow title={name} href={href} meta={['Nothing active']} />;
  const time = next.minutesLeft === undefined ? '' : timeLeft(next.minutesLeft);
  const more = active.length - 1;
  return (
    <ListRow
      title={name}
      href={href}
      status={<DueStatus due={next.due} today={today} />}
      meta={[
        <Link
          key="set"
          href={next.href}
          tone="muted"
          size="small"
          className="[overflow-wrap:normal]"
        >
          {next.set}
        </Link>,
        narrowOnly(`${String(next.done)} of ${String(next.total)}`),
        ...(time ? [time] : []),
        ...(more > 0
          ? [
              <Link
                key="more"
                href={href}
                tone="muted"
                size="small"
                className="[overflow-wrap:normal]"
              >
                +{more} more
              </Link>,
            ]
          : []),
      ]}
      aside={<ProgressBar done={next.done} total={next.total} />}
      asideWidth={ASIDE_WIDTH}
    />
  );
}
