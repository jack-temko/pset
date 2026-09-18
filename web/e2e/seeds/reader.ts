import { acceptTask, books, type MockData, type MockSection } from './library.ts'

/** The calculus book from library.ts, ready, opened in the reader states.
 *  Its sha is what the reader states navigate to. */
export const readerSha = books[0].sha256

export const readerSections: MockSection[] = [
  {
    sortOrder: 1,
    level: 1,
    title: '1 Limits and Rates of Change',
    source: 'outline',
    startPage: 1,
    endPage: 14,
  },
  {
    sortOrder: 2,
    level: 2,
    title: '1.1 The Tangent Problem',
    source: 'outline',
    startPage: 1,
    endPage: 6,
  },
  {
    sortOrder: 3,
    level: 2,
    title: '1.2 The Limit of a Function',
    source: 'outline',
    startPage: 7,
    endPage: 14,
  },
]

const prose = (n: number) =>
  [
    'The tangent problem is the oldest question in the calculus. Given a curve, what is the slope of the line that touches it at a single point and no other?',
    `Page ${n} keeps the answer within reach: zoom in far enough and any curve becomes a line, and the slope of that line is the derivative.`,
  ].join('\n\n')

/** Text for every page of the seed book; a page absent from the map makes
 *  GET /api/books/{sha}/pages/{n} answer 404. */
export const readerPages: Record<number, string> = Object.fromEntries(
  Array.from({ length: 12 }, (_, i) => [i + 1, prose(i + 1)]),
)

export const readerSeeds = {
  'reader:book': {
    books: [books[0]],
    tasks: [],
    sections: readerSections,
    pages: readerPages,
    acceptTask,
    duplicateBook: books[1],
  } satisfies MockData,
}
