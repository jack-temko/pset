import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'side',
  kind: 'pane',
  title: 'Side',
  group: 'Panes',
  purpose:
    'One side of the workspace: a row of tabs over the open tab’s pane. The tab row is there at once; the pane loads on its own, with its own skeleton.',
  states: [
    {
      id: 'default',
      name: 'Two tabs and a pane',
      when: 'The first tab is open and its pane fills the side.',
      skeleton:
        'The real tab row over the pane’s own skeleton: a label bar, a title bar, a page number bar and a page-shaped block.',
    },
    {
      id: 'dropping',
      name: 'A tab dragged over the side',
      when: 'A tab of the other side is dragged anywhere over this one: a translucent accent fill covers the whole side, tab row included, and no outline.',
      skeleton: 'The same fill over the pane’s skeleton.',
    },
    {
      id: 'overflow',
      name: 'Too many tabs',
      when: 'Ten tabs: the row shrinks them, then scrolls with a fade at the edge; the pane below does not change.',
      skeleton: 'The real tab row, scrolling, over the pane’s skeleton.',
    },
  ],
  stress:
    'A 70 character material name as the tab and the title, with eleven tabs: the tab truncates, the title wraps, and nothing overflows the side.',
  flows: [
    {
      id: 'switch-and-close',
      name: 'Switch tabs and close one',
      steps: ['open-tab', 'close-tab'],
    },
  ],
  components: [
    { unit: 'tabs', use: 'The row of tabs over the pane.' },
    { unit: 'pane-stub', use: 'Stand-in panes for the example.' },
  ],
  actions: [
    {
      id: 'open-tab',
      label: 'A tab',
      key: 'Enter',
      does: 'Shows that tab’s pane in this side.',
    },
    {
      id: 'close-tab',
      label: 'The x on a tab',
      does: 'Closes it. A side whose last tab closes folds away (the workspace does that).',
    },
    {
      id: 'drop-tab',
      label: 'Dropping a tab on the pane',
      does: 'Moves the dragged tab to the end of this side and opens it.',
    },
  ],
  data: [
    {
      reads: 'The open tab’s pane: a set, a material or Ask',
      call: 'None yet: stand-in panes with sample data',
      waiting: 'The tab row shows at once; the pane is its own skeleton.',
      failed: 'Not designed: the panes’ own grills decide.',
    },
  ],
  inputs: [
    {
      name: 'label, tabs, open, add, end',
      type: 'as Tabs',
      default: 'none',
      does: 'The side’s name and what its tab row shows.',
    },
    {
      name: 'body',
      type: 'ReactNode',
      default: 'none',
      does: 'The open tab’s pane, or its skeleton while it loads.',
    },
    {
      name: 'onOpen, onClose, onAdd, onAction, onDropTab, dropping',
      type: 'callbacks, boolean',
      default: 'none',
      does: 'Every change goes to the caller; dropping draws the drop look without a drag.',
    },
  ],
  priority: { first: 'The open pane.', main: 'open-tab' },
  sizes: {
    narrowest: 360,
    gives: [
      'Tabs shrink, then the row scrolls',
      'The pane scrolls inside the side',
    ],
  },
  exampleWidth: 560,
  rules: {
    cite: ['material-is-main', 'honest-waits', 'sentence-case'],
  },
  log: 'web/src/units/side/log.md',
  decisions: [
    {
      id: 'side-d1',
      decision:
        'Each side loads on its own, with its own skeleton; its tab row shows at once.',
      why: 'Assumed in workspace-grill.',
      beat: 'One skeleton for both sides',
      date: '2026-10-21',
    },
    {
      id: 'side-d3',
      decision:
        'Every drop target is the whole side, tab row included, tinted with a translucent accent fill: no outline, never dashed. A row reorder shows a 2px bar.',
      why: 'Jack, W18: "it can look weird when the outline slightly overlaps the underline of the active tab because its the same color." Full words in the log.',
      beat: 'An outline on the pane; a dashed box on a folded side',
      date: '2026-10-21',
    },
    {
      id: 'side-d2',
      decision:
        'A side holds any of a set, a material or Ask, as tabs; the pane is given, not chosen here.',
      why: 'Jack’s pick, W2 and W5: the same tabs as everything else.',
      beat: 'Fixed roles for the sides',
      date: '2026-10-21',
    },
  ],
});
