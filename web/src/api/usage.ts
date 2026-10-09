import { useQuery, type QueryClient } from '@tanstack/react-query'

import { get } from './client'
import { on } from './events'
import type { BookUsage, Detail } from './gen/usage'

export type * from './gen/usage'

/** What a job's usage is of: a homework question, an assignment read or an
 *  Ask turn. The server keeps each under its own id. */
export type UsageSource = { kind: 'question' | 'read' | 'turn'; id: string }

const paths: Record<UsageSource['kind'], string> = {
  question: '/api/questions',
  read: '/api/assignment-reads',
  turn: '/api/turns',
}

const detailQuery = (source: UsageSource) => ({
  queryKey: ['usage', source.kind, source.id],
  queryFn: () => get<Detail | null>(`${paths[source.kind]}/${source.id}/usage`),
})

const bookQuery = (bookId: string) => ({
  queryKey: ['usage', 'book', bookId],
  queryFn: () => get<BookUsage | null>(`/api/books/${bookId}/usage`),
})

/** A job's detail, fetched when its modal opens. It stays cached, so the
 *  second open is instant; the event stream marks it stale when a job
 *  changes, and it refreshes in place. */
export const useUsageDetail = (source: UsageSource, enabled: boolean) => useQuery({ ...detailQuery(source), enabled })

/** What a whole book has cost, fetched when its dialog opens; cached like a
 *  job's detail. */
export const useBookUsage = (bookId: string, enabled: boolean) => useQuery({ ...bookQuery(bookId), enabled })

/** Starts a job's detail loading before its modal opens (as the pointer
 *  reaches the trigger). Nothing happens when it is already cached. */
export const prefetchUsageDetail = (client: QueryClient, source: UsageSource) => client.prefetchQuery(detailQuery(source))

/** The same for a book's usage aggregate. */
export const prefetchBookUsage = (client: QueryClient, bookId: string) => client.prefetchQuery(bookQuery(bookId))

// A job that finished, or a book that changed, has spent something: mark
// every cached usage stale. What is open refetches and swaps in place; the
// rest refetches when it is next opened, showing the old figures meanwhile.
const stale = (_: unknown, qc: QueryClient) => void qc.invalidateQueries({ queryKey: ['usage'] })
for (const type of ['question.changed', 'assignment.changed', 'turn.changed', 'book.changed']) on(type, stale)
