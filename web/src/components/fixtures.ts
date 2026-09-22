/**
 * Fixtures for the components page: typed against the generated API
 * types, so a contract change breaks the build here rather than a screen.
 * No screen reads this file; they all read the API.
 */

import type { Book } from '@/api/library'
import type { HomeworkStatus } from '@/components/homework-status'

/** A sample book with everything the list doesn't care about filled in. */
export function sampleBook(b: Pick<Book, 'sha256' | 'title' | 'author' | 'state'>): Book {
  return { id: b.sha256, pageCount: 312, pageOffset: 16, aspect: 11 / 8.5, addedAt: '2026-09-03T12:00:00Z', updatedAt: '2026-09-03T12:00:00.000000000Z', ...b }
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
