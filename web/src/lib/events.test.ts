import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, renderHook } from '@testing-library/react'

import { applyTaskEvent, initialTaskStore, type TaskStore } from './events'
import type { Phase, Task, TaskEvent } from './types'

function task(over: Partial<Task> = {}): Task {
  return {
    id: 't1',
    kind: 'prepare',
    status: 'running',
    bookId: 'b1',
    homeworkId: null,
    title: 'Calculus',
    phases: [],
    failKind: null,
    retryable: false,
    error: null,
    createdAt: '2026-09-16T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    ...over,
  }
}

function phase(over: Partial<Phase> = {}): Phase {
  return {
    id: 'p1',
    taskId: 't1',
    key: 'read',
    name: 'Read the pages',
    status: 'running',
    done: 1,
    total: 10,
    note: '',
    error: null,
    etaSeconds: null,
    createdAt: '2026-09-16T00:00:00Z',
    startedAt: null,
    finishedAt: null,
    ...over,
  }
}

function fold(store: TaskStore, ev: TaskEvent) {
  return applyTaskEvent(store, ev)
}

describe('applyTaskEvent', () => {
  it('a snapshot replaces the list and marks the stream live', () => {
    const { store } = fold(initialTaskStore, { type: 'snapshot', tasks: [task()] })
    expect(store.tasks?.length).toBe(1)
    expect(store.connected).toBe(true)
    expect(store.lastBeat).not.toBeNull()
  })

  it('a task event is last-write-wins by id', () => {
    const a = fold(initialTaskStore, { type: 'snapshot', tasks: [task()] }).store
    const b = fold(a, { type: 'task', task: task({ status: 'done' }) }).store
    expect(b.tasks?.length).toBe(1)
    expect(b.tasks?.[0].status).toBe('done')
  })

  it('an unseen task joins ahead of the settled ones', () => {
    const a = fold(initialTaskStore, {
      type: 'snapshot',
      tasks: [task({ id: 'old', status: 'done' })],
    }).store
    const b = fold(a, { type: 'task', task: task({ id: 'new', status: 'queued' }) }).store
    expect(b.tasks?.map((t) => t.id)).toEqual(['new', 'old'])
  })

  it('a phase event updates its task in place', () => {
    const a = fold(initialTaskStore, { type: 'snapshot', tasks: [task()] }).store
    const b = fold(a, { type: 'phase', phase: phase() }).store
    expect(b.tasks?.[0].phases[0].done).toBe(1)
    const c = fold(b, { type: 'phase', phase: phase({ done: 4 }) }).store
    expect(c.tasks?.[0].phases.length).toBe(1)
    expect(c.tasks?.[0].phases[0].done).toBe(4)
  })

  it('a phase for an unknown task asks for a resync instead of vanishing', () => {
    // Snapshots only arrive on connect, so dropping this on the floor would
    // leave the row silently stale until the next reconnect.
    const a = fold(initialTaskStore, { type: 'snapshot', tasks: [task()] }).store
    const { store, resync } = fold(a, { type: 'phase', phase: phase({ taskId: 'gone' }) })
    expect(resync).toBe(true)
    expect(store.tasks?.length).toBe(1)
  })

  it('a removal drops the task and nothing else', () => {
    const a = fold(initialTaskStore, {
      type: 'snapshot',
      tasks: [task({ id: 'a' }), task({ id: 'b' })],
    }).store
    const b = fold(a, { type: 'task_removed', id: 'a' }).store
    expect(b.tasks?.map((t) => t.id)).toEqual(['b'])
    // A removal for an id that isn't here keeps the same array identity.
    const c = fold(b, { type: 'task_removed', id: 'a' }).store
    expect(c.tasks).toBe(b.tasks)
  })
})

// — reconnection -----------------------------------------------------------
//
// These drive the module store through a fake EventSource, because the thing
// under test is the lifecycle: what happens after the socket dies. A store
// that reports a dead server but never chases it is the bug these pin.

class FakeEventSource {
  static instances: FakeEventSource[] = []
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2

  onopen: (() => void) | null = null
  onerror: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  readyState = 0
  closed = false

  url: string

  constructor(url: string) {
    this.url = url
    FakeEventSource.instances.push(this)
  }

  close() {
    this.closed = true
    this.readyState = FakeEventSource.CLOSED
  }

  /** The server accepted and sent its snapshot. */
  open(tasks: Task[] = []) {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
    this.onmessage?.({ data: JSON.stringify({ type: 'snapshot', tasks }) })
  }

  /** The server's keep-alive. */
  ping() {
    this.onmessage?.({ data: JSON.stringify({ type: 'ping' }) })
  }

  /** A fatal failure: the browser gives up and will not retry on its own. */
  fail() {
    this.readyState = FakeEventSource.CLOSED
    this.onerror?.()
  }
}

