import { useCallback, useState, useSyncExternalStore } from 'react'

/**
 * How long a state that might be over in a moment has to last before it
 * shows. Handoffs between the engine's steps take 5 to 150ms and a local
 * endpoint answers in about 20; a real wait still reads as immediate.
 */
export const GRACE_MS = 300

/**
 * A value as it should show when it may be brief: a book queued between
 * two of its steps, a request still in flight. Nothing flickers.
 *
 * `since` is when the value began to be one of those (ms since the epoch:
 * a row's `updatedAt`, a click), or null when it isn't. A value younger
 * than GRACE_MS isn't shown yet: the last value shown stays, or, when
 * there was none, undefined, which the caller draws as a blank of the same
 * height. Anything else shows at once, so progress is never held back.
 *
 * `key` names what the value belongs to: when it changes (another
 * question in the same view), what was shown before is forgotten. The
 * value must keep its identity while it's unchanged (a primitive, or an
 * object from the query cache or from state), since it's remembered by
 * reference.
 *
 * The timing reads the server's clock against the browser's, which is
 * sound only because both run on the same machine.
 */
export function useSettled<T>(value: T, since: number | null, key?: unknown): T | undefined {
  const [last, setLast] = useState<{ key: unknown; value: T } | undefined>(undefined)
  const young = useYoung(since)

  if (young) return last && last.key === key ? last.value : undefined
  // Remember what's shown, to hold it through the next brief value. This
  // is state stored from an earlier render, set while rendering: React
  // re-renders at once and it settles, since the value is the same.
  if (!last || last.key !== key || last.value !== value) setLast({ key, value })
  return value
}

/**
 * Whether a request should look busy (a spinner, "Saving…", a disabled
 * button): only once it has been in flight for GRACE_MS, so a quick answer
 * never blinks. A double submit is still stopped at once, by the caller
 * checking the request's own `isPending`.
 */
export function useShowPending(m: { isPending: boolean; submittedAt: number }): boolean {
  return useSettled(m.isPending, m.isPending ? m.submittedAt : null) ?? false
}

/** Whether a value that began at `since` is younger than GRACE_MS. The
 *  clock is an external store: read as the component renders (a clock
 *  kept in state could be stale, and take an old wait for a young one),
 *  and it wakes the component the moment the value comes of age. */
function useYoung(since: number | null): boolean {
  const subscribe = useCallback(
    (changed: () => void) => {
      if (since === null) return () => {}
      const t = setTimeout(changed, Math.max(0, since + GRACE_MS - Date.now()))
      return () => clearTimeout(t)
    },
    [since],
  )
  return useSyncExternalStore(subscribe, () => since !== null && Date.now() - since < GRACE_MS)
}
