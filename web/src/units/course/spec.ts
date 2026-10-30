import { defineSpec } from '@/design/spec';

const ASSUMED = 'Assumed, to confirm with Jack';

export default defineSpec({
  id: 'course',
  kind: 'view',
  title: 'Course',
  group: 'Screens',
  purpose:
    'One course as a student checks on it: its name and where it stands, a stats box like Home’s, then its Work and its Materials, each with its own Add.',
  exampleWidth: 'full',
  states: [
    {
      id: 'normal',
      name: 'One set to do',
      when: 'The usual course: a set to do, three materials, six finished sets folded under Done.',
      text: 'Done (6)',
    },
    {
      id: 'nothing-due',
      name: 'Nothing due',
      when: 'Every set is finished: Work says so in one line, has no counter, and keeps the Done fold.',
      text: 'Nothing due',
    },
    {
      id: 'empty',
      name: 'Empty course',
      when: 'No work and no materials: both lists stay, each with its one-line message and its Add, and the stats box says no study time yet.',
      text: 'No study time yet',
    },
    {
      id: 'reading-in',
      name: 'A material reading in',
      when: 'A material is still being read in: its row shows the wait where the pages go.',
      text: 'Reading, about 2 min',
    },
    {
      id: 'failed',
      name: 'Failed to load',
      when: 'The course could not be read: the page says so and offers Try again.',
      text: 'Could not load this course',
    },
  ],
  stress:
    'A 55 character name, 12 sets and 9 materials with 95 character names, 8 memories and 40 times the study: names wrap in the heading and truncate in rows.',
  flows: [
    { id: 'tonights-work', name: 'Open tonight’s work', steps: ['open-set'] },
    { id: 'add-work', name: 'Add an assignment sheet', steps: ['add-work'] },
    { id: 'add-material', name: 'Add a material', steps: ['add-material'] },
    {
      id: 'delete-and-undo',
      name: 'Delete a set, then undo',
      steps: ['row-menu', 'delete-set', 'undo'],
    },
    {
      id: 'delete-the-course',
      name: 'Delete the course',
      steps: ['course-menu', 'delete-course', 'confirm-delete'],
    },
  ],
  actions: [
    {
      id: 'add-work',
      label: 'Add work',
      does: 'At the foot of Work: opens the file picker for an assignment sheet; each shows as a new set reading in.',
    },
    {
      id: 'add-material',
      label: 'Add material',
      does: 'At the foot of Materials: opens the file picker; several files at once are fine, each shows as a new material reading in.',
    },
    {
      id: 'drop-files',
      label: 'Dropping files on the page',
      does: 'Adds them as Add material does.',
    },
    {
      id: 'open-set',
      label: 'A set’s name',
      does: 'Opens the set in the workspace. The workspace is not wired to this view yet, so it has no target.',
    },
    {
      id: 'open-material',
      label: 'A material’s name',
      does: 'Opens the workspace on that material alone. Not wired yet, so it has no target.',
    },
    {
      id: 'row-menu',
      label: 'A row’s ... menu',
      does: 'Opens the row’s menu: Open, Rename and Delete for work; Open, Rename and Remove for a material.',
      target: { unit: 'menu', state: 'more' },
    },
    {
      id: 'delete-set',
      label: 'Delete',
      does: 'The row turns into one line, "Deleted Problem set 7 · Undo", until the next action or 10 seconds, then goes.',
    },
    {
      id: 'remove-material',
      label: 'Remove',
      does: 'Removes the material and keeps the work made from it, with Undo.',
    },
    {
      id: 'undo',
      label: 'Undo',
      does: 'Puts back what was just deleted or removed.',
    },
    {
      id: 'course-menu',
      label: 'The heading’s ... menu',
      does: 'Opens Rename and Delete course.',
      target: { unit: 'menu', state: 'more' },
    },
    {
      id: 'delete-course',
      label: 'Delete course',
      does: 'Opens a dialog counting the sets and materials that go; the red button waits until the course name is typed.',
      target: { unit: 'danger-dialog', state: 'course' },
    },
    {
      id: 'confirm-delete',
      label: 'Delete course',
      does: 'Deletes the course once its name is typed. The sample only empties the page.',
    },
    {
      id: 'forget-memory',
      label: 'Remove',
      does: 'Removes one thing PSet remembers about the course.',
    },
    {
      id: 'retry',
      label: 'Try again',
      does: 'Reads the course again.',
    },
  ],
  data: [
    {
      reads:
        'The course: its name, its sets (due, questions done and total, time left), its materials (kind, pages, reading in), time studied, cost, memories',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'course',
      does: 'The course: name, sets, materials, time, cost and memories.',
    },
    { name: 'failed', does: 'The read failed: shows the failed page.' },
    { name: 'today', does: 'The moment due dates count from.' },
    { name: 'unfolded', does: 'Opens every fold (the design page only).' },
    { name: 'homeHref', does: 'Where the wordmark and "Home" go.' },
    { name: 'settingsHref', does: 'Where Settings goes.' },
  ],
  priority: {
    first: 'The name and where the course stands, then Work.',
    main: 'open-set',
  },
  sizes: {
    gives: [
      'Names wrap in the heading and truncate in rows',
      'The progress bar narrows before the due date does',
    ],
  },
  rules: {
    cite: [
      'course-first',
      'work-first',
      'material-is-main',
      'one-primary',
      'honest-waits',
      'dates-only-given',
      'failure-says-what',
      'room-for-big-type',
      'figures-follow-text',
      'friction-matches-loss',
      'say-it-once',
      'sentence-case',
      'student-decides',
    ],
  },
  log: 'web/src/units/course/log.md',
  decisions: [
    {
      id: 'course-d1',
      supersededBy: 'course-d15',
      decision:
        'The heading is the course name with one muted line under it ("1 set to do · next due Thu", or "Nothing due"), Add and a ... menu at the right (C1).',
      why: `${ASSUMED}: it answers "how is this course going" before any list.`,
      beat: 'A stats box like Home’s; the name alone',
      date: '2026-10-22',
    },
    {
      id: 'course-d2',
      decision:
        'The page is Home’s width (1012) and top bar, with the path "Home / ECE 210" (C2).',
      why: `Confirmed by Jack: "same as home, we need to keep cross page uniformity where possible." one look across views.`,
      beat: 'A narrower page',
      date: '2026-10-22',
    },
    {
      id: 'course-d3',
      decision:
        'Work is one list: sets to do by due date (undated last), the finished folded under "Done (6)" at its foot (C3).',
      why: `Confirmed by Jack: "One list, Done folded (Recommended)". one active set is the common case and old sets stay one click away.`,
      beat: 'Two lists; newest first with no fold',
      date: '2026-10-22',
    },
    {
      id: 'course-d4',
      decision:
        'A work row is Home’s assignment row without the course name: set, due tag, time left, due date, progress, then its ... menu (C4).',
      why: `Confirmed by Jack: "same as home, we need to keep cross page uniformity where possible." reuse; the course is the page.`,
      beat: 'A bigger card per set',
      date: '2026-10-22',
    },
    {
      id: 'course-d5',
      decision:
        'A material row is its name over "Textbook · 640 pages", and opens the workspace on it alone (C5).',
      why: `Confirmed by Jack: "Name, kind, pages (Recommended)". enough to tell two materials apart.`,
      beat: 'Name only; a cover thumbnail',
      date: '2026-10-22',
    },
    {
      id: 'course-d6',
      supersededBy: 'course-d20',
      decision:
        'One Add takes any file or several, and dropping files on the page does the same; PSet decides if each is work or a material (C6).',
      why: `${ASSUMED}: one door, no choosing first.`,
      beat: 'Add work and Add material; an Add per list',
      date: '2026-10-22',
    },
    {
      id: 'course-d7',
      decision:
        'The ... menu holds Rename and Delete course; deleting opens a dialog that counts what goes and asks for the course’s name (C7, G9).',
      why: `Confirmed by Jack: "In ... menus (Recommended)". rare actions stay out of sight.`,
      beat: 'Buttons on the page; in Settings',
      date: '2026-10-22',
    },
    {
      id: 'course-d8',
      decision:
        'A row’s ... menu: work has Open, Rename and Delete with Undo; a material has Open, Rename and Remove, which keeps the work (C8).',
      why: `Confirmed by Jack: "In ... menus (Recommended)". the same Menu as the work pane.`,
      beat: 'Hover buttons on the row',
      date: '2026-10-22',
    },
    {
      id: 'course-d9',
      supersededBy: 'course-d21',
      decision:
        'A quiet "This course" footer: time studied (total and this week), cost so far, and "PSet remembers 8 things" unfolding a list with each removable (C9).',
      why: `${ASSUMED}: the memory screen's part and finding #5 asked for a cost total.`,
      beat: 'Memory in Settings; a stats box',
      date: '2026-10-22',
    },
    {
      id: 'course-d10',
      supersededBy: 'course-d22',
      decision:
        'An empty course is a centred "Nothing here yet", a line and Add; the heading’s Add and the lists wait until there is something (C10).',
      why: `${ASSUMED}: one clear next step, and one primary button.`,
      beat: 'Empty lists each with a hint',
      date: '2026-10-22',
    },
    {
      id: 'course-d11',
      decision:
        'A material still being read in shows "Reading, about 2 min" where its pages go (C11).',
      why: `Confirmed by Jack: "Row shows the wait (Recommended)". consistent with the material pane's wait.`,
      beat: 'Hiding it until ready',
      date: '2026-10-22',
    },
    {
      id: 'course-d12',
      decision:
        'No exam prep door: Work is problem sets only for now, and the idea is in ideas/on-hold.md (C12).',
      why: `${ASSUMED}: exam prep waits for its own design.`,
      beat: 'A third list, Exam prep',
      date: '2026-10-22',
    },
    {
      id: 'course-d13',
      decision:
        'The page loads as the Loaded standard asks: a skeleton shaped like each section, revealed together (C13).',
      why: `${ASSUMED}: nothing jumps on load.`,
      beat: 'A spinner',
      date: '2026-10-22',
    },
    {
      id: 'course-d14',
      supersededBy: 'course-d17',
      decision:
        'The muted line under the heading also carries what just happened (Undo, files added), so no toast and no layout change.',
      why: 'Builder’s call, not in the grill: a toast would sit over the lists and one more place to look.',
      beat: 'A toast; a banner',
      date: '2026-10-22',
    },
    {
      id: 'course-d15',
      supersededBy: 'course-d19',
      decision:
        'The muted line under the heading is gone in every state: the Work list right below answers it, with its counter, and "Nothing due" is said once, in the list.',
      why: 'Assumed, to confirm with Jack (say-it-once): the line repeated the Work list and was untrue on an empty course. Supersedes C1’s line.',
      beat: '"1 set to do · next due Thu" under the name',
      date: '2026-10-22',
    },
    {
      id: 'course-d16',
      decision:
        'The path in the top bar and the heading stay: the path is navigation, the heading is the page’s identity.',
      why: 'Assumed, to confirm with Jack (say-it-once): the two say the name but do different jobs, one to go up and one to know where you are.',
      beat: 'Dropping the name from the path or the heading',
      date: '2026-10-22',
    },
    {
      id: 'course-d17',
      decision:
        'A deleted row becomes a one-line "Deleted … · Undo" row in place until the next action or 10 s. Added files show as new rows reading in.',
      why: 'Assumed, to confirm with Jack: supersedes the muted-line notice (course-d14); the change shows where it happened and nothing jumps.',
      beat: 'A notice in the heading’s muted line',
      date: '2026-10-22',
    },
    {
      id: 'course-d19',
      decision:
        'Under the name sits the muted line, "1 set to do · next due Thu" or "Nothing due", then Home’s stats box. This puts back the line course-d15 removed.',
      why: 'Confirmed by Jack: "muted line + stats box" (C1). The Work list no longer says "Nothing due" itself, so it is said once (say-it-once).',
      beat: 'The name alone',
      date: '2026-10-30',
    },
    {
      id: 'course-d20',
      decision:
        'No Add by the heading: Work has "Add work" at its foot and Materials "Add material". Dropping files on the page still adds them as materials.',
      why: 'Confirmed by Jack: "An Add on each list" (C6). The button words and the drop are assumed, not asked.',
      beat: 'One Add by the heading that decides what a file is',
      date: '2026-10-30',
    },
    {
      id: 'course-d21',
      decision:
        'The quiet footer is gone: time and cost live in the stats box. "PSet remembers 8 things" stays as a small fold at the foot.',
      why: 'Confirmed by Jack: "Stats box instead" (C9). That the memories stay as a fold at the foot is assumed, not asked.',
      beat: 'A quiet footer of time, cost and memories',
      date: '2026-10-30',
    },
    {
      id: 'course-d22',
      decision:
        'An empty course keeps its shape: Work and Materials each with a one-line message and its Add, and the stats box says "No study time yet" at the same height.',
      why: 'Confirmed by Jack: "Both empty lists, each with its Add" (C10). The stats box showing, not hidden, is Jack’s ask in the same answer.',
      beat: 'A centred invitation and one Add',
      date: '2026-10-30',
    },
    {
      id: 'course-d23',
      decision:
        'The stats box is Home’s own: the heatmap beside this week’s bars, then questions done and cost so far, each with a sparkline, built from Home’s parts.',
      why: 'Confirmed by Jack: "same as home, we need to keep cross page uniformity where possible." (C2, C4)',
      beat: 'A different box for the course',
      date: '2026-10-30',
    },
    {
      id: 'course-d24',
      decision:
        'Delete course is the third level of asking: the danger dialog. Deleting a set or removing a material stays the first: at once, with Undo.',
      why: 'Confirmed by Jack: "Three levels (Recommended)" (settings-view-grill G9); rule friction-matches-loss.',
      beat: 'A small confirm for deleting a course',
      date: '2026-10-30',
    },
  ],
});
