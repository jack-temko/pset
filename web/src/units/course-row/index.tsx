import { ListChecks } from 'lucide-react';

import { ListRow } from '@/units/list-row';
import { MetaStat } from '@/units/list-row/stat';

/** One course as a lean one-line list row: its name (opens the course), then
 *  after a 12px gap the number of sets still to do as a muted icon and
 *  number (course-row-d11). The assignments are in their own list. */
export function CourseRow({
  name,
  href,
  todo,
}: {
  name: string;
  href: string;
  /** Sets still to do; zero shows as 0. */
  todo: number;
}) {
  return (
    <ListRow
      single
      title={name}
      href={href}
      meta={[
        <MetaStat
          key="todo"
          icon={ListChecks}
          value={todo}
          label={`${String(todo)} set${todo === 1 ? '' : 's'} to do`}
        />,
      ]}
    />
  );
}
