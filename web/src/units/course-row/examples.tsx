import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { SectionHeading } from '@/units/section-heading';
import { CourseRow } from './index';
import spec from './spec';

/** A fixed Tuesday, so "within 2 days" reads the same on every visit. */
const TODAY = new Date(2026, 9, 13);
const day = (d: number) => new Date(2026, 9, d);

const em = {
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
    name="Electromagnetics"
    materials={7}
    sets={3}
    href="#"
    active={[em]}
    today={TODAY}
    {...p}
  />
);

export default defineExamples(spec, {
  states: {
    'due-soon': () => course(),
    'no-date': () =>
      course({
        name: 'Philosophy of mind',
        materials: 1,
        sets: 1,
        active: [{ set: 'Reading questions', done: 1, total: 3, href: '#' }],
      }),
    'two-active': () =>
      course({
        active: [
          { ...em, done: 4, minutesLeft: 35, due: day(19) },
          {
            set: 'Lab report 2',
            done: 9,
            total: 14,
            minutesLeft: 130,
            due: day(23),
            href: '#',
          },
        ],
      }),
    'nothing-active': () => course({ active: [] }),
    empty: () =>
      course({ name: 'Thermodynamics', materials: 0, sets: 0, active: [] }),
    list: () => (
      <div>
        <SectionHeading
          count="8 courses"
          action={
            <Link href="#" size="small">
              Show all
            </Link>
          }
        >
          Courses
        </SectionHeading>
        {course()}
        {course({
          name: 'Signals and systems',
          materials: 12,
          sets: 8,
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
          materials: 4,
          sets: 5,
          active: [
            {
              set: 'Lab report 2',
              done: 9,
              total: 14,
              minutesLeft: 130,
              due: day(23),
              href: '#',
            },
          ],
        })}
        {course({
          name: 'Philosophy of mind',
          materials: 1,
          sets: 1,
          active: [{ set: 'Reading questions', done: 1, total: 3, href: '#' }],
        })}
        {course({ name: 'Linear algebra', materials: 2, sets: 6, active: [] })}
      </div>
    ),
  },
  stress: () => (
    <div className="w-[480px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {course({
        name: 'Electromagnetics and the physics of electrical machines, second year, spring term',
        active: [
          {
            ...em,
            set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
            total: 12,
          },
        ],
      })}
    </div>
  ),
});
