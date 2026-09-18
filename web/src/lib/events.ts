import { useEffect, useRef, useSyncExternalStore } from 'react'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import { isActiveTask, needsAttention } from '@/lib/tasks'
import type { Task, TaskEvent } from '@/lib/types'

/** How long without a heartbeat before the UI stops pretending it knows
 *  what is happening. The server pings every 15s, so two missed pings. */
const HEARTBEAT_GRACE_MS = 35_000

/** Reconnect backoff. The browser retries an EventSource on its own, but
 *  only for the failures it considers transient — it gives up for good on a
 *  fatal one, and it cannot see a stream that stays open while nothing
 *  flows through it. So reconnecting is ours to do: fast at first, because
 *  the common case is a server that restarted and is already back, then
 *  backing off so a server that is genuinely gone is not hammered. */
const RETRY_MIN_MS = 1_000
const RETRY_MAX_MS = 30_000

/** Everything the /api/events stream knows, held at module level so one SSE
 *  connection feeds every subscriber. A snapshot resets the store; task and
 *  phase events fold last-write-wins by id. */
export interface TaskStore {
  tasks: Task[] | null
  /** True while the stream is believed live. A dropped stream must never
   *  leave a spinner turning over numbers that stopped moving. */
  connected: boolean
  /** When the last event or heartbeat arrived, for the stale stamp. */
  lastBeat: number | null
  error: string | null
}

export const initialTaskStore: TaskStore = {
  tasks: null,
  connected: false,
  lastBeat: null,
  error: null,
}

/** Pure fold of one stream event into the store; exported for tests.
 *
 *  A phase event for a task the store has never seen is a signal that the
 *  stream missed something, not something to drop on the floor — it asks for
 *  a resync, because snapshots only arrive on connect. */
export function applyTaskEvent(
  store: TaskStore,
  ev: TaskEvent,
): { store: TaskStore; resync?: boolean } {
  switch (ev.type) {
    case 'ping':
      // Nothing to fold. Arriving at all is the point, and the caller has
      // already stamped the beat.
      return { store }
    case 'snapshot':
      return { store: { tasks: ev.tasks, connected: true, lastBeat: Date.now(), error: null } }
    case 'task': {
      const tasks = store.tasks ?? []
      const i = tasks.findIndex((t) => t.id === ev.task.id)
      if (i >= 0) {
        return { store: { ...store, tasks: tasks.with(i, ev.task) } }
      }
      // A task we haven't seen joins the active block; the finished order is
      // the server's to make on the next snapshot.
      const firstSettled = tasks.findIndex((t) => !isActiveTask(t))
      const next =
        firstSettled === -1
          ? [...tasks, ev.task]
          : [...tasks.slice(0, firstSettled), ev.task, ...tasks.slice(firstSettled)]
      return { store: { ...store, tasks: next } }
    }
    case 'phase': {
      if (!store.tasks) return { store }
      const i = store.tasks.findIndex((t) => t.id === ev.phase.taskId)
      if (i === -1) return { store, resync: true }
      const task = store.tasks[i]
      const pi = task.phases.findIndex((p) => p.id === ev.phase.id)
      const phases = pi >= 0 ? task.phases.with(pi, ev.phase) : [...task.phases, ev.phase]
      return { store: { ...store, tasks: store.tasks.with(i, { ...task, phases }) } }
    }
    case 'task_removed': {
      if (!store.tasks) return { store }
      const tasks = store.tasks.filter((t) => t.id !== ev.id)
      if (tasks.length === store.tasks.length) return { store }
      return { store: { ...store, tasks } }
    }
  }
}

// — module store ---------------------------------------------------------------------

let store: TaskStore = initialTaskStore
let version = 0
const listeners = new Set<() => void>()
let source: EventSource | null = null
/** The id of the last event the server stamped, so a reconnect can ask for
 *  what it missed instead of a fresh snapshot. EventSource only sends the
 *  Last-Event-ID header on reconnects it makes itself, and every reconnect
 *  here replaces the socket by hand — so the value rides along as a query
 *  parameter. The server falls back to a snapshot whenever it cannot honour
 *  the resume point, so a stale id is safe, never a silent gap. */
let lastEventId: string | null = null
let heartbeatTimer: ReturnType<typeof setInterval> | null = null
let retryTimer: ReturnType<typeof setTimeout> | null = null
let retryDelay = RETRY_MIN_MS

