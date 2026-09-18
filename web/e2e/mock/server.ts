import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, resolve, sep } from 'node:path'

import type { MockData, MockHomework, MockPhase, MockQuestion, MockTask } from '../seeds/library.ts'
import type { MockScript } from '../types.ts'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.map': 'application/json',
}

function json(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(payload)
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let out = ''
    req.on('data', (chunk: Buffer) => (out += chunk))
    req.on('end', () => resolveBody(out))
    req.on('error', reject)
  })
}

export { json, readBody }

export interface MockHandle {
  port: number
  /** Swap the data + script used to answer /api calls; called before each state. */
  apply(data: MockData, script: MockScript): void
  close(): Promise<void>
}

type DoctorMode = NonNullable<MockScript['doctor']>

/** The six readiness checks, scripted per mode: 'healthy' (all ok),
 *  'warnings' (tesseract missing), 'failed' (chat + embed down, linked to
 *  Settings), 'fixed' (data dir + database just repaired by Repair). */
function doctorReport(mode: DoctorMode) {
  type Finding = { severity: 'info' | 'warning' | 'error'; message: string; link?: { label: string; href: string } }
  const check = (name: string, status: string, findings: Finding[]) => ({ name, status, findings })
  const info = (message: string): Finding => ({ severity: 'info', message })
  const dir = mode === 'fixed'
    ? check('data dir', 'fixed', [info('created /home/you/.pset/library'), info('/home/you/.pset/library is writable')])
    : check('data dir', 'ok', [info('/home/you/.pset is writable')])
  const chat = mode === 'failed'
    ? check('chat api', 'failed', [{
        severity: 'error',
        message: 'no chat endpoint or API key configured',
        link: { label: 'Add a key in Settings', href: '/settings' },
      }])
    : check('chat api', 'ok', [info('connected')])
  const embed = mode === 'failed'
    ? check('semantic search', 'failed', [{
        severity: 'error',
        message: 'the embeddings endpoint refused the connection',
        link: { label: 'Check it in Settings', href: '/settings' },
      }])
    : check('semantic search', 'ok', [info('connected, model nomic-embed-text')])
  const tesseract = mode === 'warnings'
    ? check('tesseract', 'warn', [{ severity: 'warning', message: 'missing tesseract, required to read scanned books; install e.g. `sudo apt-get install tesseract-ocr`' }])
    : check('tesseract', 'ok', [info('tesseract at /usr/bin/tesseract (tesseract 5.3.0)')])
  const database = mode === 'fixed'
    ? check('database', 'fixed', [info('migrated schema v0 to v1')])
    : check('database', 'ok', [info('schema v1 at /home/you/.pset/pset.db')])
  const checks = [
    dir,
    database,
    check('poppler', 'ok', [info('pdfinfo at /usr/bin/pdfinfo (pdfinfo version 24.02.0)'), info('pdftotext at /usr/bin/pdftotext (pdftotext version 24.02.0)')]),
    tesseract,
    chat,
    embed,
  ]
  const ok = !checks.some((c) => c.status === 'failed')
  return { ok, checks }
}

/** One process serves the built SPA from distRoot plus the scripted API.
 *  Every state gets a fresh apply() before its page loads, so states never
 *  see each other's data. `extra` routes console traffic before the mock
 *  and static handlers; return true once the response is handled. */
