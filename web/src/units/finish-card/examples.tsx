import { defineExamples } from '@/design/examples';
import { FinishCard } from './index';
import spec from './spec';

export default defineExamples(spec, {
  states: {
    done: () => <FinishCard count={8} minutes={130} />,
    'no-time': () => <FinishCard count={8} />,
    'turned-in': () => <FinishCard count={8} minutes={130} turnedIn />,
  },
  stress: () => <FinishCard count={999} minutes={99 * 60 + 59} turnedIn />,
});
