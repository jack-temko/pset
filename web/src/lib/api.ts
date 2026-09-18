import type {
  ChatEvent,
  Book,
  QuestionQueued,
  ConversationMessages,
  Homework,
  HomeworkQuestion,
  Config,
  ConfigPatch,
  ConfigTest,
  Conversation,
  ConversationDetail,
  DoctorReport,
  Health,
  ImportAccepted,
  Task,
  PageText,
  ResetCounts,
  Section,
} from '@/lib/types'

/** Error thrown for every non-2xx API response, carrying the server's message and detail chain. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string[]

  constructor(status: number, message: string, detail: string[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

interface ErrorBody {
  error?: unknown
  detail?: unknown
}

async function toApiError(res: Response): Promise<ApiError> {
  let message = `${res.status} ${res.statusText}`
  let detail: string[] = []
  try {
    const data = (await res.json()) as ErrorBody
    if (typeof data.error === 'string' && data.error) message = data.error
    if (Array.isArray(data.detail)) {
      detail = data.detail.filter((d): d is string => typeof d === 'string')
    }
  } catch {
    // non-JSON error body — fall back to the status line
  }
  return new ApiError(res.status, message, detail)
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  const res = await fetch(path, {
    method,
    headers: body === undefined || isForm ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  })
  if (!res.ok) throw await toApiError(res)
  return res.json() as Promise<T>
}

const get = <T,>(path: string) => request<T>('GET', path)
const post = <T,>(path: string, body?: unknown) => request<T>('POST', path, body)
const put = <T,>(path: string, body?: unknown) => request<T>('PUT', path, body)
const patch = <T,>(path: string, body?: unknown) => request<T>('PATCH', path, body)
const del = <T,>(path: string) => request<T>('DELETE', path)

export const api = {
  health: () => get<Health>('/api/health'),
  books: () => get<{ books: Book[] }>('/api/books').then((r) => r.books),
  book: (sha: string) => get<Book>(`/api/books/${encodeURIComponent(sha)}`),
  page: (sha: string, page: number) =>
    get<PageText>(`/api/books/${encodeURIComponent(sha)}/pages/${page}`),
  pageImageUrl: (sha: string, page: number) =>
    `/api/books/${encodeURIComponent(sha)}/pages/${page}/image`,
  sections: (sha: string) => get<Section[]>(`/api/books/${encodeURIComponent(sha)}/sections`),
  importUpload: (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return post<ImportAccepted>('/api/import', form)
  },
  importPath: (path: string) => post<ImportAccepted>('/api/import', { path }),
  tasks: () => get<{ tasks: Task[] }>('/api/tasks').then((r) => r.tasks),
  task: (id: string) =>
    get<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}`).then((r) => r.task),
  stopTask: (id: string) =>
    post<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}/stop`).then((r) => r.task),
  retryTask: (id: string) =>
    post<{ task: Task }>(`/api/tasks/${encodeURIComponent(id)}/retry`).then((r) => r.task),
  /** The only door that deletes: stopping and failing both keep their work. */
  removeBook: (sha: string) =>
    del<{ removed: string; title: string }>(`/api/books/${encodeURIComponent(sha)}`),
  getConfig: () => get<Config>('/api/config'),
  updateConfig: (patch: ConfigPatch) => put<Config>('/api/config', patch),
  testConfig: () => post<ConfigTest>('/api/config/test'),
  allConversations: () =>
    get<{ conversations: Conversation[] }>('/api/conversations').then((r) => r.conversations),
  conversationById: (id: string) =>
    get<ConversationDetail>(`/api/conversations/${encodeURIComponent(id)}`),
  conversations: (sha: string) =>
    get<{ conversations: Conversation[] }>(
      `/api/books/${encodeURIComponent(sha)}/conversations`,
    ).then((r) => r.conversations),
  conversation: (sha: string, id: string) =>
    get<ConversationDetail>(
      `/api/books/${encodeURIComponent(sha)}/conversations/${encodeURIComponent(id)}`,
    ),
  updateConversation: (id: string, body: { title?: string; pinned?: boolean }) =>
    patch<{ conversation: Conversation }>(`/api/conversations/${encodeURIComponent(id)}`, body).then(
      (r) => r.conversation,
    ),
  deleteConversation: (sha: string, id: string) =>
    del<Record<string, never>>(
      `/api/books/${encodeURIComponent(sha)}/conversations/${encodeURIComponent(id)}`,
    ),
  doctor: () => get<DoctorReport>('/api/doctor'),
  doctorFix: () => post<DoctorReport>('/api/doctor'),
  reset: (apply: boolean) => post<ResetCounts>('/api/reset', { apply }),
  // --- homework ---
  homeworks: () => get<{ homeworks: Homework[] }>('/api/homework').then((r) => r.homeworks),
  homework: (id: string) =>
    get<{ homework: Homework; questions: HomeworkQuestion[] }>(
      `/api/homework/${encodeURIComponent(id)}`,
    ),
  createHomework: (body: {
    bookSha256: string
    title?: string
    dueDate?: string | null
    sourceText: string
  }) => post<{ homework: Homework; task: Task }>('/api/homework', body),
  updateHomework: (id: string, body: { title?: string; dueDate?: string | null; turnedIn?: boolean; questionScale?: number; figureScale?: number }) =>
    patch<{ homework: Homework }>(`/api/homework/${encodeURIComponent(id)}`, body),
  deleteHomework: (id: string) => del<Record<string, never>>(`/api/homework/${encodeURIComponent(id)}`),
  removeQuestion: (id: string, qid: string) =>
    del<{ question: HomeworkQuestion }>(
      `/api/homework/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}`,
    ),
  addQuestion: (id: string, q: HomeworkQuestionCreate) =>
    post<{ question: HomeworkQuestion }>(
      `/api/homework/${encodeURIComponent(id)}/questions`,
      q,
    ),
  moveQuestion: (id: string, qid: string, position: number) =>
    patch<{ question: HomeworkQuestion }>(
      `/api/homework/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}`,
      { position },
    ),
  questionImageUrl: (id: string, qid: string, variant: 'question' | 'diagram', n = 0) =>
    `/api/homework/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}/image?variant=${variant}&n=${n}`,
  homeworkPdfUrl: (id: string) => `/api/homework/${encodeURIComponent(id)}/pdf`,

  // --- question repair ---
  //
  // Each of these touches exactly the stage that was wrong and runs now,
  // not through the queue: a rewrite is one model call, and queueing it
  // behind a book being prepared would make it wait an hour.

  /** Hand corrections from the Adjust panel: a page, a reframed region,
   *  reframed figures, or a question that isn't from the book after all.
   *  No model call, no prose — words go through the tutor chat. */
  adjustQuestion: (
    id: string,
    qid: string,
    body: {
      page?: number
      questionRect?: { x: number; y: number; w: number; h: number }
      diagrams?: { label: string; rect: { x: number; y: number; w: number; h: number } }[]
      standalone?: boolean
    },
  ) =>
    post<{ question: HomeworkQuestion }>(
      `/api/homework/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}/adjust`,
      body,
    ).then((r) => r.question),

  /** Find the question in the book again, then write it up. A page the
   *  student names turns searching the whole book into finding a region on
   *  one page. Queues a task and answers with it plus the question row as it
   *  now stands; progress arrives on the shared event stream. */
  relocateQuestion: (id: string, qid: string, body: { page?: number; note?: string }) =>
    post<QuestionQueued>(
      `/api/homework/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}/relocate`,
      body,
    ),

  /** Write the walkthrough again from the location it already has. */
  rewriteQuestion: (id: string, qid: string, note?: string) =>
    post<QuestionQueued>(
      `/api/homework/${encodeURIComponent(id)}/questions/${encodeURIComponent(qid)}/rewrite`,
      { note: note ?? '' },
    ),

  /** The assignment's chat, for restoring the panel on load. The
   *  conversation is null until the first message. */
  homeworkChatHistory: (id: string) =>
    get<ConversationMessages>(`/api/homework/${encodeURIComponent(id)}/chat`),
}

