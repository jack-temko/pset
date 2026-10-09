import { useEffect, useState } from 'react'

const DEFAULT = 3

const storeKey = (key: string) => `pset:last-count:${key}`

function read(key: string): number {
  try {
    const n = Number(localStorage.getItem(storeKey(key)))
    return Number.isInteger(n) && n > 0 ? n : DEFAULT
  } catch {
    return DEFAULT
  }
}

/**
 * How many rows a list showed last time, for the skeleton that stands in for
 * it: right almost always, so the list doesn't resize when it arrives.
 * Saved per `key` in the browser; 3 when nothing is saved. Pass the real
 * `count` once it is known and it is saved for next time. The value returned
 * is the one at mount, so a skeleton on screen doesn't change under itself.
 */
export function useLastCount(key: string, count?: number): number {
  const [last] = useState(() => read(key))
  useEffect(() => {
    if (count === undefined) return
    try {
      localStorage.setItem(storeKey(key), String(count))
    } catch {
      // Storage may be off; the skeleton then draws 3.
    }
  }, [key, count])
  return last
}
