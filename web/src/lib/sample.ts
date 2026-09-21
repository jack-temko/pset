/**
 * Sample data, used until each page's backend lands. One source, so the
 * dashboard and the components page can never show different books.
 *
 * Delete this file when the API is wired. Nothing here should outlive it.
 */

import type { HomeworkStatus } from '@/components/homework-status'

/** The engine's four phases, in the words it already uses. */
export const IMPORT_PHASES = {
  examine: 'Examine the pages',
  read: 'Read the pages',
  index: 'Index the sections',
  search: 'Build search',
} as const

export type ImportPhase = keyof typeof IMPORT_PHASES

export type BookState =
  | { kind: 'ready' }
  /** Staged and waiting its turn: the runner prepares one book at a time. */
  | { kind: 'queued' }
  /** `done`/`total` only where the phase can count; reading pages can, examining
   *  and building search cannot. */
  | { kind: 'preparing'; phase: ImportPhase; done?: number; total?: number }
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
    state: { kind: 'preparing', phase: 'read', done: 140, total: 312 },
  },
  {
    sha256: '7ce04a15',
    // Until the PDF's metadata is read, the title is the tidied filename,
    // exactly the fallback the engine uses.
    title: 'Griffiths Introduction To Electrodynamics',
    author: '',
    state: { kind: 'queued' },
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
    state: { kind: 'failed', reason: "This PDF can't be read. pset couldn't open it." },
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
export const DUE_SHOWN = 3

export function bookBySha(sha: string): Book | undefined {
  return BOOKS.find((b) => b.sha256 === sha)
}

/** A book's contents: chapters with sections, each pinned to a page. A book
 *  whose TOC couldn't be read has none, and then no rail. */
export type TocSection = { id: string; title: string; page: number }
export type TocChapter = { id: string; title: string; page: number; sections: TocSection[] }

/** PDF pages in the sample book. */
export const PAGE_COUNT = 312

/** PDF page = printed page + this. The sample book has sixteen pages of
 *  front matter (i–xvi) before printed page 1. */
export const PAGE_OFFSET = 16

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
 *  colour comes from the book's cover hue: the bar is the shelf, flattened. */
export type WeekBook = { sha256: string; title: string; minutes: number }

export const WEEK_BY_BOOK: WeekBook[] = [
  { sha256: 'd8f1a9c2', title: 'Linear Algebra Done Right', minutes: 195 },
  { sha256: '4f3b81d0', title: 'Nonlinear Dynamics and Chaos', minutes: 96 },
  { sha256: '7a07f452', title: 'Introduction to Electrodynamics', minutes: 54 },
  { sha256: '61f2704c', title: 'A First Course in Probability', minutes: 28 },
]

// ---------------------------------------------------------------- settings

/** The engine's `Settings`, plus the chat model it doesn't store yet. */
export type Connections = {
  chat: { endpoint: string; apiKey: string; model: string }
  embeddings: { endpoint: string; model: string }
}

export const CONNECTIONS: Connections = {
  chat: { endpoint: 'https://api.z.ai/api/paas/v4', apiKey: 'zk-4f9a2c71e0b3d8k3Xq', model: 'glm-4.6' },
  embeddings: { endpoint: 'http://localhost:11434/v1', model: 'nomic-embed-text' },
}

/** The doctor's local checks: the two endpoint checks live beside their
 *  fields in Settings instead. `fixable` is the doctor's --fix. */
export type HealthCheck = {
  name: string
  ok: boolean
  detail: string
  fixable?: boolean
}

export const HEALTH: HealthCheck[] = [
  { name: 'Data directory', ok: true, detail: '/home/jack/.local/share/pset is writable' },
  { name: 'Database', ok: false, detail: 'schema v11, expected v12', fixable: true },
  { name: 'Poppler', ok: true, detail: 'pdftoppm 24.02.0' },
  { name: 'Tesseract', ok: false, detail: 'not installed. Install it with sudo apt install tesseract-ocr' },
]

/** What Reset would remove, from the engine's dry run. */
export const RESET_COUNTS = { books: 10, pages: 4212 }

export const ABOUT = { version: '0.9.0', dataDir: '/home/jack/.local/share/pset' }
