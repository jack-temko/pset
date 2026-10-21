import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'action-menu',
  kind: 'component',
  title: 'Action menu',
  group: 'Work',
  purpose:
    'A "⋯" button that opens a short list of actions under it: what a screen has no room to name. It closes after an item runs.',
  states: [
    {
      id: 'closed',
      name: 'Closed',
      when: 'The default: the "⋯" button.',
    },
    {
      id: 'open',
      name: 'Open',
      when: 'The card of items under the button, right-aligned to it.',
    },
    {
      id: 'danger',
      name: 'With a danger item',
      when: 'An item that takes something away, such as Remove, in the danger colour.',
    },
  ],
  exampleWidth: 560,
  stress:
    'Eight items, the longest 60 characters: the card grows to the longest and no item truncates.',
  actions: [
    {
      id: 'open',
      label: 'The "⋯" button',
      key: 'Enter',
      does: 'Opens the card and focuses its first item. Arrow keys move between items; Escape or a press elsewhere closes it.',
    },
    {
      id: 'pick',
      label: 'An item',
      key: 'Enter',
      does: 'Runs the item, closes the card and gives focus back to the button.',
    },
  ],
  inputs: [
    {
      name: 'label',
      type: 'string',
      default: 'none',
      does: 'The button’s name, such as "More for this problem".',
    },
    {
      name: 'items',
      type: 'MenuItem[]',
      default: 'none',
      does: 'Each item’s id and label, and whether it is dangerous.',
    },
    {
      name: 'onSelect',
      type: '(id) => void',
      default: 'none',
      does: 'Which item was picked.',
    },
  ],
  priority: { first: 'The button; then the first item.', main: 'open' },
  sizes: {
    narrowest: 320,
    gives: ['The card is as wide as its longest item, at least 176'],
  },
  components: [],
  rules: {
    cite: ['student-decides', 'sentence-case', 'colour-has-a-word'],
  },
  log: 'web/src/units/action-menu/log.md',
  decisions: [
    {
      id: 'action-menu-d1',
      decision:
        'Everything that is not the work itself goes in one menu, not in the row of buttons.',
      why: 'Jack picked "Only the work (Recommended)": today shows 14 controls (F9/F10) (P4).',
      beat: 'Keeping notes and "wrong problem" visible',
      date: '2026-10-21',
    },
  ],
});
