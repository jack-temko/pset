import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'

import { Homework as HomeworkPage } from './index'
import { api } from '@/lib/api'
import type { Book, Homework, Task } from '@/lib/types'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

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

function emit(ev: unknown) {
  FakeEventSource.latest?.onmessage?.({ data: JSON.stringify(ev) })
}

// Local Y-M-D: dueInfo parses due dates in local time, and a UTC string
// would read one day ahead in the evening.
const day = (offset: number) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dayOfMonth = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${m}-${dayOfMonth}`
}
const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString()

function hw(p: Partial<Homework> & Pick<Homework, 'id' | 'title'>): Homework {
  return {
    bookId: 'book-1',
    bookSha256: 'aa11',
    bookTitle: 'Calculus: Early Transcendentals',
    dueDate: null,
    status: 'ready',
    turnedIn: false,
    questionCount: 4,
    questionScale: 100,
    figureScale: 100,
    createdAt: ago(600),
    updatedAt: ago(30),
    ...p,
  }
}

const homeworks: Homework[] = [
  hw({ id: 'hw-1', title: 'Problem Set 3', dueDate: day(-1), updatedAt: ago(50) }),
  hw({ id: 'hw-2', title: 'Chapter 7 Exercises', dueDate: day(0), updatedAt: ago(180) }),
  hw({ id: 'hw-3', title: 'Reading Quiz 5', dueDate: day(12), updatedAt: ago(2880) }),
  hw({ id: 'hw-4', title: 'Problem Set 2', turnedIn: true, updatedAt: ago(4320) }),
  hw({
    id: 'hw-5',
    title: 'Vectors Worksheet',
    status: 'generating',
    questionCount: 0,
    questionScale: 100,
    figureScale: 100,
    dueDate: day(2),
    updatedAt: ago(5),
  }),
]

const book: Book = {
  id: 'book-1',
  sha256: 'aa11',
  title: 'Calculus: Early Transcendentals',
  author: 'James Stewart',
  subject: 'Mathematics',
  pageCount: 1328,
  ready: true,
  readiness: {
    pagesStored: 1328,
    pagesFailed: 0,
    pagesWithText: 1328,
    sections: 40,
    vectors: 1328,
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

function mockDefaults() {
  const spies = {
    homeworks: vi.spyOn(api, 'homeworks'),
    books: vi.spyOn(api, 'books'),
    createHomework: vi.spyOn(api, 'createHomework'),
  }
  spies.homeworks.mockResolvedValue(homeworks)
  spies.books.mockResolvedValue([book])
  return spies
}

function renderPage(entry = '/homework') {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/homework" element={<HomeworkPage />} />
        <Route path="*" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

function LocationProbe() {
  return <span data-testid="location">{useLocation().pathname}</span>
}

describe('Homework dashboard', () => {
  it('pre-picks the book when the dialog opens with ?book=', async () => {
    mockDefaults()
    renderPage('/homework?book=aa11')
    await waitFor(() => expect(screen.getAllByText('Problem Set 3').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: 'New homework' }))
    await screen.findByRole('dialog')
    // The picker already names the book instead of asking for one.
    expect(screen.queryByText('Choose a book')).toBeNull()
    expect(screen.getAllByText('Calculus: Early Transcendentals').length).toBeGreaterThan(0)
  })
  it('shows the due-soon strip over the complete list', async () => {
    mockDefaults()
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Problem Set 3').length).toBeGreaterThan(0))

    // Strip members (overdue, due today) render twice: card + row.
    await waitFor(() =>
      expect(screen.getAllByText('Problem Set 3').length).toBe(2),
    )
    expect(screen.getAllByText('Chapter 7 Exercises').length).toBe(2)
    // Later due date, turned-in and generating homework stay list-only.
    expect(screen.getAllByText('Reading Quiz 5').length).toBe(1)
    expect(screen.getAllByText('Problem Set 2').length).toBe(1)
    expect(screen.getAllByText('Vectors Worksheet').length).toBe(1)
  })

  it('filters by status and search, and clears back to everything', async () => {
    mockDefaults()
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Problem Set 3').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    expect(screen.queryByText('Problem Set 2')).toBeNull()
    expect(screen.getAllByText('Problem Set 3').length).toBeGreaterThan(0)

    fireEvent.change(screen.getByLabelText('Search homework'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nothing matches.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }))
    expect(screen.getByText('Problem Set 2')).toBeTruthy()
  })

  it('creates homework and lands in the workspace', async () => {
    const spies = mockDefaults()
    spies.createHomework.mockResolvedValue({
      homework: hw({ id: 'hw-9', title: 'Problem Set 4' }),
      task: { id: 'task-9' } as Task,
    })
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Problem Set 3').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: 'New homework' }))
    await screen.findByRole('dialog')
    const create = screen.getByRole('button', { name: 'Create homework' }) as HTMLButtonElement
    expect(create.disabled).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Choose a book' }))
    const popoverItem = await screen.findAllByText('Calculus: Early Transcendentals')
    fireEvent.click(popoverItem.at(-1)!.closest('button')!)
    fireEvent.change(screen.getByLabelText('Assignment text'), {
      target: { value: '1. Differentiate everything.' },
    })
    expect(create.disabled).toBe(false)
    fireEvent.click(create)

    await waitFor(() => expect(spies.createHomework).toBeTruthy())
    await waitFor(() =>
      expect(screen.getByTestId('location').textContent).toBe('/homework/hw-9'),
    )
  })

  it('refetches when a homework build settles on the stream', async () => {
    const spies = mockDefaults()
    spies.homeworks.mockResolvedValueOnce([
      hw({ id: 'hw-5', title: 'Vectors Worksheet', status: 'generating', questionCount: 0 }),
    ])
    spies.homeworks.mockResolvedValueOnce([
      hw({ id: 'hw-5', title: 'Vectors Worksheet', questionCount: 3 }),
    ])
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Vectors Worksheet').length).toBeGreaterThan(0))

    // The row counts walkthroughs rather than saying "generating": an
    // assignment is a list, and how far along it is is the useful fact.
    emit({
      type: 'snapshot',
      tasks: [
        {
          id: 'task-hw-5',
          kind: 'homework',
          status: 'running',
          homeworkId: 'hw-5',
          phases: [
            { id: 'p1', taskId: 'task-hw-5', key: 'walkthroughs', status: 'running', done: 1, total: 3 },
          ],
        },
      ],
    })
    await act(async () => {})
    await waitFor(() => expect(screen.getByText('1 of 3 walkthroughs')).toBeTruthy())

    // The settle hook must observe the task running before it settles; flush
    // the effects between the two stream events.
    await act(async () => {
      emit({
        type: 'task',
        task: {
          id: 'task-hw-5',
          kind: 'homework',
          status: 'done',
          homeworkId: 'hw-5',
          phases: [],
        },
      })
    })

    // The settle refetch resolves asynchronously, and both the title and the
    // missing walkthrough badge are already true on the pre-refetch DOM —
    // wait for the refetched count itself, not for a condition that holds
    // before the refetch lands.
    await waitFor(() => expect(screen.getByText('3').textContent).toBe('3'))
    expect(screen.queryByText('1 of 3 walkthroughs')).toBeNull()
  })

  it('points at the library when no books exist yet', async () => {
    const spies = mockDefaults()
    spies.books.mockResolvedValue([])
    renderPage()
    await waitFor(() => expect(screen.getAllByText('Problem Set 3').length).toBeGreaterThan(0))

    fireEvent.click(screen.getByRole('button', { name: 'New homework' }))
    await waitFor(() => expect(screen.getByText('No books yet.')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Create homework' })).toBeNull()
    expect(screen.getByText('Go to the library')).toBeTruthy()
  })
})
