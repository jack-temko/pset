import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Conversation } from '@/lib/types'

export function useConversations() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    api
      .allConversations()
      .then((c) => {
        if (!cancelled) {
          setConversations(c)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setConversations(null)
          setError(e)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  return { conversations, loading, error, refetch }
}

/** One book's ask history — the book page's activity rows. */
export function useBookConversations(sha: string | undefined) {
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    if (!sha) return
    let cancelled = false
    api
      .conversations(sha)
      .then((c) => {
        if (!cancelled) {
          setConversations(c)
          setError(null)
        }
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setConversations(null)
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

  return { conversations, loading, error, refetch }
}
