import { useState } from 'react';

import { defineExamples } from '@/design/examples';
import type { MenuGroup } from '@/units/menu';
import { Tabs, type TabItem } from './index';
import spec from './spec';

const ADD: MenuGroup[] = [
  {
    label: 'Materials',
    items: [
      { id: 'm:griffiths', label: 'Griffiths' },
      { id: 'm:notes', label: 'Lecture notes, week 6' },
    ],
  },
  { label: 'Sets', items: [{ id: 's:ps5', label: 'Problem set 5' }] },
  { items: [{ id: 'a', label: 'Ask' }] },
];

const THREE: TabItem[] = [
  { id: 'a', label: 'Problem set 4' },
  { id: 'b', label: 'Griffiths', note: 'p. 112' },
  { id: 'c', label: 'Ask' },
];

const twelve = (label: string, note: (i: number) => string): TabItem[] =>
  Array.from({ length: 12 }, (_, i) => ({
    id: `t${String(i)}`,
    label,
    note: note(i),
  }));

/** A row that holds its own state, so the example can be driven. */
function Demo({
  initial,
  open: first,
  ...force
}: {
  initial: TabItem[];
  open: string;
  forceMenu?: 'add' | 'tab';
  forceHover?: string;
  forceDropBefore?: string | null;
}) {
  const [tabs, setTabs] = useState(initial);
  const [open, setOpen] = useState<string | null>(first);
  return (
    <Tabs
      label="Tabs"
      tabs={tabs}
      open={open}
      add={ADD}
      onOpen={setOpen}
      onClose={(id) => {
        setTabs((t) => t.filter((x) => x.id !== id));
      }}
      onAdd={(id) => {
        const tab = { id: `n${String(tabs.length)}${id}`, label: id };
        setTabs((t) => [...t, tab]);
        setOpen(tab.id);
      }}
      onAction={(id, action) => {
        if (action === 'close') setTabs((t) => t.filter((x) => x.id !== id));
        if (action === 'close-others')
          setTabs((t) => t.filter((x) => x.id === id));
      }}
      onDropTab={(id, before) => {
        setTabs((t) => {
          const moved = t.find((x) => x.id === id);
          if (!moved) return t;
          const rest = t.filter((x) => x.id !== id);
          const i = before ? rest.findIndex((x) => x.id === before) : -1;
          return i < 0
            ? [...rest, moved]
            : [...rest.slice(0, i), moved, ...rest.slice(i)];
        });
      }}
      {...force}
    />
  );
}

/** The + and tab menus are in the top layer; the box holds their room. */
const Room = ({ children }: { children: React.ReactNode }) => (
  <div className="h-60">{children}</div>
);

export default defineExamples(spec, Tabs, {
  states: {
    rest: () => <Demo initial={THREE} open="a" />,
    hover: () => <Demo initial={THREE} open="a" forceHover="b" />,
    'add-menu': () => (
      <Room>
        <Demo initial={THREE} open="a" forceMenu="add" />
      </Room>
    ),
    'tab-menu': () => (
      <Room>
        <Demo initial={THREE} open="a" forceMenu="tab" />
      </Room>
    ),
    overflow: () => (
      <Demo
        initial={twelve('Griffiths', (i) => `p. ${String(10 + i * 17)}`)}
        open="t5"
      />
    ),
    dropping: () => <Demo initial={THREE} open="a" forceDropBefore="c" />,
  },
  stress: () => (
    <Demo
      initial={twelve(
        'Introduction to Electrodynamics, fourth edition, by David J. Griffiths',
        (i) => `p. ${String(i)}`,
      )}
      open="t8"
    />
  ),
});
