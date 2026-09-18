import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { DoctorReport } from '@/lib/types'

export function useDoctor() {
  const [report, setReport] = useState<DoctorReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const refetch = useCallback(() => {
    setLoading(true)
    setAttempt((n) => n + 1)
  }, [])

  useEffect(() => {
    let cancelled = false
    api
      .doctor()
      .then((r) => {
        if (!cancelled) {
          setReport(r)
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

  return { report, loading, error, refetch }
}
