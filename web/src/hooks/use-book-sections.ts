import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Section } from '@/lib/types'

export function useBookSections(sha: string | undefined) {
  const [sections, setSections] = useState<Section[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Silent refresh — see use-books.ts.
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!sha) return
    let cancelled = false
    api
      .sections(sha)
      .then((s) => {
        if (!cancelled) {
          setSections(s)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setSections(null)
          setError(e)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sha, attempt])

  return { sections, loading, error, refetch }
}
