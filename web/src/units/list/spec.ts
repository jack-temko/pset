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
      when: 'No rows: one muted line, centred in the box.',
      text: 'Nothing here yet',
    },
    {
      id: 'eight',
      name: 'Eight rows',
      when: 'A long list with no cap: the rules between rows, none after the last.',
    },
    {
      id: 'switch',
      name: 'With a state switch',
      when: 'A list with states: "To do 1" and "Done 6" in the header, the chosen one in full ink; pressing the other swaps the rows in the same box.',
      text: 'Done',
    },
    {
      id: 'capped',
      name: 'Capped',
      when: 'More rows than the cap: five show, and the last row of the box is "Show all 8", centred, a link to the list page.',
      text: 'Show all 8',
    },
    {
      id: 'switch-empty',
      name: 'To do side empty',
      when: 'The chosen side has no rows: one quiet line, and the list stays on it; the other side keeps its count in the header.',
      text: 'Nothing to do',
    },
  ],
  stress:
    'A 70 character title in a 240px container: the title truncates; the Counter and action stay.',
  actions: [
    {
      id: 'switch-state',
      label: 'To do, Done',
      does: 'Swaps the rows to that state; both counts stay in the header.',
    },
    {
      id: 'show-all',
      label: 'Show all 8',
      does: 'Opens the list page, filtered to this list.',
      target: { unit: 'list-page', state: 'filtered' },
    },
  ],
  inputs: [
    {
      name: 'title',
      does: 'The header’s title; without it there is no header.',
    },
    { name: 'count', does: 'A Counter after the title.' },
    {
      name: 'action',
      does: 'A text link at the right of the header, for a list that is never capped.',
    },
    {
      name: 'states',
      does: 'The states as a switch in the header, each with its count; one state is no switch.',
    },
    { name: 'state', does: 'The id of the chosen state.' },
    { name: 'onState', does: 'Called with the id of the state pressed.' },
    {
      name: 'cap',
      does: 'How many rows show before the "Show all N" row (LIST_CAP, 5, on summary screens).',
    },
    {
      name: 'showAllHref',
      does: 'Where "Show all N" goes: the list page, filtered to this list.',
    },
    {
      name: 'empty',
      does: 'The line shown with no rows; it may hold one action, such as Clear filters.',
    },
    { name: 'children', does: 'The rows.' },
  ],
  priority: { first: 'The rows; the header, when there is one.' },
  sizes: {
    gives: ['The header title truncates', 'The rows truncate their own lines'],
  },
  rules: { cite: ['contrast-floors', 'sentence-case', 'say-it-once'] },
  log: 'web/src/units/list/log.md',
  decisions: [
    {
      id: 'list-d3',
      decision:
        'A summary list shows at most 5 rows (LIST_CAP), to do too; "Show all 14" is the box’s last row and opens the list page. Nothing expands inline.',
      why: 'Jack: "Cap 5, Show all page (Recommended)", "Foot, with a count (Recommended)" and "Yes, one rule (Recommended)" (L2, L3, L9).',
      beat: 'Expand inline; "Show all" at the header’s right; never cap to do',
      date: '2026-11-04',
    },
    {
      id: 'list-d4',
      decision:
        'States are a header switch, "To do 1" and "Done 6", both counts in view; one swaps the rows. An empty side says so; the list never switches itself.',
      why: 'Jack: "Switch in header (Recommended)" and "Stay on To do, say so (Recommended)" (L1, L8; A4).',
      beat: 'A fold under the rows; a separate Done list; switching to Done by itself',
      date: '2026-11-04',
    },
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
    {
      id: 'list-d5',
      decision:
        'The count beside a list\'s heading shows only from 1 to the cap: a zero says nothing, and past the cap "Show all N" already says it.',
      why: 'Fable review, items 13 and 20 (no printed zeros; say it once). Jack took them in the review batch.',
      beat: '"Assignments 6" above "Show all 6"; "Materials 0"',
      date: '2026-11-09',
    },
    {
      id: 'list-d6',
      decision:
        'Loading, the list is its real frame with row(i) per row of the shape, cut by the cap; counts are bars; count 0 is the empty box; nothing known draws nothing.',
      why: 'Step 5 of the loading skeleton plan (ideas/skeleton-plan.md): a list loads as itself, so nothing on the screen moves when its rows come.',
      beat: 'Every screen drawing its own slab for a list',
      date: '2026-11-14',
      supersededBy: 'list-d8',
    },
    {
      id: 'list-d7',
      decision:
        'The Show all number’s bar is exactly its digits wide, and the number is in tabular figures, so the foot does not shift when it comes.',
      why: 'Jack: "The number after show all makes that line jump slightly."',
      beat: 'A bar of at least 2ch, wider than a one-digit number',
      date: '2026-11-14',
      supersededBy: 'list-d8',
    },
    {
      id: 'list-d8',
      decision:
        'No loading form of its own: no rows at a remembered count; its screen holds the previous one until the rows are in (loading D1, D7).',
      why: 'Jack, 2026-11-16: "Hold the old screen" and "Only what has a caller" (ideas/skeleton-grill.md D1, D7): reads take 1 to 40 ms.',
      beat: 'Its own loading form (list-d6, list-d7)',
      date: '2026-11-16',
    },
  ],
});
