import { defineExamples } from '@/design/examples';
import spec from './spec';
import { SampleScreen, SampleScreenSkeleton } from './screen';

const ITEMS = [
  { title: 'Problem set 4', detail: 'Due Friday, 6 questions' },
  { title: 'Problem set 5', detail: 'Due next week, 8 questions' },
  { title: 'Midterm review', detail: 'No date, 20 questions' },
];

export default defineExamples(spec, SampleScreen, {
  states: {
    list: () => <SampleScreen items={ITEMS} />,
    detail: () => <SampleScreen items={ITEMS} open />,
  },
  stress: () => (
    <SampleScreen
      items={Array.from({ length: 12 }, (_, i) => ({
        title: `Item ${String(i + 1)}: a title that goes on and on until it cannot fit`,
        detail: 'A second line with a date, a count and a name in it',
      }))}
    />
  ),
  skeletons: {
    list: () => <SampleScreenSkeleton />,
    detail: () => <SampleScreenSkeleton />,
  },
});
