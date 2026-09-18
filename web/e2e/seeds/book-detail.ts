import { acceptTask, books, type MockData, type MockHomework } from './library.ts'
import { askConversation } from './ask.ts'
import { readerSections } from './reader.ts'

/** The calculus book the book-home state opens. Same sha the reader and ask
 *  seeds use, so its sections and conversations line up. */
export const bookHomeSha = books[0].sha256

const calcHomework: MockHomework = {
  id: 'hw-book-home',
  bookId: books[0].id,
  bookSha256: bookHomeSha,
  bookTitle: books[0].title,
  title: 'Chapter 4 problem set',
  dueDate: null,
  status: 'ready',
  turnedIn: false,
  questionCount: 3,
  questionScale: 100,
  figureScale: 100,
  createdAt: '2026-09-15T09:00:00Z',
  updatedAt: '2026-09-15T11:00:00Z',
}

export const bookSeeds = {
  /** The ready book's home: chapters, its ask history, its homework. */
  'book:home': {
    books: [books[0], books[1]],
    tasks: [],
    sections: readerSections,
    conversations: [askConversation],
    homeworks: [calcHomework],
    acceptTask,
    duplicateBook: books[1],
  } satisfies MockData,
}
