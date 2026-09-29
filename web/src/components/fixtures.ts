/**
 * Fixtures for the components page: typed against the generated API
 * types, so a contract change breaks the build here rather than a screen.
 * No screen reads this file; they all read the API.
 */

import type { Assignment } from '@/api/homework'
import type { Book } from '@/api/library'
import type { Block, Run } from '@/api/gen/doc'
import type { HomeworkStatus } from '@/components/homework-status'
import { COVERS } from '@/lib/covers'

/** A sample book with everything the list doesn't care about filled in. */
export function sampleBook(b: Pick<Book, 'sha256' | 'title' | 'author' | 'state'> & Partial<Pick<Book, 'kind' | 'cover'>>): Book {
  // Each sample wears the colour its hash seeds, as a book on an empty
  // shelf would.
  const cover = b.cover ?? COVERS[Number.parseInt(b.sha256.slice(0, 2), 16) % COVERS.length]
  return { id: b.sha256, pageCount: 312, pageRuns: [{ from: 1, offset: 16 }], aspect: 11 / 8.5, kind: 'digital', addedAt: '2026-09-03T12:00:00Z', updatedAt: '2026-09-03T12:00:00.000000000Z', ...b, cover }
}

export const BOOKS: Book[] = [
  sampleBook({
    sha256: 'd8f1a9c2',
    title: 'Linear Algebra Done Right',
    author: 'Sheldon Axler',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: '4f3b81d0',
    title: 'Nonlinear Dynamics and Chaos',
    author: 'Steven Strogatz',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: '7a07f452',
    title: 'Introduction to Electrodynamics',
    author: 'David Griffiths',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: '932e14aa',
    title: 'Principles of Mathematical Analysis',
    author: 'Walter Rudin',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: 'b89d3b72',
    title: 'Introduction to the Theory of Computation',
    author: 'Michael Sipser',
    state: { kind: 'preparing', phase: 'read', done: 140, total: 312 },
  }),
  sampleBook({
    sha256: '7ce04a15',
    // Until the PDF's metadata is read, the title is the tidied filename,
    // exactly the fallback the engine uses.
    title: 'Griffiths Introduction To Electrodynamics',
    author: '',
    state: { kind: 'queued' },
  }),
  sampleBook({
    sha256: 'c51c6ef3',
    title: 'Structure and Interpretation of Computer Programs',
    author: 'Abelson and Sussman',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: '12a4d90b',
    title: 'The Feynman Lectures on Physics',
    author: 'Richard Feynman',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: '2571c3e8',
    title: 'Introduction to Algorithms',
    author: 'Cormen and Leiserson',
    state: { kind: 'ready' },
  }),
  sampleBook({
    sha256: '3a80b5d4',
    title: 'Organic Chemistry',
    author: 'Clayden and Greeves',
    state: { kind: 'failed', reason: "This PDF can't be read. pset couldn't open it." },
  }),
  sampleBook({
    sha256: '61f2704c',
    title: 'A First Course in Probability',
    author: 'Sheldon Ross',
    state: { kind: 'ready' },
  }),
]

export type Due = {
  id: string
  title: string
  book: string
  /** The row opens the set inside its book, so it needs the book. */
  bookSha: string
  questions: number
  /** Always words, already relative to today: "tomorrow", "Friday",
   *  "next Friday", "in two weeks". Never a raw date. */
  due: string
  /** Only when it is worth flagging; most homework has none. */
  status?: HomeworkStatus
}