/** Body of POST …/questions — the full row form the undo flow re-creates. */
export interface HomeworkQuestionCreate {
  transcription: string
  page?: number | null
  status?: string
  standalone?: boolean
  questionRect?: HomeworkQuestion['questionRect']
  diagrams?: HomeworkQuestion['diagrams']
  guide?: HomeworkQuestion['guide']
}

export function isAbortError(e: unknown): boolean {
  return e instanceof Error && e.name === 'AbortError'
}

/** Reads one SSE response, handing every `data:` payload to handle. */
async function consumeSSE(res: Response, handle: (payload: string) => void): Promise<void> {
  if (!res.body) return
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  const feed = (raw: string) => {
    for (const line of raw.split('\n')) {
      if (!line.startsWith('data:')) continue
      const payload = line.slice(5).trim()
      if (!payload) continue
      try {
        handle(payload)
      } catch {
        // skip malformed lines
      }
    }
  }
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    for (;;) {
      const sep = buffer.indexOf('\n\n')
      if (sep === -1) break
      feed(buffer.slice(0, sep))
      buffer = buffer.slice(sep + 2)
    }
  }
  feed(buffer + decoder.decode())
}

/** Streams one SSE endpoint, handing every decoded event to onEvent. The
 *  promise settles when the server closes the stream; a failure before the
 *  stream opens arrives as an ApiError with a real status, because the
 *  server only switches to an event stream on its first event. */
async function streamEvents<E>(
  path: string,
  opts: { method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal },
  onEvent: (event: E) => void,
): Promise<void> {
  const res = await fetch(path, {
    method: opts.method ?? 'GET',
    headers:
      opts.body === undefined
        ? { Accept: 'text/event-stream' }
        : { 'Content-Type': 'application/json' },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    signal: opts.signal,
  })
  if (!res.ok) throw await toApiError(res)
  await consumeSSE(res, (payload) => {
    try {
      onEvent(JSON.parse(payload) as E)
    } catch {
      // skip malformed lines
    }
  })
}

/** Ask a book. One ChatEvent stream, the same the homework chat speaks. */
export async function askBook(
  sha: string,
  body: { question: string; conversationId: string | null; page?: number | null },
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  await streamEvents(`/api/books/${encodeURIComponent(sha)}/ask`, { method: 'POST', body, signal }, onEvent)
}

/** Send one message on an assignment's chat. `questionId` is the question
 *  selected right now — the anchor the turn is about. */
export async function homeworkChat(
  homeworkId: string,
  body: { message: string; questionId?: string },
  onEvent: (event: ChatEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  await streamEvents(
    `/api/homework/${encodeURIComponent(homeworkId)}/chat`,
    { method: 'POST', body, signal },
    onEvent,
  )
}

