import { ListRow } from '@/units/list-row';
import { minutesText } from '@/units/set-line/dates';

/** The same aside as the assignment rows, so the two lists' right edges
 *  agree. */
const ASIDE_WIDTH = 'clamp(160px, 20cqw, 320px)';

/** One course as a two-line list row: the name, then the sets still to do and
 *  the materials in words, and the time this week as its aside
 *  (course-row-d12). */
export function CourseRow({
  name,
  href,
  todo,
  materials,
  weekMinutes,
}: {
  name: string;
  href: string;
  /** Sets still to do; zero shows as "0 sets to do". */
  todo: number;
  /** Materials in the course; zero shows as "0 materials". */
  materials: number;
  /** Minutes spent on the course this week. */
  weekMinutes: number;
}) {
  return (
    <ListRow
      title={name}
      href={href}
      meta={[
        `${String(todo)} set${todo === 1 ? '' : 's'} to do`,
        `${String(materials)} material${materials === 1 ? '' : 's'}`,
      ]}
      aside={
        <span className="ds-small ds-tabular block text-right whitespace-nowrap text-(--ds-fg-muted)">
          {minutesText(weekMinutes)} this week
        </span>
      }
      asideWidth={ASIDE_WIDTH}
    />
  );
}
