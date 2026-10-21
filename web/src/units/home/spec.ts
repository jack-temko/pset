import { defineSpec } from '@/design/spec';

const SKELETON =
  'Greeting, tiles and heatmap skeletons in the same layout, then the two lists as a heading bar over a block.';

export default defineSpec({
  id: 'home',
  kind: 'view',
  title: 'Home',
  group: 'Screens',
  purpose:
    'The first screen: a greeting, two stat tiles and a heatmap of time studied, then the Assignments list and the Courses list.',
  states: [
    {
      id: 'beside-two-six-months',
      name: 'Beside, two tiles, 6 months',
      when: 'Layout beside (tiles beside the heatmap); two tiles; heatmap span 6 months.',
      skeleton: SKELETON,
    },
    {
      id: 'beside-two-year',
      name: 'Beside, two tiles, a year',
      when: 'Layout beside (tiles beside the heatmap); two tiles; heatmap span a year.',
      skeleton: SKELETON,
    },
    {
      id: 'beside-one-six-months',
      name: 'Beside, one tile, 6 months',
      when: 'Layout beside (tiles beside the heatmap); one tile; heatmap span 6 months.',
      skeleton: SKELETON,
    },
    {
      id: 'beside-one-year',
      name: 'Beside, one tile, a year',
      when: 'Layout beside (tiles beside the heatmap); one tile; heatmap span a year.',
      skeleton: SKELETON,
    },
    {
      id: 'stacked-two-six-months',
      name: 'Stacked, two tiles, 6 months',
      when: 'Layout stacked (tiles row, then the heatmap); two tiles; heatmap span 6 months.',
      skeleton: SKELETON,
    },
    {
      id: 'stacked-two-year',
      name: 'Stacked, two tiles, a year',
      when: 'Layout stacked (tiles row, then the heatmap); two tiles; heatmap span a year.',
      skeleton: SKELETON,
    },
    {
      id: 'stacked-one-six-months',
      name: 'Stacked, one tile, 6 months',
      when: 'Layout stacked (tiles row, then the heatmap); one tile; heatmap span 6 months.',
      skeleton: SKELETON,
    },
    {
      id: 'stacked-one-year',
      name: 'Stacked, one tile, a year',
      when: 'Layout stacked (tiles row, then the heatmap); one tile; heatmap span a year.',
      skeleton: SKELETON,
    },
    {
      id: 'no-time',
      name: 'No time yet, no name',
      when: 'A new student: no name, the empty grid under "No time studied yet", and 0 m and 0 in the tiles.',
      text: 'No time studied yet',
      skeleton: SKELETON,
    },
  ],
  stress:
    'A 40 character name, a 70 character set title and a year of days with 60 character course names, at 360px: every line wraps and nothing overflows.',
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
  components: [
    { unit: 'top-bar', use: 'The top of the screen, in its Home state.' },
    {
      unit: 'greeting',
      use: 'The big line for the hour and what is due next.',
    },
    {
      unit: 'stat-tile',
      use: 'Time this week and Questions done, each with last week muted.',
    },
    {
      unit: 'heatmap',
      use: 'Time studied per day, over 6 months or a year.',
    },
    {
      unit: 'assignment-row',
      use: 'HomeLists: the Assignments and Courses lists below the info area.',
    },
    { unit: 'set-line', use: 'minutesText, for the tiles\u2019 figures.' },
  ],
  actions: [
    {
      id: 'open-set',
      label: 'A set in Assignments',
      key: 'Enter',
      does: 'Opens the set in the workspace. The workspace is not a unit yet, so it has no target.',
    },
    {
      id: 'open-course',
      label: 'A course\u2019s name',
      key: 'Enter',
      does: 'Opens the course. The course screen is not a unit yet, so it has no target.',
    },
    {
      id: 'show-all',
      label: 'Show all',
      key: 'Enter',
      does: 'Shows every set or every course. The list screens are not units yet, so it has no target.',
    },
  ],
  data: [
    {
      reads:
        'The name, the sets, minutes per day by course, questions done this week and last',
      call: 'None yet: sample data (the server has no per-day endpoint)',
      waiting:
        'Skeletons for the greeting, tiles and heatmap, and a block for each list.',
      failed: 'Not designed: Home has no failed state yet.',
    },
  ],
  inputs: [
    {
      name: 'name, now, pick',
      type: 'string, Date, number',
      default: 'none (pick: random per visit)',
      does: 'The student, the moment, and which of the hour\u2019s greetings.',
    },
    {
      name: 'sets, study, questions',
      type: 'GreetingSet[], StudyDay[], { thisWeek; lastWeek }',
      default: 'none',
      does: 'The sets for the muted line, minutes per day by course, and questions done.',
    },
    {
      name: 'span',
      type: "'six-months' | 'year'",
      default: 'six-months',
      does: 'How many weeks the heatmap shows at most: 26 or 53 (D2).',
    },
    {
      name: 'tiles',
      type: "'two' | 'one'",
      default: 'two',
      does: 'Two tiles (time and questions) or one (time) (D3).',
    },
    {
      name: 'layout',
      type: "'beside' | 'stacked'",
      default: 'beside',
      does: 'Tiles beside the heatmap, or tiles row then heatmap (D9).',
    },
    {
      name: 'homeHref, settingsHref',
      type: 'string',
      default: "'/', '/settings'",
      does: 'Where the wordmark and Settings go.',
    },
  ],
  priority: {
    first: 'The greeting and what is due next, then the Assignments list.',
    main: 'open-set',
  },
  sizes: {
    narrowest: 320,
    gives: [
      'Under 760 wide the tiles sit above the heatmap, not beside it',
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
    ],
  },
  log: 'web/src/units/home/log.md',
  decisions: [
    {
      id: 'home-d1',
      decision:
        'Home opens with an info area (greeting, tiles, heatmap), then Assignments, then Courses.',
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
    },
    {
      id: 'home-d3',
      decision:
        'At phone width the tiles sit above the heatmap and the heatmap shows fewer weeks, ending today.',
      why: 'Assumed in home-info-grill.',
      beat: 'Scrolling the heatmap sideways',
      date: '2026-10-16',
    },
    {
      id: 'home-d4',
      decision:
        "Home's content is at most 1012 wide (the page-width token), centred; the top bar stays full width.",
      why: 'Jack: "Can we pick a resonable max width for this screen? I want the content to be centered, and not take up the whole screen." 1012 is GitHub\'s page width.',
      beat: 'Content across the whole window',
      date: '2026-10-21',
    },
  ],
});
