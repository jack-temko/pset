import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'list-row',
  kind: 'component',
  title: 'List row',
  group: 'Lists',
  purpose:
    'The one row shape, GitHub issue style: a title on line one, small meta on line two, the status and an optional aside at the right, centred vertically in the row.',
  states: [
    { id: 'plain', name: 'Plain', when: 'A title and meta, the title a link.' },
    {
      id: 'status',
      name: 'With a status',
      when: 'A Tag or short muted text at the right of the row, centred vertically in it.',
    },
    {
      id: 'label',
      name: 'With a label',
      when: 'A Tag right after the title on line one, like a GitHub label; the title truncates first.',
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
    'An 80 character title and 80 characters of meta beside an aside: both truncate on one line and the aside keeps its width.',
  actions: [
    {
      id: 'open',
      label: 'The title',
      does: 'Goes where the title\u2019s href says; the caller decides where. Only the title is a link, not the row.',
    },
  ],
  inputs: [
    { name: 'title', does: 'Line one, truncating.' },
    { name: 'href', does: 'Makes the title a link.' },
    {
      name: 'label',
      does: 'A Tag right after the title on line one, 8 apart, centred on the title.',
    },
    {
      name: 'status',
      does: 'A Tag or short muted text at the right of the row, centred vertically in it.',
    },
    {
      name: 'meta',
      does: 'Short items joined by " · ", truncating as a whole.',
    },
    { name: 'aside', does: 'At the right, spanning both lines.' },
    {
      name: 'asideWidth',
      does: 'The aside’s width: a number is px, a string any CSS width, so asides align down a list.',
    },
  ],
  priority: { first: 'The title.', main: 'open' },
  sizes: {
    gives: ['Then the meta truncates, as a whole', 'Then the title truncates'],
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
        'One row shape for everything: two lines, at least 56 high, 16 sides, 8 above and below. Only the title is a link.',
      why: 'Jack: "More GitHub-ey ... We need to package as tightly as possible."',
      beat: 'A row per kind of thing, with its own columns',
      date: '2026-10-14',
      supersededBy: 'list-row-d7',
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
      supersededBy: 'list-row-d10',
    },
    {
      id: 'list-row-d4',
      decision:
        'The status sits centred on line one, against the middle of the title.',
      why: 'Jack: "These need to be centered vertically".',
      beat: 'A status that read as riding high on the line',
      date: '2026-10-14',
      supersededBy: 'list-row-d5',
    },
    {
      id: 'list-row-d5',
      decision:
        'The status sits at the right of the row, centred vertically in it, on a level with the aside.',
      why: 'Jack: "These need to be centered vertically in the row please. Take a look at GitHub and how they do badges like that in rows."',
      beat: 'On line one, centred against the title (list-row-d4)',
      date: '2026-10-15',
    },
    {
      id: 'list-row-d6',
      decision:
        'A label slot sits right after the title on line one, 8 apart and centred on the title; the title truncates first.',
      why: 'Jack: "Can we try to always have the due date, but have badges for overdue and due soon?" and chose a label after the course name, like GitHub.',
      beat: 'Just before the date, on the right; in the grey line',
      date: '2026-10-16',
    },
    {
      id: 'list-row-d7',
      decision:
        'The row takes no hover ground, and a title link is only as wide as its text, never a full-width block.',
      why: 'Jack: "The hover target for these links should not expand across the entire row, just cover the text."',
      beat: 'A hover wash over the whole row (list-row-d1)',
      date: '2026-10-16',
    },
    {
      id: 'list-row-d8',
      decision:
        'A count is a muted 12px icon and number in the meta (MetaStat), its words in a tooltip, after a 12px gap, not a dot.',
      why: 'Jack: "Can we display this with some muted icons and digits somewhere? Kinda how github does the line diffs"',
      beat: 'Counts in words; a separate stats slot after the title',
      date: '2026-10-16',
      supersededBy: 'list-row-d9',
    },
    {
      id: 'list-row-d9',
      decision:
        'Counts in the meta are plain words, joined by " \u00b7 " like the rest; there are no icon stats.',
      why: 'Jack: "change the icons to text, e.g. 3 sets * 5 materials"; nothing else used them.',
      beat: 'A muted icon and number in the meta (list-row-d8)',
      date: '2026-10-16',
    },
    {
      id: 'list-row-d10',
      decision:
        'The aside always shows, and no meta item is narrow-only: there is no narrow layout.',
      why: 'Desktop only; the spec format change (ideas/spec-format-grill.md, F10) strips the narrow code.',
      beat: 'The aside going first when the row is narrow (list-row-d3)',
      date: '2026-10-22',
    },
  ],
});
