import { defineExamples } from '@/design/examples';
import { Counter } from './index';
import spec from './spec';

export default defineExamples(spec, Counter, {
  states: {
    'one-digit': () => <Counter>8</Counter>,
    'three-digits': () => <Counter>128</Counter>,
  },
  stress: () => (
    <div className="w-[32px] outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Counter>1,234</Counter>
    </div>
  ),
});
