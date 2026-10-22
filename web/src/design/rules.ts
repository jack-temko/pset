/** One rule of the rulebook. The id is permanent: specs cite it, so it is
 *  never renamed or reused, only superseded in the rule text. */
export interface Rule {
  id: string;
  /** One sentence. */
  rule: string;
  /** How anyone can tell the rule is kept. */
  check: string;
  /** Which units it binds: "all", a kind, a unit id, or "pipelines" for the
   *  backend's pipelines, which no unit on this page cites. */
  scope: string;
  /** What fails when it is broken, if anything enforces it. */
  enforcedBy?: string;
}

/** The rulebook: the eleven principles of `ideas/vision-grill.md`, worded as
 *  what to do, then the six of the foundations (`ideas/theme-grill.md`),
 *  then two for controls, one for labels and one for repeats. Further rules are written as each thing is designed. */
export const RULES: readonly Rule[] = [
  {
    id: 'smallest-help-first',
    rule: 'Show only the help the student asked for: hint, then approach, then solution',
    check: 'No solution is visible before the student asked for it',
    scope: 'all',
  },
  {
    id: 'student-decides',
    rule: 'Leave every choice to the student: skipping, revealing and removing happen the moment they ask',
    check: "No action waits on PSet's permission",
    scope: 'all',
  },
  {
    id: 'generated-is-marked',
    rule: 'Mark anything PSet wrote as generated, and point it at the page it came from',
    check: 'No generated text without the mark and a source',
    scope: 'all',
  },
  {
    id: 'course-first',
    rule: 'Answer from the course\'s materials, and mark anything else "not from your course"',
    check: 'Every answer cites the course or carries the mark',
    scope: 'all',
  },
  {
    id: 'work-first',
    rule: "Make every screen's main action move the student's current work forward",
    check: "Each view's main action is about the work",
    scope: 'all',
  },
  {
    id: 'material-is-main',
    rule: "Give the course's pages and problems the space and the contrast; keep PSet's controls quiet",
    check: 'What is largest and darkest on each screen',
    scope: 'all',
  },
  {
    id: 'keep-the-place',
    rule: 'Return the student to the same spot after a reload, Back or a followed link',
    check: 'Reload and Back in every state',
    scope: 'all',
  },
  {
    id: 'check-before-cost',
    rule: "Check a stage's output before the costly stages it feeds",
    check: 'Each pipeline names its checkpoints',
    scope: 'pipelines',
  },
  {
    id: 'honest-waits',
    rule: 'Say what a wait is doing, and show a cost or a time only when it is known',
    check: 'No invented number; no spinner without a reason',
    scope: 'all',
  },
  {
    id: 'dates-only-given',
    rule: 'Show only due dates that were given or found in the work',
    check: 'Every date traces to a source',
    scope: 'all',
  },
  {
    id: 'failure-says-what',
    rule: 'Name what failed, why and the one thing to do next, in words that put no blame on the student',
    check: 'Every error state has all three',
    scope: 'all',
  },
  {
    id: 'serif-to-read',
    rule: 'Set what the student reads in the serif and what they act on in the sans',
    check:
      'Problems, help and greetings are serif; labels, buttons and rows are sans',
    scope: 'all',
  },
  {
    id: 'mono-for-copy',
    rule: 'Use mono only for codes, ids and anything the student may copy',
    check: 'Every mono run is a code, an id or copyable text',
    scope: 'all',
  },
  {
    id: 'figures-follow-text',
    rule: 'Set a figure in the font of the text it sits in',
    check:
      '"Problem 5.3" is in one font; columns of figures use tabular numbers',
    scope: 'all',
  },
  {
    id: 'colour-has-a-word',
    rule: 'Give every meaning colour its word or glyph, so colour is never the only signal',
    check: 'In greyscale, every status still reads',
    scope: 'all',
  },
  {
    id: 'contrast-floors',
    rule: 'Keep text at 4.5:1 or more and grey text at 7:1 or more, on every ground it sits on',
    check: 'tokens.test.ts passes',
    scope: 'all',
    enforcedBy: 'tokens.test.ts',
  },
  {
    id: 'room-for-big-type',
    rule: 'Give display type 96 above and 56 below, and a heading 64 above and 16 below',
    check: 'The gaps around each display line and heading, measured',
    scope: 'all',
  },
  {
    id: 'one-primary',
    rule: 'Use one primary button in a region, for the one thing the student most likely does next',
    check: 'Count the primary buttons in each region: at most one',
    scope: 'all',
  },
  {
    id: 'links-go-buttons-do',
    rule: 'Use a link to go somewhere and a button to do something',
    check: 'No link runs an action, and no button only navigates',
    scope: 'all',
  },
  {
    id: 'sentence-case',
    rule: 'Write every label in sentence case: headings, buttons, tabs, tags, menu items and table headers',
    check:
      'No label is in all capitals, title case or all lowercase; names keep their own capitals',
    scope: 'all',
  },
  {
    id: 'say-it-once',
    rule: "Show each fact once on a screen; where two parts would repeat it, the one nearer the student's eye keeps it",
    check:
      'No date, count, name or state is written twice on one screen, unless never shown together or one answers at a glance what the other needs reading for',
    scope: 'all',
  },
];
