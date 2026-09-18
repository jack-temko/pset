/**
 * Sample data, used until each page's backend lands. One source, so the
 * dashboard and the components page can never show different books.
 *
 * Delete this file when the API is wired — nothing here should outlive it.
 */

export type BookState =
  | { kind: 'ready' }
  | { kind: 'preparing'; done: number; total: number }
  | { kind: 'failed'; reason: string }

export type Book = {
  sha256: string
  title: string
  author: string
  state: BookState
}

export const BOOKS: Book[] = [
  {
    sha256: 'd8f1a9c2',
    title: 'Linear Algebra Done Right',
    author: 'Sheldon Axler',
    state: { kind: 'ready' },
  },
  {
    sha256: '4f3b81d0',
    title: 'Nonlinear Dynamics and Chaos',
    author: 'Steven Strogatz',
    state: { kind: 'ready' },
  },
  {
    sha256: '7a07f452',
    title: 'Introduction to Electrodynamics',
    author: 'David Griffiths',
    state: { kind: 'ready' },
  },
  {
    sha256: '932e14aa',
    title: 'Principles of Mathematical Analysis',
    author: 'Walter Rudin',
    state: { kind: 'ready' },
  },
  {
    sha256: 'b89d3b72',
    title: 'Introduction to the Theory of Computation',
    author: 'Michael Sipser',
    state: { kind: 'preparing', done: 140, total: 312 },
  },
  {
    sha256: 'c51c6ef3',
    title: 'Structure and Interpretation of Computer Programs',
    author: 'Abelson and Sussman',
    state: { kind: 'ready' },
  },
  {
    sha256: '12a4d90b',
    title: 'The Feynman Lectures on Physics',
    author: 'Richard Feynman',
    state: { kind: 'ready' },
  },
  {
    sha256: '2571c3e8',
    title: 'Introduction to Algorithms',
    author: 'Cormen and Leiserson',
    state: { kind: 'ready' },
  },
  {
    sha256: '3a80b5d4',
    title: 'Organic Chemistry',
    author: 'Clayden and Greeves',
    state: { kind: 'failed', reason: 'No extractable text' },
  },
  {
    sha256: '61f2704c',
    title: 'A First Course in Probability',
    author: 'Sheldon Ross',
    state: { kind: 'ready' },
  },
]

export type Due = {
  id: string
  title: string
  book: string
  questions: number
  /** Plain words, already relative: "today", "tomorrow", "Fri". */
  due: string
  /** Due today or overdue — the row's date takes warning ink. */
  urgent?: boolean
}

export const DUE: Due[] = [
  {
    id: '1',
    title: 'Problem set 4',
    book: 'Linear Algebra Done Right',
    questions: 8,
    due: 'today',
    urgent: true,
  },
  {
    id: '2',
    title: 'Chapter 3 exercises',
    book: 'Nonlinear Dynamics and Chaos',
    questions: 5,
    due: 'tomorrow',
  },
  {
    id: '3',
    title: 'Lab report 2',
    book: 'Introduction to Electrodynamics',
    questions: 3,
    due: 'Fri',
  },
]

export const DUE_TOTAL = 9
