import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'sample-row',
  kind: 'component',
  title: 'Sample row',
  group: 'Fixtures',
  purpose:
    'A fixture that shows every field of a spec: a list row with a title, a second line and a menu.',
  states: [
    {
      id: 'rest',
      name: 'Rest',
      when: 'The item has loaded and nothing is open.',
      skeleton: 'Two text lines and a square for the menu button.',
    },
    {
      id: 'menu',
      name: 'Menu open',
      when: 'The student pressed the menu button.',
      skeleton: 'The rest skeleton: the menu opens only on loaded content.',
    },
    {
      id: 'failed',
      name: 'Failed',
      when: 'The item did not load.',
      text: 'Could not load this item. Try again.',
      skeleton: 'The rest skeleton.',
    },
  ],
  stress:
    'A title of 80 characters and a second line of 120, in a 160px column.',
  flows: [
    {
      id: 'delete-item',
      name: 'Delete an item',
      steps: ['open-menu', 'open-item'],
    },
  ],
  actions: [
    {
      id: 'open-menu',
      label: 'More',
      key: 'm',
      does: 'Opens the row menu.',
      target: { unit: 'sample-row', state: 'menu' },
    },
    {
      id: 'open-item',
      label: 'Open',
      does: 'Opens the item on its own screen.',
      target: { unit: 'sample-screen', state: 'detail' },
    },
    {
      id: 'delete',
      label: 'Delete',
      does: 'Removes the item after the student confirms.',
    },
  ],
  data: [
    {
      reads: 'One item',
      call: 'GET /api/sample/items/:id',
      waiting: 'The skeleton row.',
      failed: 'The failed state, with its text.',
    },
  ],
  inputs: [
    {
      name: 'title',
      type: 'string',
      default: 'none',
      does: 'The first line.',
    },
    {
      name: 'detail',
      type: 'string',
      default: 'none',
      does: 'The second line, muted.',
    },
    {
      name: 'menuOpen',
      type: 'boolean',
      default: 'false',
      does: 'Shows the menu under the row.',
    },
  ],
  priority: {
    first: 'The title, then the menu button.',
    main: 'open-item',
  },
  sizes: {
    narrowest: 160,
    gives: ['The second line truncates', 'The title truncates'],
  },
  rules: {
    cite: [],
    local: [
      {
        id: 'sample-row-truncate',
        rule: 'Keep a row title on one line.',
        check: 'Set Stress on the page: the title ends in an ellipsis.',
        scope: 'sample-row',
      },
    ],
  },
  log: 'web/src/design/sample/sample-row/log.md',
  decisions: [
    {
      id: 'sample-row-d1',
      decision: 'The menu opens under the row, not over the list.',
      why: 'Nothing is covered, so nothing below it jumps.',
      beat: 'A floating menu',
      date: '2026-10-13',
    },
    {
      id: 'sample-row-d2',
      decision: 'A failed row keeps its place and says why.',
      why: 'The list does not reflow when one item fails.',
      beat: 'Removing the row',
      date: '2026-10-13',
    },
  ],
});
