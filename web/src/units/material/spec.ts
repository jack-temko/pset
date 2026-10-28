import { defineSpec } from '@/design/spec';

export default defineSpec({
  id: 'material',
  kind: 'pane',
  title: 'Material',
  group: 'Material',
  purpose:
    'One document with pages, read beside a problem set: a continuous scroll under a thin line of Contents, page and zoom, that keeps your exact spot and takes a box when a problem needs one.',
  states: [
    {
      id: 'reading',
      name: 'Reading',
      when: 'The top line (Contents, "p. 112 of 640", zoom) and the pages scrolling under it, fitted to the width, no boxes drawn.',
    },
    {
      id: 'contents',
      name: 'Contents',
      when: 'Under 720px wide: the list over the pages, chapters and sections, the section you are in marked, deeper ones folded. A pick closes it.',
    },
    {
      id: 'contents-beside',
      name: 'Contents beside the pages',
      when: 'From 720px wide: a column on the left, the pages shrink to the rest. It stays open, its marked row follows the page, a pick jumps and keeps it open.',
    },
    {
      id: 'go-to-page',
      name: 'Go to page',
      when: 'The page number turned into a box and typed into; Enter goes to that printed page.',
    },
    {
      id: 'page-missing',
      name: 'Go to a page that is not there',
      when: 'A printed page past the end was entered: a line says so, the box stays, and the pages stay where they were.',
      text: 'No p. 900, the book ends at 640',
    },
    {
      id: 'flash',
      name: 'Flash',
      when: 'A page link from the work pane turned the pane to the page; the problem’s box is outlined and fades out over 1.8 s.',
    },
    {
      id: 'unnumbered',
      name: 'Unnumbered page',
      when: 'On a page with no printed number (a cover, the front matter): "PDF 3", muted, where the page number is.',
      text: 'PDF 3',
    },
    {
      id: 'boxing',
      name: 'Boxing, nothing drawn yet',
      when: 'Boxing mode: the top line says what the box is around, with Cancel; Done is not shown until a box exists; drag on the page to draw one.',
      text: 'Draw a box around 4.62',
    },
    {
      id: 'boxing-drawn',
      name: 'Boxing, a box drawn',
      when: 'One or several boxes are on the page; Done appears beside Cancel; a box has its own remove.',
      text: 'Draw a box around 4.62',
    },
    {
      id: 'not-ready',
      name: 'Not ready',
      when: 'The material is still being read in after it was added: one centred wait, with the time left, until the whole book is ready.',
      text: 'Reading Griffiths, about 2 min',
    },
    {
      id: 'page-loading',
      name: 'Pages loading',
      when: 'Pages whose images have not arrived are plain page-shaped boxes in the surface colour; each image fades in over its box.',
    },
    {
      id: 'page-failed',
      name: 'A page could not be drawn',
      when: 'One page’s image failed: that page says what failed, why and Try again; the rest of the book reads on.',
      text: "Couldn't draw p. 112",
    },
    {
      id: 'book-failed',
      name: 'The book could not be read',
      when: 'The whole material failed to read: what failed, why, and Read it again; nothing else is shown.',
      text: "Couldn't read Griffiths",
    },
  ],
  exampleWidth: 560,
  stress:
    'A 3000 page book, a 90 character name, contents titles over 100 characters, three levels of them, and a place on page 1700 with Contents open.',
  flows: [
    {
      id: 'find-by-contents',
      name: 'Find a section in Contents',
      steps: ['open-contents', 'pick-section'],
    },
    {
      id: 'find-by-number',
      name: 'Go to a printed page',
      steps: ['open-go-to', 'enter-page'],
    },
    {
      id: 'box-a-problem',
      name: 'Box a problem on the page',
      steps: ['draw-box', 'done'],
    },
  ],
  actions: [
    {
      id: 'scroll',
      label: 'The pages',
      does: 'Scroll as one continuous run; the page number follows, and the tab’s page follows it.',
    },
    {
      id: 'open-contents',
      label: 'Contents',
      does: 'Opens the list over the pages, or closes it.',
      target: { unit: 'material', state: 'contents' },
    },
    {
      id: 'pick-section',
      label: 'A section in Contents',
      does: 'Goes to the page it starts on and closes the list. A caret unfolds the sections under it.',
      target: { unit: 'material', state: 'reading' },
    },
    {
      id: 'open-go-to',
      label: 'The page number',
      does: 'Turns "p. 112" into a box to type a printed page into; Escape or a click away puts it back.',
      target: { unit: 'material', state: 'go-to-page' },
    },
    {
      id: 'enter-page',
      label: 'Enter, in the page box',
      does: 'Goes to the printed page. A page that is not in the book says so and changes nothing.',
      target: { unit: 'material', state: 'page-missing' },
    },
    {
      id: 'zoom',
      label: 'Pinch or ctrl+wheel',
      does: 'Zooms around the pointer, from half to four times the fit width.',
    },
    {
      id: 'reset-zoom',
      label: 'The zoom percentage',
      does: 'Goes back to fit width. At fit it is plain text.',
    },
    {
      id: 'draw-box',
      label: 'Drag on a page, in boxing',
      does: 'Draws a box; draw as many as the problem needs. A box has a cross that removes it.',
      target: { unit: 'material', state: 'boxing-drawn' },
    },
    {
      id: 'done',
      label: 'Done',
      does: 'Hands every box to the workspace and ends boxing. It is not shown until a box exists.',
    },
    {
      id: 'cancel',
      label: 'Cancel, or Escape',
      does: 'Ends boxing and drops the boxes.',
    },
    {
      id: 'try-page',
      label: 'Try again, on a failed page',
      does: 'Asks for that page’s image again.',
    },
    {
      id: 'read-again',
      label: 'Read it again',
      does: 'Asks for the whole book to be read again.',
    },
  ],
  data: [
    {
      reads:
        'The book’s pages as images, which printed numbers they carry, and its contents',
      call: 'sample',
    },
  ],
  remembers: [
    {
      what: 'The exact scroll spot and the zoom',
      per: 'Tab (a material open twice keeps two)',
      for: 'Until the tab closes; today only until the page closes (the workspace will keep it across visits).',
    },
  ],
  inputs: [
    {
      name: 'name',
      does: 'The material’s name; it heads Contents and the wait.',
    },
    {
      name: 'book',
      does: 'The pages, where the printed numbers start, and the contents.',
    },
    { name: 'tabId', does: 'Which tab this is, the key of the place kept.' },
    { name: 'memory', does: 'Where the place of each tab is kept.' },
    {
      name: 'page',
      does: 'The printed page the tab is on; when it changes the pane turns to it.',
    },
    {
      name: 'startPdf',
      does: 'Opens on this PDF page, for a page with no printed number.',
    },
    { name: 'startContents', does: 'Opens with Contents showing.' },
    {
      name: 'besideAt',
      does: 'The pane width from which Contents sits beside the pages (720 by default).',
    },
    {
      name: 'startGoTo',
      does: 'Opens with the page number box in use: what is typed, and whether it was entered.',
    },
    {
      name: 'startBoxes',
      does: 'Opens with these boxes drawn, in boxing mode.',
    },
    {
      name: 'status',
      does: 'Ready, still being read in, or could not be read.',
    },
    {
      name: 'readingMin',
      does: 'About how many minutes the reading in takes.',
    },
    {
      name: 'loadMs',
      does: 'How long a sample page takes to arrive; the real pane has no such input.',
    },
    { name: 'brokenPages', does: 'The PDF pages a sample cannot draw.' },
    {
      name: 'flash',
      does: 'A page link’s request: the printed page and the box to outline; a new count flashes again.',
    },
    {
      name: 'boxing',
      does: 'Boxing mode: what the box is around and the printed page to turn to.',
    },
    {
      name: 'onPage',
      does: 'Called with the printed page the scroll reaches.',
    },
    { name: 'onDone', does: 'Called with every box when Done is pressed.' },
    {
      name: 'onBoxes',
      does: 'Called with the boxes drawn so far, whenever one is drawn or removed.',
    },
    { name: 'onCancel', does: 'Called when boxing is cancelled.' },
    { name: 'onRetry', does: 'Called when Read it again is pressed.' },
  ],
  priority: {
    first: 'The page you are on, big, and where you are in the book.',
    main: 'scroll',
  },
  sizes: {
    gives: [
      'Pages are fitted to the width, so they shrink with the side',
      'A long contents title wraps and the list scrolls',
      'A 90 character name wraps in Contents and the wait',
    ],
  },
  rules: {
    cite: [
      'material-is-main',
      'keep-the-place',
      'honest-waits',
      'failure-says-what',
      'one-primary',
      'sentence-case',
    ],
  },
  log: 'web/src/units/material/log.md',
  decisions: [
    {
      id: 'material-d1',
      decision: 'Pages are one continuous scroll, fitted to the side’s width.',
      why: 'Jack picked "One continuous scroll (Recommended)": flipping between a figure and its problem stays one scroll (M1).',
      beat: 'One page at a time',
      date: '2026-10-22',
    },
    {
      id: 'material-d2',
      decision:
        'A thin line on top: Contents left; the page and the zoom right. Pages scroll under it.',
      why: 'Jack picked "A thin line at the top (Recommended)": always in the same place, like the work pane’s set line (M2).',
      beat: 'A floating pill at the bottom',
      date: '2026-10-22',
    },
    {
      id: 'material-d3',
      decision:
        'Contents opens over the pages from its button and closes after a pick.',
      supersededBy: 'material-d16',
      why: 'Jack picked "Behind a button, over the pages (Recommended)": the pages keep the half-width side (M3).',
      beat: 'An always-shown rail; no contents',
      date: '2026-10-22',
    },
    {
      id: 'material-d4',
      decision:
        'Clicking the page number turns it into a box; a printed page and Enter go there. A page that is not there says so and stays put.',
      why: 'Jack picked "Click the page number and type (Recommended)": usability finding #6; the missing page is assumed (A1).',
      beat: 'A page box in a toolbar',
      date: '2026-10-22',
    },
    {
      id: 'material-d5',
      decision:
        'A page with no printed number shows its PDF page, muted: "PDF 3". Typing still means printed pages.',
      why: 'Jack picked "The PDF page, muted: \'PDF 3\' (Recommended)": honest that it is not a printed number (M5).',
      beat: 'Roman numerals or blank',
      date: '2026-10-22',
    },
    {
      id: 'material-d6',
      decision:
        'Problem boxes are not drawn while reading; a page link from the work pane flashes the problem’s box.',
      why: 'Jack picked "Only flash on a page link (Recommended)": a clean page (M6, P11).',
      beat: 'Current problem outlined; every problem outlined',
      date: '2026-10-22',
    },
    {
      id: 'material-d7',
      decision:
        'Zoom opens fitted to width; pinch or ctrl+wheel zooms and the percentage resets to fit.',
      why: 'Jack picked "Fit width, pinch to zoom, remembered (Recommended)": subscripts stay readable without chrome (M7).',
      beat: '+ and - buttons; no zoom',
      date: '2026-10-22',
    },
    {
      id: 'material-d8',
      decision:
        'The place is the exact scroll spot and the zoom, kept per tab across tab switches (and, once the workspace keeps it, reloads).',
      why: 'Jack picked "Exact scroll spot, per tab (Recommended)": finding #9, keep-the-place (M8).',
      beat: 'Top of the page only',
      date: '2026-10-22',
    },
    {
      id: 'material-d9',
      decision:
        'A page still loading is a plain page-shaped box in the surface colour, no shimmer; the image fades in and nothing jumps.',
      why: 'Jack picked "A plain page-shaped box (Recommended)": calm while scrolling fast through a book (M9).',
      beat: 'A shimmering skeleton',
      date: '2026-10-22',
    },
    {
      id: 'material-d10',
      decision:
        'A material still being read in shows one centred wait ("Reading Griffiths, about 2 min") until the whole book is ready.',
      why: 'Jack picked "One wait screen" over the recommended pages-as-ready (M10).',
      beat: 'Pages show as they become ready',
      date: '2026-10-22',
    },
    {
      id: 'material-d11',
      decision:
        'Boxing is a mode of the pane: the top line says "Draw a box around 4.62" with Done and Cancel; one box or several; Escape cancels.',
      why: 'Jack picked "A boxing mode in the material pane (Recommended)": stays side by side with the set (M11, A3).',
      beat: 'A separate full-window boxing screen',
      date: '2026-10-22',
    },
    {
      id: 'material-d12',
      decision:
        'Asking about part of a page, and searching the book’s text, are on hold, listed in ideas/on-hold.md.',
      why: 'Jack: "keep a list somewhere of possible improvements that on hold" (M12).',
      beat: 'Building them now',
      date: '2026-10-22',
    },
    {
      id: 'material-d13',
      decision:
        'Contents shows two levels and folds the rest under their section; the section you are in is marked.',
      why: 'Assumed in the grill (A2): as today’s rail does.',
      beat: 'Every level open',
      date: '2026-10-22',
    },
    {
      id: 'material-d14',
      decision:
        'Failed states follow the error catalog: what failed, why, and a fix; a page fails alone and the book reads on.',
      why: 'Assumed in the grill (A4).',
      beat: 'A bare "Error"',
      date: '2026-10-22',
    },
    {
      id: 'material-d15',
      decision:
        'Every page number in and out of the pane is a printed one; boxes carry the PDF page they are on.',
      why: 'The tab label and the work pane’s page links already speak printed pages (W11, P11).',
      beat: 'PDF pages for the workspace',
      date: '2026-10-22',
    },
    {
      id: 'material-d16',
      decision:
        'From 720px wide, Contents is a column beside the pages, which shrink to fit; it stays open and follows the page. Narrower, it stays as M3.',
      why: 'Jack: "if possible and there is width can we somehow shrink the preview so I can still see some of the page while I scroll" (amends M3; see log.md).',
      beat: 'Contents always over the pages',
      date: '2026-10-27',
    },
  ],
});
