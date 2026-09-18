import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Ask, AssistantMessage, type ChatMsg } from './index'
import { api, askBook } from '@/lib/api'
import { applyAskEvent, type StreamSegment } from '@/lib/ask-stream'
import type { Book, Config, Conversation, Message } from '@/lib/types'

// The streamed ask is a fetch SSE; page tests drive it through this mock
// and decide per test which events fire and whether the stream fails.
vi.mock('@/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/lib/api')>()
  return { ...mod, askBook: vi.fn() }
})

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

const book: Book = {
  id: 'book-1',
  sha256: 'aa11',
  title: 'Calculus: Early Transcendentals',
  author: 'James Stewart',
  subject: 'Mathematics',
  pageCount: 12,
  ready: true,
  readiness: {
    pagesStored: 12,
    pagesFailed: 0,
    pagesWithText: 12,
    sections: 4,
    vectors: 12,
    missing: '',
  },
  failedPages: [],
  task: null,
  kind: 'digital',
  pdfVersion: '1.7',
  pageWidth: 612,
  pageHeight: 792,
  fileSize: 48_200_000,
  originPath: '/home/jackt/Books/calc.pdf',
  libraryPath: '/home/jackt/.pset/library/aa11.pdf',
  importedAt: ago(600),
}

const config: Config = {
  apiBaseURL: 'http://127.0.0.1:8080',
  hasAPIKey: true,
  embedBaseURL: 'http://127.0.0.1:8080',
  embedModel: 'bge-m3',
}

const conversations: Conversation[] = [
  {
    id: 'conv-1',
    title: 'What is a gavel?',
    messageCount: 2,
    createdAt: ago(600),
    pinned: true,
    lastActivityAt: ago(30),
    bookSha256: book.sha256,
    bookTitle: book.title,
  },
]

const settledMessages: Message[] = [
  {
    id: 'm1',
    role: 'user',
    content: 'What is a gavel?',
    segments: [],
    citations: null,
    createdAt: ago(31),
  },
  {
    id: 'm2',
    role: 'assistant',
    content: '',
    segments: [{ type: 'prose', text: 'A gavel is a manufactured clap [p. 3].' }],
    citations: [3],
    createdAt: ago(30),
  },
]

function mockPage() {
  vi.spyOn(api, 'books').mockResolvedValue([book])
  vi.spyOn(api, 'getConfig').mockResolvedValue(config)
  vi.spyOn(api, 'allConversations').mockResolvedValue(conversations)
  vi.spyOn(api, 'conversationById').mockResolvedValue({
    conversation: conversations[0],
    messages: [...settledMessages],
  })
}

function renderAsk(entry = '/ask') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/ask" element={<Ask />} />
      </Routes>
    </MemoryRouter>,
  )
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname + useLocation().search}</span>
}

/** The happy stream: meta names the conversation, one prose delta lands. */
function streamHappy(conversationId: string | null) {
  vi.mocked(askBook).mockImplementation(
    (_sha, _body, onEvent) =>
      new Promise<void>((resolve) => {
        queueMicrotask(() => {
          onEvent({ type: 'meta', conversationId: conversationId ?? 'conv-new', pages: [3] })
          onEvent({ type: 'delta', text: 'A gavel is a manufactured clap (p. 3).' })
          onEvent({ type: 'done', messageId: 'm-new' })
          resolve()
        })
      }),
  )
}

