import { defineSpec } from '@/design/spec';

const ASSUMED = 'Assumed, to confirm with Jack';

export default defineSpec({
  id: 'settings',
  kind: 'view',
  title: 'Settings',
  group: 'Screens',
  purpose:
    'One page in four groups, You, Model, PSet and Reset, each row a name and what it does on the left and its control on the right, for a student who opens it rarely.',
  exampleWidth: 'full',
  states: [
    {
      id: 'fine',
      name: 'All fine',
      when: 'A key that works, up to date, nothing failing and no errors kept: Health is one quiet line with the checks folded under it.',
      text: 'Everything is working',
    },
    {
      id: 'no-key',
      name: 'No key yet',
      when: 'First run: the key section says what is missing, above the empty field.',
      text: 'PSet needs a key to read and guide.',
    },
    {
      id: 'key-failed',
      name: 'Key failed its test',
      when: 'The pasted key was refused: the field and its note take the danger colour.',
      text: 'OpenRouter refused this key. Check it and paste it again.',
    },
    {
      id: 'update-available',
      name: 'Update available',
      when: 'A newer version exists: its notes and "Update to 0.3.0" show under the version.',
      text: 'Update to 0.3.0',
    },
    {
      id: 'updating',
      name: 'Updating',
      when: 'The update button is busy and a line says it is updating in place.',
      text: 'Updating in place. PSet restarts when it is done.',
    },
    {
      id: 'check-failing',
      name: 'A check failing',
      when: 'One health check fails: Health says so and the checks open, the failing one with its Fix.',
      text: 'Start Ollama',
    },
    {
      id: 'errors-kept',
      name: 'Errors kept',
      when: 'Errors are kept: "Recent errors (3)" is unfolded with each id, reason and fix, and Clear all.',
      text: 'Clear all',
    },
    {
      id: 'failed',
      name: 'Failed to load',
      when: 'Settings could not be read: the page says so and offers Try again.',
      text: 'Could not load Settings',
    },
  ],
  stress:
    'A 38 character name, a 140 character key, 8 models, 8 notes, 12 courses and 12 errors with 95 character reasons: long text wraps or truncates.',
  flows: [
    {
      id: 'first-key',
      name: 'Paste the first key',
      steps: ['test-key', 'save-key'],
    },
    { id: 'switch-to-night', name: 'Switch to Night', steps: ['appearance'] },
    {
      id: 'update-pset',
      name: 'Update PSet',
      steps: ['check-updates', 'update'],
    },
    { id: 'mend-a-check', name: 'Mend a failing check', steps: ['fix'] },
    {
      id: 'start-again',
      name: 'Start again',
      steps: ['reset-everything', 'confirm-reset'],
    },
  ],
  actions: [
    {
      id: 'save-name',
      label: 'Name',
      does: 'Saves on Enter or when you leave the field, and says "Saved" for a moment.',
    },
    {
      id: 'test-key',
      label: 'Test',
      does: 'Tests the key against the model service and says whether it works.',
    },
    {
      id: 'save-key',
      label: 'Save',
      does: 'Tests the key first, and keeps it only if it works.',
    },
    {
      id: 'appearance',
      label: 'Paper, Night or System',
      does: 'Applies the look at once. The design page is always dark, so the sample does not repaint.',
    },
    {
      id: 'check-updates',
      label: 'Check for updates',
      does: 'Asks whether a newer version exists and says what it found.',
    },
    {
      id: 'update',
      label: 'Update to 0.3.0',
      does: 'Updates in place and restarts PSet.',
    },
    {
      id: 'fix',
      label: 'Fix',
      does: 'Runs the check’s own fix, worded for it: "Start Ollama".',
    },
    {
      id: 'clear-errors',
      label: 'Clear all',
      does: 'Asks first, in a small confirm beside the button that counts the kept errors, then forgets them.',
      target: { unit: 'confirm', state: 'errors' },
    },
    {
      id: 'clear-history',
      label: 'Clear',
      does: 'Asks first, in a small confirm beside the button with the hours and answers that go.',
      target: { unit: 'confirm', state: 'history' },
    },
    {
      id: 'reset-everything',
      label: 'Reset',
      does: 'Opens a dialog with the counts of courses, sets, materials and memories that go; the red button waits until "reset" is typed.',
      target: { unit: 'danger-dialog', state: 'reset' },
    },
    {
      id: 'confirm-reset',
      label: 'Reset everything',
      does: 'Does it once "reset" is typed. The sample only closes the dialog.',
    },
    { id: 'retry', label: 'Try again', does: 'Reads Settings again.' },
  ],
  data: [
    {
      reads:
        'The name, key and status, models per job, look, version and update, usage by month and course, health checks, kept errors and the reset counts',
      call: 'sample',
    },
  ],
  inputs: [
    {
      name: 'settings',
      does: 'Everything the page shows and every count its confirms use.',
    },
    { name: 'failed', does: 'The read failed: shows the failed page.' },
    { name: 'unfolded', does: 'Opens every fold (the design page only).' },
    { name: 'homeHref', does: 'Where the wordmark and "Home" go.' },
    { name: 'settingsHref', does: 'Where Settings goes.' },
  ],
  priority: {
    first: 'The key, when there is none; otherwise the groups in order.',
    main: 'save-key',
  },
  sizes: {
    gives: [
      'Long text wraps or truncates',
      'A row’s bar narrows before its figure does',
    ],
  },
  rules: {
    cite: [
      'check-before-cost',
      'honest-waits',
      'failure-says-what',
      'student-decides',
      'one-primary',
      'colour-has-a-word',
      'room-for-big-type',
      'sentence-case',
      'friction-matches-loss',
      'say-it-once',
    ],
  },
  log: 'web/src/units/settings/log.md',
  decisions: [
    {
      id: 'settings-d1',
      supersededBy: 'settings-d15',
      decision:
        'One column 720 wide, centred, with section headings like Home’s and no side nav (G1).',
      why: `${ASSUMED}: seven short sections fit one scroll.`,
      beat: 'A side nav; Home’s 1012',
      date: '2026-10-22',
    },
    {
      id: 'settings-d2',
      supersededBy: 'settings-d16',
      decision:
        'The order is You, Model key, Appearance, Updates, Usage, Health, Reset, with the about line at the foot (G2).',
      why: `${ASSUMED}: first run needs the key; the rest by how often it is wanted.`,
      beat: 'Today’s order; alphabetical',
      date: '2026-10-22',
    },
    {
      id: 'settings-d3',
      decision:
        'The key is one field with Test and Save, and Save tests first. The models PSet picks per job fold under "Models PSet uses" (G3).',
      why: `Confirmed by Jack: "Field, Test, Save, models folded (Recommended)". the key is the task; the model list is curiosity.`,
      beat: 'The model list always shown; the key alone',
      date: '2026-10-22',
    },
    {
      id: 'settings-d4',
      decision:
        'Health and errors sit together in PSet: a Health row, Checks folded, then "Recent errors (N)" folded with each id, reason and fix, and Clear all (G4).',
      why: `Confirmed by Jack: "Quiet line, checks folded (Recommended)". both answer "is something wrong".`,
      beat: 'Two sections, as today',
      date: '2026-10-22',
    },
    {
      id: 'settings-d5',
      decision:
        'Usage is in Model: this month’s total, per course with a thin bar each, and all time (G5).',
      why: `Confirmed by Jack: "Month, per course, all time (Recommended)". no screen shows a total today (finding #5).`,
      beat: 'Per course only on the course page; leaving it out',
      date: '2026-10-22',
    },
    {
      id: 'settings-d6',
      decision:
        'Appearance is Paper, Night and System as a segmented control, applied at once (G6).',
      why: `Confirmed by Jack: "Three-part switch (Recommended)". as today, it works.`,
      beat: 'A toggle; a dropdown',
      date: '2026-10-22',
    },
    {
      id: 'settings-d7',
      decision:
        'The PSet group shows the version once with Check for updates; a newer one adds a notes row with "Update to 0.3.0" that swaps its face in place (G7).',
      why: `Confirmed by Jack: "Check button, update in place (Recommended)". as today.`,
      beat: 'Automatic updates with no button',
      date: '2026-10-22',
    },
    {
      id: 'settings-d8',
      decision:
        'Fields save on Enter or on leaving them, with a brief "Saved"; only the key has a Save button (G8).',
      why: `Confirmed by Jack: "Save on leave (Recommended)". fewer buttons.`,
      beat: 'A Save per section',
      date: '2026-10-22',
    },
    {
      id: 'settings-d9',
      supersededBy: 'settings-d17',
      decision:
        'Clear study history and Reset everything sit in Reset; buttons say Clear and Reset and a popover confirms with counts; Clear all stays with errors (G9).',
      why: `${ASSUMED}: one danger zone.`,
      beat: 'Each beside what it clears',
      date: '2026-10-22',
    },
    {
      id: 'settings-d10',
      decision:
        'The words are the course vocabulary: "every course, set and material", and Ollama "searches your materials". "Book" is gone (G10).',
      why: `${ASSUMED}: the courses vocabulary.`,
      beat: 'Keeping "book"',
      date: '2026-10-22',
    },
    {
      id: 'settings-d11',
      decision:
        'When all is well, Health is one line, "Everything is working", with the checks folded under it (G11).',
      why: `Confirmed by Jack: "Quiet line, checks folded (Recommended)". the common case is quiet.`,
      beat: 'Always listing the five checks',
      date: '2026-10-22',
    },
    {
      id: 'settings-d12',
      decision:
        'Settings loads as the Loaded standard asks: a skeleton shaped like the sections, revealed together (G12).',
      why: `${ASSUMED}: nothing jumps on load.`,
      beat: 'A spinner',
      date: '2026-10-22',
    },
    {
      id: 'settings-d13',
      decision:
        'Path and heading both stay, and Settings in the top bar shows plain here. The version is said once, in the PSet group; the data folder is its own row there.',
      why: 'Confirmed by Jack: "Keep both (Recommended)" (path and heading). The version said once is assumed (say-it-once).',
      beat: 'The version in Updates and again in the foot; a Settings link to itself',
      date: '2026-10-22',
    },
    {
      id: 'settings-d14',
      decision:
        'Health is hidden when no errors are kept: "Recent errors" shows only with at least one.',
      why: 'Assumed, to confirm with Jack: a fold labelled (0) is a door to nothing.',
      beat: 'A fold that opens to "No errors kept"',
      date: '2026-10-22',
    },
    {
      id: 'settings-d15',
      decision:
        'The page is 1012 wide in four groups, no side nav. Each row is a name and what it does on the left, its control on the right: about 1.5 screens.',
      why: 'Confirmed by Jack: "Yes, four groups, one page (Recommended)" (G1), after asking about the page’s width, height and a side nav.',
      beat: 'A 720 column of seven sections; a side nav with a page per section',
      date: '2026-10-30',
    },
    {
      id: 'settings-d16',
      decision:
        'The groups are You (name, appearance), Model (key, models folded, usage), PSet (updates, health, data folder) and Reset (clear history, reset everything).',
      why: 'Confirmed by Jack: "Try to collapse the categories slightly. Organize in the way you think best" (G2).',
      beat: 'Seven sections',
      date: '2026-10-30',
    },
    {
      id: 'settings-d17',
      decision:
        'Three levels of asking: a small confirm for clearing one kind of data (history, errors), a danger dialog with the typed word "reset" for Reset everything.',
      why: 'Confirmed by Jack: "Three levels (Recommended)" (G9), after asking how GitHub does it. Rule friction-matches-loss.',
      beat: 'One confirm for everything; Clear all outside the levels',
      date: '2026-10-30',
    },
  ],
});
