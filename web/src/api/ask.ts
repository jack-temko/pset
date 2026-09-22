import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { del, get, post } from './client'
import { on } from './events'
import type { Kind, Segment } from './gen/cards'
import type { Question, Turn, TurnCard, TurnCardStart, TurnChanged, TurnDelta, Turns, TurnsCleared } from './gen/ask'

export type * from './gen/ask'

/** A turn as the transcript holds it: what the server saved, plus what's
 *  streamed since, and the card being written right now, if any. */
export type LiveTurn = Turn & { pending?: { kind: Kind; repairing: boolean } }

export const askKeys = { turns: (bookId: string) => ['turns', bookId] as const }

export const useTurns = (bookId: string) =>
  useQuery({
    queryKey: askKeys.turns(bookId),
    queryFn: () => get<Turns>(`/api/books/${bookId}/turns`).then((r) => r.turns as LiveTurn[]),
  })

// ---------------------------------------------------------------- cache

function putTurn(qc: QueryClient, t: Turn) {
  qc.setQueryData<LiveTurn[]>(askKeys.turns(t.bookId), (list) => {
    if (!list) return list
    const i = list.findIndex((x) => x.id === t.id)
    if (i === -1) return [...list, t]
    // A card mid-write survives a step update; a settled turn has none.
    const pending = t.state === 'running' ? list[i].pending : undefined
    return list.map((x) => (x.id === t.id ? { ...t, pending } : x))
  })
}

/** Patch the turn wherever it is: stream events carry only its id. */
function patchTurn(qc: QueryClient, id: string, fn: (t: LiveTurn) => LiveTurn) {
  for (const [key, list] of qc.getQueriesData<LiveTurn[]>({ queryKey: ['turns'] })) {
    if (list?.some((t) => t.id === id)) qc.setQueryData(key, list.map((t) => (t.id === id ? fn(t) : t)))
  }
}

function appendProse(answer: Segment[], text: string): Segment[] {
  const last = answer[answer.length - 1]
  if (last?.type === 'prose') return [...answer.slice(0, -1), { ...last, text: (last.text ?? '') + text }]
  return [...answer, { type: 'prose', text }]
}

on<TurnChanged>('turn.changed', (d, qc) => putTurn(qc, d.turn))
on<TurnDelta>('turn.delta', (d, qc) => patchTurn(qc, d.turnId, (t) => ({ ...t, answer: appendProse(t.answer, d.text) })))
on<TurnCardStart>('turn.card.start', (d, qc) => patchTurn(qc, d.turnId, (t) => ({ ...t, pending: { kind: d.kind, repairing: false } })))
on<TurnCardStart>('turn.card.repairing', (d, qc) =>
  patchTurn(qc, d.turnId, (t) => ({ ...t, pending: { kind: d.kind, repairing: true } })),
)
on<TurnCard>('turn.card', (d, qc) =>
  patchTurn(qc, d.turnId, (t) => ({ ...t, pending: undefined, answer: [...t.answer, d.segment] })),
)
on<TurnsCleared>('turns.cleared', (d, qc) => qc.setQueryData(askKeys.turns(d.bookId), []))

// ---------------------------------------------------------------- mutations

export function useAsk(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (q: Question) => post<Turn>(`/api/books/${bookId}/turns`, q),
    onSuccess: (t) => putTurn(qc, t),
  })
}

export function useStopTurn() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => post<Turn>(`/api/turns/${id}/stop`),
    onSuccess: (t) => putTurn(qc, t),
  })
}

export function useClearTurns(bookId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => del<void>(`/api/books/${bookId}/turns`),
    onSuccess: () => qc.setQueryData(askKeys.turns(bookId), []),
  })
}
