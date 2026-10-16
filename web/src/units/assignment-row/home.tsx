import { CourseRow } from '@/units/course-row';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { SectionHeading } from '@/units/section-heading';
import { parseDueDate } from '@/units/set-line/dates';
import { AssignmentRow } from './index';
import { listAssignments } from './listed';

/** A fixed Tuesday noon, so "due soon" and "opened 2 h ago" read the same on
 *  every visit. */
const TODAY = new Date(2026, 9, 13, 12);
const day = (d: number) =>
  parseDueDate(`2026-10-${String(d).padStart(2, '0')}`);
const ago = (hours: number) => new Date(TODAY.getTime() - hours * 3_600_000);

const showAll = (
  <Link href="#" size="small">
    Show all
  </Link>
);

/** The sets, in no order: the list's own rule orders and caps them. */
const SETS = [
  {
    set: 'Homework 3',
    course: 'Differential equations',
    done: 1,
    total: 3,
    minutesLeft: 130,
    due: day(27),
    openedAt: ago(72),
  },
  {
    set: 'Problem set 4',
    course: 'Circuits I',
    done: 0,
    total: 6,
    minutesLeft: 70,
    due: day(15),
  },
  {
    set: 'Problem set 6',
    course: 'Linear algebra',
    done: 1,
    total: 4,
    openedAt: ago(2),
  },
  {
    set: 'Homework 7',
    course: 'Signals and systems',
    done: 3,
    total: 5,
    minutesLeft: 45,
    due: day(18),
  },
  {
    set: 'Problem set 2',
    course: 'Thermodynamics',
    done: 3,
    total: 8,
    due: day(10),
  },
  {
    set: 'Homework 5',
    course: 'Circuits I',
    done: 2,
    total: 6,
    due: day(17),
  },
  {
    set: 'Problem set 1',
    course: 'Linear algebra',
    done: 4,
    total: 4,
    due: day(30),
    openedAt: ago(30 * 24),
  },
];

const COURSES = [
  {
    name: 'Circuits I',
    todo: 2,
    materials: 7,
    openedAt: ago(26),
    weekMinutes: 190,
  },
  {
    name: 'Signals and systems',
    todo: 5,
    materials: 12,
    openedAt: ago(2),
    weekMinutes: 45,
  },
  {
    name: 'Thermodynamics',
    todo: 10,
    materials: 31,
    openedAt: ago(24 * 12),
    weekMinutes: 0,
  },
  {
    name: 'Differential equations',
    todo: 1,
    materials: 1,
    openedAt: ago(72),
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
              <CourseRow key={c.name} {...c} href="#" today={TODAY} />
            ))}
          </List>
        </div>
      </div>
    </div>
  );
}
