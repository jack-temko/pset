import { defineExamples } from '@/design/examples';
import { ProgressBar } from './index';
import spec from './spec';

export default defineExamples(spec, {
  states: {
    'none-done': () => <ProgressBar done={0} total={6} />,
    'some-done': () => <ProgressBar done={2} total={6} />,
    'all-done': () => <ProgressBar done={6} total={6} />,
    'one-problem': () => <ProgressBar done={0} total={1} />,
    twelve: () => <ProgressBar done={5} total={12} />,
    thirty: () => <ProgressBar done={11} total={30} />,
  },
  stress: () => (
    <div className="w-[96px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <ProgressBar done={5} total={12} />
    </div>
  ),
});