describe('reconnection', () => {
  let useTasksHook: typeof import('./events').useTasks

  beforeEach(async () => {
    vi.useFakeTimers()
    FakeEventSource.instances = []
    vi.stubGlobal('EventSource', FakeEventSource)
    // A fresh module per test: the store and its connection are module-level
    // state, which is the whole point of them.
    vi.resetModules()
    const mod = await import('./events')
    useTasksHook = mod.useTasks
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  /** Mounts a subscriber the way a real component does, and returns the
   *  unmount that tears the connection down. */
  function mount() {
    return renderHook(() => useTasksHook()).unmount
  }

  it('chases a dead server instead of only reporting it', () => {
    mount()
    expect(FakeEventSource.instances).toHaveLength(1)
    FakeEventSource.instances[0].open([task()])

    // The server dies fatally: the browser will not retry this one.
    FakeEventSource.instances[0].fail()
    expect(FakeEventSource.instances).toHaveLength(1)

    // …but we do, and the retry opens a fresh connection.
    vi.advanceTimersByTime(2_000)
    expect(FakeEventSource.instances).toHaveLength(2)
  })

  it('backs off while the server stays down, and resets once it is back', () => {
    mount()
    FakeEventSource.instances[0].open()

    const attemptsWithin = (ms: number) => {
      const before = FakeEventSource.instances.length
      FakeEventSource.instances[before - 1].fail()
      vi.advanceTimersByTime(ms)
      return FakeEventSource.instances.length - before
    }

    // Each failure roughly doubles the wait, so a server that is genuinely
    // gone is not hammered.
    expect(attemptsWithin(1_500)).toBe(1)
    expect(attemptsWithin(1_500)).toBe(0)
    vi.advanceTimersByTime(3_000)

    // Coming back resets the backoff: the next outage retries fast again.
    const revived = FakeEventSource.instances.at(-1)!
    revived.open()
    const before = FakeEventSource.instances.length
    revived.fail()
    vi.advanceTimersByTime(1_500)
    expect(FakeEventSource.instances.length - before).toBe(1)
  })

  it('leaves an idle but healthy stream alone', () => {
    const view = renderHook(() => useTasksHook())
    act(() => FakeEventSource.instances[0].open())

    // Nothing is happening on the server — no imports, no homework — so the
    // only traffic is its heartbeat. That is a perfectly healthy stream, and
    // tearing it down every grace window would mean an idle app reconnects
    // forever and reports itself broken while doing it.
    for (let i = 0; i < 8; i++) {
      act(() => {
        vi.advanceTimersByTime(15_000)
        FakeEventSource.instances[0].ping()
      })
    }
    expect(FakeEventSource.instances).toHaveLength(1)
    expect(view.result.current.connected).toBe(true)
  })

  it('reconnects when a stream goes silent, heartbeats included', () => {
    mount()
    FakeEventSource.instances[0].open()

    // The socket stays open and the browser is content, but nothing arrives
    // — a wedged server, or a proxy holding the connection. EventSource sees
    // nothing wrong here; only the heartbeat watchdog can catch it.
    vi.advanceTimersByTime(30_000)
    expect(FakeEventSource.instances).toHaveLength(1)

    // Past the grace window it is declared dead, and the retry follows.
    vi.advanceTimersByTime(12_000)
    expect(FakeEventSource.instances.length).toBeGreaterThan(1)
  })

  it('comes back at once when the machine comes online', () => {
    mount()
    FakeEventSource.instances[0].open()
    FakeEventSource.instances[0].fail()

    // Well inside the backoff, so nothing would have retried yet.
    vi.advanceTimersByTime(100)
    const before = FakeEventSource.instances.length

    window.dispatchEvent(new Event('online'))
    expect(FakeEventSource.instances.length).toBe(before + 1)
  })

  it('reports itself connected again once the server answers', () => {
    const view = renderHook(() => useTasksHook())
    act(() => FakeEventSource.instances[0].open([task()]))
    expect(view.result.current.connected).toBe(true)

    act(() => {
      FakeEventSource.instances[0].fail()
      vi.advanceTimersByTime(2_000)
    })
    expect(view.result.current.connected).toBe(false)

    // The server is back and the retry lands. The card must stop saying it
    // lost touch — a UI that reconnects but keeps reporting a dead server
    // is no better than one that never reconnected at all.
    act(() => FakeEventSource.instances.at(-1)!.open([task()]))
    expect(view.result.current.connected).toBe(true)
    expect(view.result.current.error).toBeNull()
  })

  it('stops chasing once nothing is listening', () => {
    const unmount = mount()
    FakeEventSource.instances[0].open()
    FakeEventSource.instances[0].fail()
    unmount()

    const before = FakeEventSource.instances.length
    vi.advanceTimersByTime(60_000)
    expect(FakeEventSource.instances.length).toBe(before)
  })
})
