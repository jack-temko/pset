import { useState } from 'react';

import { defineExamples } from '@/design/examples';
import { MaterialStub, MaterialStubSkeleton } from '@/units/pane-stub';
import type { TabItem } from '@/units/tabs';
import { Side } from './index';
import spec from './spec';

const noop = () => {};

const TABS: TabItem[] = [
  { id: 'a', label: 'Griffiths · p. 112' },
  { id: 'b', label: 'Lecture notes, week 6 · p. 4' },
];

function Demo({
  tabs = TABS,
  loading,
  dropping,
  name = 'Griffiths',
}: {
  tabs?: TabItem[];
  loading?: boolean;
  dropping?: boolean;
  name?: string;
}) {
  const [open, setOpen] = useState<string | null>(tabs[0].id);
  return (
    <div className="h-[480px] w-full">
      <Side
        label="Side"
        tabs={tabs}
        open={open}
        add={[{ items: [{ id: 'a', label: 'Ask' }] }]}
        dropping={dropping}
        body={
          loading ? (
            <MaterialStubSkeleton />
          ) : (
            <MaterialStub name={name} page={112} />
          )
        }
        onOpen={setOpen}
        onClose={noop}
        onAdd={noop}
        onAction={noop}
        onDropTab={noop}
      />
    </div>
  );
}

const many = Array.from({ length: 10 }, (_, i) => ({
  id: `t${String(i)}`,
  label: `Griffiths · p. ${String(10 + i * 17)}`,
}));

export default defineExamples(spec, {
  states: {
    default: () => <Demo />,
    dropping: () => <Demo dropping />,
    overflow: () => <Demo tabs={many} />,
  },
  stress: () => (
    <Demo
      name="Introduction to Electrodynamics, fourth edition, by David J. Griffiths"
      tabs={[
        {
          id: 'a',
          label:
            'Introduction to Electrodynamics, fourth edition, by David J. Griffiths · p. 112',
        },
        ...many,
      ]}
    />
  ),
  skeletons: {
    default: () => <Demo loading />,
    dropping: () => <Demo loading dropping />,
    overflow: () => <Demo loading tabs={many} />,
  },
});
