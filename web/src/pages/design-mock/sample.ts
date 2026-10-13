// Throwaway sample content for the gallery docs mockups (ideas/gallery-docs-mockups.md).

export type Kind = 'component' | 'pane' | 'view';

export interface State {
  id: string;
  name: string;
  when: string;
}
export interface Link {
  name: string;
  use: string;
}
export interface Target {
  unit: string;
  state: string;
}
export interface Action {
  id: string;
  does: string;
  leads: string;
  /** The state the example shows once this step of the flow is reached. */
  state?: string;
  /** Where the action ends up, when it is another unit. */
  target?: Target;
}
export interface Ref {
  name: string;
  kind: Kind;
}
export interface Data {
  reads: string;
  call: string;
  waiting: string;
  failed: string;
}
export interface Input {
  name: string;
  type: string;
  default: string;
  does: string;
}
export interface Rule {
  id: string;
  text: string;
  local?: boolean;
}
export interface Decision {
  what: string;
  why: string;
  beat: string;
}

export interface Sample {
  unit: string;
  /** The student's work as ordered action ids from `actions`; none for a lone component. */
  flow?: string[];
  /** What contains it: the dock for a pane, the units that list a component. */
  inside: Ref[];
  /** Whether the unit draws a skeleton while it waits. */
  skeleton: boolean;
  kind: Kind;
  title: string;
  purpose: string;
  states: State[];
  /** What it is made of. */
  madeOf: Link[];
  actions: Action[];
  data: Data[];
  inputs: Input[];
  inputsTitle: string;
  rules: Rule[];
  decisions: Decision[];
}

const BUTTON: Sample = {
  kind: 'component',
  unit: 'button',
  skeleton: false,
  title: 'Button',
  purpose: 'The one control for every action.',
  states: [
    {
      id: 'primary',
      name: 'Primary',
      when: 'The single main action of a region.',
    },
    {
      id: 'outline',
      name: 'Outline',
      when: 'Beside a primary one; Retry in errors.',
    },
    {
      id: 'secondary',
      name: 'Secondary',
      when: 'A quiet alternative: Start over.',
    },
    { id: 'ghost', name: 'Ghost', when: 'Toolbar and icon actions.' },
    {
      id: 'destructive',
      name: 'Destructive',
      when: 'Removals only, always confirmed.',
    },
    { id: 'sizes', name: 'Sizes', when: 'sm 28px, default 32px, lg 40px.' },
    {
      id: 'icon',
      name: 'With icon',
      when: 'A leading icon, or an IconButton.',
    },
    {
      id: 'disabled',
      name: 'Disabled',
      when: 'The action is not available now.',
    },
    { id: 'busy', name: 'Busy', when: 'Work is running; the label stays.' },
  ],
  inside: [
    { name: 'Homework panel', kind: 'pane' },
    { name: 'Confirm', kind: 'component' },
    { name: 'Settings', kind: 'view' },
    { name: 'Error notice', kind: 'view' },
    { name: 'Home', kind: 'view' },
  ],
  madeOf: [],
  actions: [
    { id: 'click', does: 'Click or Enter', leads: 'The caller’s onClick' },
    {
      id: 'click-disabled',
      does: 'Click while disabled',
      leads: 'Nothing: no pointer events',
    },
    { id: 'tab', does: 'Tab', leads: 'The one focus ring from the base layer' },
  ],
  data: [],
  inputsTitle: 'Props',
  inputs: [
    {
      name: 'variant',
      type: 'primary | outline | secondary | ghost | destructive',
      default: 'primary',
      does: 'Picks the look.',
    },
    {
      name: 'size',
      type: 'sm | default | lg',
      default: 'default',
      does: 'Height and type size.',
    },
    {
      name: 'disabled',
      type: 'boolean',
      default: 'false',
      does: 'Dims it and stops clicks.',
    },
    {
      name: 'aria-label',
      type: 'string',
      default: 'none',
      does: 'Required on IconButton: its only name.',
    },
    {
      name: 'onClick',
      type: 'function',
      default: 'none',
      does: 'What the click does.',
    },
  ],
  rules: [
    { id: 'R-one-primary', text: 'One primary action per screen region.' },
    {
      id: 'R-semantic-tokens',
      text: 'Semantic tokens only, no raw colour values.',
    },
    {
      id: 'R-one-focus-ring',
      text: 'One focus ring, from the base layer, on everything.',
    },
    {
      id: 'R-no-own-margin',
      text: 'A component never sets its own outer margin.',
    },
    { id: 'R-sentence-case', text: 'Labels are sentence case and verb first.' },
    {
      id: 'R-btn-soft-destructive',
      text: 'Destructive is soft ink on a soft ground, never solid red.',
      local: true,
    },
  ],
  decisions: [
    {
      what: 'No link variant, no xs size',
      why: 'Dropped in the v2 baseline',
      beat: 'Keeping both',
    },
    {
      what: 'Focus is not on the variants',
      why: 'One ring in the base layer matches everything',
      beat: 'A ring per variant',
    },
    {
      what: 'Hover is a colour mix',
      why: 'No hover token in the palette',
      beat: 'A second token per variant',
    },
    {
      what: 'No asChild yet',
      why: 'One call site needed it',
      beat: 'A polymorphic wrapper',
    },
  ],
};

