import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'list',
  kind: 'component',
  title: 'List',
  group: 'Lists',
  purpose:
    'A bordered box of rows, as the old Box was: an optional header band, rules between rows, and a line for when it is empty.',
  states: [
    {
      id: 'header',
      name: 'With a header',
      when: 'A title, a Counter and an action over the rows.',
    },
    {
      id: 'no-header',
      name: 'Without a header',
      when: 'The rows alone, under a section heading on the screen.',
    },
    {
      id: 'empty',
      name: 'Empty',
      when: 'No rows: one muted line.',
      text: 'Nothing here yet',
    },
    {
      id: 'eight',
      name: 'Eight rows',
      when: 'A long list: the rules between rows, none after the last.',
    },
  ],
  stress:
    'A 70 character title in a 240px container: the title truncates; the Counter and action stay.',
  components: [
    { unit: 'counter', use: 'The header\u2019s count.' },
    { unit: 'list-row', use: 'The rows, in the examples.' },
    { unit: 'link', use: 'The header\u2019s action, in the examples.' },
  ],
  actions: [],
  inputs: [
    {
      name: 'title',
      type: 'string',
      default: 'none',
      does: 'The header\u2019s title; without it there is no header.',
    },
    {
      name: 'count',
      type: 'ReactNode',
      default: 'none',
      does: 'A Counter after the title.',
    },
    {
      name: 'action',
      type: 'ReactNode',
      default: 'none',
      does: 'A text link at the right of the header.',
    },
    {
      name: 'empty',
      type: 'string',
      default: 'Nothing here yet',
      does: 'The line shown with no rows.',
    },
    { name: 'children', type: 'ReactNode', default: 'none', does: 'The rows.' },
  ],
  priority: { first: 'The rows; the header, when there is one.' },
  sizes: {
    narrowest: 240,
    gives: ['The header title truncates', 'The rows truncate their own lines'],
  },
  rules: { cite: ['contrast-floors', 'sentence-case'] },
  log: 'web/src/units/list/log.md',
  decisions: [
    {
      id: 'list-d1',
      decision:
        'The old Box in `ds` tokens: 1px frame, control radius, a header band 40 high, rows on `bg`, muted rules between rows (drawn by the list).',
      why: 'Jack: "I want to be more similar to my old design", and a row must not draw its own rules.',
      beat: 'Rows that draw their own rules',
      date: '2026-10-14',
    },
    {
      id: 'list-d2',
      decision:
        'The header is optional: on Home a section heading sits above the list, as the old Home did.',
      why: 'Jack: the old Home framed its lists under a SectionHeader.',
      beat: 'A header on every list',
      date: '2026-10-14',
    },
  ],
});
