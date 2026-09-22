import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'

import { get, post } from './client'
import type { Kind, Week } from './gen/activity'

export type * from './gen/activity'

/** Monday 00:00 of this week, in the student's own time zone. */
function weekStart(now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.toISOString()
}

export const useWeek = () =>
  useQuery({
    queryKey: ['week'],
    queryFn: () => get<Week>(`/api/week?since=${encodeURIComponent(weekStart())}`),
    // Time accrues without events: fresh each visit to Home.
    staleTime: 0,
  })

const BEAT = 30_000
/** Input older than this, and the student has wandered off. */
const IDLE = 120_000

/**
 * Counts time in a book: every 30 seconds, while the tab is visible and
 * there was input in the last two minutes, one heartbeat saying what the
 * student is doing. `kind` is read when the beat goes, so it can follow
 * where they last clicked or typed.
 */
export function useHeartbeat(bookId: string, kind: () => Kind) {
  const lastInput = useRef(Date.now())
  const kindRef = useRef(kind)
  kindRef.current = kind
  useEffect(() => {
    const touch = () => (lastInput.current = Date.now())
    const events = ['pointerdown', 'keydown', 'wheel', 'scroll'] as const
    events.forEach((e) => window.addEventListener(e, touch, { passive: true, capture: true }))
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible' || Date.now() - lastInput.current > IDLE) return
      post('/api/heartbeat', { bookId, kind: kindRef.current() }).catch(() => {})
    }, BEAT)
    return () => {
      clearInterval(timer)
      events.forEach((e) => window.removeEventListener(e, touch, { capture: true }))
    }
  }, [bookId])
}
