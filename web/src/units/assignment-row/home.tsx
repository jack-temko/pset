import { CourseRow } from '@/units/course-row';
import { List, LIST_CAP } from '@/units/list';
import { countBeside } from '@/units/list/count';
import { SectionHeading } from '@/units/section-heading';
import { AssignmentRow } from './index';
import { listAssignments } from './listed';
import { SETS, TODAY } from './sample';

const COURSES = [
  {
    name: 'Circuits I',
    todo: 2,
    materials: 7,
    weekMinutes: 190,
  },
  {
    name: 'Signals and systems',
    todo: 5,
    materials: 12,
    weekMinutes: 45,
  },
  {
    name: 'Thermodynamics',
    todo: 10,
    materials: 31,
    weekMinutes: 0,
  },
  {
    name: 'Differential equations',
    todo: 1,
    materials: 1,
    weekMinutes: 130,
  },
  { name: 'Linear algebra', todo: 0, materials: 0, weekMinutes: 0 },
  { name: 'Statics', todo: 0, materials: 4, weekMinutes: 0 },
  { name: 'Dynamics', todo: 3, materials: 6, weekMinutes: 20 },
  { name: 'Materials science', todo: 0, materials: 2, weekMinutes: 0 },
];

/** Home as the design page shows it: Assignments, then Courses, 40 apart
 *  (the info area above them comes later). */
export function HomeLists({
  workHref,
  coursesHref,
}: {
  /** Where Assignments' "Show all" goes. */
  workHref: string;
  /** Where Courses' "Show all" goes. */
  coursesHref: string;
}) {
  const all = listAssignments(SETS, TODAY);
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
                today={TODAY}
              />
            ))}
          </List>
        </div>
      </div>
      <div>
        <SectionHeading count={countBeside(COURSES.length)}>
          Courses
        </SectionHeading>
        <div className="mt-3">
          <List cap={LIST_CAP} showAllHref={coursesHref}>
            {COURSES.map((c) => (
              <CourseRow key={c.name} {...c} href="#" />
            ))}
          </List>
        </div>
      </div>
    </div>
  );
}
