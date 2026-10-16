import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { List } from '@/units/list';
import { parseDueDate } from '@/units/set-line/dates';
import { SectionHeading } from '@/units/section-heading';
import { CourseRow } from './index';
import spec from './spec';

/** A fixed Tuesday, so "within 2 days" reads the same on every visit. */
const TODAY = new Date(2026, 9, 13);
const day = (d: number) =>
  parseDueDate(`2026-10-${String(d).padStart(2, '0')}`);

const circuits = {
  set: 'Problem set 4',
  done: 0,
  total: 6,
  due: day(15),
  href: '#',
};

const course = (
  p: Partial<Parameters<typeof CourseRow>[0]> = {},
): React.ReactNode => (
  <CourseRow
    name="Circuits I"
    href="#"
    active={[circuits]}
    sets={3}
    today={TODAY}
    {...p}
  />
);

export default defineExamples(spec, {
  states: {
    'due-soon': () => course(),
    overdue: () => course({ active: [{ ...circuits, done: 3, due: day(10) }] }),
    'no-date': () =>
      course({
        name: 'Differential equations',
        active: [{ set: 'Homework 2', done: 1, total: 3, href: '#' }],
      }),
    'two-active': () =>
      course({
        active: [
          { ...circuits, done: 4, minutesLeft: 35, due: day(19) },
          {
            set: 'Homework 7',
            done: 9,
            total: 14,
            minutesLeft: 130,
            due: day(23),
            href: '#',
          },
        ],
      }),
    'nothing-active': () => course({ active: [] }),
    empty: () => course({ name: 'Thermodynamics', active: [] }),
    list: () => (
      <div>
        <SectionHeading
          count={8}
          action={
            <Link href="#" size="small">
              Show all
            </Link>
          }
        >
          Courses
        </SectionHeading>
        <div className="mt-3">
          <List>
            {course()}
            {course({
              name: 'Signals and systems',
              sets: 5,
              active: [
                {
                  set: 'Homework 7',
                  done: 3,
                  total: 5,
                  minutesLeft: 45,
                  due: day(18),
                  href: '#',
                },
              ],
            })}
            {course({
              name: 'Thermodynamics',
              sets: 10,
              active: [
                {
                  set: 'Problem set 3',
                  done: 9,
                  total: 14,
                  minutesLeft: 130,
                  due: day(23),
                  href: '#',
                },
              ],
            })}
            {course({
              name: 'Differential equations',
              sets: 1,
              active: [{ set: 'Homework 2', done: 1, total: 3, href: '#' }],
            })}
            {course({
              name: 'Linear algebra',
              sets: 0,
              active: [],
            })}
          </List>
        </div>
      </div>
    ),
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {course({
        name: 'Electromagnetics and the physics of electrical machines, second year, spring term',
        active: [
          {
            ...circuits,
            set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
            total: 12,
            minutesLeft: 70,
          },
          { ...circuits, set: 'Problem set 5', due: day(20) },
        ],
      })}
    </div>
  ),
});