export const DUE: Due[] = [
  {
    id: '1',
    title: 'Problem set 4',
    book: 'Linear Algebra Done Right',
    bookSha: 'd8f1a9c2',
    questions: 4,
    due: 'today',
    status: 'soon',
  },
  {
    id: '2',
    title: 'Chapter 3 exercises',
    book: 'Nonlinear Dynamics and Chaos',
    bookSha: '4f3b81d0',
    questions: 5,
    due: 'tomorrow',
    status: 'soon',
  },
  {
    id: '3',
    title: 'Lab report 2',
    book: 'Introduction to Electrodynamics',
    bookSha: '7a07f452',
    questions: 3,
    due: 'Friday',
  },
  {
    id: '4',
    title: 'Problem set 5',
    book: 'Principles of Mathematical Analysis',
    bookSha: '932e14aa',
    questions: 6,
    due: 'Friday',
  },
  {
    id: '5',
    title: 'Recurrence practice',
    book: 'Introduction to Algorithms',
    bookSha: '2571c3e8',
    questions: 10,
    due: 'Saturday',
  },
  {
    id: '6',
    title: 'Streams and laziness',
    book: 'Structure and Interpretation of Computer Programs',
    bookSha: 'c51c6ef3',
    questions: 4,
    due: 'Sunday',
  },
  {
    id: '7',
    title: 'Chapter 12 review',
    book: 'The Feynman Lectures on Physics',
    bookSha: '12a4d90b',
    questions: 7,
    due: 'next Monday',
  },
  {
    id: '8',
    title: 'Combinatorics warm-up',
    book: 'A First Course in Probability',
    bookSha: '61f2704c',
    questions: 9,
    due: 'next Tuesday',
  },
  {
    id: '9',
    title: 'Problem set 6',
    book: 'Linear Algebra Done Right',
    bookSha: 'd8f1a9c2',
    questions: 8,
    due: 'in two weeks',
  },
]

/** How many of the due list Home shows before its door. */


// Runs the way the server splits them, without the string writing.
const t = (text: string): Run => ({ t: text })
const bold = (text: string): Run => ({ t: text, b: true })
const italic = (text: string): Run => ({ t: text, i: true })
const m = (tex: string): Run => ({ m: tex })
const cite = (pdf: number, to?: number): Run => ({ cite: pdf, citeTo: to })

/** An answer as the engine sends it: every block type, and the runs
 *  inside them (math, marks, citations, math that failed and shows as its
 *  source). Pages are PDF pages; the components page renders with offset
 *  16. */