const HOMEWORK: Sample = {
  kind: 'pane',
  skeleton: true,
  unit: 'homework',
  flow: ['open-set', 'work', 'wait-guide', 'retry', 'turn-in'],
  inside: [{ name: 'Dock', kind: 'view' }],
  title: 'Homework panel',
  purpose: 'The book’s sets, then one set’s walkthrough, a question at a time.',
  states: [
    {
      id: 'happy',
      name: 'Happy path',
      when: 'Two sets; guides written, being written and queued.',
    },
    {
      id: 'empty',
      name: 'Nothing yet',
      when: 'A book with no homework, just imported.',
    },
    {
      id: 'slow',
      name: 'Slow server',
      when: 'Every answer takes a while; questions wait.',
    },
    {
      id: 'failed',
      name: 'Everything failed',
      when: 'One question of each failure kind.',
    },
    {
      id: 'mid-flow-reload',
      name: 'Mid-flow reload',
      when: 'Reloaded with the third question half written.',
    },
    {
      id: 'finish',
      name: 'Every question done',
      when: 'Opens on the finish page.',
    },
  ],
  madeOf: [
    { name: 'Menu', use: 'The set menu and the question list' },
    { name: 'ProgressBar', use: 'The header’s bottom edge' },
    { name: 'Button', use: 'Next question, the one primary' },
    { name: 'StatTile', use: 'The finish page’s numbers' },
    { name: 'Spinner', use: 'A guide being written' },
    { name: 'Dialog', use: 'Import review and confirmations' },
  ],
  actions: [
    {
      id: 'open-set',
      does: 'Open a set from the list',
      leads: 'Its next unfinished question',
      state: 'happy',
    },
    {
      id: 'work',
      does: 'Open a help row',
      leads: 'The hint, walkthrough or answer, in place',
      state: 'mid-flow-reload',
    },
    {
      id: 'wait-guide',
      does: 'Wait for the next guide',
      leads: 'It is written while the student reads',
      state: 'slow',
    },
    {
      id: 'retry',
      does: 'Try again',
      leads: 'A failed guide is asked for again',
      state: 'failed',
    },
    {
      id: 'next',
      does: 'Next question',
      leads: 'The next unfinished one, or the finish page',
    },
    {
      id: 'turn-in',
      does: 'Turn in',
      leads: 'The set is turned in',
      state: 'finish',
    },
    {
      id: 'skip',
      does: 'Skip for now',
      leads: 'Moves on without marking done',
    },
    {
      id: 'show-in-book',
      does: 'Show in book',
      leads: 'The page scan, on the problem’s page',
      target: { unit: 'page-scan', state: 'default' },
    },
    {
      id: 'ask',
      does: 'Ask about this',
      leads: 'Ask, with the question as a chip',
      target: { unit: 'ask', state: 'with-chip' },
    },
    {
      id: 'back',
      does: 'Back to course',
      leads: 'The course overview',
      target: { unit: 'course-overview', state: 'default' },
    },
  ],
  data: [
    {
      reads: 'The book’s sets',
      call: 'GET homework sets',
      waiting: 'Skeleton rows',
      failed: 'Inline error notice with Retry',
    },
    {
      reads: 'A set’s questions',
      call: 'GET set, then its events stream',
      waiting: 'Skeleton walkthrough',
      failed: 'Status line with ways out',
    },
    {
      reads: 'A question’s guide',
      call: 'Streamed as it is written',
      waiting: 'Spinner and the stage’s name',
      failed: 'Failed line, Try again',
    },
  ],
  inputsTitle: 'Opened with',
  inputs: [
    {
      name: 'bookId',
      type: 'string',
      default: 'required',
      does: 'The book whose sets it lists.',
    },
    {
      name: 'initialSet',
      type: 'string',
      default: 'none',
      does: 'Opens straight in that set (Home’s due row).',
    },
    {
      name: 'onJump',
      type: 'function',
      default: 'required',
      does: 'Takes the scan to a page.',
    },
    {
      name: 'onAskAbout',
      type: 'function',
      default: 'required',
      does: 'Hands a question to Ask.',
    },
    {
      name: 'wide',
      type: 'boolean',
      default: 'false',
      does: 'Focus: the two-column face.',
    },
  ],
  rules: [
    { id: 'R-one-primary', text: 'One primary action per screen region.' },
    {
      id: 'R-semantic-tokens',
      text: 'Semantic tokens only, no raw colour values.',
    },
    {
      id: 'R-spinner-waiting',
      text: 'Only the Spinner loops, and it means waiting.',
    },
    {
      id: 'R-one-menu',
      text: 'One menu per thing; opening one closes any other.',
    },
    { id: 'R-no-em-dash', text: 'No em dashes in any copy.' },
    {
      id: 'R-hw-never-done',
      text: 'Never mark done what is not done.',
      local: true,
    },
  ],
  decisions: [
    {
      what: 'The front door is a set’s walkthrough',
      why: 'Students usually arrive straight into a set',
      beat: 'Opening on the list',
    },
    {
      what: 'One primary button',
      why: 'Complete and Next were far apart',
      beat: 'A Complete checkbox beside arrows',
    },
    {
      what: 'A finish page fills the pane',
      why: 'Closes the loop the mission describes',
      beat: 'A toast',
    },
    {
      what: 'Choosing a question never moves the book',
      why: 'A page may be open beside it',
      beat: 'Auto-jump',
    },
    {
      what: 'Progress lives in the header',
      why: 'Marks were too tall for “3 of 8”',
      beat: 'Segment marks as targets',
    },
    {
      what: 'Skip for now never marks done',
      why: 'Honest progress',
      beat: 'Skip counts as done',
    },
    {
      what: 'One redesigned Menu everywhere',
      why: 'Same style, larger rows',
      beat: 'Per-place dropdowns',
    },
    {
      what: 'Help stages are compact rows',
      why: 'The frosted veil was disliked',
      beat: 'The Veil component',
    },
  ],
};

