import { FileText, ListChecks } from 'lucide-react';

import { openedAgo } from '@/units/assignment-row/opened';
import { ListRow } from '@/units/list-row';
import { MetaStat } from '@/units/list-row/stat';
import { minutesText } from '@/units/set-line/dates';

/** The same aside as the assignment rows, so the two lists' right edges
 *  agree. */
const ASIDE_WIDTH = 'clamp(160px, 20cqw, 320px)';

const count = (n: number, noun: string) =>
  `${String(n)} ${noun}${n === 1 ? '' : 's'}`;

/** One course as a two-line list row: the name, then the sets still to do,
 *  the materials count and when it was last opened, and the time this week
 *  as its aside (course-row-d12). */
export function CourseRow({
  name,
  href,
  todo,
  materials,
  openedAt,
  weekMinutes,
  today = new Date(),
}: {
  name: string;
  href: string;
  /** Sets still to do; zero shows as 0. */
  todo: number;
  /** Materials in the course; zero shows as 0. */
  materials: number;
  /** When the student last opened the course; none when never. */
  openedAt?: Date;
  /** Minutes spent on the course this week. */
  weekMinutes: number;
  /** The moment "Opened 2 h ago" counts from; for the design page and tests. */
  today?: Date;
}) {
  return (
    <ListRow
      title={name}
      href={href}
      meta={[
        <MetaStat
          key="todo"
          icon={ListChecks}
          value={todo}
          label={`${count(todo, 'set')} to do`}
        />,
        <MetaStat
          key="materials"
          icon={FileText}
          value={materials}
          label={count(materials, 'material')}
        />,
        ...(openedAt === undefined ? [] : [openedAgo(openedAt, today)]),
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