export const BLOCKS: Block[] = [
  {
    type: 'para',
    text: [t('The '), bold('key idea'), t(" is Kirchhoff's voltage law "), cite(58), t(': around any closed loop, the voltage rises equal the drops. Here that gives')],
  },
  { type: 'math', tex: '\\sum_k v_k = 0 \\quad\\Longrightarrow\\quad -\\frac{600}{13} + \\frac{150}{13}i + 10i - 5i_x + 40i = 0' },
  { type: 'para', text: [t('Two things to keep straight: the dependent source '), m('5i_x'), t(' is a '), italic('rise'), t(' in the direction of travel, and '), m('v_1'), t(' comes from the node equation at A, not the loop.')] },
  { type: 'step', title: [t('Solve for the loop current')] },
  {
    type: 'derivation',
    steps: [
      { tex: '-\\frac{600}{13} + \\frac{150}{13}i + 10i - 5i_x + 40i = 0', why: [t('KVL clockwise; the '), m('5i_x'), t(' source enters as a negative drop.')] },
      { tex: '\\frac{800}{13}i = \\frac{600}{13} + 5i_x', why: [t('Collect the resistances: '), m('\\tfrac{150}{13} + 10 + 40 = \\tfrac{800}{13}')] },
      { tex: 'i_x = 4 - \\frac{v_1}{15} = \\frac{12 + 10i}{13}', why: [t('From the node equation at A '), cite(60), t('.')] },
      { tex: '800i = 660 + 50i \\;\\Rightarrow\\; i = \\frac{660}{750} = 0.88\\ \\text{A}' },
      { tex: '\\frac{1}{', why: [t('TeX that would not parse, even after repair, shows as its source.')], raw: true },
    ],
  },
  { type: 'note', text: [t('A quick check: '), m('0.88 \\times 800/13 \\approx 54.15'), t(', and the right side is '), m('600/13 + 8 \\approx 54.15'), t('.')] },
  {
    type: 'statement',
    kind: 'Theorem',
    number: '3.2',
    name: 'Kirchhoff’s voltage law',
    page: 58,
    text: [t('The algebraic sum of the voltages around any closed path in a circuit is zero: '), m('\\sum_{k=1}^{n} v_k = 0'), t('.')],
  },
  {
    type: 'table',
    columns: [[t('Element')], [t('Voltage')], [t('Direction')]],
    rows: [
      [[m('R_1')], [m('\\tfrac{150}{13}i')], [t('drop')]],
      [[m('5i_x'), t(' source')], [m('5i_x')], [t('rise')]],
      [[m('R_2'), t(' (40 Ω)')], [m('40i')], [t('drop')]],
    ],
  },
  {
    type: 'plot',
    title: 'Capacitor voltage after the switch closes',
    x: { label: 't (ms)' },
    y: { label: 'v (V)' },
    series: [
      { label: 'v_C(t)', points: Array.from({ length: 60 }, (_, i) => [i / 5, 12 * (1 - Math.exp(-i / 15))] as [number, number]) },
      { label: 'v_R(t)', points: Array.from({ length: 60 }, (_, i) => [i / 5, 12 * Math.exp(-i / 15)] as [number, number]) },
    ],
    marks: [{ x: 3, y: 12 * (1 - Math.exp(-1)), label: 'one time constant' }],
  },
  { type: 'callout', tone: 'caveat', title: [t('A common slip')], text: [t('Reading '), m('5i_x'), t(' as a drop when the loop enters it at the minus end.')] },
  { type: 'para', text: [t('To check it numerically, '), { t: 'numpy', code: true }, t(' solves the same system:')] },
  { type: 'code', language: 'python', code: 'import numpy as np\nA = np.array([[800/13, -5], [-10/13, 1]])\nb = np.array([600/13, 12/13])\nprint(np.linalg.solve(A, b))  # [0.88, 1.6]' },
  { type: 'raw', of: 'plot', text: '{"title":"Broken","series":[{"label":"x","expr":"x^^2"' },
  { type: 'para', text: [t('So '), m('i = 0.88'), t(' A and '), m('i_x = 1.6'), t(' A, as the answers at the back agree '), cite(402, 403), t('. The dollars are plain text: $25.42 a month.')] },
]

/** A guide as the walkthrough draws it: the hint apart, then parts with
 *  steps and answers. The eigenvalue example of the writing guide. */
export const GUIDE_HINT: Block[] = [
  { type: 'hint', text: [t('An eigenvalue is a number '), m('\\lambda'), t(' that makes '), m('A - \\lambda I'), t(' singular, so start from its determinant.')] },
]

export const GUIDE: Block[] = [
  { type: 'part', label: '(a)', title: [t('The eigenvalues of '), m('A')] },
  { type: 'step', title: [t('Turn eigenvalues into a determinant')] },
  { type: 'para', text: [t('A nonzero '), m('v'), t(' with '), m('Av = \\lambda v'), t(' exists exactly when '), m('A - \\lambda I'), t(' sends some nonzero vector to zero, that is, when it is '), bold('singular'), t(' '), cite(132), t('. So we need')] },
  { type: 'math', tex: '\\det(A - \\lambda I) = 0' },
  { type: 'step', title: [t('Solve the characteristic equation')] },
  {
    type: 'derivation',
    steps: [
      { tex: '\\det\\begin{pmatrix} 2-\\lambda & 1 \\\\ 1 & 2-\\lambda \\end{pmatrix} = (2-\\lambda)^2 - 1', why: [t('The determinant of a 2 by 2 matrix is '), m('ad - bc'), t('.')] },
      { tex: '(2-\\lambda)^2 - 1 = (\\lambda - 1)(\\lambda - 3)', why: [t('A difference of squares.')] },
      { tex: '\\lambda = 1 \\quad\\text{or}\\quad \\lambda = 3', why: [t('A product is zero when a factor is.')] },
    ],
  },
  { type: 'note', text: [t('A quick check: the eigenvalues add to the trace, '), m('2 + 2 = 4'), t(', and multiply to the determinant, '), m('4 - 1 = 3'), t('.')] },
  { type: 'answer', label: '(a)', text: [m('\\lambda_1 = 1'), t(' and '), m('\\lambda_2 = 3'), t('.')] },
  { type: 'part', label: '(b)', title: [t('An eigenvector for each')] },
  { type: 'step', title: [t('Find what each shifted matrix sends to zero')] },
  { type: 'para', text: [t('For each '), m('\\lambda'), t(', an eigenvector is any nonzero solution of '), m('(A - \\lambda I)v = 0'), t('. For '), m('\\lambda = 3'), t(' the rows of '), m('A - 3I'), t(' are both '), m('(-1, 1)'), t(', so '), m('v'), t(' needs equal entries.')] },
  { type: 'callout', tone: 'insight', title: [t("Why they're perpendicular")], text: [m('A'), t(' is symmetric, and a symmetric matrix always has perpendicular eigenvectors for different eigenvalues.')] },
  { type: 'answer', label: '(b)', text: [m('\\lambda = 3'), t(': '), m('v = (1, 1)'), t('. '), m('\\lambda = 1'), t(': '), m('v = (1, -1)'), t('.')] },
]

