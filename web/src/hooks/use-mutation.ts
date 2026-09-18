import { useCallback, useState } from 'react'

export type MutationState = 'idle' | 'loading' | 'success' | 'error'

/**
 * Tiny mutation hook for POST-style actions: tracks idle/loading/success/error
 * and keeps the last result or error in state. `mutate` never rejects — check
 * `state` / `error` instead — so callers don't need to catch.
 */
export function useMutation<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
) {
  const [state, setState] = useState<MutationState>('idle')
  const [data, setData] = useState<TResult | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const mutate = (...args: TArgs) => {
    setState('loading')
    setError(null)
    return fn(...args).then(
      (result) => {
        setData(result)
        setState('success')
        return result
      },
      (err: unknown) => {
        setData(null)
        setError(err instanceof Error ? err : new Error(String(err)))
        setState('error')
        return null
      },
    )
  }

  const reset = useCallback(() => {
    setState('idle')
    setData(null)
    setError(null)
  }, [])

  return { mutate, reset, state, data, error, loading: state === 'loading' }
}
