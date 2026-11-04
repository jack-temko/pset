import { defineExamples } from '@/design/examples';
import { Plus } from 'lucide-react';

import { Button } from '@/units/button';
import { Link } from '@/units/link';
import { SectionHeading } from './index';
import spec from './spec';

const showAll = (
  <Link href="#" size="small">
    Show all
  </Link>
);

export default defineExamples(spec, SectionHeading, {
  states: {
    plain: () => <SectionHeading>In progress</SectionHeading>,
    count: () => <SectionHeading count={3}>In progress</SectionHeading>,
    action: () => <SectionHeading action={showAll}>In progress</SectionHeading>,
    button: () => (
      <SectionHeading count={1} button={<Button icon={Plus}>Add work</Button>}>
        Work
      </SectionHeading>
    ),
    both: () => (
      <SectionHeading count={8} action={showAll}>
        In progress
      </SectionHeading>
    ),
  },
  stress: () => (
    <div className="w-[240px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <SectionHeading count={8} action={showAll}>
        Electromagnetic fields and waves, problem sets in progress
      </SectionHeading>
    </div>
  ),
});
