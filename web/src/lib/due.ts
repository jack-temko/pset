import type { HomeworkStatus } from '@/components/homework-status'

/** Whole days from today to a calendar date, in the student's own time
 *  zone: 0 today, 1 tomorrow, -1 yesterday. */
function daysUntil(date: string, now: Date): number {
  const [y, m, d] = date.split('-').map(Number)
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

/** A date as words relative to today: "today", "Friday", "next Friday",
 *  "Sep 25". */
function words(date: string, now: Date): string {
  const n = daysUntil(date, now)
  const [y, m, d] = date.split('-').map(Number)
  const day = new Date(y, m - 1, d)
  const weekday = day.toLocaleDateString(undefined, { weekday: 'long' })
  if (n === 0) return 'today'
  if (n === 1) return 'tomorrow'
  if (n === -1) return 'yesterday'
  if (n > 1 && n < 7) return weekday
  if (n >= 7 && n < 14) return `next ${weekday}`
  return day.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

type Dated = { dueDate: string; turnedInAt: string }

/** The flag a set earns, if any: turned in, overdue, or due within a day. */
export function dueStatus(h: Dated, now = new Date()): HomeworkStatus | undefined {
  if (h.turnedInAt) return 'turned-in'
  if (!h.dueDate) return undefined
  const n = daysUntil(h.dueDate, now)
  if (n < 0) return 'overdue'
  if (n <= 1) return 'soon'
  return undefined
}

/** The deadline as a row's meta line says it. */
export function dueLine(h: Dated, now = new Date()): string {
  if (h.turnedInAt) return `turned in ${words(h.turnedInAt.slice(0, 10), now)}`
  if (!h.dueDate) return 'no due date'
  return `due ${words(h.dueDate, now)}`
}
