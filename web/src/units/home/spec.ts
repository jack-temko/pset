import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'home',
  kind: 'view',
  title: 'Home',
  group: 'Screens',
  purpose:
    'The first screen: a greeting, a heatmap of 6 months of study with this week and its sparklines beside it, then the Assignments list and the Courses list.',
  states: [
    {
      id: 'default',
      name: 'This week with sparklines',
      when: 'The one box: the heatmap left; right, this week as seven bars with last week muted, then questions done and what is left, a 14-day sparkline beside each.',
    },
    {
      id: 'no-time',
      name: 'No time yet, no name',
      when: 'A new student: no name, the empty grid under "No time studied yet", 0 m and 0 in the figures and nothing due.',
      text: 'No time studied yet',
    },
  ],
  stress:
    'A 40 character name, a 70 character set title and a set of 999 questions and figures of 99 h or more: long text wraps or truncates and nothing overflows.',
  flows: [
    {
      id: 'pick-tonights-work',
      name: 'Pick tonight\u2019s work',
      steps: ['open-set'],
    },
    {
      id: 'by-way-of-the-course',
      name: 'By way of the course',
      steps: ['open-course'],
    },
    { id: 'see-every-set', name: 'See every set', steps: ['show-all'] },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'A set in Assignments',
      does: 'Opens the set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
    {
      id: 'open-course',
      label: 'A course\u2019s name',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
    },
    {
      id: 'show-all',
      label: 'Show all',
      does: 'Shows every set or every course. The list screens are not units yet, so it has no target.',
    },
  ],
  data: [
    {
      reads:
        'The name, the sets (with questions done and total), and per day: minutes by course, questions done, questions left',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'name',
      does: 'The student’s name, empty for a new student.',
    },
    {
      name: 'now',
      does: 'The moment, for the greeting and the dates.',
    },
    {
      name: 'pick',
      does: 'Which of the hour’s greetings.',
    },
    {
      name: 'sets',
      does: 'The sets for the greeting’s line and what is left.',
    },
    {
      name: 'study',
      does: 'Per-day study, with questions done and questions left.',
    },
    { name: 'homeHref', does: 'Where the wordmark goes.' },
    { name: 'settingsHref', does: 'Where Settings goes.' },
  ],
  priority: {
    first: 'The greeting and what is due next, then the Assignments list.',
    main: 'open-set',
  },
  sizes: {
    gives: [
      'The heatmap shows fewer weeks, the oldest going first',
      'The lists give way as their rows do',
    ],
  },
  rules: {
    cite: [
      'work-first',
      'room-for-big-type',
      'figures-follow-text',
      'serif-to-read',
      'honest-waits',
      'sentence-case',
      'say-it-once',
    ],
  },
  log: 'web/src/units/home/log.md',
  decisions: [
    {
      id: 'home-d1',
      decision:
        'Home opens with an info area (greeting, heatmap, this week), then Assignments, then Courses.',
      why: 'Jack: "plus some info on top (e.g. github style heatmap for work, stat tile, big greeting)" (S14, home-info-grill).',
      beat: 'One list of courses (S13)',
      date: '2026-10-16',
    },
    {
      id: 'home-d2',
      decision:
        'The three open picks are states of this view: span (6 months or a year), tiles (two or one), layout (beside or stacked). Eight states hold every pairing.',
      why: 'Jack: "pick the two most reasonable options and A/B them once we start building"; tiles and layout were picked "A/B" (D2, D3, D9).',
      beat: 'Deciding in the grill',
      date: '2026-10-16',
      supersededBy: 'home-d6',
    },
    {
      id: 'home-d3',
      decision:
        'At phone width the tiles sit above the heatmap and the heatmap shows fewer weeks, ending today.',
      why: 'Assumed in home-info-grill.',
      beat: 'Scrolling the heatmap sideways',
      date: '2026-10-16',
      supersededBy: 'home-d13',
    },
    {
      id: 'home-d4',
      decision:
        "Home's content is at most 1012 wide (the page-width token), centred; the top bar stays full width.",
      why: 'Jack: "Can we pick a resonable max width for this screen? I want the content to be centered, and not take up the whole screen." 1012 is GitHub\'s page width.',
      beat: 'Content across the whole window',
      date: '2026-10-21',
    },
    {
      id: 'home-d5',
      decision: 'The heatmap shows 6 months; the year span is gone.',
      why: 'Jack, 2026-10-21: "Lets go with the 6 months."',
      beat: 'A year of weeks',
      date: '2026-10-21',
    },
    {
      id: 'home-d6',
      decision:
        'This week sits beside the heatmap, in two states to compare, A with meters and B with sparklines. The panel, courses and sparklines options are dropped.',
      supersededBy: 'home-d10',
      why: 'Jack, 2026-10-21: "Week is my favorite. Drop the rest. Can we find a way to include sparklines in that one too? A/B it for me."',
      beat: 'Four options; tiles and layout picks',
      date: '2026-10-21',
    },
    {
      id: 'home-d7',
      decision:
        'Show time this week (bars, heading), questions done with last week by now, and what is left in sets due within 7 days. No month total, active days or course.',
      why: 'Jack, 2026-10-21: "the most important ones to display and most useful." What is left is what a student can act on tonight.',
      beat: 'Most time this week, time this month, active days, sets finished',
      date: '2026-10-21',
    },
    {
      id: 'home-d8',
      decision:
        'The info area\u2019s box has no fill: an outline only, with the border and radius of the lists below.',
      why: 'Jack, 2026-10-21: "Make the backgrounds of the panels just outlines like the lists below them".',
      beat: 'A raised fill inside the border',
      date: '2026-10-21',
    },
    {
      id: 'home-d9',
      decision:
        'The info area is one outlined box with no fill: the heatmap left, this week right, a hairline between, 20px on every side. Nothing inside has its own outline.',
      why: 'Jack: "Go back to having all the stat stuff in one box", then "heatmap in box too please".',
      beat: 'A box round the stats only; a box round the heatmap',
      date: '2026-10-21',
    },
    {
      id: 'home-d10',
      decision:
        'Home has one info layout: this week with a sparkline beside each figure. State A, the meters, and everything only it used are gone.',
      why: 'Jack: "Lets go with spark lines, drop the other one, and anything else not used anymore."',
      beat: 'A, with meters; the tiles, layout and span picks',
      date: '2026-10-21',
    },
    {
      id: 'home-d11',
      decision:
        'Changes compare like with like: this week so far against last week up to the same weekday (by this time last week). Hidden when it is 0.',
      why: 'Coordinator, 2026-10-21: a Tuesday against a whole week would read "down" every Monday to Thursday. The days hold no hours, so today counts whole.',
      beat: 'This week so far against all of last week',
      date: '2026-10-21',
    },
    {
      id: 'home-d12',
      decision:
        'A change is muted: arrow and percent in the muted colour, never yellow or red. The Questions left sparkline is questions left per day over 14 days.',
      why: 'Coordinator, 2026-10-21: being behind on a Tuesday is not a warning; sets finished per day read as a flat line beside the figure and said nothing.',
      beat: 'Green and amber changes; sets finished per day',
      date: '2026-10-21',
    },
    {
      id: 'home-d13',
      decision:
        'Home has no narrow layout: this week is always beside the heatmap, and the heatmap alone gives way by showing fewer weeks.',
      why: 'Desktop only; the spec format change strips the narrow code (ideas/spec-format-grill.md, F10).',
      beat: 'Stacking the tiles above the heatmap at phone width (home-d3)',
      date: '2026-10-22',
    },
    {
      id: 'home-d14',
      decision:
        'The greeting\u2019s due line stays, though the first Assignments row shows the same date (say-it-once).',
      why: 'Jack, 2026-10-22: you know when the next one is due without reading Assignments.',
      beat: 'Dropping the repeat from the greeting',
      date: '2026-10-22',
    },
    {
      id: 'home-d15',
      decision:
        'Time this week shows in the info area and again on each course row (say-it-once).',
      why: 'Jack, 2026-10-22: the two are never on screen together, so nothing is said twice at once.',
      beat: 'Dropping the time from the course rows',
      date: '2026-10-22',
    },
    {
      id: 'home-d16',
      decision:
        'A row keeps the due tag beside the set name and the due date at the right (say-it-once).',
      why: 'Assumed, not asked: the tag gives urgency at a glance and the date gives the exact day.',
      beat: 'The tag in place of the date (set-line-d7)',
      date: '2026-10-22',
    },
  ],
});
