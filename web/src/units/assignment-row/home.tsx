import { CourseRow } from '@/units/course-row';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { SectionHeading } from '@/units/section-heading';
import { parseDueDate } from '@/units/set-line/dates';
import { AssignmentRow } from './index';

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

/** Home as the design page shows it: Assignments, then Courses, 40 apart
 *  (the info area above them comes later). */
export function HomeLists() {
  return (
    <div className="space-y-10">
      <div>
        <SectionHeading count={9} action={showAll}>
          Assignments
        </SectionHeading>
        <div className="mt-3">
          <List>
            <AssignmentRow
              set="Problem set 4"
              href="#"
              course="Circuits I"
              courseHref="#"
              done={0}
              total={6}
              minutesLeft={70}
              due={day(15)}
              reason="due"
              today={TODAY}
            />
            <AssignmentRow
              set="Problem set 2"
              href="#"
              course="Thermodynamics"
              courseHref="#"
              done={3}
              total={8}
              due={day(10)}
              reason="due"
              today={TODAY}
            />
            <AssignmentRow
              set="Homework 7"
              href="#"
              course="Signals and systems"
              courseHref="#"
              done={3}
              total={5}
              minutesLeft={45}
              due={day(18)}
              reason="due"
              today={TODAY}
            />
            <AssignmentRow
              set="Lab report 2"
              href="#"
              course="Linear algebra"
              courseHref="#"
              done={1}
              total={4}
              reason="opened"
              openedAt={ago(2)}
              today={TODAY}
            />
            <AssignmentRow
              set="Homework 3"
              href="#"
              course="Differential equations"
              courseHref="#"
              done={1}
              total={3}
              minutesLeft={130}
              due={day(27)}
              reason="opened"
              openedAt={ago(72)}
              today={TODAY}
            />
          </List>
        </div>
      </div>
      <div>
        <SectionHeading count={8} action={showAll}>
          Courses
        </SectionHeading>
        <div className="mt-3">
          <List>
            <CourseRow name="Circuits I" href="#" todo={2} />
            <CourseRow name="Signals and systems" href="#" todo={5} />
            <CourseRow name="Thermodynamics" href="#" todo={10} />
            <CourseRow name="Differential equations" href="#" todo={1} />
            <CourseRow name="Linear algebra" href="#" todo={0} />
          </List>
        </div>
      </div>
    </div>
  );
}
