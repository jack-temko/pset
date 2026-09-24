import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { ApiError, del, get, patch, post } from './client'
import { on } from './events'
import type { Book, BookChanged, BookPatch, BookRemoved, Books, BookState, Contents, Phase } from './gen/library'
import { forget, observe } from '@/lib/eta'

export type * from './gen/library'

/** The five phases, in the words a student reads. */
export const IMPORT_PHASES: Record<Phase, string> = {
  examine: 'Examine the pages',
  read: 'Read the pages',
  contents: 'Read the contents',
  index: 'Index the sections',
  search: 'Build search',
}

export const libraryKeys = {
  books: ['books'] as const,
  book: (id: string) => ['books', id] as const,
  contents: (id: string) => ['books', id, 'contents'] as const,
}

export const useBooks = () =>
  useQuery({
    queryKey: libraryKeys.books,
    queryFn: () => get<Books>('/api/books').then((r) => r.books),
  })

export const useBook = (id: string) =>
  useQuery({ queryKey: libraryKeys.book(id), queryFn: () => get<Book>(`/api/books/${id}`) })

export const useContents = (id: string, enabled = true) =>
  useQuery({
    queryKey: libraryKeys.contents(id),
    queryFn: () => get<Contents>(`/api/books/${id}/contents`),
    enabled,
  })

/** A page scan at about `width` CSS pixels, snapped to the server's
 *  buckets so the same page at nearby sizes is one cached image. */
const BUCKETS = [600, 900, 1200, 1800, 2400]
export function pageImageURL(bookId: string, page: number, width: number) {
  const px = width * (window.devicePixelRatio || 1)
  const w = BUCKETS.find((b) => px <= b) ?? BUCKETS[BUCKETS.length - 1]
  return `/api/books/${bookId}/pages/${page}/image?w=${w}`
}

// ---------------------------------------------------------------- cache

/** Whether `b` is at least as new as `a`. Timestamps are the server's
 *  RFC 3339 with fixed-width nanoseconds, so they compare as strings. */
const newer = (b: Book, a: Book | undefined) => !a || b.updatedAt >= a.updatedAt

/** One book changed: patch it into the list and its own query, unless
 *  what's there is newer. An HTTP reply can land after an event that
 *  already moved the book on (an upload's "queued" after "preparing"). */
function putBook(qc: QueryClient, book: Book) {
  qc.setQueryData<Book[]>(libraryKeys.books, (list) => {
    if (!list) return list
    const i = list.findIndex((b) => b.id === book.id)
    if (i === -1) return [...list, book]
    if (!newer(book, list[i])) return list
    const next = list.slice()
    next[i] = book
    return next
  })
  if (newer(book, qc.getQueryData<Book>(libraryKeys.book(book.id)))) qc.setQueryData(libraryKeys.book(book.id), book)
  // Ready means the contents exist now; a retried import may redo them.
  if (book.state.kind === 'ready') qc.invalidateQueries({ queryKey: libraryKeys.contents(book.id) })
}

function dropBook(qc: QueryClient, id: string) {
  qc.setQueryData<Book[]>(libraryKeys.books, (list) => list?.filter((b) => b.id !== id))
  qc.removeQueries({ queryKey: libraryKeys.book(id) })
}

/** The step a book is in, for its time left (lib/eta): its import
 *  phase while preparing, none otherwise. */
export const bookStep = (s: BookState) => (s.kind === 'preparing' && s.phase ? `import:${s.phase}` : undefined)

on<BookChanged>('book.changed', (d, qc) => {
  observe(`book:${d.book.id}`, bookStep(d.book.state), d.book.state)
  putBook(qc, d.book)
})
on<BookRemoved>('book.removed', (d, qc) => {
  forget(`book:${d.id}`)
  dropBook(qc, d.id)
})

// ---------------------------------------------------------------- mutations

async function uploadOne(file: File): Promise<Book> {
  const body = new FormData()
  body.append('file', file)
  let res: Response
  try {
    res = await fetch('/api/books', { method: 'POST', body })
  } catch {
    throw new ApiError(0, { code: 'unreachable', message: "PSet's server isn't answering." })
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data ?? { code: 'internal', message: `The server answered ${res.status}.` })
  return (data as BookChanged).book
}

/** A refusal that names its file, as the duplicate error names its book. */
function refused(f: File, e: ApiError): ApiError {
  const message =
    e.message === "That isn't a PDF."
      ? `${f.name} isn't a PDF. PSet can only shelve PDF files.`
      : `${f.name}: ${e.message}`
  return new ApiError(e.status, { code: e.code, message, field: e.field, id: e.id })
}

/** Uploads files one after another. Each lands in the list as it's
 *  accepted; a book that's already on the shelf comes back as
 *  `duplicate`, with its id. */
export function useUploadBooks() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (files: File[]) => {
      const duplicates: string[] = []
      const errors: ApiError[] = []
      for (const f of files) {
        try {
          putBook(qc, await uploadOne(f))
        } catch (e) {
          if (e instanceof ApiError && e.code === 'duplicate_book' && e.id) duplicates.push(e.id)
          else if (e instanceof ApiError) errors.push(refused(f, e))
          else throw e
        }
      }
      return { duplicates, errors }
    },
  })
}

function bookAction(path: string) {
  return function useAction() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: (id: string) => post<Book>(`/api/books/${id}/${path}`),
      onSuccess: (b) => putBook(qc, b),
    })
  }
}

/** Stop a preparing import, or cancel a queued one: either way it stays
 *  as a failed row, and Try again is the undo. */
export const useStopImport = bookAction('stop')
export const useRetryImport = bookAction('retry')

/** Removes a book, or dismisses a failed import. */
export function useRemoveBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/api/books/${id}`),
    onSuccess: (_, id) => dropBook(qc, id),
  })
}

/** Title, author and offset apply at once, and roll back if the server
 *  refuses. */
export function useUpdateBook(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: BookPatch) => patch<Book>(`/api/books/${id}`, p),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: libraryKeys.book(id) })
      const before = qc.getQueryData<Book>(libraryKeys.book(id))
      if (before) putBook(qc, { ...before, ...p } as Book)
      return { before }
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.before) putBook(qc, ctx.before)
    },
    onSuccess: (b) => putBook(qc, b),
  })
}
