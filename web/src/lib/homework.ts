// Pure homework helpers plus the two pieces of client-only state the server
// deliberately does not own: walkthrough reveal memory and the PDF download
// gesture. All data access lives in lib/api.ts and the components.
import type { Homework } from '@/lib/types'

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none'

export function dueInfo(dueDate: string | null): { tone: DueTone; label: string } {
  if (!dueDate) return { tone: 'none', label: 'No due date' }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate}T00:00:00`)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (days < 0) return { tone: 'overdue', label: `Overdue · ${formatDay(due)}` }
  if (days === 0) return { tone: 'today', label: 'Due today' }
  if (days === 1) return { tone: 'today', label: 'Due tomorrow' }
  if (days <= 7) return { tone: 'soon', label: `Due ${formatDay(due)}` }
  return { tone: 'later', label: `Due ${formatDay(due)}` }
}

function formatDay(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

/** Overdue first, then the next 7 days, excluding turned-in. */
export function dueSoon(list: Homework[]): Homework[] {
  return list
    .filter((h) => !h.turnedIn && h.status === 'ready' && h.dueDate)
    .filter((h) => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const due = new Date(`${h.dueDate}T00:00:00`)
      const days = (due.getTime() - today.getTime()) / 86_400_000
      return days <= 7
    })
    .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
}

// --- reveal memory (localStorage, per question) --------------------------------

export interface HomeworkReveal {
  steps: boolean
  answer: boolean
}

const REVEALS_KEY = 'pset-hw-reveals'

function readReveals(): Record<string, HomeworkReveal> {
  try {
    const raw = localStorage.getItem(REVEALS_KEY)
    if (raw) return JSON.parse(raw) as Record<string, HomeworkReveal>
  } catch {
    // broken storage behaves like no memory
  }
  return {}
}

export function revealFor(questionId: string): HomeworkReveal {
  const reveal = readReveals()[questionId]
  return { steps: reveal?.steps ?? false, answer: reveal?.answer ?? false }
}

export function setReveal(questionId: string, which: 'steps' | 'answer', open: boolean): void {
  const reveals = readReveals()
  reveals[questionId] = { ...revealFor(questionId), [which]: open }
  try {
    localStorage.setItem(REVEALS_KEY, JSON.stringify(reveals))
  } catch {
    // storage full or blocked: reveals just stop persisting
  }
}

// --- download -------------------------------------------------------------------

/** Triggers the browser download of the assignment's template PDF. */
export function downloadHomeworkPdf(id: string): void {
  const a = document.createElement('a')
  a.href = `/api/homework/${encodeURIComponent(id)}/pdf`
  a.download = ''
  document.body.appendChild(a)
  a.click()
  a.remove()
}
