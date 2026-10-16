import { defineExamples } from '@/design/examples';
import { parseDueDate } from '@/units/set-line/dates';
import { HomeLists } from './home';
import { AssignmentRow, type AssignmentRowProps } from './index';
import spec from './spec';

/** A fixed Tuesday noon, so "due soon" and "opened 2 h ago" read the same on
 *  every visit. */
const TODAY = new Date(2026, 9, 13, 12);
const day = (d: number) =>
  parseDueDate(`2026-10-${String(d).padStart(2, '0')}`);
const ago = (hours: number) => new Date(TODAY.getTime() - hours * 3_600_000);

const row = (p: Partial<AssignmentRowProps> = {}) => (
  <AssignmentRow
    set="Problem set 4"
    href="#"
    course="Circuits I"
    courseHref="#"
    done={2}
    total={6}
    minutesLeft={70}
    due={day(18)}
    reason="due"
    today={TODAY}
    {...p}
  />
);

export default defineExamples(spec, {
  states: {
    'due-soon': () => row({ done: 0, due: day(15) }),
    overdue: () => row({ done: 3, due: day(10) }),
    later: () => row(),
    opened: () =>
      row({
        set: 'Lab report 2',
        course: 'Linear algebra',
        due: undefined,
        minutesLeft: undefined,
        reason: 'opened',
        openedAt: ago(2),
      }),
    'no-time': () => row({ minutesLeft: undefined }),
    list: () => <HomeLists />,
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {row({
        set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
        course: 'Electromagnetics and the physics of electrical machines',
        due: day(14),
        reason: 'opened',
        openedAt: ago(5),
      })}
    </div>
  ),
});
