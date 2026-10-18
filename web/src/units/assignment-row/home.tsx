import { CourseRow } from '@/units/course-row';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { SectionHeading } from '@/units/section-heading';
import { AssignmentRow } from './index';
import { listAssignments } from './listed';
import { SETS, TODAY } from './sample';

const showAll = (
  <Link href="#" size="small">
    Show all
  </Link>
);

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
];

/** Home as the design page shows it: Assignments, then Courses, 40 apart
 *  (the info area above them comes later). */
export function HomeLists() {
  const { shown, more } = listAssignments(SETS, TODAY);
  return (
    <div className="space-y-10">
      <div>
        <SectionHeading count={shown.length + more} action={showAll}>
          Assignments
        </SectionHeading>
        <div className="mt-3">
          <List>
            {shown.map((a) => (
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
        <SectionHeading count={8} action={showAll}>
          Courses
        </SectionHeading>
        <div className="mt-3">
          <List>
            {COURSES.map((c) => (
              <CourseRow key={c.name} {...c} href="#" />
            ))}
          </List>
        </div>
      </div>
    </div>
  );
}
