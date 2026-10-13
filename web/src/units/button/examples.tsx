import { Plus, Trash2 } from 'lucide-react';

import { defineExamples } from '@/design/examples';
import { Button } from './index';
import spec from './spec';

const LONG = 'Start the next problem set from the chapter on magnetic circuits';

export default defineExamples(spec, {
  states: {
    primary: () => <Button variant="primary">Continue</Button>,
    default: () => <Button>Open</Button>,
    quiet: () => <Button variant="quiet">Skip</Button>,
    danger: () => (
      <Button variant="danger" icon={Trash2}>
        Remove
      </Button>
    ),
    icon: () => <Button icon={Plus}>Add a file</Button>,
    busy: () => (
      <div className="flex flex-wrap items-start gap-4">
        <Button variant="primary" busy>
          Continue
        </Button>
        <Button icon={Plus} busy>
          Add a file
        </Button>
      </div>
    ),
    'not-ready': () => (
      <div className="pb-8">
        <Button variant="primary" notReady="Add a file first." reasonOpen>
          Continue
        </Button>
      </div>
    ),
    narrow: () => (
      <div className="w-16">
        <Button>Open</Button>
      </div>
    ),
  },
  stress: () => (
    <div className="w-40">
      <Button variant="primary">{LONG}</Button>
    </div>
  ),
});
