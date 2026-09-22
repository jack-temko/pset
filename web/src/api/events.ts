import { useEffect, useSyncExternalStore } from 'react'
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

// The stream's reachability, so the shell can own a lost-touch banner.
// EventSource reconnects on its own; it errors the moment the connection
// falls and opens again when a retry lands.
let live = true
const watchers = new Set<() => void>()

function setLive(up: boolean) {
  if (live === up) return
  live = up
  for (const w of watchers) w()
}

/** True while `/api/events` is connected; false from the first failed
 *  reconnect until the stream opens again. */
export function useLiveStream() {
  return useSyncExternalStore(
    (onChange) => {
      watchers.add(onChange)
      return () => {
        watchers.delete(onChange)
      }
    },
    () => live,
  )
}

/** Opens the stream for the life of the app. Mounted once, in App. */
export function useEventStream() {
  useEffect(() => {
    let es: EventSource
    let retry: ReturnType<typeof setTimeout> | undefined
    let wait = 1000
    const open = () => {
      es = new EventSource('/api/events')
      es.onopen = () => {
        wait = 1000
        setLive(true)
      }
      es.onerror = () => {
        setLive(false)
        // A refusal (a proxy's 502 while the server restarts) closes the
        // stream for good; EventSource only retries dropped connections.
        // Reopen it ourselves, backing off, so the banner stays honest.
        if (es.readyState !== EventSource.CLOSED) return
        retry = setTimeout(open, wait)
        wait = Math.min(wait * 2, 30000)
      }
      es.onmessage = (e) => dispatch(e.data)
    }
    open()
    return () => {
      clearTimeout(retry)
      es.close()
    }
  }, [])
}
