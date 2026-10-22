import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'menu',
  kind: 'component',
  title: 'Menu',
  group: 'Navigation',
  purpose:
    'A small list of choices opened at a point, in groups with optional headings. It sits in the top layer, keeps inside the window, and closes on a pick, an outside press or Escape.',
  states: [
    {
      id: 'add',
      name: 'Grouped, with headings',
      when: 'The + menu: Materials and Sets under headings, then Ask on its own after a hairline.',
    },
    {
      id: 'tab',
      name: 'Plain groups',
      when: 'A tab’s menu: two groups without headings, moves first and closes second.',
    },
    {
      id: 'more',
      name: 'More button',
      when: 'The "⋯" button opens a short list of actions under it, right-aligned to it, with a danger item in the danger colour (menu-d2).',
    },
  ],
  stress:
    'A 100 character item and twelve more: the long one truncates with its full text as a title, and the list scrolls inside 70% of the window.',
  actions: [
    {
      id: 'pick',
      label: 'An item',
      does: 'Does what the item says and closes the menu. Arrow keys move between items.',
    },
    {
      id: 'dismiss',
      label: 'Outside or Escape',
      does: 'Closes the menu and changes nothing.',
    },
  ],
  inputs: [
    {
      name: 'at',
      does: 'Where its top left corner goes, in window coordinates; it shifts to keep 8 from the edge.',
    },
    {
      name: 'groups',
      does: 'The choices, in groups; a heading when the group has a label.',
    },
    {
      name: 'label',
      does: 'The menu’s name.',
    },
    {
      name: 'onPick',
      does: 'Called with the id of the item picked.',
    },
    {
      name: 'onClose',
      does: 'Called when the menu closes without a pick.',
    },
  ],
  priority: { first: 'The first item, which has focus.', main: 'pick' },
  sizes: {
    gives: ['Long labels truncate', 'A long list scrolls inside the menu'],
  },
  rules: {
    cite: ['links-go-buttons-do', 'sentence-case'],
  },
  log: 'web/src/units/menu/log.md',
  decisions: [
    {
      id: 'menu-d1',
      decision:
        'A menu is opened at a point and drawn in the top layer, so a scrolling tab row cannot clip it.',
      why: 'Built small for the + menu and the tab menu of the workspace (ideas/workspace.md); no menu existed.',
      beat: 'A menu inside the row',
      date: '2026-10-21',
    },
    {
      id: 'menu-d2',
      decision:
        'One menu for the workspace and the work pane: `Menu` stays, and the "⋯" button is `MoreMenu` in the same unit; the action menu is gone.',
      why: 'Both did one job. Menu already has the top layer, window clamping, truncation and groups; the action menu was a button and a plain list.',
      beat: 'Keeping the action menu and widening it to open at a point',
      date: '2026-10-21',
    },
  ],
});
