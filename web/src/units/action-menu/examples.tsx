import { defineExamples } from '@/design/examples';
import { ActionMenu } from './index';
import spec from './spec';

const ITEMS = [
  { id: 'edit', label: 'Edit the text' },
  { id: 'move', label: 'Move' },
  { id: 'notes', label: 'Edit the note' },
];

const frame = (node: React.ReactNode, tall = 0) => (
  <div className="flex justify-end" style={{ minHeight: tall }}>
    {node}
  </div>
);

export default defineExamples(spec, {
  states: {
    closed: () => frame(<ActionMenu label="More" items={ITEMS} />),
    open: () => frame(<ActionMenu label="More" items={ITEMS} forceOpen />, 160),
    danger: () =>
      frame(
        <ActionMenu
          label="More"
          items={[...ITEMS, { id: 'remove', label: 'Remove', danger: true }]}
          forceOpen
        />,
        200,
      ),
  },
  stress: () =>
    frame(
      <ActionMenu
        label="More"
        forceOpen
        items={Array.from({ length: 8 }, (_, i) => ({
          id: `i${String(i)}`,
          label:
            i === 3
              ? 'Check how the figure reads against the page it came from, again'
              : `Item ${String(i + 1)}`,
        }))}
      />,
      320,
    ),
});
