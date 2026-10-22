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
    },
    {
      id: 'menu',
      name: 'Menu open',
      when: 'The student pressed the menu button.',
    },
    {
      id: 'failed',
      name: 'Failed',
      when: 'The item did not load.',
      text: 'Could not load this item: the connection dropped. Try again.',
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
      call: 'sample',
    },
  ],
  inputs: [
    { name: 'title', does: 'The first line.' },
    { name: 'detail', does: 'The second line, muted.' },
    { name: 'menuOpen', does: 'Shows the menu under the row.' },
    {
      name: 'failed',
      does: 'Draws the failed state: the detail in red with an icon.',
    },
  ],
  priority: {
    first: 'The title, then the menu button.',
    main: 'open-item',
  },
  sizes: {
    gives: ['The second line truncates', 'The title truncates'],
  },
  rules: {
    cite: ['failure-says-what'],
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
