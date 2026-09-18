import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Book } from '@/lib/types'

export function useBooks() {
  const [books, setBooks] = useState<Book[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Silent refresh: keeps the rendered list in place instead of flashing the
  // skeleton — used by the job-settled refetches and the Retry buttons.
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    api
      .books()
      .then((b) => {
        if (!cancelled) {
          setBooks(b)
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

  return { books, loading, error, refetch }
}
