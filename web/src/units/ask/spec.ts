import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'ask',
  kind: 'pane',
  title: 'Ask',
  group: 'Ask',
  purpose:
    'One running conversation about a course: you ask, its steps show in order as quiet rows between the text, and the answer is a document with page chips that open the material beside it.',
  states: [
    {
      id: 'empty',
      name: 'Empty',
      when: 'No history and nothing attached: one quiet line above the composer, nothing to dismiss.',
      text: 'Ask anything about ECE 210. It reads your materials.',
    },
    {
      id: 'opened',
      name: 'Opened with a chip',
      when: 'Opened from "Ask about this": scrolled to the latest turn, the problem’s chip in the composer, the cursor in the box.',
      text: 'About 3.A.4 · (a)',
    },
    {
      id: 'thinking',
      name: 'Thinking',
      when: 'The question is sent and nothing has come back: a shimmering "Thinking" row under the question, replaced by the first step or the first words.',
      text: 'Thinking',
    },
    {
      id: 'step-running',
      name: 'A step running',
      when: 'Ask is searching or reading: one row names the current step with a light sweeping over it, no spinner; consecutive steps share the row.',
      text: "Searching 'eigenvalue'",
    },
    {
      id: 'writing',
      name: 'Writing, with the mark',
      when: 'Text is streaming and no step runs: a small mark pulses after the last words and is gone when the answer ends.',
    },
    {
      id: 'streaming',
      name: 'Streaming',
      when: 'An answer written live: Thinking, a step row, text, another step row, more text; the box stays yours and the button says Stop.',
    },
    {
      id: 'steps-folded',
      name: 'Steps done, folded',
      when: 'Each run of steps is one quiet row in its place between the text, "Searched twice, read 3 pages", the same height it had while running.',
      text: 'Searched twice, read 3 pages',
    },
    {
      id: 'steps-open',
      name: 'Steps done, opened',
      when: 'A folded row pressed: its steps are a small timeline under it, an icon per step on a thin vertical line.',
      text: "Searched 'eigenvalue'",
    },
    {
      id: 'not-ours',
      name: 'Not from your course',
      when: 'A block the model added on its own wears a quiet "Not from your course" tag above it.',
      text: 'Not from your course',
    },
    {
      id: 'remembered',
      name: 'Remembered',
      when: 'Ask saved a preference: a quiet row in the answer with Undo and Edit; the memory list shows it as New.',
      text: 'Remembered: you use V_0 for node voltages',
    },
    {
      id: 'stopped',
      name: 'Stopped',
      when: 'Stop was pressed: the partial answer stays, with a quiet "Stopped" under it. Asking again is the retry.',
      text: 'Stopped',
    },
    {
      id: 'failed',
      name: 'Failed',
      when: 'The answer could not be written: one line saying why and Try again; what was written stays.',
      text: "Couldn't answer: the model took too long to reply.",
    },
    {
      id: 'failed-setup',
      name: 'Failed, setup',
      when: 'The key is the cause: the same line, and Open Settings beside Try again.',
      text: 'Open Settings',
    },
    {
      id: 'image',
      name: 'Image pasted',
      when: 'A picture was pasted or dropped on the composer: a thumbnail with a cross to remove it, above the box.',
    },
    {
      id: 'history',
      name: 'Long history',
      when: 'Days of questions: quiet dividers ("Sep 12", "Yesterday", "Today") where the day changes, Clear at the very top.',
      text: 'Yesterday',
    },
    {
      id: 'clearing',
      name: 'Clear asks first',
      when: 'Clear pressed: the top row says how many turns go and that memories stay, with Cancel and Clear.',
      text: 'Clear 4 questions? Memories stay.',
    },
    {
      id: 'loading',
      name: 'Loading',
      when: 'The conversation is on its way: the top row, a question and an answer as quiet bars, and the composer at its own size.',
    },
  ],
  exampleWidth: 560,
  stress:
    'Fifty turns over three days, a 90 character chip, a 400 character question, and an answer with a plot, a table and code.',
  flows: [
    {
      id: 'ask-about-this',
      name: 'Ask about a problem',
      steps: ['type', 'send', 'open-calls'],
    },
    {
      id: 'follow-a-page',
      name: 'Check the book',
      steps: ['page-chip'],
    },
    {
      id: 'stop-and-ask-again',
      name: 'Stop one and ask another',
      steps: ['send', 'stop', 'type', 'send'],
    },
  ],
  actions: [
    {
      id: 'type',
      label: 'The box',
      does: 'Takes the question, several lines; Enter sends, Shift and Enter start a line. A pasted or dropped image joins it.',
    },
    {
      id: 'send',
      label: 'Send',
      does: 'Asks, with the chip and the image if any. Not ready, with its reason, until there is something to ask.',
    },
    {
      id: 'stop',
      label: 'Stop',
      does: 'Ends the answer being written; what is there stays, with "Stopped". It replaces Send until the answer ends.',
    },
    {
      id: 'open-calls',
      label: 'A folded step row',
      does: 'Opens or closes the timeline of the steps in that run.',
      target: { unit: 'ask', state: 'steps-open' },
    },
    {
      id: 'page-chip',
      label: 'A page chip, "p. 142"',
      does: 'Tells the workspace to open that material at that page on the other side. Sample chips carry no box, so nothing flashes yet.',
      target: { unit: 'material', state: 'flash' },
    },
    {
      id: 'copy',
      label: 'Copy',
      does: 'Copies a finished answer as text, without the steps. Shown on hover; the latest answer always shows it.',
    },
    {
      id: 'undo',
      label: 'Undo, on a Remembered row',
      does: 'Forgets what Ask just saved.',
    },
    {
      id: 'edit',
      label: 'Edit, on a Remembered row',
      does: 'Opens what Ask saved to change its words.',
    },
    {
      id: 'retry',
      label: 'Try again',
      does: 'Asks the failed question again.',
    },
    {
      id: 'settings',
      label: 'Open Settings',
      does: 'Goes to Settings, where the key is.',
    },
    {
      id: 'remove-chip',
      label: 'The cross on a chip or image',
      does: 'Drops the problem or the picture from the question being written.',
    },
    {
      id: 'clear',
      label: 'Clear',
      does: 'At the top: asks first, counting the turns that go; memories stay. Confirming empties the conversation.',
    },
  ],
  data: [
    {
      reads: 'The course’s one conversation: turns, calls, answers as blocks',
      call: 'sample',
    },
  ],
  remembers: [
    {
      what: 'The conversation itself, to the first question',
      per: 'Course',
      for: 'Until Clear; today only until the page closes (the server keeps it per book).',
    },
  ],
  inputs: [
    {
      name: 'course',
      does: 'The course’s name, for the empty line and the box.',
    },
    {
      name: 'turns',
      does: 'Every turn, oldest first, with the day each was asked.',
    },
    {
      name: 'about',
      does: 'The problem the question is about: the chip in the box. A new one brings its chip in.',
    },
    { name: 'startImage', does: 'Opens with this picture pasted in the box.' },
    {
      name: 'focusBox',
      does: 'Puts the cursor in the box when the pane opens ("Ask about this").',
    },
    { name: 'startOpen', does: 'Turns whose folded line starts open.' },
    { name: 'startClearing', does: 'Opens with Clear asking first.' },
    { name: 'onSend', does: 'Called with the text, the chip and the image.' },
    { name: 'onStop', does: 'Called when Stop is pressed.' },
    { name: 'onRetry', does: 'Called with the turn to ask again.' },
    { name: 'onClear', does: 'Called when Clear is confirmed.' },
    { name: 'onUndo', does: 'Called with the turn whose memory is undone.' },
    { name: 'onEdit', does: 'Called with the turn whose memory is edited.' },
    {
      name: 'onPage',
      does: 'Called with the material and printed page of a page chip.',
    },
    { name: 'onSettings', does: 'Called when Open Settings is pressed.' },
  ],
  priority: {
    first: 'The latest answer, and the box to ask the next question.',
    main: 'send',
  },
  sizes: {
    gives: [
      'The answer’s text stops at 680 and sits left; a plot, table or code may use the width',
      'A long chip or question wraps or is cut with an ellipsis',
      'The conversation scrolls; the box stays at the foot',
    ],
  },
  rules: {
    cite: [
      'honest-waits',
      'failure-says-what',
      'keep-the-place',
      'serif-to-read',
      'colour-has-a-word',
      'course-first',
      'student-decides',
      'one-primary',
      'sentence-case',
    ],
  },
  log: 'web/src/units/ask/log.md',
  decisions: [
    {
      id: 'ask-d1',
      decision:
        'One conversation per course. The answer is a document of blocks.',
      why: 'Jack picked "One per course (Recommended)" (K1): last week’s explanation stays in reach; blocks assumed (A1).',
      beat: 'One per set; separate chats listed',
      date: '2026-11-04',
    },
    {
      id: 'ask-d2',
      decision:
        'While Ask works, one line shows only the call in flight and replaces itself; when done it folds to one summary line that opens to the calls.',
      why: 'Jack: "I only want the current tool action to show, not a list of them as they come in. Then a summary folded to one line when its done." (K2)',
      supersededBy: 'ask-d16',
      beat: 'Rows as today; rows hidden once done',
      date: '2026-11-04',
    },
    {
      id: 'ask-d3',
      decision:
        'The live line and its folded summary are the same line, at the top of the answer under the question, the same height.',
      why: 'Jack picked "Top of the answer (Recommended)" (K3): nothing moves when the answer starts or ends.',
      supersededBy: 'ask-d15',
      beat: 'The foot of the answer',
      date: '2026-11-04',
    },
    {
      id: 'ask-d4',
      decision:
        'A saved preference is a quiet row in the answer, "Remembered: ...", with Undo and Edit.',
      why: 'Jack picked "A row with Undo (Recommended)" (K4): you see what was kept.',
      beat: 'Ask first with Keep; save silently',
      date: '2026-11-04',
    },
    {
      id: 'ask-d5',
      decision:
        'With no history and nothing attached, one quiet line sits above the composer.',
      why: 'Jack picked "A quiet line + composer (Recommended)" (K5).',
      beat: 'Suggested questions',
      date: '2026-11-04',
    },
    {
      id: 'ask-d6',
      decision:
        'The composer takes the problem chip and a pasted or dropped image.',
      why: 'Jack picked "Chips + paste an image (Recommended)" (K6): questions hold images since #53.',
      beat: 'Chips only; any page from a picker',
      date: '2026-11-04',
    },
    {
      id: 'ask-d7',
      decision:
        'History is endless with quiet day dividers; Clear is at the very top and asks first, counting the turns that go.',
      why: 'Jack picked "Endless, day dividers (Recommended)" (K7); the confirm is assumed (A5).',
      beat: 'Today open, earlier folded',
      date: '2026-11-04',
    },
    {
      id: 'ask-d8',
      decision:
        'The composer has no answer controls: the box, its chips and one button.',
      why: 'Jack picked "None, say it in words (Recommended)" (K8): "briefly" in words works; a lasting wish is a memory.',
      beat: 'A Short / Full switch',
      date: '2026-11-04',
    },
    {
      id: 'ask-d9',
      decision:
        'A page chip tells the workspace to open that material on the other side at that page; flashing a box waits for chips that carry one.',
      why: 'Jack picked "Material on the other side (Recommended)" (K9): one behaviour for every page link.',
      beat: 'A preview popover',
      date: '2026-11-04',
    },
    {
      id: 'ask-d10',
      decision:
        'Answer text stops at about 680 wide, left-aligned; plots, tables and code may use the width.',
      why: 'Jack picked "Capped, about 680 (Recommended)" (K10); the question is a compact block on the right (A2).',
      beat: 'Full pane width',
      date: '2026-11-04',
    },
    {
      id: 'ask-d11',
      decision:
        'While Ask answers the box stays editable and the button says Stop; nothing queues.',
      why: 'Jack picked "Type, send when done (Recommended)" (K11).',
      beat: 'Queue it; lock the box',
      date: '2026-11-04',
    },
    {
      id: 'ask-d12',
      decision:
        'Opened from "Ask about this", the pane is at the latest turn, the chip is in the box and the box has the cursor.',
      why: 'Jack picked "Bottom, chip in, focused (Recommended)" (K12).',
      beat: 'A fresh start view',
      date: '2026-11-04',
    },
    {
      id: 'ask-d13',
      decision:
        'Stop keeps the partial answer with "Stopped"; a failure says why with Try again, plus Open Settings for a setup cause. Past turns offer Copy only.',
      why: 'Assumed in the grill (A3, A4).',
      beat: 'Dropping the partial answer; editing old turns',
      date: '2026-11-04',
    },
    {
      id: 'ask-d14',
      decision:
        'Between the last call and the first words, and while words stream, the live line says "Thinking" and then "Writing".',
      why: 'Assumed in building: the grill names "Thinking" and calls only; a streaming answer needs a line that is still true.',
      supersededBy: 'ask-d18',
      beat: 'Staying on "Thinking" while it writes',
      date: '2026-11-04',
    },
    {
      id: 'ask-d15',
      decision:
        'Steps sit in the answer where they happened, between its paragraphs, in order; the answer has no bubble.',
      why: 'Jack picked "In order, like Claude (Recommended)" (K13): he wants Ask to look like the Claude desktop app. It reverses K3.',
      beat: 'Steps gathered at the top of the answer',
      date: '2026-11-04',
    },
    {
      id: 'ask-d16',
      decision:
        'While a run of steps goes, one row names the current step with a light sweeping over the text, no spinner; consecutive steps share the row.',
      why: 'Jack picked "Shimmering label (Recommended)" (K14): K2’s only-the-current-action stands.',
      beat: 'A spinner and a list',
      date: '2026-11-04',
    },
    {
      id: 'ask-d17',
      decision:
        'Each run of steps folds to one quiet row in its place, "Searched twice, read 3 pages", as tall as when it ran; it opens to a timeline.',
      why: 'Jack picked "Each group to one row (Recommended)" (K15): nothing jumps when the row turns.',
      beat: 'One summary for the whole answer',
      date: '2026-11-04',
    },
    {
      id: 'ask-d18',
      decision:
        'While text streams and no step runs, a small mark pulses after the last words and is gone when the answer ends. There is no "Writing" label.',
      why: 'Jack picked "A small mark at the end (Recommended)" (K16); it removes the assumed label of ask-d14.',
      beat: 'A Writing label',
      date: '2026-11-04',
    },
    {
      id: 'ask-d19',
      decision:
        'Before the first step or word, a shimmering "Thinking" row stands in the place the first step row or words take, and leaves nothing behind.',
      why: 'Jack picked "Thinking shimmer, then gone (Recommended)" (K17).',
      beat: 'A spinner; Thinking left in place',
      date: '2026-11-04',
    },
    {
      id: 'ask-d20',
      decision:
        'Copy is the only action on an answer: it shows while the pointer is over it, its space always reserved; the latest answer always shows it.',
      why: 'Jack picked "Copy, on hover (Recommended)" (K18).',
      beat: 'Copy always shown; more actions',
      date: '2026-11-04',
    },
    {
      id: 'ask-d21',
      decision:
        'A block the model added on its own wears a quiet "Not from your course" tag. Nothing is marked generated.',
      why: 'Jack picked "Mark only off-course parts (Recommended)" (K19): the course-first rule.',
      beat: 'Marking every answer',
      date: '2026-11-04',
    },
    {
      id: 'ask-d22',
      decision:
        'Asking about a selection of an old answer is deferred to one change for this pane and the work pane.',
      why: 'Jack picked "Later, with the work pane’s (Recommended)" (K20); it defers A3’s selection-asking.',
      beat: 'Building it for Ask alone',
      date: '2026-11-04',
    },
  ],
});
