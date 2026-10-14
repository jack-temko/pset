import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { SectionHeading } from '@/units/section-heading';
import { WorkRow } from './index';
import spec from './spec';

/** A fixed Tuesday, so "within 2 days" reads the same on every visit. */
const TODAY = new Date(2026, 9, 13);
const day = (d: number) => new Date(2026, 9, d);

const row = (p: Partial<Parameters<typeof WorkRow>[0]> = {}) => (
  <WorkRow
    set="Problem set 4"
    course="Electromagnetics"
    done={2}
    total={6}
    minutesLeft={70}
    due={day(19)}
    href="#"
    today={TODAY}
    {...p}
  />
);

export default defineExamples(spec, {
  states: {
    'with-time': () => row(),
    'without-time': () => row({ minutesLeft: undefined }),
    'due-soon': () => row({ done: 0, minutesLeft: undefined, due: day(15) }),
    'no-date': () => row({ due: undefined }),
    list: () => (
      <div>
        <SectionHeading
          count="8 sets"
          action={
            <Link href="#" className="ds-small">
              Show all
            </Link>
          }
        >
          In progress
        </SectionHeading>
        {row({ done: 0, minutesLeft: undefined, due: day(14) })}
        {row({
          set: 'Homework 7',
          course: 'Signals and systems',
          done: 3,
          total: 5,
          minutesLeft: 45,
          due: day(15),
        })}
        {row()}
        {row({
          set: 'Lab report 2',
          course: 'Thermodynamics',
          done: 9,
          total: 14,
          minutesLeft: 130,
          due: day(23),
        })}
        {row({
          set: 'Reading questions',
          course: 'Philosophy of mind',
          done: 1,
          total: 3,
          minutesLeft: undefined,
          due: undefined,
        })}
      </div>
    ),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {row({
        set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
        course: 'Electromagnetics and the physics of machines, second year',
        total: 12,
        due: day(14),
      })}
    </div>
  ),
});
