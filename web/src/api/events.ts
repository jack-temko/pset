import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'

import { queryClient } from './query'

/**
 * The one live stream, `GET /api/events`. Each feature's module registers
 * what an event type does to the cache; this file only routes. The
 * browser resends `Last-Event-ID` on reconnect and the server replays what
 * was missed, or sends `reset` when too much was, and then everything is
 * refetched.
 */
type Handler = (data: any, qc: QueryClient) => void

const handlers = new Map<string, Handler[]>()

/** Register what an event type does. Call at module load. */
export function on<T>(type: string, fn: (data: T, qc: QueryClient) => void) {
  handlers.set(type, [...(handlers.get(type) ?? []), fn as Handler])
}

on('reset', (_, qc) => qc.invalidateQueries())

function dispatch(raw: string) {
  let msg: { type: string; data?: unknown }
  try {
    msg = JSON.parse(raw)
  } catch {
    return
  }
  for (const fn of handlers.get(msg.type) ?? []) fn(msg.data, queryClient)
}

/** Opens the stream for the life of the app. Mounted once, in App. */
export function useEventStream() {
  useEffect(() => {
    const es = new EventSource('/api/events')
    es.onmessage = (e) => dispatch(e.data)
    return () => es.close()
  }, [])
}
