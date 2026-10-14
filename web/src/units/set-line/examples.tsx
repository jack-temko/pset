import { defineExamples } from '@/design/examples';
import { SetLine, type SetLineProps } from './index';
import spec from './spec';

/** A fixed Tuesday, so "within 2 days" reads the same on every visit. */
const TODAY = new Date(2026, 9, 13);
const day = (d: number) => new Date(2026, 9, d);

const line = (p: Partial<SetLineProps> = {}) => (
  <SetLine
    set="Problem set 4"
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
    'with-time': () => line(),
    'without-time': () => line({ minutesLeft: undefined }),
    'due-soon': () => line({ done: 0, minutesLeft: undefined, due: day(15) }),
    'no-date': () => line({ due: undefined }),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {line({
        set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
        total: 12,
        due: day(14),
      })}
    </div>
  ),
});
