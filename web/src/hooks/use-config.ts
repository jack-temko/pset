import { useCallback, useEffect, useState } from 'react'

import { api } from '@/lib/api'
import type { Config, ConfigPatch } from '@/lib/types'

export function useConfig() {
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState<Error | null>(null)
  const refetch = useCallback(() => setAttempt((n) => n + 1), [])

  useEffect(() => {
    let cancelled = false
    api
      .getConfig()
      .then((c) => {
        if (!cancelled) {
          setConfig(c)
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

  const save = useCallback(async (patch: ConfigPatch) => {
    setSaving(true)
    setSaved(false)
    setSaveError(null)
    try {
      const next = await api.updateConfig(patch)
      setConfig(next)
      setSaved(true)
      return next
    } catch (e) {
      setSaveError(e instanceof Error ? e : new Error(String(e)))
      return null
    } finally {
      setSaving(false)
    }
  }, [])

  return { config, loading, error, refetch, save, saving, saved, saveError }
}
