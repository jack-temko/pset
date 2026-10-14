import { Link } from '@/units/link';
import { ListRow, narrowOnly } from '@/units/list-row';
import { ProgressBar } from '@/units/progress-bar';
import { DueStatus, type SetLineProps } from '@/units/set-line';
import { daysUntil, timeLeft } from '@/units/set-line/dates';

export type ActiveSet = Omit<SetLineProps, 'today'>;

/** The nearest active set: the earliest due date, undated ones last. */
export function nearest(
  active: readonly ActiveSet[],
  today: Date,
): ActiveSet | undefined {
  const key = (a: ActiveSet) =>
    a.due === undefined ? Infinity : daysUntil(a.due, today);
  return [...active].sort((a, b) => key(a) - key(b))[0];
}

/** One course as a list row: the course name (opens the course), the nearest
 *  active set's due on line one, that set (opens it), its count and time left
 *  on line two, and its progress bar at the right (course-row-d3, d4).
 *  Home sorts and caps the list (course-row-d2). */
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
      asideWidth={120}
    />
  );
}
