import { useCallback, useEffect, useRef, useState } from 'react'

import { useTasks } from '@/lib/events'
import { isActiveTask } from '@/lib/tasks'
import { api } from '@/lib/api'
import type { Homework } from '@/lib/types'

export function useHomeworks() {
  const [homeworks, setHomeworks] = useState<Homework[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Silent refresh: keeps the rendered list in place instead of flashing the
  // skeleton — used by mutations and the Retry button.
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    api
      .homeworks()
      .then((hs) => {
        if (!cancelled) {
          setHomeworks(hs)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { homeworks, loading, error, refetch }
}

/** Calls refetch whenever a homework task that was running stops running, so
 *  the dashboard reflects a finished assignment without a reload. Tracking by
 *  identity rather than by count means a task finishing as another starts is
 *  still noticed. */
export function useRefetchOnHomeworkSettle(refetch: () => void): void {
  const { tasks } = useTasks()
  const seen = useRef<Set<string>>(new Set<string>())

  useEffect(() => {
    const active = new Set<string>(
      (tasks ?? []).filter((t) => t.kind === 'homework' && isActiveTask(t)).map((t) => t.id),
    )
    let settled = false
    for (const id of seen.current) {
      if (!active.has(id)) settled = true
    }
    seen.current = active
    if (settled) refetch()
  }, [tasks, refetch])
}
