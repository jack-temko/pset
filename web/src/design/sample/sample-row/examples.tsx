import { defineExamples } from '@/design/examples';
import spec from './spec';
import { SampleRow, SampleRowSkeleton } from './row';

const LONG_TITLE =
  'The title of an item that goes on and on until it cannot fit in any column at all';
const LONG_DETAIL =
  'A second line that also goes on, well past the width of the row, with a date, a count and a name in it';

export default defineExamples(spec, SampleRow, {
  states: {
    rest: () => (
      <SampleRow title="Problem set 4" detail="Due Friday, 6 questions" />
    ),
    menu: () => (
      <SampleRow
        title="Problem set 4"
        detail="Due Friday, 6 questions"
        menuOpen
      />
    ),
    failed: () => (
      <SampleRow
        title="Problem set 4"
        detail="Could not load this item: the connection dropped. Try again."
        failed
      />
    ),
  },
  stress: () => <SampleRow title={LONG_TITLE} detail={LONG_DETAIL} menuOpen />,
  skeletons: {
    rest: () => <SampleRowSkeleton />,
    menu: () => <SampleRowSkeleton />,
    failed: () => <SampleRowSkeleton />,
  },
});
