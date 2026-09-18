// Types for the PSet HTTP API (/api/*). Kept in sync with the backend contract.

export type SectionSource = 'outline' | 'inferred'
/** How preparation reads the book: its own text layer, or a scan. */
export type BookKind = 'digital' | 'scanned'

/** Why a book is not ready yet, as counts rather than flags. Readiness is
 *  derived on the server from stored rows, so nothing here can go stale. */
export interface Readiness {
  pagesStored: number
  pagesFailed: number
  /** Blank pages excluded: there is nothing on them for search to miss. */
  pagesWithText: number
  sections: number
  vectors: number
  /** The first unfinished phase's key, or '' when the book is ready. */
  missing: '' | 'examine' | 'read' | 'index' | 'search'
}

/** One page whose text a tool failed to produce. A blank page never appears
 *  here: a blank page is a finished page. */
export interface FailedPage {
  page: number
  error: string
}

export interface Book {
  id: string
  sha256: string
  title: string
  author: string
  subject: string
  pageCount: number
  /** A book is ready or it isn't; there is no partial capability. */
  ready: boolean
  readiness: Readiness
  failedPages: FailedPage[]
  /** The task preparing this book, or the one still waiting on a decision. */
  task: Task | null
  kind: BookKind
  pdfVersion: string
  pageWidth: number
  pageHeight: number
  fileSize: number
  originPath: string
  libraryPath: string
  importedAt: string
}

export interface PageText {
  sha256: string
  page: number
  text: string
}

export interface Health {
  status: string
  version: string
  databasePath: string
  libraryDirectory: string
}

/** Two kinds of work a student starts. Everything else is a direct request
 *  that renders on the thing it affects. */
export type TaskKind = 'prepare' | 'homework' | 'question'

/** Stopping keeps the work, so a stopped task rests at `paused` and a retry
 *  resumes it. There is no cancelled, and nothing waits on configuration. */
export type TaskStatus = 'queued' | 'running' | 'paused' | 'failed' | 'done'

/** Why a task failed. `permanent` means a retry would fail identically, so
 *  no Try again is offered for it. */
export type FailKind = 'transient' | 'environment' | 'permanent'

export type PhaseStatus = 'waiting' | 'running' | 'done' | 'failed'

/** One step of a task's plan. Phases are a flat ordered list — there are no
 *  child rows, so what runs is exactly what the student sees. */
