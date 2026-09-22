import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { del, get, post } from './client'
import { on } from './events'
import type { Memories, Memory, NewMemory, Removed, Saved } from './gen/memory'

export type { Memory, NewMemory, Source } from './gen/memory'
export type { Kind as MemoryKind } from './gen/memory'

/**
 * A book's memory: what the tutor knows about it from working in it.
 * Saves arrive as `memory.saved` (the tutor's, mid-answer, as well as
 * yours) and deletes as `memory.removed`. Spec: design/memory.md.
 */
export const memoryKeys = { list: (bookId: string) => ['memories', bookId] as const }

export const useMemories = (bookId: string) =>
  useQuery({
    queryKey: memoryKeys.list(bookId),
    queryFn: () => get<Memories>(`/api/books/${bookId}/memories`).then((r) => r.memories),
  })

// ---------------------------------------------------------------- cache

/** Newest first, as the server lists them; a replaced memory is new again. */
function putMemory(qc: QueryClient, m: Memory) {
  qc.setQueryData<Memory[]>(memoryKeys.list(m.bookId), (list) => {
    if (!list) return list
    const rest = list.filter((x) => x.id !== m.id)
    return [m, ...rest].sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  })
}

function dropMemory(qc: QueryClient, id: string, bookId: string) {
  qc.setQueryData<Memory[]>(memoryKeys.list(bookId), (list) => list?.filter((x) => x.id !== id))
}

on<Saved>('memory.saved', (d, qc) => putMemory(qc, d.memory))
on<Removed>('memory.removed', (d, qc) => dropMemory(qc, d.id, d.bookId))

// ---------------------------------------------------------------- mutations

export function useAddMemory(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (m: NewMemory) => post<Memory>(`/api/books/${bookId}/memories`, m),
    onSuccess: (m) => putMemory(qc, m),
  })
}

/** Delete, or Undo a save: gone at once, back if the server says no. */
export function useRemoveMemory(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => del<void>(`/api/memories/${id}`),
    onMutate: (id) => {
      const before = qc.getQueryData<Memory[]>(memoryKeys.list(bookId))
      dropMemory(qc, id, bookId)
      return { before }
    },
    onError: (_e, _v, ctx) => ctx?.before && qc.setQueryData(memoryKeys.list(bookId), ctx.before),
  })
}