function renderMsg(segments: StreamSegment[], opts: { streaming?: boolean } = {}) {
  const msg: ChatMsg = { id: 'm1', role: 'assistant', segments, citations: [] }
  return render(
    <MemoryRouter>
      <AssistantMessage msg={msg} sha="sha123" streaming={opts.streaming ?? false} readingPages={null} />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

function bodyContains(fragment: string): boolean {
  return (document.body.textContent ?? '').includes(fragment)
}

/** Drives a full envelope lifecycle the way the SSE events arrive. */
function events(kind: 'equation' | 'steps' | 'theorem' | 'definition' | 'note'): StreamSegment[] {
  let segs: StreamSegment[] = applyAskEvent([], { type: 'delta', text: 'From the book [p. 3].\n' })
  segs = applyAskEvent(segs, { type: 'envelope-start', kind })
  segs = applyAskEvent(segs, { type: 'envelope', kind, payload: payloadFor(kind) })
  segs = applyAskEvent(segs, { type: 'delta', text: ' Done [p. 4].' })
  return segs
}

function payloadFor(kind: 'equation' | 'steps' | 'theorem' | 'definition' | 'note') {
  switch (kind) {
    case 'equation':
      return { title: "Bayes' theorem", equations: ['P(A\\mid B) = 1'], note: 'see [p. 12]' }
    case 'steps':
      return { title: 'Solving', steps: ['Subtract 3: $2x = 8$ [p. 12].', 'Divide by 2: $x = 4$.'] }
    case 'theorem':
      return { title: 'Pythagorean theorem', statement: 'Right triangles satisfy $a^2 + b^2 = c^2$ [p. 40].' }
    case 'definition':
      return { title: 'Derivative', statement: 'A limit of difference quotients.' }
    case 'note':
      return { title: 'Common mistake', body: ['Never cancel $\sin$.'] }
  }
}

describe('AssistantMessage', () => {
  it('renders prose with citation chips and an equation envelope with display math', () => {
    renderMsg(events('equation'))
    expect(screen.getByText("Bayes' theorem")).toBeTruthy()
    expect(screen.getByText('Equation')).toBeTruthy()
    // Bare TeX went straight through KaTeX display mode: no $$ survived.
    expect(document.querySelector('.katex-display')).toBeTruthy()
    expect(document.body.textContent).not.toContain('$$')
    // The note is a text field: its citation became a chip, like prose.
    expect(bodyContains('see')).toBeTruthy()
    expect(screen.getByTitle('Page 12')).toBeTruthy()
    expect(screen.getByTitle('Page 3')).toBeTruthy()
  })

  it('renders steps with their numbers and inline math', () => {
    renderMsg(events('steps'))
    expect(screen.getByText('Worked steps')).toBeTruthy()
    expect(screen.getByText('Solving')).toBeTruthy()
    expect(bodyContains('Subtract 3:')).toBeTruthy()
    expect(screen.getByTitle('Page 12')).toBeTruthy()
    expect(document.querySelector('.katex')).toBeTruthy()
  })

  it('renders theorem and definition cards', () => {
    renderMsg(events('theorem'))
    expect(screen.getByText('Theorem')).toBeTruthy()
    expect(screen.getByText('Pythagorean theorem')).toBeTruthy()

    cleanup()
    renderMsg(events('definition'))
    expect(screen.getByText('Definition')).toBeTruthy()
    expect(screen.getByText('Derivative')).toBeTruthy()
  })

  it('renders a note card', () => {
    renderMsg(events('note'))
    expect(screen.getByText('Note')).toBeTruthy()
    expect(screen.getByText('Common mistake')).toBeTruthy()
    expect(bodyContains('Never cancel')).toBeTruthy()
    expect(document.querySelector('.katex')).toBeTruthy()
  })

  it('shows the writing label while an envelope streams and swaps to the repairing label', () => {
    let segs = applyAskEvent([], { type: 'envelope-start', kind: 'equation' })
    const first = render(
      <MemoryRouter>
        <AssistantMessage msg={{ id: null, role: 'assistant', segments: segs }} sha="s" streaming readingPages={null} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Writing an equation…')).toBeTruthy()
    first.unmount()

    segs = applyAskEvent(segs, { type: 'envelope-repairing', kind: 'equation' })
    render(
      <MemoryRouter>
        <AssistantMessage msg={{ id: null, role: 'assistant', segments: segs }} sha="s" streaming readingPages={null} />
      </MemoryRouter>,
    )
    expect(screen.getByText('Tidying an equation…')).toBeTruthy()
    expect(screen.queryByText('Writing an equation…')).toBeNull()
  })

  it('degrades a failed envelope to a muted code block with the raw payload', () => {
    let segs = applyAskEvent([], { type: 'envelope-start', kind: 'note' })
    segs = applyAskEvent(segs, { type: 'envelope-failed', kind: 'note', raw: '{"broken": true' })
    renderMsg(segs)
    expect(screen.queryByText('Note')).toBeNull()
    const code = document.querySelector('pre')
    expect(code?.textContent).toBe('{"broken": true')
  })

  it('shows the thinking status while nothing has streamed yet', () => {
    renderMsg([], { streaming: true })
    expect(screen.getByText('Thinking…')).toBeTruthy()
  })
})

describe('Ask page', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.mocked(askBook).mockReset()
    cleanup()
  })

  it('picks a book on the landing, sends a clean question, and lands in the thread', async () => {
    mockPage()
    streamHappy(null)
    renderAsk()
    await waitFor(() => expect(screen.getByText('What do you want to learn?')).toBeTruthy())

    // Send stays gated until a book is picked.
    expect(
      (screen.getByRole('button', { name: 'Send question' }) as HTMLButtonElement).disabled,
    ).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Choose a book' }))
    const item = await screen.findAllByText('Calculus: Early Transcendentals')
    fireEvent.click(item[item.length - 1]!.closest('button')!)
    fireEvent.change(screen.getByLabelText('Ask a question'), {
      target: { value: 'What is a gavel?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))

    await waitFor(() => expect(vi.mocked(askBook)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(askBook).mock.calls[0][1]).toEqual({
      question: 'What is a gavel?',
      conversationId: null,
      page: undefined,
    })
    // The meta named the conversation, so the URL carries it now.
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/ask?book=aa11&c=conv-new'),
    )
    await waitFor(() =>
      expect(document.body.textContent).toContain('A gavel is a manufactured clap'),
    )
  })

  it('carries the page anchor in the request, not the question', async () => {
    mockPage()
    streamHappy('conv-1')
    // The post-stream settle refetches the thread; it shows the clean question.
    vi.spyOn(api, 'conversationById').mockResolvedValue({
      conversation: conversations[0],
      messages: [
        { id: 'm1', role: 'user', content: 'Why this step?', segments: [], citations: null, createdAt: ago(5) },
        {
          id: 'm2',
          role: 'assistant',
          content: '',
          segments: [{ type: 'prose', text: 'Because page 42 says so.' }],
          citations: [42],
          createdAt: ago(4),
        },
      ],
    })
    renderAsk('/ask?book=aa11&page=42')
    await waitFor(() => expect(document.body.textContent).toContain('Asking about page 42'))

    fireEvent.change(screen.getByLabelText('Ask a question'), {
      target: { value: 'Why this step?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))

    await waitFor(() => expect(vi.mocked(askBook)).toHaveBeenCalledTimes(1))
    expect(vi.mocked(askBook).mock.calls[0][1].page).toBe(42)
    expect(vi.mocked(askBook).mock.calls[0][1].question).toBe('Why this step?')
    await waitFor(() =>
      expect(document.body.textContent).not.toContain('Asking about page 42'),
    )
    expect(screen.getByText('Why this step?')).toBeTruthy()
  })

  it('retries a failed stream with the same question and anchor', async () => {
    mockPage()
    vi.mocked(askBook)
      .mockRejectedValueOnce(new Error('the model wobbled'))
      .mockImplementation(() => Promise.resolve())
    renderAsk('/ask?book=aa11')
    fireEvent.change(await screen.findByLabelText('Ask a question'), {
      target: { value: 'Why?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))

    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy())
    expect(screen.getByText('the model wobbled')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(vi.mocked(askBook)).toHaveBeenCalledTimes(2))
    expect(vi.mocked(askBook).mock.calls[1][1].question).toBe('Why?')
  })

  it('keeps one door to a new conversation, in the top bar', async () => {
    mockPage()
    renderAsk('/ask?c=conv-1')
    await waitFor(() =>
      expect(document.body.textContent).toContain('Calculus: Early Transcendentals'),
    )
    // The rail is pure history; the top bar Plus is the only New door.
    expect(screen.getAllByRole('button', { name: 'New conversation' })).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'New conversation' }))
    await waitFor(() => expect(screen.getByText('What do you want to learn?')).toBeTruthy())
    expect(screen.getByTestId('location').textContent).toBe('/ask')
  })
})
