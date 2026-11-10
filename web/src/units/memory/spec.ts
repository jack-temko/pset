import { defineSpec } from '@/design/spec';

const VERDICT = 'Jack, 2026-10-30';

export default defineSpec({
  id: 'memory',
  kind: 'component',
  title: 'Memory',
  group: 'Mocks',
  purpose:
    'The memories PSet follows, of two kinds: typed by the student, and saved by Ask when asked to remember. Mocked on sample data.',
  exampleWidth: 1012,
  states: [
    {
      id: 'ask-saves',
      name: 'Ask saves, you keep',
      when: 'Ask saved two: the switch reads New 2, Yours, From Ask, and the list opens on New, each row with Keep and Edit.',
      text: 'Keep',
    },
    {
      id: 'from-ask',
      name: 'From Ask',
      when: 'The header switch on From Ask: what Ask saved and the student kept, each with a link to its chat.',
      text: 'Open the chat',
    },
    {
      id: 'empty',
      name: 'Nothing remembered',
      when: 'No memories: one paragraph says what memory is, and the add field follows.',
      text: 'PSet remembers how you like things explained',
    },
    {
      id: 'editing',
      name: 'Editing a row',
      when: 'A row’s text becomes a field in the same place, as tall as the wrapped text and growing; Enter saves, Shift+Enter adds a line.',
      text: 'Save',
    },
    {
      id: 'deleted',
      name: 'Forgotten, with Undo',
      when: 'A row is forgotten at once, no question asked, and stays in its place as one line with Undo for 10 s.',
      text: 'Forgot “Round to three significant figures”',
    },
  ],
  stress:
    'A 190 character memory among eleven: it wraps onto three lines, and its field grows with it.',
  actions: [
    {
      id: 'add',
      label: 'Add',
      does: 'Adds what is typed as a memory of yours, on Enter or the button.',
    },
    {
      id: 'edit',
      label: 'Edit',
      does: 'Turns the row’s text into a growing field; Enter or Save keeps the change, Shift+Enter adds a line, Escape or Cancel drops it.',
    },
    {
      id: 'forget',
      label: 'Forget',
      does: 'Removes the memory at once and offers Undo, with no question first.',
    },
    {
      id: 'undo',
      label: 'Undo',
      does: 'Puts the forgotten memory back where it was.',
    },
    {
      id: 'switch-side',
      label: 'New, Yours, From Ask',
      does: 'The header switch: what Ask just saved (only while there is some), the student’s own, or what Ask saved and was kept.',
    },
    {
      id: 'show-all',
      label: 'Show all',
      does: 'At the list’s foot past five rows: opens the list page’s memories.',
      target: { unit: 'list-page', state: 'memories' },
    },
    {
      id: 'keep',
      label: 'Keep',
      does: 'Accepts what Ask saved, and the New mark goes.',
    },
  ],
  data: [
    {
      reads:
        'The memories: text, source (You or Ask), date, the chat a saved one came from',
      call: 'sample',
    },
  ],
  inputs: [
    { name: 'empty', does: 'Starts with nothing remembered.' },
    { name: 'side', does: 'Which side of the switch starts chosen.' },
    {
      name: 'showAllHref',
      does: 'Where Show all goes: the list page’s memories.',
    },
    { name: 'editing', does: 'The id of the memory that starts being edited.' },
    {
      name: 'deleted',
      does: 'The id of the memory that starts forgotten, with Undo showing.',
    },
  ],
  priority: {
    first: 'The add field, then the list.',
    main: 'add',
  },
  sizes: {
    gives: ['Long text wraps, so a row grows'],
  },
  rules: {
    cite: [
      'student-decides',
      'sentence-case',
      'colour-has-a-word',
      'one-word-per-thing',
      'friction-matches-loss',
      'quiet-when-repeated',
    ],
  },
  log: 'web/src/units/memory/log.md',
  decisions: [
    {
      id: 'memory-d1',
      decision:
        "What Ask saved waits on the list's New side with Keep and Edit, until the student keeps it.",
      why: `${VERDICT}: "lets go with D". The model never silently steers: a save from Ask waits for a look.`,
      beat: 'One plain list; two lists; chips',
      date: '2026-10-30',
    },
    {
      id: 'memory-d2',
      decision: 'Forget asks nothing and offers Undo.',
      why: 'A lost memory costs one sentence to type again (ideas/memory-preferences-only.md).',
      beat: 'A confirm on every delete',
      date: '2026-10-30',
    },
    {
      id: 'memory-d3',
      decision:
        'There is no search. The list shows the five newest kept memories, and New ones always, then "Show all" in the heading, as Home’s lists do.',
      why: `${VERDICT}: "drop the search bar. Make it hide past a certain amount with a button to expand like our other lists."`,
      beat: 'A search field; showing every memory',
      date: '2026-10-30',
    },
    {
      id: 'memory-d4',
      decision:
        'A memory shows its full text, wrapped. Edit and Add are multi-line fields that grow with the text, in the same type and place as the text.',
      why: 'Jack, 2026-10-30: "make these memories be multi line editable, editing a saved memory that wraps opens a super smalle inline textblock that sucks to edit".',
      beat: 'A one-line title that truncates; a one-line input',
      date: '2026-10-30',
    },
    {
      id: 'memory-d5',
      decision:
        'The list pattern: the header switch picks the side, five rows then Show all N to the list page.',
      why: 'Jack, 2026-11-04: "redo memory D with our new list changes and having the list page please".',
      beat: 'A segmented filter over the list; Show all expanding in place',
      date: '2026-11-04',
    },
    {
      id: 'memory-d6',
      decision:
        'New is a side of the switch, first, shown only while Ask has saved something not yet kept; the list opens on it. No second list.',
      why: 'Jack, 2026-11-04: "i dont love having two separte lists when something is new. Either make that a cetegory that can be selected to filter".',
      beat: 'A New from Ask box above the list; new rows at the top of every side',
      date: '2026-11-04',
    },
    {
      id: 'memory-d7',
      decision:
        'MemoryList is the list alone (same rows, cap, Show all, Undo) for a fold on another screen, such as Course.',
      why: 'Fable review, item 15: Course drew memories its own way. Jack took it in the review batch.',
      beat: 'Each screen drawing its own memory rows',
      date: '2026-11-09',
    },
    {
      id: 'memory-d8',
      decision:
        'A forgotten memory stays in its place as "Forgot “...” · Undo" for 10 s or until the next is forgotten: the one Undo shape in a list.',
      why: 'Jack: "Row in place, 10 s (Recommended)" (ideas/fable-review-grill.md D4).',
      beat: 'A muted Undo line under the list',
      date: '2026-11-09',
    },
  ],
});
