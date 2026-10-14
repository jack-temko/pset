import { Clock } from 'lucide-react';

import { defineExamples } from '@/design/examples';
import { Tag } from './index';
import spec from './spec';

export default defineExamples(spec, {
  states: {
    neutral: () => <Tag>Generated</Tag>,
    attention: () => (
      <Tag tone="attention" icon={Clock}>
        Due Fri
      </Tag>
    ),
    'attention-plain': () => <Tag tone="attention">Due Fri</Tag>,
  },
  stress: () => (
    <div className="w-[120px]">
      <Tag tone="attention" icon={Clock}>
        Due Friday after the midterm review session
      </Tag>
    </div>
  ),
});
