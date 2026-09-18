/** Mock data shapes: structural mirrors of BookJSON / PhaseJSON / TaskJSON
 *  from internal/api/README.md. Kept local so the harness has no imports
 *  from web/src. */

export interface MockReadiness {
  pagesStored: number
  pagesFailed: number
  pagesWithText: number
  sections: number
  vectors: number
  missing: '' | 'examine' | 'read' | 'index' | 'search'
}

export interface MockBook {
  id: string
  sha256: string
  title: string
  author: string
  subject: string
  kind: 'digital' | 'scanned'
  pageCount: number
  /** Derived on the server from stored rows; a book is ready or it isn't. */
  ready: boolean
  readiness: MockReadiness
  failedPages: { page: number; error: string }[]
  /** The task preparing this book, or still waiting on a decision about it. */
  task: MockTask | null
  pdfVersion: string
  pageWidth: number
  pageHeight: number
  fileSize: number
  originPath: string
  libraryPath: string
  importedAt: string
}

export interface MockPhase {
  id: string
  taskId: string
  key: string
  name: string
  note: string
  status: 'waiting' | 'running' | 'done' | 'failed'
  done: number
  total: number
  error: string | null
  etaSeconds: number | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface MockTask {
  id: string
  kind: 'prepare' | 'homework' | 'question'
  status: 'queued' | 'running' | 'paused' | 'failed' | 'done'
  bookId: string | null
  homeworkId: string | null
  /** Set on a question task: the one question it works. */
  questionId?: string
  title: string
  phases: MockPhase[]
  failKind: 'transient' | 'environment' | 'permanent' | null
  retryable: boolean
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface MockConfig {
  apiBaseURL: string
  hasAPIKey: boolean
  embedBaseURL: string
  embedModel: string
  hwQuestionScale: number
  hwFigureScale: number
}

/** Structural mirror of HomeworkJSON (internal/api/README.md). */
export interface MockHomework {
  id: string
  bookId: string
  bookSha256: string
  bookTitle: string
  title: string
  dueDate: string | null
  status: 'generating' | 'ready'
  turnedIn: boolean
  questionCount: number
  questionScale: number
  figureScale: number
  createdAt: string
  updatedAt: string
}

/** Structural mirror of the question rows inside GET /api/homework/{id}. */
export interface MockQuestion {
  id: string
  homeworkId: string
  position: number
  page: number | null
  status: 'pending' | 'locating' | 'writing' | 'ready' | 'failed' | 'stale'
  error: string | null
  standalone: boolean
  questionRect: { x: number; y: number; w: number; h: number } | null
  transcription: string
  diagrams: { label: string; rect: { x: number; y: number; w: number; h: number } }[]
  /** Corrections the chat pinned; they steer the next rewrite. */
  understandingNotes?: { note: string; at: string }[]
  guide: {
    /** How the model read the problem — the box checked first. */
    reading?: { given: string[]; find: string; figure?: string } | null
    setup: string
    hints: string[]
    steps: string[]
    equations: { title: string; tex: string; note?: string }[]
    answer: string
  } | null
  createdAt: string
  updatedAt: string
}

/** Structural mirror of sectionJSON (GET /api/books/{sha}/sections). */
export interface MockSection {
  sortOrder: number
  level: number
  title: string
  source: 'outline' | 'inferred'
  startPage: number
  endPage: number
}

/** Structural mirror of the Segment / Message / Conversation JSON the ask
 *  surface reads and writes. */
export type MockSegment =
  | { type: 'prose'; text: string }
  | {
      type: 'envelope'
      kind: 'equation'
      payload: { title: string; equations: string[]; note?: string }
    }
  | {
      type: 'envelope'
      kind: 'steps'
      payload: { title: string; steps: string[]; note?: string }
    }
  | {
      type: 'envelope'
      kind: 'theorem' | 'definition'
      payload: { title: string; statement: string; note?: string }
    }
  | { type: 'envelope'; kind: 'note'; payload: { title: string; body: string[] } }
  | { type: 'code'; text: string }
  | {
      type: 'tool'
      kind: 'calc' | 'solve_linear' | 'search_book' | 'read_page' | 'add_understanding_note'
      payload: {
        id: string
        tool: 'calc' | 'solve_linear' | 'search_book' | 'read_page' | 'add_understanding_note'
        args?: unknown
        result?: string
        ok: boolean
        pages?: number[]
      }
    }

export interface MockMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  segments: MockSegment[]
  citations: number[] | null
  /** The homework question a chat turn was about. */
  questionId?: string
  createdAt: string
}

export interface MockConversation {
  id: string
  title: string
  messageCount: number
  createdAt: string
  pinned: boolean
  lastActivityAt: string
  bookId?: string
  bookSha256?: string
  bookTitle?: string
  /** The detail view (GET /api/conversations/{id}); the list omits it. */
  messages?: MockMessage[]
}

export interface MockData {
  books: MockBook[]
  tasks: MockTask[]
  homeworks?: MockHomework[]
  /** Questions served with GET /api/homework/{id}. */
  questions?: MockQuestion[]
  /** GET /api/books/{sha}/sections for the reader. */
  sections?: MockSection[]
  /** Page text per page number for GET /api/books/{sha}/pages/{n}; a page
   *  absent from the map answers 404. */
  pages?: Record<number, string>
  /** Ask history: the rail list, and each thread's messages for detail. */
  conversations?: MockConversation[]
  /** One tutor chat per assignment, restored by GET /api/homework/{id}/chat. */
  homeworkChats?: (MockConversation & { homeworkId: string })[]
  /** Response bodies for the scripted POST /api/import modes. */
  acceptTask: MockTask
  duplicateBook: MockBook
  /** GET/PUT /api/config; the server answers with defaults when absent. */
  config?: MockConfig
}

const T0 = '2026-09-15T09:00:00Z'

function phase(taskId: string, partial: Pick<MockPhase, 'id' | 'key' | 'name' | 'note' | 'status' | 'done' | 'total'> & Partial<MockPhase>): MockPhase {
  return {
    error: null,
    etaSeconds: null,
    createdAt: T0,
    startedAt: null,
    finishedAt: null,
    ...partial,
    taskId,
  }
}

/** The four phases of preparing a book, in the words Tasks shows. */
export function preparePlan(taskId: string, over: Partial<Record<string, Partial<MockPhase>>> = {}): MockPhase[] {
  const names: [string, string][] = [
    ['examine', 'Examine the pages'],
    ['read', 'Read the pages'],
    ['index', 'Index the sections'],
    ['search', 'Build search'],
  ]
  return names.map(([key, name], i) =>
    phase(taskId, {
      id: `${taskId}-p${i + 1}`,
      key,
      name,
      note: '',
      status: 'waiting',
      done: 0,
      total: 0,
      ...(over[key] ?? {}),
    }),
  )
}

const calcSha = 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90'
const laxSha = 'b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2'
const aplSha = 'c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3'
const ochemSha = 'd4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4'

function book(p: Pick<MockBook, 'id' | 'sha256' | 'title' | 'author' | 'subject' | 'pageCount'> & Partial<MockBook>): MockBook {
  return {
    kind: 'digital',
    ready: true,
    readiness: {
      pagesStored: p.pageCount,
      pagesFailed: 0,
      pagesWithText: p.pageCount,
      sections: 24,
      vectors: p.pageCount,
      missing: '',
    },
    failedPages: [],
    task: null,
    pdfVersion: '1.7',
    pageWidth: 612,
    pageHeight: 792,
    fileSize: 48_200_000,
    originPath: `/home/jackt/Books/${p.title}.pdf`,
    libraryPath: `/home/jackt/.pset/library/${p.sha256}.pdf`,
    importedAt: T0,
    ...p,
  }
}

export const books: MockBook[] = [
  book({
    id: '6f1c2a10-0001-4a5b-8c6d-100000000001',
    sha256: calcSha,
    title: 'Calculus: Early Transcendentals',
    author: 'James Stewart',
    subject: 'Mathematics',
    pageCount: 1328,
  }),
  book({
    id: '6f1c2a10-0002-4a5b-8c6d-100000000002',
    sha256: laxSha,
    title: 'Linear Algebra Done Right',
    author: 'Sheldon Axler',
    subject: 'Mathematics',
    pageCount: 340,
    fileSize: 9_400_000,
  }),
  book({
    id: '6f1c2a10-0003-4a5b-8c6d-100000000003',
    sha256: aplSha,
    title: 'A Pattern Language',
    author: 'Christopher Alexander',
    subject: 'Architecture',
    pageCount: 1172,
    kind: 'scanned',
    fileSize: 210_000_000,
  }),
  book({
    id: '6f1c2a10-0004-4a5b-8c6d-100000000004',
    sha256: ochemSha,
    title: 'Organic Chemistry',
    author: 'Paula Bruice',
    subject: 'Chemistry',
    pageCount: 1220,
  }),
]

/** A mid-flight preparation of book 4, reading page 512 of 1220. The
 *  sidebar card, the library card and /tasks all read from this. */
export const runningPrepare: MockTask = {
  id: 'task-running-0001',
  kind: 'prepare',
  status: 'running',
  bookId: books[3].id,
  homeworkId: null,
  title: books[3].title,
  phases: preparePlan('task-running-0001', {
    examine: { status: 'done', startedAt: T0, finishedAt: T0 },
    read: {
      status: 'running',
      note: 'recognizing page 512…',
      done: 512,
      total: 1220,
      etaSeconds: 140,
      startedAt: T0,
    },
  }),
  failKind: null,
  retryable: false,
  error: null,
  createdAt: T0,
  startedAt: T0,
  finishedAt: null,
}

/** The book that preparation belongs to, dimmed and not usable yet. */
export const preparingBook: MockBook = {
  ...books[3],
  ready: false,
  readiness: {
    pagesStored: 512,
    pagesFailed: 0,
    pagesWithText: 512,
    sections: 0,
    vectors: 0,
    missing: 'read',
  },
  task: runningPrepare,
}

/** What POST /api/import answers with on 202: a queued preparation with no
 *  book row yet — examine is what creates it. */
export const acceptTask: MockTask = {
  id: 'task-accepted-0001',
  kind: 'prepare',
  status: 'queued',
  bookId: null,
  homeworkId: null,
  title: 'Lecture Notes on Analysis',
  phases: preparePlan('task-accepted-0001'),
  failKind: null,
  retryable: false,
  error: null,
  createdAt: T0,
  startedAt: null,
  finishedAt: null,
}