export const SAMPLES: Record<Exclude<Kind, 'view'>, Sample> = {
  component: BUTTON,
  pane: HOMEWORK,
};

export const UNITS: { group: string; names: string[] }[] = [
  {
    group: 'Components',
    names: ['Box', 'Button', 'Dialog', 'Menu', 'Table', 'Spinner'],
  },
  { group: 'Panes', names: ['Homework panel', 'Ask'] },
  { group: 'Views', names: ['Settings', 'Error notice'] },
];

export const TABS = [
  'Foundations',
  'Components',
  'Panes',
  'Views',
  'Errors',
  'Rules',
];

/** Names and kinds of the units the sample data points at. */
export const UNIT_INFO: Record<string, Ref> = {
  button: { name: 'Button', kind: 'component' },
  homework: { name: 'Homework panel', kind: 'pane' },
  ask: { name: 'Ask', kind: 'pane' },
  'page-scan': { name: 'Page scan', kind: 'pane' },
  'course-overview': { name: 'Course overview', kind: 'view' },
  home: { name: 'Home', kind: 'view' },
};

/** Actions of other units, so "Leads here" is derived, not written on the
 *  unit it leads to. */
export const OTHER_ACTIONS: { unit: string; action: Action }[] = [
  {
    unit: 'course-overview',
    action: {
      id: 'open-hw',
      does: 'Open homework set',
      leads: 'The set',
      target: { unit: 'homework', state: 'happy' },
    },
  },
  {
    unit: 'home',
    action: {
      id: 'continue-hw',
      does: 'Continue homework',
      leads: 'The due set',
      target: { unit: 'homework', state: 'handoff-in' },
    },
  },
  {
    unit: 'ask',
    action: {
      id: 'back-to-q',
      does: 'Back to the question',
      leads: 'The same question',
      target: { unit: 'homework', state: 'mid-flow-reload' },
    },
  },
];
