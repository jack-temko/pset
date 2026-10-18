import { defineSpec } from '@/design/spec';

const SKELETON = 'Three bars: the label, the figure and the muted line.';

export default defineSpec({
  id: 'stat-tile',
  kind: 'component',
  title: 'Stat tile',
  group: 'Home',
  purpose:
    'One figure of the week under its label, with an optional muted line for the week before. Never clickable.',
  states: [
    {
      id: 'with-last-week',
      name: 'With last week',
      when: 'The figure and a muted "Last week: 2 h 40 m" under it.',
      skeleton: SKELETON,
    },
    {
      id: 'alone',
      name: 'Figure only',
      when: 'No note: the third line stays empty, so the tile is as tall as one with a note.',
      skeleton: SKELETON,
    },
    {
      id: 'zero',
      name: 'Nothing yet',
      when: 'A week with no time: the figure reads "0 m", never a dash.',
      skeleton: SKELETON,
    },
  ],
  stress:
    'A 60 character label and a note of 60 characters at 160px: the label truncates, the figure and the note wrap.',
  actions: [],
  data: [
    {
      reads: 'Minutes studied and questions done, this week and last',
      call: 'None yet: sample data (GET /api/week has this week only)',
      waiting: 'Three bars in the three lines.',
      failed: 'Not designed: Home has no failed state yet.',
    },
  ],
  inputs: [
    {
      name: 'label',
      type: 'string',
      default: 'none',
      does: 'What the figure counts: "Time this week", "Questions done".',
    },
    {
      name: 'value',
      type: 'string',
      default: 'none',
      does: 'The figure, already written: "2 h 40 m", "14".',
    },
    {
      name: 'note',
      type: 'string',
      default: 'none',
      does: 'A muted line under the figure, such as "Last week: 2 h 40 m".',
    },
  ],
  priority: { first: 'The figure.' },
  sizes: {
    narrowest: 120,
    gives: ['The label truncates', 'The figure and the note wrap'],
  },
  rules: {
    cite: ['figures-follow-text', 'contrast-floors', 'sentence-case'],
  },
  log: 'web/src/units/stat-tile/log.md',
  decisions: [
    {
      id: 'stat-tile-d1',
      decision:
        'A tile is a label, a figure in the heading step, and an optional muted line. Home uses it for "Time this week" and "Questions done", each with last week muted.',
      why: 'Jack picked two tiles against one, to compare on sight (home-info-grill D3).',
      beat: 'A streak tile',
      date: '2026-10-16',
    },
    {
      id: 'stat-tile-d2',
      decision:
        'The figure is set in the serif heading step, units and all, so it is one run in one font.',
      why: 'figures-follow-text: "2 h 40 m" is one figure and must not change font in the middle.',
      beat: 'A sans figure with serif digits; the display step',
      date: '2026-10-16',
    },
  ],
});