function emit() {
  version += 1
  for (const listener of listeners) listener()
}

function beat() {
  // Anything arriving proves the stream is alive, so the backoff resets: the
  // next outage starts over at a fast retry rather than inheriting the delay
  // that the last one had climbed to.
  retryDelay = RETRY_MIN_MS
  if (!store.connected || store.lastBeat === null) {
    store = { ...store, connected: true, lastBeat: Date.now(), error: null }
    emit()
    return
  }
  store = { ...store, lastBeat: Date.now() }
}

function dispatch(ev: TaskEvent) {
  const { store: next, resync } = applyTaskEvent(store, ev)
  store = next
  emit()
  if (resync) resyncNow()
}

/** Reconnects asking for a full snapshot rather than a resume. Resuming is
 *  the right default, but it is exactly the wrong move when the store is
 *  known to disagree with the server: replaying from the same point would
 *  hand back the same gap. Forgetting the id is what makes the server start
 *  over. */
function resyncNow() {
  lastEventId = null
  reconnect()
}

/** goStale marks the stream lost and schedules a reconnect. The numbers stay
 *  on screen with an "as of" stamp rather than freezing silently: a dead
 *  server must look dead, and then it must be chased.
 *
 *  A stream that never connected at all is a different thing — there is
 *  nothing to stamp, so it reports a real error and offers a manual retry
 *  rather than leaving a skeleton turning forever. */
function goStale() {
  const neverConnected = store.tasks === null
  if (store.connected || (neverConnected && store.error === null)) {
    store = {
      ...store,
      connected: false,
      error: neverConnected ? 'Lost the task stream.' : null,
    }
    emit()
  }
  scheduleRetry()
}

/** scheduleRetry queues the next attempt, unless one is already queued. */
function scheduleRetry() {
  if (retryTimer !== null || listeners.size === 0) return
  // Jitter so several tabs that lost the same server do not all come back
  // in the same instant.
  const delay = retryDelay + Math.random() * retryDelay * 0.25
  retryTimer = setTimeout(() => {
    retryTimer = null
    retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS)
    reconnect()
  }, delay)
}

/** retryNow abandons the backoff and reconnects immediately — for the
 *  moments that are evidence the network is back (the machine came online,
 *  the tab was brought forward) and for the manual Retry button. */
function retryNow() {
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  retryDelay = RETRY_MIN_MS
  reconnect()
}

function connect() {
  // Resuming only makes sense while we still hold the state it builds on: a
  // store that was never filled needs the snapshot, not the tail.
  const resume = store.tasks !== null ? lastEventId : null
  const es = new EventSource(resume ? `/api/events?after=${encodeURIComponent(resume)}` : '/api/events')
  source = es
  es.onopen = () => beat()
  es.onerror = () => {
    // A fatal error closes the EventSource for good, so its own retry is
    // not coming: drop this one and schedule our own. A non-fatal error
    // leaves it retrying, and goStale's backoff is harmless alongside that
    // because reconnect() replaces the socket either way.
    if (es.readyState === EventSource.CLOSED) {
      es.close()
      if (source === es) source = null
    }
    goStale()
  }
  es.onmessage = (e) => {
    beat()
    if (e.lastEventId) lastEventId = e.lastEventId
    try {
      dispatch(JSON.parse(e.data) as TaskEvent)
    } catch {
      // skip malformed payloads
    }
  }
  // The server heartbeats every 15s as a real event, so silence is
  // meaningful: a stream that stays open while nothing flows through it — a
  // proxy holding the socket, a server wedged mid-request — is invisible to
  // EventSource, and this is the only thing that catches it.
  heartbeatTimer = setInterval(() => {
    if (store.lastBeat !== null && Date.now() - store.lastBeat > HEARTBEAT_GRACE_MS) goStale()
  }, 5_000)
}

function disconnect() {
  source?.close()
  source = null
  if (heartbeatTimer !== null) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  if (retryTimer !== null) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
}

function reconnect() {
  disconnect()
  connect()
}

/** Evidence the network is back. Waiting out a backoff after the machine
 *  has plainly come online is time spent looking broken for no reason. */
function wakeUp() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
  if (store.connected) return
  retryNow()
}

function watchForWakeUps() {
  if (typeof window === 'undefined') return
  window.addEventListener('online', wakeUp)
  document.addEventListener('visibilitychange', wakeUp)
}

