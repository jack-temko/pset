import { useEffect, useState } from 'react'

const storeKey = (key: string) => `pset:last-count:${key}`

function read(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(storeKey(key)))
    return Number.isInteger(n) && n > 0 ? n : fallback
  } catch {
    return fallback
  }
}

/**
 * How many rows a list showed last time, for the skeleton that stands in for
 * it: right almost always, so the list doesn't resize when it arrives.
 * Saved per `key` in the browser; 3 when nothing is saved. Pass the real
 * `count` once it is known and it is saved for next time. `fallback` stands in
 * for it when nothing is saved (a width in characters, say, rather than rows). The value returned
 * is the one at mount, so a skeleton on screen doesn't change under itself.
 */
export function useLastCount(key: string, count?: number, fallback = 3): number {
  const [last] = useState(() => read(key, fallback))
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
