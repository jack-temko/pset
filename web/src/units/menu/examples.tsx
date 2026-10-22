import { useLayoutEffect, useRef, useState } from 'react';

import { defineExamples } from '@/design/examples';
import { Menu, MoreMenu, type MenuGroup } from './index';
import spec from './spec';

const noop = () => {};

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

const TAB: MenuGroup[] = [
  {
    items: [
      { id: 'move', label: 'Move to other side' },
      { id: 'swap', label: 'Swap sides' },
    ],
  },
  {
    items: [
      { id: 'close', label: 'Close' },
      { id: 'close-others', label: 'Close others' },
    ],
  },
];

/** Opens the menu at its own place on the page, wherever the page puts it,
 *  and holds 240px of room for it. */
function Open({ groups, label }: { groups: MenuGroup[]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ x: number; y: number }>();
  useLayoutEffect(() => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setAt({ x: r.left, y: r.top });
  }, []);
  return (
    <div ref={ref} className="h-60">
      {at && (
        <Menu
          at={at}
          groups={groups}
          label={label}
          onPick={noop}
          onClose={noop}
        />
      )}
    </div>
  );
}

export default defineExamples(spec, {
  states: {
    add: () => <Open groups={ADD} label="Open" />,
    tab: () => <Open groups={TAB} label="Tab" />,
    more: () => (
      <div className="flex h-60 justify-end">
        <MoreMenu
          label="More"
          forceOpen
          items={[
            { id: 'edit', label: 'Edit the text' },
            { id: 'move', label: 'Move' },
            { id: 'remove', label: 'Remove', danger: true },
          ]}
        />
      </div>
    ),
  },
  stress: () => (
    <Open
      label="Open"
      groups={[
        {
          label: 'Materials',
          items: [
            {
              id: 'x',
              label:
                'Electromagnetics and the physics of electrical machines, lecture notes, week 6: magnetic circuits',
            },
          ],
        },
        ...Array.from({ length: 12 }, (_, i) => ({
          items: [{ id: String(i), label: `Problem set ${String(i + 1)}` }],
        })),
      ]}
    />
  ),
});
