import { CourseRow } from '@/units/course-row';
import { List, LIST_CAP } from '@/units/list';
import { countBeside } from '@/units/list/count';
import { SectionHeading } from '@/units/section-heading';
import { AssignmentRow } from './index';
import { listAssignments } from './listed';
import type { CourseSummary, HomeSet } from './lists';

/** Home's two lists: Assignments, then Courses, 40 apart. */
export function HomeLists({
  workHref,
  coursesHref,
  today,
  sets,
  courses,
}: {
  /** Where Assignments' "Show all" goes. */
  workHref: string;
  /** Where Courses' "Show all" goes. */
  coursesHref: string;
  /** The moment "due soon" and "opened 2 h ago" count from. */
  today: Date;
  sets: readonly HomeSet[];
  courses: readonly CourseSummary[];
}) {
  const all = listAssignments(sets, today);
  return (
    <div className="space-y-10">
      <div>
        <SectionHeading count={countBeside(all.length)}>
          Assignments
        </SectionHeading>
        <div className="mt-3">
          <List cap={LIST_CAP} showAllHref={workHref}>
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
        <SectionHeading count={countBeside(courses.length)}>
          Courses
        </SectionHeading>
        <div className="mt-3">
          <List cap={LIST_CAP} showAllHref={coursesHref}>
            {courses.map((c) => (
              <CourseRow key={c.name} {...c} href="#" />
            ))}
          </List>
        </div>
      </div>
    </div>
  );
}
