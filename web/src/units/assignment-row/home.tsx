import { UNKNOWN, type Unknown } from '@/design/loading';
import { CourseRow } from '@/units/course-row';
import { List, LIST_CAP } from '@/units/list';
import { countBeside } from '@/units/list/count';
import { SectionHeading } from '@/units/section-heading';
import { AssignmentRow } from './index';
import { listAssignments } from './listed';
import type { CourseSummary, HomeSet, ListsShape } from './lists';

/** Home's two lists: Assignments, then Courses, 40 apart. Loading, the
 *  headings are real and each list is its frame at the shape's count; with
 *  nothing known the lists stay quiet (skeleton-grill S2). */
export function HomeLists({
  workHref,
  coursesHref,
  today,
  sets,
  courses,
  loading,
}: {
  /** Where Assignments' "Show all" goes. */
  workHref: string;
  /** Where Courses' "Show all" goes. */
  coursesHref: string;
  /** The moment "due soon" and "opened 2 h ago" count from. */
  today: Date;
} & (
  | {
      sets: readonly HomeSet[];
      courses: readonly CourseSummary[];
      loading?: undefined;
    }
  | { sets?: undefined; courses?: undefined; loading: ListsShape | Unknown }
)) {
  const all = loading === undefined ? listAssignments(sets, today) : [];
  const shape =
    loading === undefined
      ? { assignments: all.length, courses: courses.length }
      : loading === UNKNOWN
        ? undefined
        : loading;
  const on = loading !== undefined;
  const count = (n: number | undefined) =>
    n === undefined ? undefined : countBeside(n);
  const listLoading = (n: number | undefined) =>
    !on ? undefined : n === undefined ? UNKNOWN : { count: n };
  return (
    <div className="space-y-10">
      <div>
        <SectionHeading count={count(shape?.assignments)} loading={on}>
          Assignments
        </SectionHeading>
        <div className="mt-3">
          <List
            cap={LIST_CAP}
            showAllHref={workHref}
            loading={listLoading(shape?.assignments)}
            row={(i) => <AssignmentRow key={i} loading={{ row: i }} />}
          >
            {all.map((a) => (
              <AssignmentRow
                key={a.set}
                {...a}
                href="#"
                courseHref="#"
                today={today}
              />
            ))}
          </List>
        </div>
      </div>
      <div>
        <SectionHeading count={count(shape?.courses)} loading={on}>
          Courses
        </SectionHeading>
        <div className="mt-3">
          <List
            cap={LIST_CAP}
            showAllHref={coursesHref}
            loading={listLoading(shape?.courses)}
            row={(i) => <CourseRow key={i} loading={{ row: i }} />}
          >
            {(courses ?? []).map((c) => (
              <CourseRow key={c.name} {...c} href="#" />
            ))}
          </List>
        </div>
      </div>
    </div>
  );
}
