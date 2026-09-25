/**
 * Fixtures for the components page: typed against the generated API
 * types, so a contract change breaks the build here rather than a screen.
 * No screen reads this file; they all read the API.
 */

import type { Book } from '@/api/library'
import type { Segment } from '@/api/gen/cards'
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


/** An answer as a model really writes one: every card kind, and the
 *  prose around them (lists, display math, citations, inline code). Pages
 *  are PDF pages; the components page renders with offset 16. */
export const SEGMENTS: Segment[] = [
  {
    type: 'prose',
    text: 'The **key idea** is Kirchhoff\'s voltage law [p. 58]: around any closed loop, the voltage rises equal the drops. Here that gives\n\n$$\\sum_k v_k = 0 \\quad\\Longrightarrow\\quad -\\frac{600}{13} + \\frac{150}{13}i + 10i - 5i_x + 40i = 0$$\n\nTwo things to keep straight:\n\n- the dependent source $5i_x$ is a *rise* in the direction of travel;\n- $v_1$ comes from the node equation at A, not the loop.\n\n### Solving',
  },
  {
    type: 'card',
    kind: 'steps',
    card: {
      steps: [
        { math: '-\\frac{600}{13} + \\frac{150}{13}i + 10i - 5i_x + 40i = 0', why: 'KVL clockwise; the $5i_x$ source enters as a negative drop.' },
        { math: '\\frac{800}{13}i = \\frac{600}{13} + 5i_x', why: 'Collect the resistances: $\\tfrac{150}{13} + 10 + 40 = \\tfrac{800}{13}$.' },
        { math: 'i_x = 4 - \\frac{v_1}{15} = \\frac{12 + 10i}{13}', why: 'From the node equation at A [p. 60].' },
        { math: '800i = 660 + 50i \\;\\Rightarrow\\; i = \\frac{660}{750} = 0.88\\ \\text{A}' },
      ],
    },
  },
  {
    type: 'card',
    kind: 'statement',
    card: {
      kind: 'Theorem',
      number: '3.2',
      name: 'Kirchhoff’s voltage law',
      page: 58,
      text: 'The algebraic sum of the voltages around any closed path in a circuit is zero: $\\sum_{k=1}^{n} v_k = 0$.',
    },
  },
  {
    type: 'card',
    kind: 'table',
    card: {
      columns: ['Element', 'Voltage', 'Direction'],
      rows: [
        ['$R_1$', '$\\tfrac{150}{13}i$', 'drop'],
        ['$5i_x$ source', '$5i_x$', 'rise'],
        ['$R_2$ (40 Ω)', '$40i$', 'drop'],
      ],
    },
  },
  {
    type: 'card',
    kind: 'plot',
    card: {
      title: 'Capacitor voltage after the switch closes',
      x: { label: 't (ms)' },
      y: { label: 'v (V)' },
      series: [
        { label: 'v_C(t)', points: Array.from({ length: 60 }, (_, i) => [i / 5, 12 * (1 - Math.exp(-i / 15))] as [number, number]) },
        { label: 'v_R(t)', points: Array.from({ length: 60 }, (_, i) => [i / 5, 12 * Math.exp(-i / 15)] as [number, number]) },
      ],
    },
  },
  { type: 'prose', text: 'To check it numerically, `numpy` solves the same system:' },
  {
    type: 'card',
    kind: 'code',
    card: { language: 'python', code: 'import numpy as np\nA = np.array([[800/13, -5], [-10/13, 1]])\nb = np.array([600/13, 12/13])\nprint(np.linalg.solve(A, b))  # [0.88, 1.6]' },
  },
  { type: 'raw', kind: 'plot', text: '{"title":"Broken","series":[{"label":"x","expr":"x^^2"' },
  { type: 'prose', text: 'So $i = 0.88$ A and $i_x = 1.6$ A, as the answers at the back agree [pp. 402–403].' },
]