/** An assignment as read for review, like a course's semester table
 *  checked mid-September: a date already added with nothing new, one
 *  added before that the professor has changed since, and one to come
 *  with every kind of line. */
export const ASSIGNMENT: Assignment = {
  source: 'https://people.example.edu/~prof/202/homework.htm',
  title: 'EECS 202 Homework',
  groups: [
    {
      due: '2026-09-04',
      title: 'Homework due Sep 4',
      imported: true,
      setId: 'set-sep4',
      gone: [],
      rows: [
        {
          kind: 'book',
          text: '1.18 , 1.28',
          labels: ['1.18', '1.28'],
          notes: [],
          present: ['1.18', '1.28'],
          added: true,
          changed: [],
        },
      ],
    },
    {
      due: '2026-09-11',
      title: 'Homework due Sep 11',
      imported: true,
      setId: 'set-sep11',
      gone: [{ questionId: 'q-312', label: '3.12' }],
      rows: [
        {
          kind: 'book',
          text: '2.31 , 2.32 (use PSpice)',
          labels: ['2.31', '2.32'],
          notes: ['use PSpice'],
          present: ['2.31', '2.32'],
          added: true,
          changed: [{ questionId: 'q-232', label: '2.32', was: ['no PSpice'], now: ['use PSpice'] }],
        },
        {
          kind: 'book',
          text: '3.2 , 3.8 , 3.10 , 3.14',
          labels: ['3.2', '3.8', '3.10', '3.14'],
          notes: [],
          present: ['3.2', '3.8', '3.10'],
          changed: [],
        },
      ],
    },
    {
      due: '2026-10-02',
      title: 'Homework due Oct 2',
      gone: [],
      rows: [
        {
          kind: 'book',
          text: '4.27 , 4.32 , 4.25 (no PSpice or MulitSim)',
          labels: ['4.27', '4.32', '4.25'],
          notes: ['no PSpice or MulitSim'],
          present: [],
          changed: [],
        },
        {
          kind: 'own',
          text:
            'A 12 V source drives a 4 Ohm and an 8 Ohm resistor in series. (a) Find the current. (b) Find the power to the 8 Ohm resistor.',
          labels: [],
          notes: [],
          present: [],
          changed: [],
        },
        {
          kind: 'book',
          text: 'the ladder network one from lecture',
          labels: [],
          notes: [],
          unread: true,
          present: [],
          changed: [],
        },
        { kind: 'other', text: 'Reading: pages 147-148, 137-146', labels: [], notes: [], present: [], changed: [] },
      ],
    },
  ],
}

/** The sets the sample assignment updates, by id. */
export const ASSIGNMENT_SETS: Record<string, string> = {
  'set-sep4': 'Homework due Sep 4',
  'set-sep11': 'Homework due Sep 11',
}
