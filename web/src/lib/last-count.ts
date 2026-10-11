import { useEffect, useState } from 'react';

const storeKey = (key: string) => `pset:last-count:${key}`;

function read(key: string, fallback: number): number {
  try {
    const n = Number(localStorage.getItem(storeKey(key)));
    return Number.isInteger(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
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
export function useLastCount(
  key: string,
  count?: number,
  fallback = 3,
): number {
  const [last] = useState(() => read(key, fallback));
  useEffect(() => {
    if (count === undefined) return;
    try {
      localStorage.setItem(storeKey(key), String(count));
    } catch {
      // Storage may be off; the skeleton then draws 3.
    }
  }, [key, count]);
  return last;
}

/**
 * The same for a list's shape, not just its length: whatever small JSON value
 * the skeleton needs to draw rows the way the content did (which rows had a
 * second line, say). `fallback` is drawn when nothing is saved or what is saved
 * fails `valid` (an old version's value, or another page's). The value is the
 * one at mount.
 */
export function useLastShape<T>(
  key: string,
  shape: T | undefined,
  fallback: T,
  valid: (x: unknown) => x is T,
): T {
  const [last] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storeKey(key));
      if (raw === null) return fallback;
      const saved: unknown = JSON.parse(raw);
      return valid(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  const json = shape === undefined ? undefined : JSON.stringify(shape);
  useEffect(() => {
    if (json === undefined) return;
    try {
      localStorage.setItem(storeKey(key), json);
    } catch {
      // Storage may be off; the skeleton then draws the fallback.
    }
  }, [key, json]);
  return last;
}
