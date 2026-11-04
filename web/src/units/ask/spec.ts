import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'ask',
  kind: 'pane',
  title: 'Ask',
  group: 'Ask',
  purpose:
    'One running conversation about a course: you ask, one live line says what Ask is doing, and the answer lands as a document with page chips that open the material beside it.',
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
      when: 'The question is sent and Ask waits on the model: the live line says "Thinking" under the question, with a spinner.',
      text: 'Thinking',
    },
    {
      id: 'call',
      name: 'A call in flight',
      when: 'Ask is searching or reading: the live line names only that call and replaces itself with the next one.',
      text: "Searching 'eigenvalue'",
    },
    {
      id: 'streaming',
      name: 'Streaming',
      when: 'The answer is being written, a block at a time, under the live line ("Writing"); the box stays yours and the button says Stop.',
    },
    {
      id: 'done',
      name: 'Done',
      when: 'The answer ends: the live line turns, in place, into one folded line of what Ask read; Copy is under the answer.',
      text: 'Read 3 pages, searched twice',
    },
    {
      id: 'done-open',
      name: 'Done, the calls opened',
      when: 'The folded line pressed: the calls are listed under it, each as it was done.',
      text: "Searched 'eigenvalue'",
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
      label: 'The folded line',
      does: 'Opens or closes the list of calls Ask made.',
      target: { unit: 'ask', state: 'done-open' },
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
      does: 'Copies a finished answer as text.',
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
      beat: 'Rows as today; rows hidden once done',
      date: '2026-11-04',
    },
    {
      id: 'ask-d3',
      decision:
        'The live line and its folded summary are the same line, at the top of the answer under the question, the same height.',
      why: 'Jack picked "Top of the answer (Recommended)" (K3): nothing moves when the answer starts or ends.',
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
      beat: 'Staying on "Thinking" while it writes',
      date: '2026-11-04',
    },
  ],
});