export function startMockServer(
  distRoot: string,
  extra?: (req: IncomingMessage, res: ServerResponse, url: URL) => boolean | Promise<boolean>,
  port = 0,
): Promise<MockHandle> {
  const absDist = resolve(distRoot)
  // States patch this through /__mock/control before their page loads; the
  // empty defaults keep a cold server answerable.
  let data: MockData = { books: [], tasks: [], acceptTask: undefined as never, duplicateBook: undefined as never }
  let script: MockScript = {}
  // Live SSE connections, so mock mutations (clear-finished) can emit the
  // same job_removed events the real server does.
  const sseClients = new Set<ServerResponse>()

  // publishTask pushes one task row onto the stream — the same signal the
  // real server sends, and the only way the workspace learns that a
  // question's phase moved.
  const publishTask = (task: MockTask) => {
    const payload = JSON.stringify({ type: 'task', task })
    for (const client of sseClients) client.write(`data: ${payload}\n\n`)
  }

  // phaseRow builds one waiting phase in the shape the wire uses.
  const phaseRow = (taskId: string, key: string, name: string): MockPhase => ({
    id: `${taskId}-${key}`,
    taskId,
    key,
    name,
    note: '',
    status: 'waiting' as const,
    done: 0,
    total: 1,
    error: null,
    etaSeconds: null,
    createdAt: new Date().toISOString(),
    startedAt: null,
    finishedAt: null,
  })

  // Settle every generating homework: flips to ready, its job completes,
  // and the job event goes out on the stream — the dashboard refetches off
  // exactly that signal.
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const settleHomeworks = () => {
    const now = new Date().toISOString()
    for (const hw of data.homeworks ?? []) {
      if (hw.status !== 'generating') continue
      hw.status = 'ready'
      if (hw.questionCount === 0) hw.questionCount = 3
      hw.updatedAt = now
    }
    for (const task of data.tasks ?? []) {
      if (task.kind !== 'homework' || task.status !== 'running') continue
      task.status = 'done'
      task.finishedAt = now
      for (const phase of task.phases) {
        phase.status = 'done'
        phase.done = phase.total
      }
      const payload = JSON.stringify({ type: 'task', task })
      for (const client of sseClients) client.write(`data: ${payload}\n\n`)
    }
  }

  const DEFAULT_CONFIG = {
    apiBaseURL: 'https://api.z.ai/api/paas/v4',
    hasAPIKey: true,
    embedBaseURL: 'http://127.0.0.1:11434/v1',
    embedModel: 'nomic-embed-text',
    hwQuestionScale: 100,
    hwFigureScale: 100,
  }

  const server: Server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://mock')

    if (extra && (await extra(req, res, url))) return

    if (url.pathname === '/__mock/control' && req.method === 'POST') {
      void readBody(req).then((body) => {
        const patch = JSON.parse(body) as { data?: MockData; script?: MockScript }
        // A mid-flow patch reconditions without disturbing the seed: only
        // the fields present are replaced.
        if (patch.data) data = patch.data
        if (patch.script) script = patch.script
        // A live stream that is being dropped must actually fall: ending the
        // responses here is what turns the app's card honest — a reconditioned
        // script alone would only refuse the next connection.
        if (script.events === 'drop') {
          for (const client of sseClients) client.end()
        }
        json(res, 200, { ok: true })
      })
      return
    }

    if (url.pathname === '/api/health') {
      json(res, 200, {
        status: 'ok',
        version: '0.0.0-visual',
        databasePath: '/home/you/.pset/pset.db',
        libraryDirectory: '/home/you/.pset/library',
      })
      return
    }

    if (url.pathname === '/api/config' && req.method === 'GET') {
      if (script.config === 'fail') {
        json(res, 500, { error: 'config store unreadable', detail: ['settings.json: permission denied'] })
        return
      }
      const send = () => json(res, 200, data.config ?? DEFAULT_CONFIG)
      if (script.configDelayMs) setTimeout(send, script.configDelayMs)
      else send()
      return
    }

    if (url.pathname === '/api/config' && req.method === 'PUT') {
      void readBody(req).then((body) => {
        if (script.configSave === 'fail') {
          json(res, 500, { error: 'the key was rejected', detail: ['provider answered 401 for the probe request'] })
          return
        }
        const patch = JSON.parse(body) as Partial<NonNullable<MockData['config']>> & { apiKey?: string }
        const current = data.config ?? DEFAULT_CONFIG
        const next = { ...current }
        if (patch.apiBaseURL !== undefined) next.apiBaseURL = patch.apiBaseURL
        if (patch.embedBaseURL !== undefined) next.embedBaseURL = patch.embedBaseURL
        if (patch.embedModel !== undefined) next.embedModel = patch.embedModel
        if (patch.hwQuestionScale !== undefined) next.hwQuestionScale = patch.hwQuestionScale
        if (patch.hwFigureScale !== undefined) next.hwFigureScale = patch.hwFigureScale
        if (patch.apiKey) next.hasAPIKey = true
        data.config = next
        json(res, 200, next)
      })
      return
    }

    if (url.pathname === '/api/config/test' && req.method === 'POST') {
      const mode = script.configTest ?? 'pass'
      const part = (ok: boolean, detail: string) => ({ ok, detail })
      switch (mode) {
        case 'fail-chat':
          json(res, 200, {
            ok: false,
            chat: part(false, '401 unauthorized; check the API key'),
            embed: part(true, ''),
          })
          return
        case 'fail-embed':
          json(res, 200, {
            ok: false,
            chat: part(true, ''),
            embed: part(false, 'connection refused; is the search service running?'),
          })
          return
        default:
          json(res, 200, { ok: true, chat: part(true, ''), embed: part(true, '') })
      }
      return
    }

    if (url.pathname === '/api/homework' && req.method === 'GET') {
      if (script.homeworks === 'fail') {
        json(res, 500, { error: 'homework list unavailable', detail: ['database: disk I/O error'] })
        return
      }
      const list = [...(data.homeworks ?? [])].sort(
        (a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt),
      )
      json(res, 200, { homeworks: list })
      return
    }

    if (url.pathname === '/api/homework' && req.method === 'POST') {
      void readBody(req).then((body) => {
        const respond = () => {
          if (script.homeworkCreate === 'fail') {
            json(res, 500, { error: 'the model never answered', detail: ['chat: 500 after 3 attempts'] })
            return
          }
          const input = JSON.parse(body) as {
          bookSha256?: string
          title?: string
          dueDate?: string | null
          sourceText?: string
        }
        const book = (data.books ?? []).find((b) => b.sha256 === input.bookSha256)
        if (!book || !input.sourceText?.trim()) {
          json(res, 400, { error: 'pick a book and paste the assignment', detail: [] })
          return
        }
        const now = new Date().toISOString()
        const homework: MockHomework = {
          id: `hw-new-${(data.homeworks?.length ?? 0) + 1}`,
          bookId: book.id,
          bookSha256: book.sha256,
          bookTitle: book.title,
          title: input.title?.trim() || 'New assignment',
          dueDate: input.dueDate || null,
          status: 'generating',
          turnedIn: false,
          questionCount: 0,
          questionScale: 100,
          figureScale: 100,
          createdAt: now,
          updatedAt: now,
        }
        const taskId = `task-${homework.id}`
        const task: MockTask = {
          id: taskId,
          kind: 'homework',
          status: 'running',
          bookId: book.id,
          homeworkId: homework.id,
          title: homework.title,
          phases: [
            {
              id: `${taskId}-p1`,
              taskId,
              key: 'extract',
              name: 'Read the assignment',
              note: 'finding the questions…',
              status: 'running',
              done: 0,
              total: 1,
              error: null,
              etaSeconds: 20,
              createdAt: now,
              startedAt: now,
              finishedAt: null,
            },
            {
              id: `${taskId}-p2`,
              taskId,
              key: 'walkthroughs',
              name: 'Write the walkthroughs',
              note: '',
              status: 'waiting',
              done: 0,
              total: 0,
              error: null,
              etaSeconds: null,
              createdAt: now,
              startedAt: null,
              finishedAt: null,
            },
          ],
          failKind: null,
          retryable: false,
          error: null,
          createdAt: now,
          startedAt: now,
          finishedAt: null,
        }
        data.homeworks = [homework, ...(data.homeworks ?? [])]
        data.tasks = [...(data.tasks ?? []), task]
        json(res, 200, { homework, task })
        }
        if (script.homeworkCreateDelayMs) setTimeout(respond, script.homeworkCreateDelayMs)
        else respond()
      })
      return
    }

    // --- reader: book detail, sections, page text, page scan -------------------

    const bookMatch = url.pathname.match(/^\/api\/books\/([^/]+)$/)
    if (bookMatch && req.method === 'GET') {
      if (script.book === 'fail') {
        json(res, 500, { error: 'the bookshelf jammed', detail: ['store: disk I/O error'] })
        return
      }
      const book = (data.books ?? []).find((b) => b.sha256 === decodeURIComponent(bookMatch[1]))
      if (!book) {
        json(res, 404, { error: 'no book in the library matches this link', detail: [] })
        return
      }
      json(res, 200, book)
      return
    }

    const sectionsMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/sections$/)
    if (sectionsMatch && req.method === 'GET') {
      if (script.sections === 'fail') {
        json(res, 500, { error: 'sections are unavailable', detail: [] })
        return
      }
      json(res, 200, data.sections ?? [])
      return
    }

    const pageMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/pages\/(\d+)$/)
    if (pageMatch && req.method === 'GET') {
      if (script.pageText === 'fail') {
        json(res, 500, { error: 'the text layer is unavailable', detail: [] })
        return
      }
      const n = Number(pageMatch[2])
      const text = data.pages?.[n]
      if (text === undefined) {
        json(res, 404, { error: `page ${n} has no text`, detail: [] })
        return
      }
      json(res, 200, { sha256: decodeURIComponent(pageMatch[1]), page: n, text })
      return
    }

    // The scan the reader shows: a portrait page plate with the page number
    // on it, so screenshots (and waits) can tell pages apart.
    const scanMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/pages\/(\d+)\/image$/)
    if (scanMatch) {
      if (script.scan === 'missing') {
        // An undecodable image rather than a 404: onError still fires, but
        // the browser logs nothing, so the state's gallery stays clean.
        res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' })
        res.end('<html>not an image')
        return
      }
      const n = Number(scanMatch[2])
      const lines = Array.from({ length: 13 }, (_, i) => {
        const w = [520, 548, 508, 540, 380][i % 5]
        return `<rect x="40" y="${96 + i * 42}" width="${w}" height="16" rx="8" fill="#c9d0da"/>`
      }).join('')
      res.writeHead(200, { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' })
      res.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800">' +
          '<rect width="600" height="800" fill="#eef0f4"/>' +
          '<rect x="8" y="8" width="584" height="784" fill="none" stroke="#b6bec9" stroke-dasharray="4 4"/>' +
          lines +
          // The number at the top too: the bottom sits below the fold in
          // full-page shots, so the flip is provable in the visible area.
          `<text x="300" y="60" text-anchor="middle" font-family="monospace" font-size="26" fill="#5b6472">page ${n}</text>` +
          `<text x="300" y="744" text-anchor="middle" font-family="monospace" font-size="26" fill="#5b6472">page ${n}</text></svg>`,
      )
      return
    }

    if (url.pathname.endsWith('/image')) {
      // Page-snapshot endpoints (question rects, reader pages): a neutral
      // placeholder plate, since no real PDF pages exist in mock mode.
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
      res.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="480" height="200">' +
          '<rect width="480" height="200" fill="#dfe3ea"/>' +
          '<rect x="1" y="1" width="478" height="198" fill="none" stroke="#b6bec9" stroke-dasharray="4 4"/>' +
          '<text x="24" y="38" font-family="monospace" font-size="15" fill="#5b6472">page snapshot</text></svg>',
      )
      return
    }

    if (/^\/api\/homework\/[^/]+$/.test(url.pathname) && req.method === 'PATCH') {
      const id = decodeURIComponent(url.pathname.split('/').pop() ?? '')
      const homework = (data.homeworks ?? []).find((h) => h.id === id)
      if (!homework) {
        json(res, 404, { error: 'no such homework', detail: [] })
        return
      }
      void readBody(req).then((raw) => {
        const patch = JSON.parse(raw || '{}') as Partial<MockHomework>
        if (patch.title !== undefined) homework.title = patch.title
        if (patch.dueDate !== undefined) homework.dueDate = patch.dueDate
        if (patch.turnedIn !== undefined) homework.turnedIn = patch.turnedIn
        if (patch.questionScale !== undefined) homework.questionScale = patch.questionScale
        if (patch.figureScale !== undefined) homework.figureScale = patch.figureScale
        homework.updatedAt = new Date().toISOString()
        json(res, 200, { homework })
      })
      return
    }

    if (/^\/api\/homework\/[^/]+$/.test(url.pathname) && req.method === 'GET') {
      const id = decodeURIComponent(url.pathname.split('/').pop() ?? '')
      const homework = (data.homeworks ?? []).find((h) => h.id === id)
      if (!homework) {
        json(res, 404, { error: 'no such homework', detail: [] })
        return
      }
      const qs = (data.questions ?? [])
        .filter((q) => q.homeworkId === id)
        .sort((a, b) => a.position - b.position)
      json(res, 200, { homework, questions: qs })
      return
    }

    // A question added by hand: inserted as a bare row, exactly as the real
    // endpoint does — no page, no walkthrough. The relocate that follows is
    // what makes it real.
    const hwQuestionsMatch = url.pathname.match(/^\/api\/homework\/([^/]+)\/questions$/)
    if (hwQuestionsMatch && req.method === 'POST') {
      const id = decodeURIComponent(hwQuestionsMatch[1])
      void readBody(req).then((raw) => {
        let body: { transcription?: string; page?: number | null; status?: string } = {}
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          // an unreadable body still inserts something
        }
        const siblings = (data.questions ?? []).filter((q) => q.homeworkId === id)
        const now = new Date().toISOString()
        const question = {
          id: `q-new-${siblings.length + 1}`,
          homeworkId: id,
          position: siblings.length + 1,
          page: body.page ?? null,
          status: (body.status ?? 'ready') as MockQuestion['status'],
          error: null,
          standalone: false,
          questionRect: null,
          transcription: body.transcription ?? '',
          diagrams: [],
          understandingNotes: [],
          guide: null,
          createdAt: now,
          updatedAt: now,
        }
        data.questions = [...(data.questions ?? []), question]
        const homework = (data.homeworks ?? []).find((h) => h.id === id)
        if (homework) homework.questionCount = siblings.length + 1
        json(res, 201, { question })
      })
      return
    }

    // --- the homework chat: history, and the scripted SSE turn ------------

    const hwChatMatch = url.pathname.match(/^\/api\/homework\/([^/]+)\/chat$/)
    if (hwChatMatch && req.method === 'GET') {
      const id = decodeURIComponent(hwChatMatch[1])
      const conv = (data.homeworkChats ?? []).find((c) => c.homeworkId === id)
      if (!conv) {
        json(res, 200, { conversation: null, messages: [] })
        return
      }
      const { messages, ...rest } = conv
      json(res, 200, { conversation: rest, messages: messages ?? [] })
      return
    }

    if (hwChatMatch && req.method === 'POST') {
      const id = decodeURIComponent(hwChatMatch[1])
      void readBody(req).then((raw) => {
        let body: { message?: string; questionId?: string } = {}
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          // an unreadable body still gets the scripted stream
        }
        const mode = script.homeworkChat ?? 'answer'
        if (mode === 'fail') {
          json(res, 500, { error: 'the model endpoint is unreachable', detail: [] })
          return
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`)
        send({ type: 'meta', conversationId: `hwconv-${id}`, questionId: body.questionId ?? '' })
        if (mode === 'streaming') {
          send({ type: 'tool-start', id: 'c1', tool: 'calc', args: { expression: '(24∠0)/(4+j6)' } })
          return
        }
        if (mode === 'tools') {
          send({ type: 'tool-start', id: 'c1', tool: 'calc', args: { expression: '(24∠0)/(4+j6)' } })
          send({
            type: 'tool-result',
            id: 'c1',
            tool: 'calc',
            args: { expression: '(24∠0)/(4+j6)' },
            ok: true,
            summary: '3.32820 - j4.99231  (5.99385∠-56.3099°)',
          })
          send({ type: 'tool-start', id: 's1', tool: 'search_book', args: { query: 'mesh analysis' } })
          send({
            type: 'tool-result',
            id: 's1',
            tool: 'search_book',
            args: { query: 'mesh analysis' },
            ok: true,
            summary: 'p. 143 — Mesh analysis applies KVL around each window…',
            pages: [143, 144],
          })
          send({
            type: 'delta',
            text: 'The mesh current is $5.99\\angle-56.3^\\circ$ A (p. 143).\n',
          })
          send({ type: 'done', messageId: `msg-${Date.now()}` })
          res.end()
          return
        }
        if (mode === 'correction') {
          const qid = body.questionId ?? ''
          const question = (data.questions ?? []).find((q) => q.id === qid)
          send({
            type: 'tool-start',
            id: 'n1',
            tool: 'add_understanding_note',
            args: { note: 'the 2 A source arrow points up, into node A' },
          })
          if (question) {
            question.status = 'stale'
            question.understandingNotes = [
              ...(question.understandingNotes ?? []),
              { note: 'the 2 A source arrow points up, into node A', at: new Date().toISOString() },
            ]
            send({ type: 'question', question })
          }
          send({
            type: 'tool-result',
            id: 'n1',
            tool: 'add_understanding_note',
            args: { note: 'the 2 A source arrow points up, into node A' },
            ok: true,
            summary: 'Noted on Q3. The walkthrough is now out of date; offer the rewrite.',
          })
          send({
            type: 'delta',
            text: 'Noted — I had that source the other way, which flips the sign of the node equation. The walkthrough is out of date.\n',
          })
          send({ type: 'done', messageId: `msg-${Date.now()}` })
          res.end()
          return
        }
        send({ type: 'delta', text: 'Start from KVL around the left window (p. 143).\n' })
        send({ type: 'done', messageId: `msg-${Date.now()}` })
        res.end()
      })
      return
    }

    // --- repairs: one task per question -----------------------------------
    //
    // The endpoint queues and answers; the work itself shows up on the task
    // stream, which is where the workspace watches it. 'stages' leaves the
    // task running mid-phase so the in-progress shot has something to shoot.
    const repairMatch = url.pathname.match(
      /^\/api\/homework\/([^/]+)\/questions\/([^/]+)\/(rewrite|relocate)$/,
    )
    if (repairMatch && req.method === 'POST') {
      const hwId = decodeURIComponent(repairMatch[1])
      const qid = decodeURIComponent(repairMatch[2])
      const kind = repairMatch[3]
      void readBody(req).then((raw) => {
        let body: { page?: number } = {}
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          // an unreadable body still queues the work
        }
        const question = (data.questions ?? []).find((q) => q.id === qid)
        if (!question) {
          json(res, 404, { error: 'no such question', detail: [] })
          return
        }
        const mode = script.repair ?? 'done'
        const taskId = `task-${qid}-${(data.tasks ?? []).length + 1}`
        const phases =
          kind === 'relocate'
            ? [
                phaseRow(taskId, 'locate', 'Find it in the book'),
                phaseRow(taskId, 'guide', 'Write the walkthrough'),
              ]
            : [phaseRow(taskId, 'guide', 'Write the walkthrough')]
        const task: MockTask = {
          id: taskId,
          kind: 'question',
          status: 'running',
          bookId: null,
          homeworkId: hwId,
          questionId: qid,
          title: `Question ${question.position}`,
          phases,
          failKind: null,
          retryable: false,
          error: null,
          createdAt: new Date().toISOString(),
          startedAt: new Date().toISOString(),
          finishedAt: null,
        }
        phases[0].status = 'running'
        phases[0].note =
          kind === 'relocate' ? 'Reading page 143…' : 'Writing the walkthrough…'
        question.status = kind === 'relocate' ? 'locating' : 'writing'
        data.tasks = [...(data.tasks ?? []), task]
        json(res, 202, { task, question })
        publishTask(task)

        if (mode === 'stages') return
        setTimeout(() => {
          if (mode === 'fail') {
            task.status = 'failed'
            task.error = 'the model request failed. Check the connection under Settings'
            task.failKind = 'transient'
            task.retryable = true
            phases[phases.length - 1].status = 'failed'
            question.status = 'failed'
            question.error = task.error
          } else {
            for (const ph of phases) {
              ph.status = 'done'
              ph.done = 1
              ph.note = ''
            }
            task.status = 'done'
            task.finishedAt = new Date().toISOString()
            question.status = 'ready'
            question.error = null
            if (!question.guide) {
              question.page = question.page ?? 143
              question.guide = {
                reading: {
                  given: ['24 V source', '4 Ω and 6 Ω in series across it'],
                  find: 'the current through the 6 Ω',
                  figure: 'The source drives the loop clockwise, + at the top.',
                },
                setup: 'One loop, one unknown: Ohm’s law on the series pair [p. 143].',
                hints: ['Add the two resistances before dividing.'],
                steps: ['$R = 4 + 6 = 10\\ \\Omega$', '$i = 24/10 = 2.4$ A'],
                equations: [
                  { title: 'Ohm’s law', tex: 'v = iR', note: 'For a resistor carrying $i$.' },
                ],
                answer: '$i = 2.4\\ \\text{A}$',
              }
            }
          }
          publishTask(task)
        }, script.repairMs ?? 400)
      })
      return
    }

    if (/^\/api\/doctor$/.test(url.pathname) && (req.method === 'GET' || req.method === 'POST')) {
      const respond = () => {
        const mode = req.method === 'POST'
          ? script.doctorFix ?? script.doctor ?? 'healthy'
          : script.doctor ?? 'healthy'
        if (mode === 'fail') {
          json(res, 500, { error: 'doctor is unavailable', detail: ['database is locked'] })
          return
        }
        json(res, 200, doctorReport(mode))
      }
      if (script.doctorDelayMs) setTimeout(respond, script.doctorDelayMs)
      else respond()
      return
    }

    // --- ask: conversations and the scripted SSE answer ---------------------

    const bookConversationsMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/conversations$/)
    if (bookConversationsMatch && req.method === 'GET') {
      const sha = decodeURIComponent(bookConversationsMatch[1])
      const list = (data.conversations ?? [])
        .filter((c) => c.bookSha256 === sha)
        .map(({ messages: _messages, ...c }) => c)
      json(res, 200, { conversations: list })
      return
    }

    if (url.pathname === '/api/conversations' && req.method === 'GET') {
      const list = (data.conversations ?? []).map(({ messages: _messages, ...c }) => c)
      json(res, 200, { conversations: list })
      return
    }

    const convMatch = url.pathname.match(/^\/api\/conversations\/([^/]+)$/)
    if (convMatch) {
      const conv = (data.conversations ?? []).find(
        (c) => c.id === decodeURIComponent(convMatch[1]),
      )
      if (!conv) {
        json(res, 404, { error: 'no such conversation', detail: [] })
        return
      }
      if (req.method === 'GET') {
        const { messages, ...rest } = conv
        json(res, 200, { conversation: rest, messages: messages ?? [] })
        return
      }
      if (req.method === 'PATCH') {
        void readBody(req).then((raw) => {
          const patch = JSON.parse(raw || '{}') as { title?: string; pinned?: boolean }
          if (patch.title !== undefined) conv.title = patch.title
          if (patch.pinned !== undefined) conv.pinned = patch.pinned
          const { messages, ...rest } = conv
          json(res, 200, rest)
        })
        return
      }
    }

    const convDeleteMatch = url.pathname.match(/^\/api\/books\/([^/]+)\/conversations\/([^/]+)$/)
    if (convDeleteMatch && req.method === 'DELETE') {
      const id = decodeURIComponent(convDeleteMatch[2])
      data.conversations = (data.conversations ?? []).filter((c) => c.id !== id)
      json(res, 200, {})
      return
    }

    // The scripted answer: meta, deltas, optionally an equation envelope —
    // 'streaming' holds mid-thought so the skeleton state can be shot.
    if (/^\/api\/books\/[^/]+\/ask$/.test(url.pathname) && req.method === 'POST') {
      void readBody(req).then((raw) => {
        let body: { conversationId?: string | null; page?: number | null } = {}
        try {
          body = JSON.parse(raw || '{}')
        } catch {
          // an unreadable body still gets the scripted stream
        }
        if (script.ask === 'fail') {
          json(res, 500, { error: 'the model endpoint is unreachable', detail: [] })
          return
        }
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        })
        const send = (event: unknown) => res.write(`data: ${JSON.stringify(event)}\n\n`)
        const convId = body.conversationId ?? `conv-${(data.conversations?.length ?? 0) + 1}`
        const pages = body.page ? [body.page, 3] : [3, 12]
        send({ type: 'meta', conversationId: convId, pages })
        if (script.ask === 'streaming') {
          send({ type: 'delta', text: 'Let me read the pages first' })
          return
        }
        if (script.ask === 'tools') {
          send({ type: 'tool-start', id: 'c1', tool: 'calc', args: { expression: '0.42 * 3.1' } })
          send({
            type: 'tool-result',
            id: 'c1',
            tool: 'calc',
            args: { expression: '0.42 * 3.1' },
            ok: true,
            summary: '651/500  (1.30200)',
          })
          send({ type: 'tool-start', id: 's1', tool: 'search_book', args: { query: 'impulse momentum' } })
          send({
            type: 'tool-result',
            id: 's1',
            tool: 'search_book',
            args: { query: 'impulse momentum' },
            ok: true,
            summary: 'p. 12 — Impulse is the integral of force over the contact time…',
            pages: [12, 14],
          })
          send({ type: 'delta', text: 'The impulse is $1.30$ N·s (p. 12).\n' })
          send({ type: 'done', messageId: `msg-${Date.now()}` })
          res.end()
          return
        }
        send({ type: 'delta', text: 'A gavel is a manufactured clap ' })
        if (script.ask === 'envelopes') {
          send({ type: 'envelope-start', kind: 'equation' })
          send({
            type: 'envelope',
            kind: 'equation',
            payload: { title: 'Impact of a gavel', equations: ['I = m \\cdot v'], note: 'see [p. 12]' },
          })
        }
        send({ type: 'delta', text: '[p. 3], and page 12 works the numbers.' })
        send({ type: 'done', messageId: `msg-${Date.now()}` })
        res.end()
      })
      return
    }

    if (url.pathname === '/api/reset' && req.method === 'POST') {
      void readBody(req).then((body) => {
        const { apply } = JSON.parse(body) as { apply: boolean }
        const pages = data.books.reduce((n, b) => n + b.pageCount, 0)
        const finished = data.tasks.filter((t: MockTask) => t.status !== 'queued' && t.status !== 'running').length
        if (!apply) {
          json(res, 200, {
            books: data.books.length,
            pages,
            libraryFiles: data.books.length,
            finishedTasks: finished,
          })
          return
        }
        data.books = []
        data.tasks = []
        json(res, 200, { books: 0, pages: 0, libraryFiles: 0, finishedTasks: 0 })
      })
      return
    }

    if (url.pathname === '/api/events') {
      if (script.events === 'fail' || script.events === 'drop') {
        res.destroy()
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      })
      sseClients.add(res)
      // A real event, matching the server: an SSE comment is invisible to
      // EventSource, so a client watching for silence would tear a healthy
      // idle stream down every grace window.
      const ping = setInterval(() => res.write('data: {"type":"ping"}\n\n'), 15_000)
      req.on('close', () => {
        clearInterval(ping)
        sseClients.delete(res)
      })
      const snapshot = () => res.write(`data: ${JSON.stringify({ type: 'snapshot', tasks: data.tasks })}\n\n`)
      if (script.snapshotDelayMs) setTimeout(snapshot, script.snapshotDelayMs)
      else snapshot()
      return
    }

    if (url.pathname === '/api/books' && req.method === 'GET') {
      if (script.books === 'fail') {
        json(res, 500, { error: 'the library shelf collapsed', detail: ['store: disk I/O error while listing books'] })
        return
      }
      const send = () => json(res, 200, { books: data.books })
      if (script.booksDelayMs) setTimeout(send, script.booksDelayMs)
      else send()
      return
    }

    if (url.pathname === '/api/tasks' && req.method === 'GET') {
      json(res, 200, { tasks: data.tasks })
      return
    }

    if (url.pathname === '/api/import' && req.method === 'POST') {
      switch (script.importMode ?? 'accept') {
        case 'hang':
          return // never answer; the context close tears the socket down
        case 'duplicate':
          json(res, 200, { book: data.duplicateBook, task: null, duplicated: true })
          return
        case 'error':
          json(res, 500, {
            error: 'That PDF could not be read',
            detail: ['poppler: damaged xref table on page 1', 'gave up after 1 attempt'],
          })
          return
        case 'accept':
          json(res, 202, { book: null, task: data.acceptTask, duplicated: false })
          return
      }
    }

    if (url.pathname.startsWith('/api/')) {
      json(res, 501, { error: `visual mock has no handler for ${req.method} ${url.pathname}` })
      return
    }

    // Static SPA: exact files from dist, index.html fallback for client routes.
    const rel = url.pathname === '/' ? '/index.html' : url.pathname
    const file = resolve(join(absDist, rel))
    if (file.startsWith(absDist + sep)) {
      readFile(file)
        .then((buf) => {
          res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' })
          res.end(buf)
        })
        .catch(() => {
          if (extname(rel)) {
            res.writeHead(404)
            res.end()
            return
          }
          readFile(join(absDist, 'index.html'))
            .then((buf) => {
              res.writeHead(200, { 'Content-Type': MIME['.html'] })
              res.end(buf)
            })
            .catch(() => {
              res.writeHead(500)
              res.end('dist is missing; run the visual runner without --no-build')
            })
        })
      return
    }
    res.writeHead(404)
    res.end()
  })

  return new Promise((resolveListen, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      const { port } = server.address() as { port: number }
      resolveListen({
        port,
        apply(nextData, nextScript) {
          // Clone: some mock handlers mutate data (clear-finished, reset),
          // and the registry objects must stay pristine for the next apply.
          data = structuredClone(nextData)
          script = nextScript
          if (settleTimer) clearTimeout(settleTimer)
          if (script.homeworkSettleMs) {
            settleTimer = setTimeout(settleHomeworks, script.homeworkSettleMs)
          }
          // A mid-session apply (a state step re-seeding data) must reach
          // pages that are already connected: the real server streams task
          // changes, so the mock tells live subscribers to resnapshot. Pages
          // not yet open are unaffected — they snapshot on connect.
          if (sseClients.size > 0) {
            const snapshot = JSON.stringify({ type: 'snapshot', tasks: data.tasks })
            for (const client of sseClients) client.write(`data: ${snapshot}\n\n`)
          }
        },
        close() {
          // SSE connections never end on their own; drop every socket.
          server.closeAllConnections()
          return new Promise((done) => server.close(() => done()))
        },
      })
    })
  })
}
