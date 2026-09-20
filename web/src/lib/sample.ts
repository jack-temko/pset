/**
 * Sample data, used until each page's backend lands. One source, so the
 * dashboard and the components page can never show different books.
 *
 * Delete this file when the API is wired — nothing here should outlive it.
 */

import type { HomeworkStatus } from '@/components/homework-status'

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
    questions: 4,
    due: 'today',
    status: 'soon',
  },
  {
    id: '2',
    title: 'Chapter 3 exercises',
    book: 'Nonlinear Dynamics and Chaos',
    questions: 5,
    due: 'tomorrow',
    status: 'soon',
  },
  {
    id: '3',
    title: 'Lab report 2',
    book: 'Introduction to Electrodynamics',
    questions: 3,
    due: 'Friday',
  },
  {
    id: '4',
    title: 'Problem set 5',
    book: 'Principles of Mathematical Analysis',
    questions: 6,
    due: 'Friday',
  },
  {
    id: '5',
    title: 'Recurrence practice',
    book: 'Introduction to Algorithms',
    questions: 10,
    due: 'Saturday',
  },
  {
    id: '6',
    title: 'Streams and laziness',
    book: 'Structure and Interpretation of Computer Programs',
    questions: 4,
    due: 'Sunday',
  },
  {
    id: '7',
    title: 'Chapter 12 review',
    book: 'The Feynman Lectures on Physics',
    questions: 7,
    due: 'next Monday',
  },
  {
    id: '8',
    title: 'Combinatorics warm-up',
    book: 'A First Course in Probability',
    questions: 9,
    due: 'next Tuesday',
  },
  {
    id: '9',
    title: 'Problem set 6',
    book: 'Linear Algebra Done Right',
    questions: 8,
    due: 'in two weeks',
  },
]

/** How many of the due list Home shows before its door. */
export const DUE_SHOWN = 3

export function bookBySha(sha: string): Book | undefined {
  return BOOKS.find((b) => b.sha256 === sha)
}

/** A book's contents: chapters with sections, each pinned to a page. A book
 *  whose TOC couldn't be read has none — and then no rail. */
export type TocSection = { id: string; title: string; page: number }
export type TocChapter = { id: string; title: string; page: number; sections: TocSection[] }

export const PAGE_COUNT = 312

export const TOC: TocChapter[] = [
  {
    id: 'c1',
    title: '1 · Vector Spaces',
    page: 1,
    sections: [
      { id: 'c1s1', title: 'Rⁿ and Cⁿ', page: 2 },
      { id: 'c1s2', title: 'Definition of Vector Space', page: 12 },
      { id: 'c1s3', title: 'Subspaces', page: 18 },
    ],
  },
  {
    id: 'c2',
    title: '2 · Finite-Dimensional Vector Spaces',
    page: 27,
    sections: [
      { id: 'c2s1', title: 'Span and Linear Independence', page: 28 },
      { id: 'c2s2', title: 'Bases', page: 39 },
      { id: 'c2s3', title: 'Dimension', page: 44 },
    ],
  },
  {
    id: 'c3',
    title: '3 · Linear Maps',
    page: 51,
    sections: [
      { id: 'c3s1', title: 'The Vector Space of Linear Maps', page: 52 },
      { id: 'c3s2', title: 'Null Spaces and Ranges', page: 59 },
      { id: 'c3s3', title: 'Matrices', page: 70 },
      { id: 'c3s4', title: 'Invertibility and Isomorphism', page: 80 },
    ],
  },
  {
    id: 'c5',
    title: '5 · Eigenvalues and Eigenvectors',
    page: 131,
    sections: [
      { id: 'c5s1', title: 'Invariant Subspaces', page: 132 },
      { id: 'c5s2', title: 'The Minimal Polynomial', page: 142 },
      { id: 'c5s3', title: 'Upper-Triangular Matrices', page: 154 },
    ],
  },
]

/** Homework for the open book, as the panel's list shows it. */
export type BookHomework = {
  id: string
  title: string
  due: string
  status?: HomeworkStatus
  done: number
  total: number
}

export const BOOK_HOMEWORK: BookHomework[] = [
  { id: '1', title: 'Problem set 4', due: 'today', status: 'soon', done: 0, total: 4 },
  { id: '9', title: 'Problem set 6', due: 'in two weeks', done: 0, total: 8 },
  { id: '11', title: 'Chapter 2 proofs', due: 'last Friday', status: 'overdue', done: 2, total: 5 },
  { id: '10', title: 'Problem set 3', due: 'Sep 12', status: 'turned-in', done: 6, total: 6 },
]

export type Week = {
  /** Minutes this week, by activity. */
  homework: number
  reading: number
  asking: number
  /** Questions worked, and the problem sets they came from. */
  questions: number
  problemSets: number
}

export const WEEK: Week = {
  homework: 263,
  reading: 70,
  asking: 40,
  questions: 14,
  problemSets: 3,
}

/** The week's time split by book, for the bar under the stat tiles. The
 *  colour comes from the book's cover hue — the bar is the shelf, flattened. */
export type WeekBook = { sha256: string; title: string; minutes: number }

export const WEEK_BY_BOOK: WeekBook[] = [
  { sha256: 'd8f1a9c2', title: 'Linear Algebra Done Right', minutes: 195 },
  { sha256: '4f3b81d0', title: 'Nonlinear Dynamics and Chaos', minutes: 96 },
  { sha256: '7a07f452', title: 'Introduction to Electrodynamics', minutes: 54 },
  { sha256: '61f2704c', title: 'A First Course in Probability', minutes: 28 },
]
