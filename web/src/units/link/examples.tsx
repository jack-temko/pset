import { defineExamples } from '@/design/examples';
import { Link } from './index';
import spec from './spec';

const LONG =
  'Read the whole chapter on magnetic circuits, hysteresis and transformer losses before the next set';

export default defineExamples(spec, {
  states: {
    standalone: () => <Link href="#">Open the course</Link>,
    'inline-serif': () => (
      <p className="ds-reading ds-measure">
        Start from what the problem gives you, then see{' '}
        <Link href="#" inline>
          Problem 5.3
        </Link>{' '}
        for the same loop.
      </p>
    ),
    'inline-sans': () => (
      <p className="ds-body">
        Generated from{' '}
        <Link href="#" inline>
          page 212
        </Link>{' '}
        of your textbook.
      </p>
    ),
    hover: () => (
      <Link href="#" forceState="hover">
        Open the course
      </Link>
    ),
    focus: () => (
      <Link href="#" forceState="focus">
        Open the course
      </Link>
    ),
  },
  stress: () => (
    <div className="w-[200px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Link href="#">{LONG}</Link>
    </div>
  ),
});
