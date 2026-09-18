import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { Reader } from './index'
import { api, ApiError } from '@/lib/api'
import type { Book, PageText, Section } from '@/lib/types'

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

const pageText = (n: number): PageText => ({
  sha256: book.sha256,
  page: n,
  text: `Page ${n} paragraph one.\n\nPage ${n} paragraph two.`,
})

function mockDefaults() {
  const spies = {
    book: vi.spyOn(api, 'book'),
    page: vi.spyOn(api, 'page'),
    sections: vi.spyOn(api, 'sections'),
  }
  spies.book.mockResolvedValue(book)
  spies.page.mockImplementation((_sha, n) => Promise.resolve(pageText(n)))
  spies.sections.mockResolvedValue(sections)
  return spies
}

const lastPageKey = `pset:reader:last-page:${book.sha256}`

function renderReader(entry = `/library/${book.sha256}/read`) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LocationProbe />
      <Routes>
        <Route path="/library/:bookId/read" element={<Reader />} />
      </Routes>
    </MemoryRouter>,
  )
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname + useLocation().search}</span>
}

const scanImage = (page: number) =>
  screen.getByRole('img', { name: `Page ${page} of ${book.title}` })

beforeEach(() => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
  localStorage.clear()
  cleanup()
})

describe('Reader', () => {
  it('opens on the scan and flips pages from the keyboard', async () => {
    mockDefaults()
    renderReader()
    await waitFor(() => expect(scanImage(1)).toBeTruthy())

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(scanImage(2)).toBeTruthy()
    expect((screen.getByLabelText('Go to page') as HTMLInputElement).value).toBe('2')
    expect(localStorage.getItem(lastPageKey)).toBe('2')

    fireEvent.keyDown(window, { key: 'ArrowLeft' })
    expect(scanImage(1)).toBeTruthy()
  })

  it('resumes where the book was left off', async () => {
    localStorage.setItem(lastPageKey, '5')
    mockDefaults()
    renderReader()
    await waitFor(() => expect(scanImage(5)).toBeTruthy())
  })

  it('lets ?page= win over memory and clears it on the first flip', async () => {
    localStorage.setItem(lastPageKey, '3')
    mockDefaults()
    renderReader(`/library/${book.sha256}/read?page=7`)
    await waitFor(() => expect(scanImage(7)).toBeTruthy())

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(scanImage(8)).toBeTruthy()
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe(`/library/${book.sha256}/read`),
    )
    expect(localStorage.getItem(lastPageKey)).toBe('8')
  })

  it('keeps Text mode across page flips and starts over on a fresh open', async () => {
    mockDefaults()
    const { unmount } = renderReader()
    await waitFor(() => expect(scanImage(1)).toBeTruthy())

    fireEvent.click(screen.getByRole('button', { name: 'Text' }))
    await waitFor(() => expect(screen.getByText('Page 1 paragraph one.')).toBeTruthy())
    expect(screen.queryByRole('img', { name: /Page 1 of/ })).toBeNull()

    fireEvent.keyDown(window, { key: 'ArrowRight' })
    await waitFor(() => expect(screen.getByText('Page 2 paragraph one.')).toBeTruthy())
    expect(screen.queryByRole('img', { name: /Page 2 of/ })).toBeNull()

    // A fresh open resets the mode to Scan but resumes at the last page.
    unmount()
    renderReader()
    await waitFor(() => expect(scanImage(2)).toBeTruthy())
    expect(screen.getByRole('button', { name: 'Scan' }).getAttribute('aria-pressed')).toBe('true')
  })

  it('says so when the scan is missing and hands over to the text', async () => {
    const spies = mockDefaults()
    spies.page.mockRejectedValue(new ApiError(404, 'no such page', []))
    renderReader()
    await waitFor(() => expect(scanImage(1)).toBeTruthy())

    fireEvent.error(scanImage(1))
    expect(screen.getByText('This page has no scan.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Read the text' }))
    expect(screen.getByText('This page has no text yet.')).toBeTruthy()
  })

  it('does not pull page text for a book that is not ready', async () => {
    const spies = mockDefaults()
    spies.book.mockResolvedValue({
      ...book,
      ready: false,
      readiness: { ...book.readiness, missing: 'read' },
      task: null,
    })
    renderReader()
    await waitFor(() => expect(screen.getByText('This book isn’t ready yet.')).toBeTruthy())
    expect(spies.page).not.toHaveBeenCalled()
  })

  it('jumps through the page field and guards the keyboard while typing', async () => {
    mockDefaults()
    renderReader()
    await waitFor(() => expect(scanImage(1)).toBeTruthy())

    const field = screen.getByLabelText('Go to page') as HTMLInputElement
    fireEvent.change(field, { target: { value: '3' } })
    fireEvent.keyDown(field, { key: 'Enter' })
    expect(scanImage(3)).toBeTruthy()

    // While the field has focus, arrow keys belong to it.
    fireEvent.change(field, { target: { value: '9' } })
    field.focus()
    fireEvent.keyDown(field, { key: 'ArrowRight' })
    expect(scanImage(3)).toBeTruthy()
    expect(field.value).toBe('9')

    // Blur commits the draft, then the keyboard works again.
    fireEvent.blur(field)
    expect(scanImage(9)).toBeTruthy()
    fireEvent.keyDown(window, { key: 'ArrowRight' })
    expect(scanImage(10)).toBeTruthy()
    expect(field.value).toBe('10')
  })
})
