import { defineExamples } from '@/design/examples';
import { Meter } from './index';
import spec from './spec';

export default defineExamples(spec, Meter, {
  states: {
    half: () => <Meter value={5} max={10} />,
    empty: () => <Meter value={0} max={10} />,
    full: () => <Meter value={10} max={10} />,
  },
  stress: () => (
    <div className="space-y-2">
      <Meter value={30} max={10} />
      <Meter value={3} max={0} />
    </div>
  ),
});
