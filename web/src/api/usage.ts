import { useQuery } from '@tanstack/react-query'

import { get } from './client'
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

/** A job's detail, fetched when its modal opens and every time it does: a
 *  retry or a rewrite adds calls, so nothing here is kept. */
export const useUsageDetail = (source: UsageSource, enabled: boolean) =>
  useQuery({
    queryKey: ['usage', source.kind, source.id],
    queryFn: () => get<Detail | null>(`${paths[source.kind]}/${source.id}/usage`),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })

/** What a whole book has cost, fetched when its dialog opens. */
export const useBookUsage = (bookId: string, enabled: boolean) =>
  useQuery({
    queryKey: ['usage', 'book', bookId],
    queryFn: () => get<BookUsage | null>(`/api/books/${bookId}/usage`),
    enabled,
    staleTime: 0,
    gcTime: 0,
  })
