import { Link } from '@/units/link';
import { SetLine, type SetLineProps } from '@/units/set-line';
import { count } from './count';

/** One course: its name (opens the course), what it holds, and its active
 *  sets, each opening its set (course-row-d1). Home sorts and caps the list
 *  (course-row-d2). Below 920 the sets stack under the name. */
export function CourseRow({
  name,
  materials,
  sets,
  href,
  active,
  today,
}: {
  name: string;
  materials: number;
  sets: number;
  href: string;
  /** The course's active sets, usually one. */
  active: readonly Omit<SetLineProps, 'today'>[];
  today?: Date;
}) {
  return (
    <div className="@container min-w-0 border-b border-(--ds-border-muted)">
      <div className="grid min-w-0 gap-2 px-4 py-2 @min-[920px]:grid-cols-[220px_minmax(0,1fr)] @min-[920px]:gap-4">
        <div className="min-w-0 px-0.5">
          <Link
            href={href}
            title={name}
            className="block truncate font-medium!"
          >
            {name}
          </Link>
          <p className="ds-small truncate text-(--ds-fg-muted)">
            {count(materials, 'material', 'materials')},{' '}
            {count(sets, 'set', 'sets').toLowerCase()}
          </p>
        </div>
        <div className="min-w-0">
          {active.length === 0 ? (
            <p className="ds-small flex h-10 items-center px-3 text-(--ds-fg-muted)">
              Nothing active
            </p>
          ) : (
            active.map((a) => <SetLine key={a.href} {...a} today={today} />)
          )}
        </div>
      </div>
    </div>
  );
}
