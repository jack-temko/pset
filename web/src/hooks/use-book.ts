import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Book, PageText } from '@/lib/types'

export function useBook(sha: string | undefined) {
  const [book, setBook] = useState<Book | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  // Silent refresh — see use-books.ts.
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!sha) return
    let cancelled = false
    api
      .book(sha)
      .then((b) => {
        if (!cancelled) {
          setBook(b)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setBook(null)
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

  return { book, loading, error, refetch }
}

export function useBookPage(sha: string | undefined, page: number) {
  const [text, setText] = useState<PageText | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refetch = useCallback(() => {
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    if (!sha) return
    let cancelled = false
    api
      .page(sha, page)
      .then((p) => {
        if (!cancelled) {
          setText(p)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setText(null)
          setError(e)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [sha, page, attempt])

  // Hide text belonging to a previous page while the new one is in flight.
  const stale = text !== null && text.page !== page
  return { text: stale ? null : text, loading, error, refetch }
}
