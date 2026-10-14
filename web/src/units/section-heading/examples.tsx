import { defineExamples } from '@/design/examples';
import { Link } from '@/units/link';
import { SectionHeading } from './index';
import spec from './spec';

const showAll = (
  <Link href="#" className="ds-small">
    Show all
  </Link>
);

export default defineExamples(spec, {
  states: {
    plain: () => <SectionHeading>In progress</SectionHeading>,
    count: () => <SectionHeading count="3 sets">In progress</SectionHeading>,
    action: () => <SectionHeading action={showAll}>In progress</SectionHeading>,
    both: () => (
      <SectionHeading count="8 sets" action={showAll}>
        In progress
      </SectionHeading>
    ),
  },
  stress: () => (
    <div className="w-[240px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <SectionHeading count="8 sets" action={showAll}>
        Electromagnetic fields and waves, problem sets in progress
      </SectionHeading>
    </div>
  ),
});
