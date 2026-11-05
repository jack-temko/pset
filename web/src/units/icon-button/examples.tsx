import { ArrowUp, Copy, Square } from 'lucide-react';

import { defineExamples } from '@/design/examples';
import { IconButton } from './index';
import spec from './spec';

export default defineExamples(spec, IconButton, {
  states: {
    quiet: () => <IconButton icon={Copy} label="Copy" />,
    primary: () => <IconButton icon={ArrowUp} label="Send" variant="primary" />,
    default: () => <IconButton icon={Square} label="Stop" variant="default" />,
    named: () => (
      <div className="pb-12">
        <IconButton icon={Copy} label="Copy" reasonOpen />
      </div>
    ),
    busy: () => (
      <IconButton icon={ArrowUp} label="Send" variant="primary" busy />
    ),
    'not-ready': () => (
      <div className="pb-12">
        <IconButton
          icon={ArrowUp}
          label="Send"
          variant="primary"
          notReady="Write a message first"
          reasonOpen
        />
      </div>
    ),
  },
  stress: () => (
    <div className="flex w-[96px] gap-2 outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <IconButton icon={Copy} label="Copy" />
      <IconButton icon={ArrowUp} label="Send" variant="primary" />
      <IconButton icon={Square} label="Stop" variant="default" />
    </div>
  ),
});
