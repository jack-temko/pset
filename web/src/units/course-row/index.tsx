import { Bone } from '@/units/bone';
import { ListRow } from '@/units/list-row';
import { minutesText } from '@/units/set-line/dates';

/** The same aside as the assignment rows, so the two lists' right edges
 *  agree. */
const ASIDE_WIDTH = 'clamp(160px, 20cqw, 320px)';

/** One course as a two-line list row: the name, then the sets still to do and
 *  the materials in words, and the time this week as its aside
 *  (course-row-d12). */
interface CourseRowProps {
  name: string;
  href: string;
  /** Assignments still to do; zero says "Nothing to do". */
  todo: number;
  /** Materials in the course; zero is left out. */
  materials: number;
  /** Minutes spent on the course this week. */
  weekMinutes: number;
}

export function CourseRow(
  props:
    | (CourseRowProps & { loading?: undefined })
    | (Partial<CourseRowProps> & {
        /** Draws its loading form: its place in the list, which picks the
         *  bars' widths (course-row-d14). */
        loading: { row: number };
      }),
) {
  if (props.loading !== undefined)
    return (
      <ListRow
        loading={{ row: props.loading.row, lines: 2 }}
        aside={
          <span className="ds-small block min-h-5 text-right">
            <Bone ch={11} />
          </span>
        }
        asideWidth={ASIDE_WIDTH}
      />
    );
  const { name, href, todo, materials, weekMinutes } = props;
  return (
    <ListRow
      rowLink
      title={name}
      href={href}
      // A zero is said in words or not at all (course-row-d13): a printed 0
      // reads as data and costs a scan.
      meta={[
        todo === 0
          ? 'Nothing to do'
          : `${String(todo)} assignment${todo === 1 ? '' : 's'} to do`,
        ...(materials > 0
          ? [`${String(materials)} material${materials === 1 ? '' : 's'}`]
          : []),
      ]}
      aside={
        <span className="ds-small ds-tabular block min-h-5 text-right whitespace-nowrap text-(--ds-fg-muted)">
          {weekMinutes > 0 && `${minutesText(weekMinutes)} this week`}
        </span>
      }
      asideWidth={ASIDE_WIDTH}
    />
  );
}
