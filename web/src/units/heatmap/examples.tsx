import { defineExamples } from '@/design/examples';
import { SAMPLE_TODAY, sampleStudy } from '@/design/study-sample';
import { addDays, dayKey } from './day';
import { Heatmap, HeatmapSkeleton, type StudyDay } from './index';
import spec from './spec';

const DAYS = sampleStudy();

/** Last Friday's study, a few courses, to hold its tooltip open. */
const FRIDAY = dayKey(addDays(SAMPLE_TODAY, -4));

const LONG_COURSES = [
  'Electromagnetics and the physics of electrical machines, part one',
  'Introduction to signals, systems and the transforms that describe them',
  'Thermodynamics and statistical mechanics for engineers and scientists',
];
const STRESS_DAYS: StudyDay[] = DAYS.map((d) => ({
  date: d.date,
  courses: d.courses.map((c, i) => ({
    course: LONG_COURSES[i % LONG_COURSES.length],
    minutes: c.minutes,
  })),
}));

/** A fixed width, so the example is narrow whatever the page is. */
function In({ px, children }: { px: number; children: React.ReactNode }) {
  return (
    <div
      className="max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)"
      style={{ width: px }}
    >
      {children}
    </div>
  );
}

const skeleton = () => <HeatmapSkeleton />;

export default defineExamples(spec, Heatmap, {
  states: {
    'six-months': () => <Heatmap days={DAYS} today={SAMPLE_TODAY} weeks={26} />,
    grown: () => (
      <div className="w-[880px] max-w-full">
        <Heatmap days={DAYS} today={SAMPLE_TODAY} weeks={26} grow />
      </div>
    ),
    narrow: () => (
      <In px={264}>
        <Heatmap days={DAYS} today={SAMPLE_TODAY} weeks={26} />
      </In>
    ),
    hover: () => (
      <div className="pb-40">
        <Heatmap
          days={[
            ...DAYS.filter((d) => d.date !== FRIDAY),
            {
              date: FRIDAY,
              courses: [
                { course: 'Linear algebra', minutes: 25 },
                { course: 'Circuits I', minutes: 70 },
                { course: 'Thermodynamics', minutes: 15 },
              ],
            },
          ]}
          today={SAMPLE_TODAY}
          weeks={26}
          openDay={FRIDAY}
        />
      </div>
    ),
    empty: () => <Heatmap days={[]} today={SAMPLE_TODAY} weeks={26} />,
  },
  stress: () => (
    <div className="pb-48">
      <Heatmap
        days={STRESS_DAYS}
        today={SAMPLE_TODAY}
        weeks={53}
        openDay={dayKey(addDays(SAMPLE_TODAY, -1))}
      />
    </div>
  ),
  skeletons: {
    'six-months': skeleton,
    grown: () => (
      <div className="w-[880px] max-w-full">
        <HeatmapSkeleton grow />
      </div>
    ),
    narrow: () => <In px={264}>{skeleton()}</In>,
    hover: skeleton,
    empty: skeleton,
  },
});
