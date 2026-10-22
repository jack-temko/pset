import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'sample-screen',
  kind: 'view',
  title: 'Sample screen',
  group: 'Fixtures',
  purpose: 'A fixture view that lists sample rows, so the map has a neighbour.',
  states: [
    {
      id: 'list',
      name: 'List',
      when: 'The items have loaded.',
    },
    {
      id: 'detail',
      name: 'One item',
      when: 'The student opened a row.',
    },
  ],
  stress: 'Twelve items with 80 character titles.',
  flows: [
    {
      id: 'browse',
      name: 'Browse, then back',
      steps: ['pick-row', 'back'],
    },
  ],
  actions: [
    {
      id: 'pick-row',
      label: 'Open',
      does: 'Opens a row.',
      target: { unit: 'sample-screen', state: 'detail' },
    },
    {
      id: 'back',
      label: 'Back',
      does: 'Returns to the list.',
      target: { unit: 'sample-screen', state: 'list' },
    },
    {
      id: 'more',
      label: 'More',
      does: 'Opens the menu of a row.',
      target: { unit: 'sample-row', state: 'menu' },
    },
  ],
  data: [
    {
      reads: 'The items',
      call: 'sample',
    },
  ],
  remembers: [
    {
      what: 'Which item is open',
      per: 'List',
      for: 'Until another is opened.',
    },
  ],
  inputs: [
    { name: 'items', does: 'The list: a title and a second line each.' },
    { name: 'open', does: 'The title of the row to open.' },
  ],
  priority: { first: 'The list.', main: 'pick-row' },
  sizes: { gives: ['The heading wraps', 'Rows truncate'] },
  rules: { cite: [] },
  decisions: [
    {
      id: 'sample-screen-d1',
      decision: 'Opening a row replaces the list, with Back.',
      why: 'One thing on screen at a time.',
      beat: 'A side panel',
      date: '2026-10-13',
    },
  ],
});
