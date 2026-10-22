import { defineExamples } from '@/design/examples';
import { BarChart, BarChartSkeleton, type Bar } from './index';
import spec from './spec';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const text = (m: number) =>
  m >= 60
    ? `${String(Math.floor(m / 60))} h ${String(m % 60)} m`
    : `${String(m)} m`;

function week(minutes: number[], today: number, big = 1): Bar[] {
  return DAYS.map((d, i) => ({
    label: d,
    value: (minutes[i] ?? 0) * big,
    tip: `${d}\n${text((minutes[i] ?? 0) * big)}`,
    today: i === today,
    future: i > today,
  }));
}

const skeleton = () => <BarChartSkeleton />;

export default defineExamples(spec, BarChart, {
  states: {
    midweek: () => (
      <div className="h-40">
        <BarChart bars={week([65, 95], 1)} />
      </div>
    ),
    'full-week': () => (
      <BarChart bars={week([65, 95, 0, 40, 130, 20, 75], 6)} />
    ),
    quiet: () => <BarChart bars={week([0, 0, 0], 2)} />,
  },
  stress: () => (
    <div className="w-[320px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <BarChart bars={week([65, 95, 600, 40, 130, 20, 75], 6, 1)} />
    </div>
  ),
  skeletons: { midweek: skeleton, 'full-week': skeleton, quiet: skeleton },
});
