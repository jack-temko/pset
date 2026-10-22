import { useState } from 'react';

import { defineExamples } from '@/design/examples';
import { SegmentedControl, type Segment } from './index';
import spec from './spec';

const THEMES: Segment[] = [
  { id: 'paper', label: 'Paper' },
  { id: 'night', label: 'Night' },
  { id: 'system', label: 'System' },
];

function Held({
  start,
  options = THEMES,
}: {
  start: string;
  options?: Segment[];
}) {
  const [value, set] = useState(start);
  return (
    <SegmentedControl
      label="Appearance"
      options={options}
      value={value}
      onChange={set}
    />
  );
}

export default defineExamples(spec, SegmentedControl, {
  states: {
    first: () => <Held start="paper" />,
    middle: () => <Held start="night" />,
  },
  stress: () => (
    <div className="w-[320px] outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Held
        start="a"
        options={['a', 'b', 'c', 'd'].map((id) => ({
          id,
          label: `Option ${id} with a long label`,
        }))}
      />
    </div>
  ),
});
