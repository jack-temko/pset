import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ImportDialog } from './import-dialog'
import { api } from '@/lib/api'
import type { Book, Task } from '@/lib/types'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

const task: Task = {
  id: 't1',
  kind: 'prepare',
  status: 'queued',
  bookId: 'b1',
  homeworkId: null,
  title: 'Lecture Notes on Analysis',
  phases: [],
  failKind: null,
  retryable: false,
  error: null,
  createdAt: '2026-09-15T00:00:00Z',
  startedAt: null,
  finishedAt: null,
}

const book: Book = {
  id: 'b1',
  sha256: 'sha-dup',
  title: 'Already Book',
  author: 'A. Author',
  subject: 'Math',
  pageCount: 10,
  ready: true,
  readiness: {
    pagesStored: 10,
    pagesFailed: 0,
    pagesWithText: 10,
    sections: 3,
    vectors: 10,
    missing: '',
  },
  failedPages: [],
  task: null,
  kind: 'digital',
  pdfVersion: '1.4',
  pageWidth: 600,
  pageHeight: 800,
  fileSize: 1000,
  originPath: '/tmp/a.pdf',
  libraryPath: '/tmp/library.pdf',
  importedAt: '2026-09-15T00:00:00Z',
}

function renderDialog() {
  const onOpenChange = vi.fn()
  render(
    <MemoryRouter>
      <ImportDialog open onOpenChange={onOpenChange} />
    </MemoryRouter>,
  )
  return onOpenChange
}

function pickFile(name = 'book.pdf', type = 'application/pdf') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement
  fireEvent.change(input, { target: { files: [new File(['x'], name, { type })] } })
}

function mockUpload(result: { book: Book | null; task: Task | null; duplicated: boolean }) {
  const spy = vi.spyOn(api, 'importUpload') as unknown as {
    mockResolvedValue: (r: unknown) => unknown
  }
  spy.mockResolvedValue(result)
}

async function uploadOnce(result?: Parameters<typeof mockUpload>[0]) {
  mockUpload(result ?? { book: null, task, duplicated: false })
  const onOpenChange = renderDialog()
  const events = vi.spyOn(window, 'dispatchEvent')
  pickFile()
  await act(async () => {})
  return { onOpenChange, events }
}

describe('ImportDialog', () => {
  it('accepts an upload: queue confirmation, next steps, and a stay-open dialog', async () => {
    const { onOpenChange } = await uploadOnce()
    expect(screen.getByText('Added to the queue')).toBeTruthy()
    expect(screen.getByText('What happens next')).toBeTruthy()
    expect(screen.getByText('Examine the pages')).toBeTruthy()
    expect(screen.getByText('Build search')).toBeTruthy()
    expect(screen.getByText('View task')).toBeTruthy()
    expect(screen.getByText('Import another')).toBeTruthy()
    // No auto-close: the standard close button and the user own the window.
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('swaps the intake header out on the accepted view', async () => {
    await uploadOnce()
    expect(screen.queryByText('Import a textbook')).toBeNull()
  })

  it('returns to the drop zone via Import another without closing', async () => {
    const { onOpenChange } = await uploadOnce()
    fireEvent.click(screen.getByText('Import another'))
    expect(screen.getByText('Drop a PDF here')).toBeTruthy()
    expect(screen.getByText('Import a textbook')).toBeTruthy()
    expect(onOpenChange).not.toHaveBeenCalled()
  })

  it('closes via Done', async () => {
    const { onOpenChange } = await uploadOnce()
    fireEvent.click(screen.getByText('Done'))
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('shows the duplicate view without the intake header', async () => {
    await uploadOnce({ book, task: null, duplicated: true })
    expect(screen.getByText('Already in your library')).toBeTruthy()
    expect(screen.getByText('Open book')).toBeTruthy()
    expect(screen.queryByText('Import a textbook')).toBeNull()
  })

  it('rejects non-PDF files inline without any upload', async () => {
    const spy = vi.spyOn(api, 'importUpload')
    renderDialog()
    pickFile('picture.png', 'image/png')
    expect(screen.getByText(/doesn’t look like a PDF/)).toBeTruthy()
    expect(spy).not.toHaveBeenCalled()
  })
})
