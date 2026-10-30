import { useState } from 'react';

import { defineExamples } from '@/design/examples';
import { Button } from '@/units/button';
import { TextField } from './index';
import spec from './spec';

function Held({
  start,
  ...rest
}: { start: string } & Omit<
  Parameters<typeof TextField>[0],
  'value' | 'onChange'
>) {
  const [value, set] = useState(start);
  return <TextField {...rest} value={value} onChange={set} />;
}

export default defineExamples(spec, TextField, {
  states: {
    empty: () => <Held start="" label="Name" placeholder="Your first name" />,
    filled: () => <Held start="Jack" label="Name" />,
    inline: () => (
      <div className="ds-body flex h-8 items-center rounded-(--ds-radius-control) border border-(--ds-border-muted) px-4">
        <Held start="Problem set 7" label="Name" inline="row" />
      </div>
    ),
    multiline: () => (
      <Held
        start="When a problem has a figure, describe what you see in it before using it, and name every node and mesh the way the figure labels them."
        label="Memory"
        multiline
      />
    ),
    saved: () => <Held start="Jack" label="Name" note="Saved" />,
    key: () => (
      <Held
        start="sk-or-v1-4f2a9c1e77b0"
        label="Model key"
        mono
        secret
        action={<Button>Test</Button>}
      />
    ),
    failed: () => (
      <Held
        start="sk-or-v1-0000"
        label="Model key"
        mono
        failed
        note="The key was refused"
        action={<Button>Test</Button>}
      />
    ),
  },
  stress: () => (
    <div className="w-[240px] max-w-full outline-[1px] outline-dashed outline-(--ds-border-muted)">
      <Held
        start={'sk-or-v1-'.padEnd(120, 'x')}
        label="A label that is longer than the field it sits over"
        mono
        action={<Button>Test</Button>}
      />
    </div>
  ),
});
