import { acceptTask, books, preparingBook, runningPrepare, type MockData } from './library.ts'
import { tasksSeeds } from './tasks.ts'
import { homeworkSeeds } from './homework.ts'
import { eecsSeeds } from './homework-eecs.ts'
import { readerSeeds } from './reader.ts'
import { askSeeds } from './ask.ts'
import { bookSeeds } from './book-detail.ts'

/** Seed registry: one id, one deterministic data scenario. Every seed must
 *  carry the import fixtures so dialog states work over any of them. */
const registry: Record<string, MockData> = {
  'library:empty': {
    books: [],
    tasks: [],
    acceptTask,
    duplicateBook: books[1],
  },
  'library:shelf': {
    // Three ready books and one still being prepared, so the shelf shows
    // both states side by side rather than only the happy one.
    books: [books[0], books[1], books[2], preparingBook],
    tasks: [runningPrepare],
    acceptTask,
    duplicateBook: books[1],
  },
  ...tasksSeeds,
  ...homeworkSeeds,
  ...eecsSeeds,
  ...readerSeeds,
  ...askSeeds,
  ...bookSeeds,
}

export function getSeed(id: string): MockData {
  const seed = registry[id]
  if (!seed) throw new Error(`unknown seed: ${id}`)
  return seed
}
