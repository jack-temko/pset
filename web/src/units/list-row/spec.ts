import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'list-row',
  kind: 'component',
  title: 'List row',
  group: 'Lists',
  purpose:
    'The one row shape, GitHub issue style: a title and a status on line one, small meta on line two, an optional aside at the right.',
  states: [
    { id: 'plain', name: 'Plain', when: 'A title and meta, the title a link.' },
    {
      id: 'status',
      name: 'With a status tag',
      when: 'A Tag at the far right of line one.',
    },
    {
      id: 'aside',
      name: 'With an aside',
      when: 'A progress bar at the right, spanning both lines.',
    },
    {
      id: 'meta-links',
      name: 'With meta links',
      when: 'Meta items that are muted links; the title is the only link around none of them.',
    },
    {
      id: 'no-href',
      name: 'No href',
      when: 'The title is plain text, not a link.',
    },
  ],
  exampleWidth: 720,
  stress:
    'An 80 character title and 80 characters of meta at 320px: the aside is gone and both truncate on one line.',
  components: [
    { unit: 'link', use: 'The title, and any meta links.' },
    { unit: 'tag', use: 'The status, in the examples.' },
    { unit: 'progress-bar', use: 'The aside, in the examples.' },
  ],
  actions: [
    {
      id: 'open',
      label: 'The title',
      key: 'Enter',
      does: 'Goes where the title\u2019s href says; the caller decides where. Only the title is a link, not the row.',
    },
  ],
  inputs: [
    {
      name: 'title',
      type: 'string',
      default: 'none',
      does: 'Line one, truncating.',
    },
    {
      name: 'href',
      type: 'string',
      default: 'none',
      does: 'Makes the title a link.',
    },
    {
      name: 'status',
      type: 'ReactNode',
      default: 'none',
      does: 'A Tag or short muted text at the far right of line one.',
    },
    {
      name: 'meta',
      type: 'ReactNode[]',
      default: '[]',
      does: 'Short items joined by " \u00b7 ", truncating as a whole; narrowOnly() marks one that shows only where the aside does not.',
    },
    {
      name: 'aside',
      type: 'ReactNode',
      default: 'none',
      does: 'At the right, spanning both lines.',
    },
    {
      name: 'asideWidth',
      type: 'number',
      default: '120',
      does: 'The aside\u2019s width in px, so asides align down a list.',
    },
  ],
  priority: { first: 'The title.', main: 'open' },
  sizes: {
    narrowest: 280,
    gives: [
      'The aside goes below 440',
      'Then the meta truncates, as a whole',
      'Then the title truncates',
    ],
  },
  rules: {
    cite: [
      'links-go-buttons-do',
      'contrast-floors',
      'figures-follow-text',
      'sentence-case',
    ],
  },
  log: 'web/src/units/list-row/log.md',
  decisions: [
    {
      id: 'list-row-d1',
      decision:
        'One row shape for everything: two lines, at least 56 high, 16 sides, 8 above and below. Hover washes the whole row; only the title is a link.',
      why: 'Jack: "More GitHub-ey ... We need to package as tightly as possible."',
      beat: 'A row per kind of thing, with its own columns',
      date: '2026-10-14',
    },
    {
      id: 'list-row-d2',
      decision:
        'Meta is short items joined by a middle dot, truncating as a whole; a meta item may be a muted link.',
      why: 'GitHub\u2019s issue row. Settled afterwards, not asked: the orchestrator\u2019s brief.',
      beat: 'Separate columns for each fact',
      date: '2026-10-14',
    },
    {
      id: 'list-row-d3',
      decision:
        'The aside goes first when the row is narrow; a count the aside repeats is shown only where the aside is not.',
      why: 'Jack: the count always shows. Settled afterwards, not asked: how it is done.',
      beat: 'Hide the count; shrink the aside',
      date: '2026-10-14',
    },
  ],
});
