import type { MockData, MockHomework, MockQuestion, MockTask } from './library.ts'
import { acceptTask, books } from './library.ts'

/** Homework seeds: the `homework:week` scenario — one assignment in every
 *  dashboard state (overdue, due today, due this week, due later, turned
 *  in, generating). Due dates are computed relative to page load so the
 *  DueChip tones and the Due soon strip read the same whenever the suite
 *  runs. */

// Local Y-M-D, never toISOString: the app parses due dates in local time,
// so UTC dates read one day ahead whenever the shoot runs in the evening.
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dayOfMonth}`
}
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function homework(p: Pick<MockHomework, 'id' | 'title' | 'bookId' | 'bookSha256' | 'bookTitle'> & Partial<MockHomework>): MockHomework {
  return {
    dueDate: null,
    status: 'ready',
    turnedIn: false,
    questionCount: 4,
    questionScale: 100,
    figureScale: 100,
    createdAt: ago(2880),
    updatedAt: ago(60),
    ...p,
  }
}

const [calc, lax, , ochem] = books

export const homeworks: MockHomework[] = [
  homework({
    id: 'hw-vectors',
    title: 'Vectors Worksheet',
    bookId: lax.id,
    bookSha256: lax.sha256,
    bookTitle: lax.title,
    status: 'generating',
    questionCount: 0,
    dueDate: day(2),
    createdAt: ago(6),
    updatedAt: ago(5),
  }),
  homework({
    id: 'hw-pset3',
    title: 'Problem Set 3',
    bookId: calc.id,
    bookSha256: calc.sha256,
    bookTitle: calc.title,
    dueDate: day(-1),
    questionCount: 4,
    updatedAt: ago(50),
  }),
  homework({
    id: 'hw-ch7',
    title: 'Chapter 7 Exercises',
    bookId: lax.id,
    bookSha256: lax.sha256,
    bookTitle: lax.title,
    dueDate: day(0),
    questionCount: 6,
    updatedAt: ago(180),
  }),
  homework({
    id: 'hw-lab',
    title: 'Lab Report 2',
    bookId: ochem.id,
    bookSha256: ochem.sha256,
    bookTitle: ochem.title,
    dueDate: day(3),
    questionCount: 2,
    updatedAt: ago(1440),
  }),
  homework({
    id: 'hw-quiz',
    title: 'Reading Quiz 5',
    bookId: calc.id,
    bookSha256: calc.sha256,
    bookTitle: calc.title,
    dueDate: day(12),
    questionCount: 10,
    updatedAt: ago(2880),
  }),
  homework({
    id: 'hw-ps2',
    title: 'Problem Set 2',
    bookId: calc.id,
    bookSha256: calc.sha256,
    bookTitle: calc.title,
    turnedIn: true,
    questionCount: 5,
    updatedAt: ago(4320),
  }),
]

/** The generating assignment's task: the questions are extracted and the
 *  walkthroughs are being written, three of eight so far. Questions are not
 *  phases — each one's state lives on its own row, where its repair doors
 *  are — so the phase simply counts them. */
export const generatingHomeworkTask: MockTask = {
  id: 'task-hw-vectors',
  kind: 'homework',
  status: 'running',
  bookId: lax.id,
  homeworkId: 'hw-vectors',
  title: 'Vectors Worksheet',
  phases: [
    {
      id: 'v1',
      taskId: 'task-hw-vectors',
      key: 'extract',
      name: 'Read the assignment',
      note: '',
      status: 'done',
      done: 1,
      total: 1,
      error: null,
      etaSeconds: null,
      createdAt: ago(6),
      startedAt: ago(6),
      finishedAt: ago(5),
    },
    {
      id: 'v2',
      taskId: 'task-hw-vectors',
      key: 'walkthroughs',
      name: 'Write the walkthroughs',
      note: 'question 4 of 8…',
      status: 'running',
      done: 3,
      total: 8,
      error: null,
      etaSeconds: 95,
      createdAt: ago(6),
      startedAt: ago(5),
      finishedAt: null,
    },
  ],
  failKind: null,
  retryable: false,
  error: null,
  createdAt: ago(6),
  startedAt: ago(5),
  finishedAt: null,
}

/** Problem Set 3's outline, served with GET /api/homework/hw-pset3: four
 *  answered questions mixing page-pinned and standalone. */
export const questions: MockQuestion[] = [
  {
    id: 'q-pset3-1',
    homeworkId: 'hw-pset3',
    position: 1,
    page: 12,
    status: 'ready',
    error: null,
    standalone: false,
    questionRect: { x: 0.08, y: 0.42, w: 0.56, h: 0.07 },
    transcription: 'Differentiate f(x) = x² sin(x).',
    diagrams: [{ label: 'Figure 1.4', rect: { x: 0.18, y: 0.18, w: 0.64, h: 0.32 } }],
    guide: {
      setup: 'A product of x² and sin(x), so the product rule applies.',
      hints: ['Identify the two factors.', 'Differentiate each factor.', 'Combine per the product rule.'],
      steps: [
        'Let u = x² and v = sin(x), so f = uv.',
        'Then u′ = 2x and v′ = cos(x).',
        'The product rule gives f′ = u′v + uv′ = 2x sin(x) + x² cos(x).',
      ],
      equations: [{ title: 'Product rule', tex: '(uv)\\prime = u\\prime v + uv\\prime' }],
      answer: 'f′(x) = 2x sin(x) + x² cos(x)',
    },
    createdAt: ago(2880),
    updatedAt: ago(2870),
  },
  {
    id: 'q-pset3-2',
    homeworkId: 'hw-pset3',
    position: 2,
    page: 12,
    status: 'ready',
    error: null,
    standalone: false,
    questionRect: { x: 0.08, y: 0.55, w: 0.5, h: 0.06 },
    transcription: 'Evaluate the integral of 1/x dx.',
    diagrams: [],
    guide: {
      setup: 'The antiderivative of 1/x is the natural logarithm.',
      hints: ['Recall which elementary function differentiates to 1/x.', 'Keep the absolute value.'],
      steps: [
        'Write the integrand as x⁻¹.',
        'The antiderivative is ln|x| + C. The absolute value keeps it defined for x < 0.',
      ],
      equations: [{ title: 'Antiderivative', tex: '\\int \\frac{1}{x}\\,dx = \\ln|x| + C' }],
      answer: 'ln|x| + C',
    },
    createdAt: ago(2880),
    updatedAt: ago(2869),
  },
  {
    id: 'q-pset3-3',
    homeworkId: 'hw-pset3',
    position: 3,
    page: null,
    status: 'ready',
    error: null,
    standalone: true,
    questionRect: null,
    transcription: 'A spherical balloon loses air at 3 cm³/s. How fast is the radius changing when r = 6 cm?',
    diagrams: [],
    guide: {
      setup: 'Related rates: differentiate V = (4/3)πr³ with respect to time.',
      hints: ['Write dV/dt in terms of dr/dt.', 'Substitute r = 6 at the instant of interest.'],
      steps: [
        'dV/dt = 4πr² dr/dt.',
        'Set dV/dt = −3 and r = 6: −3 = 4π(36) dr/dt.',
        'So dr/dt = −3 / (144π) = −1/(48π) cm/s.',
      ],
      equations: [{ title: 'Volume of a sphere', tex: 'V = \\tfrac{4}{3}\\pi r^3' }],
      answer: 'dr/dt = −1/(48π) ≈ −0.0066 cm/s',
    },
    createdAt: ago(2879),
    updatedAt: ago(2868),
  },
  {
    id: 'q-pset3-4',
    homeworkId: 'hw-pset3',
    position: 4,
    page: 13,
    status: 'ready',
    error: null,
    standalone: false,
    questionRect: { x: 0.08, y: 0.2, w: 0.6, h: 0.06 },
    transcription: 'Compute the limit of (sin x)/x as x → 0.',
    diagrams: [],
    guide: {
      setup: 'The classic limit; the squeeze theorem settles it.',
      hints: ['Compare the areas in a unit-circle picture.', 'Bound sin x between x and tan x near 0.'],
      steps: [
        'For 0 < |x| < π/2, cos x < (sin x)/x < 1.',
        'Both bounds tend to 1 as x → 0.',
        'By the squeeze theorem the limit is 1.',
      ],
      equations: [{ title: 'Squeeze bounds', tex: '\\cos x < \\frac{\\sin x}{x} < 1' }],
      answer: '1',
    },
    createdAt: ago(2878),
    updatedAt: ago(2867),
  },
]

export const homeworkSeeds: Record<string, MockData> = {
  'homework:week': {
    books,
    tasks: [generatingHomeworkTask],
    homeworks,
    acceptTask,
    duplicateBook: books[1],
  },
  'homework:workspace': {
    books,
    tasks: [],
    homeworks: [homeworks[1]],
    questions,
    acceptTask,
    duplicateBook: books[1],
  },
}
