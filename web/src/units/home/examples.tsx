import { defineExamples } from '@/design/examples';
import { sampleStudy } from '@/design/study-sample';
import { SETS, TODAY } from '@/units/assignment-row/sample';
import { Home, HomeSkeleton } from './index';
import spec from './spec';

/** Tuesday evening, so the greeting is the 5pm stretch and a study day is
 *  still the same day. */
const NOW = new Date(
  TODAY.getFullYear(),
  TODAY.getMonth(),
  TODAY.getDate(),
  18,
);
const STUDY = sampleStudy();

const home = (p: Partial<Parameters<typeof Home>[0]> = {}) => (
  <Home name="Jack" now={NOW} pick={0} sets={SETS} study={STUDY} {...p} />
);

export default defineExamples(spec, {
  states: {
    default: () => home(),
    'no-time': () => home({ name: '', study: [], sets: [] }),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {home({
        name: 'Maximilian Alexander Featherstonehaugh',
        sets: [
          {
            set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
            due: new Date(2026, 9, 15),
            done: 0,
            total: 999,
          },
        ],
        study: STUDY.map((d) => ({
          ...d,
          questions: (d.questions ?? 0) * 80,
          courses: d.courses.map((c) => ({
            course: 'Electromagnetics and the physics of electrical machines',
            minutes: c.minutes * 40,
          })),
        })),
      })}
    </div>
  ),
  skeletons: {
    default: () => <HomeSkeleton />,
    'no-time': () => <HomeSkeleton />,
  },
});
