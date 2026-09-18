import type { MockBook, MockData, MockTask } from './library.ts'
import { acceptTask, books, preparePlan, preparingBook, runningPrepare } from './library.ts'

/** Tasks seeds: the snapshot array follows the server's TaskViews order —
 *  active FIFO, then the ones needing a decision, then finished newest-first.
 *  Times are relative to page load so duration lines read naturally. */

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function task(p: Pick<MockTask, 'id' | 'kind' | 'status' | 'title' | 'phases'> & Partial<MockTask>): MockTask {
  return {
    bookId: null,
    homeworkId: null,
    failKind: null,
    retryable: false,
    error: null,
    createdAt: ago(20),
    startedAt: null,
    finishedAt: null,
    ...p,
  }
}

/** The board covers every state a task can rest in, and both failure shapes:
 *  one an environment problem you can retry, one a file that will fail
 *  identically every time and so is offered no Try again at all. */
const boardTasks: MockTask[] = [
  runningPrepare,
  task({
    id: 'task-queued-0002',
    kind: 'prepare',
    status: 'queued',
    bookId: books[0].id,
    title: books[0].title,
    phases: preparePlan('task-queued-0002'),
  }),
  task({
    id: 'task-failed-0003',
    kind: 'prepare',
    status: 'failed',
    bookId: books[2].id,
    title: books[2].title,
    failKind: 'environment',
    retryable: true,
    error: '2 pages couldn’t be read (p.212, p.640). Try again, or check that tesseract is working',
    phases: preparePlan('task-failed-0003', {
      examine: { status: 'done', startedAt: ago(47), finishedAt: ago(47) },
      read: {
        status: 'failed',
        done: 1170,
        total: 1172,
        error: '2 pages couldn’t be read (p.212, p.640)',
        startedAt: ago(47),
        finishedAt: ago(41),
      },
    }),
    createdAt: ago(47),
    startedAt: ago(47),
    finishedAt: ago(41),
  }),
  task({
    id: 'task-permanent-0007',
    kind: 'prepare',
    status: 'failed',
    title: 'seminar-notes.pdf',
    failKind: 'permanent',
    retryable: false,
    error: 'This PDF can’t be read — it’s encrypted and pset can’t open it.',
    phases: preparePlan('task-permanent-0007', {
      examine: {
        status: 'failed',
        error: 'it’s encrypted and pset can’t open it',
        startedAt: ago(52),
        finishedAt: ago(52),
      },
    }),
    createdAt: ago(52),
    startedAt: ago(52),
    finishedAt: ago(52),
  }),
  task({
    id: 'task-paused-0004',
    kind: 'prepare',
    status: 'paused',
    bookId: books[1].id,
    title: books[1].title,
    retryable: true,
    phases: preparePlan('task-paused-0004', {
      examine: { status: 'done', startedAt: ago(65), finishedAt: ago(65) },
      read: { status: 'waiting', done: 120, total: 340 },
    }),
    createdAt: ago(65),
    startedAt: ago(65),
    finishedAt: ago(64),
  }),
  task({
    id: 'task-done-0006',
    kind: 'homework',
    status: 'done',
    homeworkId: 'hw-week3-quiz',
    title: 'Week 3 quiz',
    phases: [
      {
        id: 'task-done-0006-p1',
        taskId: 'task-done-0006',
        key: 'extract',
        name: 'Read the assignment',
        note: '',
        status: 'done',
        done: 1,
        total: 1,
        error: null,
        etaSeconds: null,
        createdAt: ago(32),
        startedAt: ago(32),
        finishedAt: ago(31),
      },
      {
        id: 'task-done-0006-p2',
        taskId: 'task-done-0006',
        key: 'walkthroughs',
        name: 'Write the walkthroughs',
        note: '',
        status: 'done',
        done: 8,
        total: 8,
        error: null,
        etaSeconds: null,
        createdAt: ago(32),
        startedAt: ago(31),
        finishedAt: ago(30),
      },
    ],
    createdAt: ago(32),
    startedAt: ago(32),
    finishedAt: ago(30),
  }),
  task({
    id: 'task-done-0003',
    kind: 'prepare',
    status: 'done',
    bookId: books[2].id,
    title: books[2].title,
    phases: preparePlan('task-done-0003', {
      examine: { status: 'done', startedAt: ago(120), finishedAt: ago(120) },
      read: { status: 'done', done: 1172, total: 1172, startedAt: ago(120), finishedAt: ago(99) },
      index: { status: 'done', done: 1172, total: 1172, startedAt: ago(99), finishedAt: ago(98) },
      search: { status: 'done', done: 1172, total: 1172, startedAt: ago(98), finishedAt: ago(96) },
    }),
    createdAt: ago(120),
    startedAt: ago(120),
    finishedAt: ago(96),
  }),
]

/** A long Done section, to check that history stays legible at its cap. */
const historyTasks: MockTask[] = [
  ...boardTasks.filter((t) => t.status === 'done'),
  ...Array.from({ length: 12 }, (_, i): MockTask => {
    const id = `task-old-${String(12 - i).padStart(4, '0')}`
    const b = books[i % books.length]
    const started = ago(60 * (i + 2) + 30)
    return task({
      id,
      kind: 'prepare',
      status: 'done',
      bookId: b.id,
      title: b.title,
      phases: preparePlan(id, {
        examine: { status: 'done', startedAt: started, finishedAt: started },
        read: { status: 'done', done: b.pageCount, total: b.pageCount, startedAt: started },
        index: { status: 'done', done: b.pageCount, total: b.pageCount },
        search: { status: 'done', done: b.pageCount, total: b.pageCount, finishedAt: ago(60 * (i + 2)) },
      }),
      createdAt: started,
      startedAt: started,
      finishedAt: ago(60 * (i + 2)),
    })
  }),
]

/** The library as it looks while one book is being prepared and one failed:
 *  both visible, both dimmed, neither pretending to be ready. */
const mixedBooks: MockBook[] = [
  books[0],
  books[1],
  {
    ...books[2],
    ready: false,
    readiness: {
      pagesStored: 1172,
      pagesFailed: 2,
      pagesWithText: 1170,
      sections: 0,
      vectors: 0,
      missing: 'read',
    },
    failedPages: [
      { page: 212, error: 'tesseract page 212: exited with status 1' },
      { page: 640, error: 'rasterize page 640: pdftoppm produced no image' },
    ],
    task: boardTasks[2],
  },
  preparingBook,
]

export const tasksSeeds: Record<string, MockData> = {
  'tasks:empty': { books, tasks: [], acceptTask, duplicateBook: books[1] },
  'tasks:board': { books: mixedBooks, tasks: boardTasks, acceptTask, duplicateBook: books[1] },
  'tasks:history': { books, tasks: historyTasks, acceptTask, duplicateBook: books[1] },
  'library:mixed': { books: mixedBooks, tasks: boardTasks, acceptTask, duplicateBook: books[1] },
}
