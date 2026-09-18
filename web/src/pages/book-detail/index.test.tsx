import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'

import { BookDetail } from './index'
import { api, ApiError } from '@/lib/api'
import type { Book, Conversation, Homework, Section } from '@/lib/types'

// jsdom has no EventSource; the shared task store needs one to subscribe to.
class FakeEventSource {
  static latest: FakeEventSource | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(_url: string) {
    FakeEventSource.latest = this
  }
  close() {}
}
vi.stubGlobal('EventSource', FakeEventSource)

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
    sections: 2,
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

const sections: Section[] = [
  { sortOrder: 1, level: 1, title: '4 Vectors', source: 'outline', startPage: 1, endPage: 8 },
  { sortOrder: 2, level: 2, title: '4.1 Dot products', source: 'outline', startPage: 3, endPage: 8 },
]

const asks: Conversation[] = [
  {
    id: 'conv-1',
    title: 'Why does the loop rule hold?',
    messageCount: 2,
    createdAt: ago(600),
    pinned: false,
    lastActivityAt: ago(30),
  },
]

const homeworks: Homework[] = [
  {
    id: 'hw-mine',
    bookId: book.id,
    bookSha256: book.sha256,
    bookTitle: book.title,
    title: 'Problem Set 3',
    dueDate: null,
    status: 'ready',
    turnedIn: false,
    questionCount: 4,
    questionScale: 100,
    figureScale: 100,
    createdAt: ago(600),
    updatedAt: ago(50),
  },
  {
    id: 'hw-other',
    bookId: 'book-2',
    bookSha256: 'bb22',
    bookTitle: 'Other Book',
    title: 'Someone else’s worksheet',
    dueDate: null,
    status: 'ready',
    turnedIn: false,
    questionCount: 2,
    questionScale: 100,
    figureScale: 100,
    createdAt: ago(600),
    updatedAt: ago(10),
  },
]

function mockDefaults(over: Partial<{ book: Book }> = {}) {
  const spies = {
    book: vi.spyOn(api, 'book'),
    sections: vi.spyOn(api, 'sections'),
    conversations: vi.spyOn(api, 'conversations'),
    homeworks: vi.spyOn(api, 'homeworks'),
  }
  spies.book.mockResolvedValue(over.book ?? book)
  spies.sections.mockResolvedValue(sections)
  spies.conversations.mockResolvedValue(asks)
  spies.homeworks.mockResolvedValue(homeworks)
  return spies
}

function renderDetail() {
  return render(
    <MemoryRouter initialEntries={[`/library/${book.sha256}`]}>
      <Routes>
        <Route path="/library/:bookId" element={<BookDetail />} />
        <Route path="*" element={<span>elsewhere</span>} />
      </Routes>
    </MemoryRouter>,
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('Book view', () => {
  it('renders the home: hero doors, chapter doors, and this book’s activity only', async () => {
    mockDefaults()
    renderDetail()
    await waitFor(() =>
      expect(screen.getAllByText('Calculus: Early Transcendentals').length).toBeGreaterThan(0),
    )

    expect(screen.getByRole('link', { name: /Open reader/ }).getAttribute('href')).toBe(
      '/library/aa11/read',
    )
    expect(screen.getByRole('link', { name: /Ask about this book/ }).getAttribute('href')).toBe(
      '/ask?book=aa11',
    )
    expect(screen.getByRole('link', { name: /Set homework/ }).getAttribute('href')).toBe(
      '/homework?book=aa11',
    )

    // Chapters are doors into the reader at their start pages.
    await waitFor(() => expect(screen.getByText('4 Vectors')).toBeTruthy())
    expect(screen.getByTitle('Open page 3 in the reader').getAttribute('href')).toBe(
      '/library/aa11/read?page=3',
    )

    // Activity shows this book's asks and homework, never another book's.
    expect(screen.getByText('Why does the loop rule hold?')).toBeTruthy()
    const mine = screen.getByText('Problem Set 3')
    expect(mine.closest('a')?.getAttribute('href')).toBe('/homework/hw-mine')
    expect(screen.queryByText('Someone else’s worksheet')).toBeNull()

    // The quiet details card carries the file identity.
    expect(screen.getByText('SHA-256')).toBeTruthy()
  })

  it('hides the hero doors and shows the readiness card while the book prepares', async () => {
    const spies = mockDefaults({
      book: {
        ...book,
        ready: false,
        readiness: { ...book.readiness, missing: 'read', sections: 0 },
      },
    })
    spies.sections.mockResolvedValue([])
    renderDetail()
    await waitFor(() => expect(screen.getByText('Not ready')).toBeTruthy())

    expect(screen.queryByRole('link', { name: /Open reader/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Ask about this book/ })).toBeNull()
    expect(screen.queryByRole('link', { name: /Set homework/ })).toBeNull()
    await waitFor(() => expect(screen.getByText(/Not worked out yet\./)).toBeTruthy())
  })

  it('says so when nothing has happened with the book yet', async () => {
    const spies = mockDefaults()
    spies.conversations.mockResolvedValue([])
    spies.homeworks.mockResolvedValue([])
    renderDetail()
    await waitFor(() =>
      expect(screen.getByText(/No questions or homework yet\./)).toBeTruthy(),
    )
  })

  it('keeps a friendly 404', async () => {
    const spies = mockDefaults()
    spies.book.mockRejectedValue(new ApiError(404, 'no book', []))
    renderDetail()
    await waitFor(() => expect(screen.getByText('Book not found')).toBeTruthy())
    expect(screen.getByRole('link', { name: /Back to library/ })).toBeTruthy()
  })
})