function stopWatchingForWakeUps() {
  if (typeof window === 'undefined') return
  window.removeEventListener('online', wakeUp)
  document.removeEventListener('visibilitychange', wakeUp)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    watchForWakeUps()
    connect()
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) {
      stopWatchingForWakeUps()
      disconnect()
    }
  }
}

function getVersion() {
  return version
}

function foldTask(task: Task) {
  dispatch({ type: 'task', task })
}

function actionError(e: unknown, fallback: string) {
  toast.error(e instanceof Error && e.message ? e.message : fallback)
}

// — actions --------------------------------------------------------------------------

/** Rests a queued or running task where it stands, keeping every finished
 *  phase. A failure is reported, never swallowed. */
export async function stopTask(id: string): Promise<Task | null> {
  try {
    const task = await api.stopTask(id)
    if (task) foldTask(task)
    return task
  } catch (e) {
    actionError(e, 'Couldn’t stop this task')
    return null
  }
}

/** Resumes a paused or failed task from where it stopped. Finished phases
 *  are never re-run. */
export async function retryTask(id: string): Promise<Task | null> {
  try {
    const task = await api.retryTask(id)
    if (task) foldTask(task)
    return task
  } catch (e) {
    actionError(e, 'Couldn’t start this task again')
    return null
  }
}

// — hooks -----------------------------------------------------------------------------

export interface TasksApi {
  tasks: Task[] | null
  running: Task[]
  queued: Task[]
  attention: Task[]
  active: Task[]
  finished: Task[]
  loading: boolean
  error: string | null
  connected: boolean
  /** When the shown numbers were last true, while the stream is lost. */
  lastBeat: number | null
  refresh: () => void
  stop: typeof stopTask
  retry: typeof retryTask
  taskForBook: (bookId: string | null | undefined) => Task | null
  taskForHomework: (homeworkId: string | null | undefined) => Task | null
  /** The task working one question, if any is. */
  taskForQuestion: (questionId: string | null | undefined) => Task | null
}

export function useTasks(): TasksApi {
  useSyncExternalStore(subscribe, getVersion)

  const list = store.tasks ?? []
  const active = list.filter(isActiveTask)

  const taskForBook = (bookId: string | null | undefined) => {
    if (!bookId) return null
    const matches = list.filter((t) => t.bookId === bookId)
    // A failed or paused preparation is exactly what the library card has to
    // show, so unsettled tasks count here too — not just running ones.
    return (
      matches.find((t) => t.status === 'running') ??
      matches.find(isActiveTask) ??
      matches.find(needsAttention) ??
      null
    )
  }

  // The assignment's own task is the read that builds the outline; its
  // questions each have their own, so this deliberately ignores those.
  const taskForHomework = (homeworkId: string | null | undefined) => {
    if (!homeworkId) return null
    const matches = list.filter((t) => t.homeworkId === homeworkId && t.kind === 'homework')
    return (
      matches.find((t) => t.status === 'running') ??
      matches.find(isActiveTask) ??
      matches.at(-1) ??
      null
    )
  }

  const taskForQuestion = (questionId: string | null | undefined) => {
    if (!questionId) return null
    const matches = list.filter((t) => t.questionId === questionId)
    return (
      matches.find((t) => t.status === 'running') ??
      matches.find(isActiveTask) ??
      matches.find(needsAttention) ??
      null
    )
  }

  return {
    tasks: store.tasks,
    running: list.filter((t) => t.status === 'running'),
    queued: active.filter((t) => t.status === 'queued'),
    attention: list.filter(needsAttention),
    active,
    finished: list.filter((t) => t.status === 'done'),
    loading: store.tasks === null && store.error === null,
    error: store.error,
    connected: store.connected,
    lastBeat: store.lastBeat,
    refresh: retryNow,
    stop: stopTask,
    retry: retryTask,
    taskForBook,
    taskForHomework,
    taskForQuestion,
  }
}

/**
 * Calls `onSettled` once when a task that was running stops running, so a
 * page can refetch the object the task was building.
 */
export function useTaskSettled(task: Task | null | undefined, onSettled: () => void) {
  const wasActive = useRef(false)

  useEffect(() => {
    const activeNow = task ? isActiveTask(task) : false
    if (wasActive.current && !activeNow) onSettled()
    wasActive.current = activeNow
  }, [task, onSettled])
}
