import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Health } from '@/lib/types'

export function useHealth() {
  const [health, setHealth] = useState<Health | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    api
      .health()
      .then((h) => {
        if (!cancelled) {
          setHealth(h)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { health, error, refetch }
}
