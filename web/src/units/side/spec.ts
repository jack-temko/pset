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
    },
    {
      id: 'dropping',
      name: 'A tab dragged over the side',
      when: 'A tab of the other side is dragged anywhere over this one: a translucent accent fill covers the whole side, tab row included, and no outline.',
    },
    {
      id: 'overflow',
      name: 'Too many tabs',
      when: 'Ten tabs: the row shrinks them, then scrolls with a fade at the edge; the pane below does not change.',
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
  actions: [
    {
      id: 'open-tab',
      label: 'A tab',
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
      call: 'sample',
    },
  ],
  inputs: [
    { name: 'label', does: 'The side’s name.' },
    { name: 'tabs', does: 'The tabs in its row.' },
    { name: 'open', does: 'The id of the open tab, or null.' },
    { name: 'add', does: 'The groups of the + menu.' },
    {
      name: 'onOpen',
      does: 'Called with the id of a tab pressed.',
    },
    {
      name: 'onClose',
      does: 'Called with the id of a tab closed.',
    },
    {
      name: 'onAdd',
      does: 'Called with the id of the item picked in the + menu.',
    },
    {
      name: 'onAction',
      does: 'Called with the tab and the action picked in its menu.',
    },
    {
      name: 'onDropTab',
      does: 'Called with the tab dropped and the tab it lands before, or null for the end.',
    },
    {
      name: 'forceMenu',
      does: 'Draws a menu open without a press (the design page only).',
    },
    {
      name: 'forceHover',
      does: 'Draws the hover look without a pointer (the design page only).',
    },
    {
      name: 'forceDropBefore',
      does: 'Draws the drop mark before a tab without a drag (the design page only).',
    },
    {
      name: 'body',
      does: 'The open tab’s pane, or its skeleton while it loads.',
    },
    {
      name: 'dropping',
      does: 'Draws the drop look without a drag.',
    },
  ],
  priority: { first: 'The open pane.', main: 'open-tab' },
  sizes: {
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
