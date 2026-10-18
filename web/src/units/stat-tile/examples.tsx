import { defineExamples } from '@/design/examples';
import { StatTile, StatTileSkeleton } from './index';
import spec from './spec';

const skeleton = () => <StatTileSkeleton />;

export default defineExamples(spec, {
  states: {
    'with-last-week': () => (
      <StatTile
        label="Time this week"
        value="4 h 20 m"
        note="Last week: 2 h 40 m"
      />
    ),
    alone: () => <StatTile label="Questions done" value="14" />,
    zero: () => (
      <StatTile label="Time this week" value="0 m" note="Last week: 0 m" />
    ),
  },
  stress: () => (
    <div className="w-[160px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <StatTile
        label="Time spent in the last seven days across every course"
        value="120 h 45 m"
        note="The week before, across every course: 119 h 30 m"
      />
    </div>
  ),
  skeletons: {
    'with-last-week': skeleton,
    alone: skeleton,
    zero: skeleton,
  },
});