export interface Phase {
  id: string
  taskId: string
  key: string
  name: string
  status: PhaseStatus
  done: number
  /** 0 means uncounted. */
  total: number
  note: string
  error: string | null
  /** Remaining time of a running, counted phase; survives a restart. */
  etaSeconds: number | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

export interface Task {
  id: string
  kind: TaskKind
  status: TaskStatus
  bookId: string | null
  homeworkId: string | null
  /** Set on a question task: the one question it works. */
  questionId?: string
  /** What the task is working on, in the words a student uses. */
  title: string
  phases: Phase[]
  failKind: FailKind | null
  /** Whether offering a retry would be honest. A permanent failure is never
   *  retryable; a finished task is, only when the book it built is no longer
   *  complete. */
  retryable: boolean
  error: string | null
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
}

/** Events on GET /api/events: one connection carries every task; a snapshot
 *  resets the store, everything else folds last-write-wins by id. */
export type TaskEvent =
  | { type: 'snapshot'; tasks: Task[] }
  /** A heartbeat. It carries nothing; its arrival is the whole message —
   *  it is how the client tells an idle stream from a dead one. */
  | { type: 'ping' }
  | { type: 'task'; task: Task }
  | { type: 'phase'; phase: Phase }
  | { type: 'task_removed'; id: string }

export interface ImportAccepted {
  book: Book | null
  task: Task | null
  duplicated: boolean
}

export interface Section {
  sortOrder: number
  level: number
  title: string
  source: SectionSource
  startPage: number
  endPage: number
}

export type CheckStatus = 'ok' | 'fixed' | 'warn' | 'failed'
export type Severity = 'info' | 'warning' | 'error'

export interface DoctorFinding {
  severity: Severity
  message: string
  /** Where the fix lives, when it is outside this page (Settings owns the
   *  API key and endpoints). */
  link?: { label: string; href: string }
}

export interface DoctorCheck {
  name: string
  status: CheckStatus
  findings: DoctorFinding[]
}

export interface DoctorReport {
  ok: boolean
  checks: DoctorCheck[]
}

export interface ResetCounts {
  books: number
  pages: number
  libraryFiles: number
  finishedTasks: number
}

export interface Config {
  apiBaseURL: string
  hasAPIKey: boolean
  embedBaseURL: string
  embedModel: string
}

export interface ConfigPatch {
  apiBaseURL?: string
  apiKey?: string
  embedBaseURL?: string
  embedModel?: string
}

export interface ConfigTestPart {
  ok: boolean
  detail: string
}

export interface ConfigTest {
  ok: boolean
  chat: ConfigTestPart
  embed: ConfigTestPart
}

export interface Conversation {
  id: string
  title: string
  messageCount: number
  createdAt: string
  pinned: boolean
  lastActivityAt: string
  bookId?: string
  bookSha256?: string
  bookTitle?: string
}

export type MessageRole = 'user' | 'assistant'

/** The five envelope kinds the engine schema-validates. Hand-synced with
 *  internal/engine/schemas/*.json — the web trusts the engine and never
 *  re-validates payloads. */
export type EnvelopeKind = 'equation' | 'steps' | 'theorem' | 'definition' | 'note'

export interface EquationPayload {
  title: string
  equations: string[]
  note?: string
}

export interface StepsPayload {
  title: string
  steps: string[]
  note?: string
}

export interface StatementPayload {
  title: string
  statement: string
  note?: string
}

export interface NotePayload {
  title: string
  body: string[]
}

export type EnvelopePayload = EquationPayload | StepsPayload | StatementPayload | NotePayload

export interface ProseSegment {
  type: 'prose'
  text: string
}

export interface CodeSegment {
  type: 'code'
  text: string
}

export type EnvelopeSegment =
  | { type: 'envelope'; kind: 'equation'; payload: EquationPayload }
  | { type: 'envelope'; kind: 'steps'; payload: StepsPayload }
  | { type: 'envelope'; kind: 'theorem' | 'definition'; payload: StatementPayload }
  | { type: 'envelope'; kind: 'note'; payload: NotePayload }

/** One tool exchange as the transcript holds it: what ran, with which
 *  arguments, and what came back. `pages` feeds the consulted strip. */
export interface ToolPayload {
  id: string
  tool: ToolName
  args?: unknown
  result?: string
  ok: boolean
  pages?: number[]
}

export interface ToolSegment {
  type: 'tool'
  kind: ToolName
  payload: ToolPayload
}

export type ToolName =
  | 'calc'
  | 'solve_linear'
  | 'search_book'
  | 'read_page'
  | 'add_understanding_note'

export type Segment = ProseSegment | EnvelopeSegment | CodeSegment | ToolSegment

export interface Message {
  id: string
  role: MessageRole
  content: string
  segments: Segment[]
  /** Deprecated: never written for new messages. Legacy threads still render
   *  their consulted strip from it. */
  citations: number[] | null
  /** The homework question a chat turn was about; absent on ask threads. */
  questionId?: string
  createdAt: string
}

export interface ConversationDetail {
  conversation: Conversation
  messages: Message[]
}

/** A homework chat on load: the conversation is null until the first
 *  message, which is a normal empty state rather than an error. */
export interface ConversationMessages {
  conversation: Conversation | null
  messages: Message[]
}

/** The one chat stream, shared by Ask and the homework workspace. Ask's
 *  meta carries the retrieved pages; the homework chat's carries the
 *  question the turn is anchored to and can emit `question` when a tool
 *  changes the outline. Everything else is identical, so one reducer folds
 *  both. */
export type ChatEvent =
  | {
      type: 'meta'
      conversationId: string
      pages?: number[]
      warnings?: string[]
      questionId?: string
    }
  | { type: 'delta'; text: string }
  | { type: 'envelope-start'; kind: EnvelopeKind }
  | { type: 'envelope-repairing'; kind: EnvelopeKind }
  | { type: 'envelope'; kind: EnvelopeKind; payload: EnvelopePayload }
  | { type: 'envelope-failed'; kind: EnvelopeKind; raw: string }
  | { type: 'tool-start'; id: string; tool: ToolName; args?: unknown }
  | {
      type: 'tool-result'
      id: string
      tool: ToolName
      args?: unknown
      ok: boolean
      summary: string
      pages?: number[]
    }
  | { type: 'question'; question: HomeworkQuestion }
  | { type: 'done'; messageId: string }
  | { type: 'error'; error: string }

/** @deprecated the ask stream is a ChatEvent stream now. */
export type AskEvent = ChatEvent

// --- homework ---------------------------------------------------------------------

export type HomeworkStatus = 'generating' | 'ready'
/** `stale` marks a walkthrough that no longer matches its question: the text
 *  was edited, or the location moved. The card says so and offers a rewrite
 *  rather than silently spending a model call. */
export type HomeworkQuestionStatus =
  | 'pending'
  | 'locating'
  | 'writing'
  | 'ready'
  | 'failed'
  | 'stale'

/** Region of a rendered book page, normalized to [0, 1], y from the top. */
export interface HomeworkRect {
  x: number
  y: number
  w: number
  h: number
}

export interface HomeworkDiagram {
  label: string
  rect: HomeworkRect
}

export interface HomeworkEquation {
  title: string
  tex: string
  note?: string
}

/** How the model read the problem before solving it. Shown ungated at the
 *  top of the question, because a wrong reading is what makes a whole
 *  walkthrough wrong and it is the fastest thing to check. Null on guides
 *  written before the box existed. */
export interface HomeworkReading {
  given: string[]
  find: string
  figure?: string
}

export interface HomeworkGuide {
  reading: HomeworkReading | null
  setup: string
  hints: string[]
  steps: string[]
  equations: HomeworkEquation[]
  answer: string
}

export interface HomeworkQuestion {
  id: string
  homeworkId: string
  position: number
  page: number | null
  status: HomeworkQuestionStatus
  error: string | null
  standalone: boolean
  questionRect: HomeworkRect | null
  transcription: string
  diagrams: HomeworkDiagram[]
  /** Durable corrections the chat pinned. They never print on the sheet;
   *  they steer the next rewrite. */
  understandingNotes: UnderstandingNote[]
  guide: HomeworkGuide | null
  createdAt: string
  updatedAt: string
}

export interface UnderstandingNote {
  note: string
  at: string
}

export interface Homework {
  id: string
  bookId: string
  bookSha256: string
  bookTitle: string
  title: string
  dueDate: string | null
  status: HomeworkStatus
  turnedIn: boolean
  questionCount: number
  questionScale: number
  figureScale: number
  createdAt: string
  updatedAt: string
}

/** What a queued repair answers with: the task to watch, and the question
 *  row as it now stands (already marked as working), so the outline updates
 *  without a refetch. Progress then arrives on the shared event stream. */
export interface QuestionQueued {
  task: Task
  question: HomeworkQuestion
}
