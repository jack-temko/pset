import { Clock, TriangleAlert } from 'lucide-react';

import { defineExamples } from '@/design/examples';
import { Tag } from './index';
import spec from './spec';

export default defineExamples(spec, Tag, {
  states: {
    neutral: () => <Tag>Generated</Tag>,
    attention: () => (
      <Tag tone="attention" icon={Clock}>
        Due Fri
      </Tag>
    ),
    danger: () => (
      <Tag tone="danger" icon={TriangleAlert}>
        Overdue
      </Tag>
    ),
    'attention-plain': () => <Tag tone="attention">Due Fri</Tag>,
  },
  stress: () => (
    <div className="w-[120px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Tag tone="attention" icon={Clock}>
        Due Friday after the midterm review session
      </Tag>
    </div>
  ),
});
