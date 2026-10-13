import { Clock } from 'lucide-react';

import { defineExamples } from '@/design/examples';
import { Tag } from './index';
import spec from './spec';

export default defineExamples(spec, {
  states: {
    neutral: () => <Tag>generated</Tag>,
    attention: () => (
      <Tag tone="attention" icon={Clock}>
        due Fri
      </Tag>
    ),
    'attention-plain': () => <Tag tone="attention">due Fri</Tag>,
  },
  stress: () => (
    <div className="w-[120px]">
      <Tag tone="attention" icon={Clock}>
        due Friday after the midterm review session
      </Tag>
    </div>
  ),
});
