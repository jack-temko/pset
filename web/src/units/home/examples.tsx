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
  <Home
    name="Jack"
    now={NOW}
    pick={0}
    sets={SETS}
    study={STUDY}
    questions={{ thisWeek: 14, lastWeek: 11 }}
    {...p}
  />
);

export default defineExamples(spec, {
  states: {
    'beside-two-six-months': () => home(),
    'beside-two-year': () => home({ span: 'year' }),
    'beside-one-six-months': () => home({ tiles: 'one' }),
    'beside-one-year': () => home({ tiles: 'one', span: 'year' }),
    'stacked-two-six-months': () => home({ layout: 'stacked' }),
    'stacked-two-year': () => home({ layout: 'stacked', span: 'year' }),
    'stacked-one-six-months': () => home({ layout: 'stacked', tiles: 'one' }),
    'stacked-one-year': () =>
      home({ layout: 'stacked', tiles: 'one', span: 'year' }),
    'no-time': () =>
      home({
        name: '',
        study: [],
        questions: { thisWeek: 0, lastWeek: 0 },
      }),
  },
  stress: () => (
    <div className="w-[360px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      {home({
        name: 'Maximilian Alexander Featherstonehaugh',
        span: 'year',
        sets: [
          {
            set: 'Problem set 4: magnetic circuits, hysteresis and transformer losses, parts A to F',
            due: new Date(2026, 9, 15),
            done: 0,
            total: 6,
          },
        ],
        study: STUDY.map((d) => ({
          ...d,
          courses: d.courses.map((c) => ({
            ...c,
            course: 'Electromagnetics and the physics of electrical machines',
          })),
        })),
        questions: { thisWeek: 1234, lastWeek: 1198 },
      })}
    </div>
  ),
  skeletons: {
    'beside-two-six-months': () => <HomeSkeleton />,
    'beside-two-year': () => <HomeSkeleton />,
    'beside-one-six-months': () => <HomeSkeleton tiles="one" />,
    'beside-one-year': () => <HomeSkeleton tiles="one" />,
    'stacked-two-six-months': () => <HomeSkeleton layout="stacked" />,
    'stacked-two-year': () => <HomeSkeleton layout="stacked" />,
    'stacked-one-six-months': () => (
      <HomeSkeleton layout="stacked" tiles="one" />
    ),
    'stacked-one-year': () => <HomeSkeleton layout="stacked" tiles="one" />,
    'no-time': () => <HomeSkeleton />,
  },
});
