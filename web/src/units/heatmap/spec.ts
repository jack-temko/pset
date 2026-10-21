import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'heatmap',
  kind: 'component',
  title: 'Heatmap',
  group: 'Home',
  purpose:
    'Time studied per day as a grid of squares, weeks from Monday in columns, today in the last one, month names above and Mon, Wed, Fri beside, with a total as its one heading line.',
  states: [
    {
      id: 'six-months',
      name: 'Six months',
      when: 'The span is 26 weeks and the container fits them: "N h studied in the last 6 months".',
      skeleton: 'The heading line as a bar and a block the height of the grid.',
    },
    {
      id: 'grown',
      name: 'Grown to its container',
      when: 'The grow prop: the squares size up to 32 and the gaps widen so the grid reaches the container\u2019s right edge.',
      skeleton:
        'The heading line as a bar and a block as tall as the grown labels and grid.',
    },
    {
      id: 'narrow',
      name: 'Too narrow for the span',
      when: 'The container fits fewer weeks than the span: it shows the latest ones, never scrolls sideways, and the heading names the weeks on show.',
      skeleton: 'The heading line as a bar and a block the height of the grid.',
    },
    {
      id: 'hover',
      name: 'Hovering a day',
      when: 'The tooltip names the day, its total, then each course studied with its time, most first.',
      skeleton: 'The heading line as a bar and a block the height of the grid.',
    },
    {
      id: 'empty',
      name: 'No time yet',
      when: 'No day has any time: the empty grid under the heading.',
      text: 'No time studied yet',
      skeleton: 'The heading line as a bar and a block the height of the grid.',
    },
  ],
  stress:
    'A year of days with 70 character course names, in a 160px container: 8 weeks show and the tooltip wraps at 250.',
  components: [
    {
      unit: 'tooltip',
      use: 'On each square: the day, its total and its courses.',
    },
    {
      unit: 'set-line',
      use: 'minutesText, the wording of every time.',
    },
  ],
  actions: [],
  data: [
    {
      reads: 'Minutes studied per day, by course',
      call: 'None yet: sample data (the server has no per-day endpoint)',
      waiting: 'A bar for the heading and a block the size of the grid.',
      failed: 'Not designed: Home has no failed state yet.',
    },
  ],
  inputs: [
    {
      name: 'days',
      type: '{ date: string; courses: { course: string; minutes: number }[] }[]',
      default: 'none',
      does: 'The study days, each under its date "2026-10-13"; a day left out is empty.',
    },
    {
      name: 'today',
      type: 'Date',
      default: 'none',
      does: 'The study day that is today (see studyDay): the last square.',
    },
    {
      name: 'weeks',
      type: 'number',
      default: '26',
      does: 'The most weeks to show: 26 for about 6 months, 53 for a year.',
    },
    {
      name: 'grow',
      type: 'boolean',
      default: 'false',
      does: 'Fill the container: the squares up to 32 and the gaps wider, the same weeks.',
    },
    {
      name: 'openDay',
      type: 'string',
      default: 'none',
      does: 'A date whose tooltip stays open, for the design page.',
    },
  ],
  priority: { first: 'The total in the heading, then the brightest squares.' },
  sizes: {
    narrowest: 60,
    gives: [
      'Fewer weeks show, the oldest going first, down to one',
      'The heading wraps',
    ],
  },
  rules: {
    cite: [
      'colour-has-a-word',
      'contrast-floors',
      'figures-follow-text',
      'sentence-case',
    ],
  },
  log: 'web/src/units/heatmap/log.md',
  decisions: [
    {
      id: 'heatmap-d1',
      decision:
        'A square counts the time studied that day: reading, homework and tutor time together.',
      why: 'Jack picked "Time studied" (home-info-grill D1).',
      beat: 'Questions done; both, switchable',
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d2',
      decision:
        'Weeks start on Monday and today is the last column. A study day ends at 4am: work until then counts for the day before, via studyDay.',
      why: 'Jack picked Monday (D8) and "At 4am" (D6).',
      beat: 'Sunday start; calendar midnight',
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d3',
      decision:
        'Squares are 14 with 3 between, always. The container decides how many weeks show, up to the span: fewer when narrow, ending today, never a sideways scroll.',
      why: 'Assumed in home-info-grill: at phone width the heatmap shows fewer weeks, ending today.',
      beat: 'Shrinking the squares; scrolling sideways',
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d4',
      decision:
        'Five shades: empty, then four steps of the accent blue for under 30 m, under 1 h, under 2 h and 2 h or more, as tokens heat-0 to heat-4.',
      why: 'Jack picked accent shades (D8); the steps are Assumed.',
      beat: 'GitHub green; steps by share of the busiest day',
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d5',
      decision:
        'The heading is one line, the total: "41 h studied in the last 6 months", or "No time studied yet". It names the weeks on show, so a narrow grid says "3 months".',
      why: 'Jack picked the total line (D10); naming the shown weeks is assumed, so the total never counts days the student cannot see.',
      beat: 'No heading; total and weekly average; a total over weeks that are hidden',
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d6',
      decision: 'No legend.',
      why: 'Jack picked "No legend" (D12).',
      beat: "GitHub's Less to More legend",
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d7',
      decision:
        'Hovering a square shows its day, its total, then each course with its time, most first; no split by kind.',
      why: 'Jack: "courses by time in them. no split" (D7).',
      beat: 'Time and kind split; time only',
      date: '2026-10-16',
    },
    {
      id: 'heatmap-d8',
      decision:
        'Month names sit above the grid and Mon, Wed, Fri beside it. Home grows the heatmap to fill its column: squares up to 32, gaps widening to the edge.',
      why: 'Jack, 2026-10-21: "I want some that look good and don\'t leave any large empty gaps" (home round 2). Labels are the plan\'s.',
      beat: 'Fixed 14px squares that leave the column part empty',
      date: '2026-10-21',
    },
    {
      id: 'heatmap-d9',
      decision:
        'No outline of its own, no ragged end: the rest of this week shows as faint empty squares, never counted, no tooltip, so every column is full.',
      why: 'Jack: "Make sure when designing it the heat map has no empty space around it." then "Sorry, no separate outline around the heatmap".',
      beat: 'A box round the heatmap; a last column that stops at today',
      date: '2026-10-21',
    },
    {
      id: 'heatmap-d10',
      decision:
        "The heading's total is in the text colour and the words after it muted, as the stats beside it are.",
      why: 'Jack: "can you make the "studied in the last 6 months" grey, but numbers white, like the stat tile to the right of it".',
      beat: 'The whole heading in the text colour',
      date: '2026-10-21',
    },
  ],
});
