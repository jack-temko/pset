import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GRACE_MS, useSettled, useShowPending } from './settled'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

// Renders the hook and records what it said on every render.
let root: Root
let shown: unknown[]
function Probe({ value, since, id }: { value: string; since: number | null; id?: string }) {
  shown.push(useSettled(value, since, id))
  return null
}
const render = (value: string, since: number | null, id?: string) =>
  act(() => root.render(createElement(Probe, { value, since, id })))
const now = () => shown[shown.length - 1]
const wait = (ms: number) => act(() => vi.advanceTimersByTime(ms))

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(1_000_000)
  shown = []
  root = createRoot(document.createElement('div'))
})
afterEach(() => {
  act(() => root.unmount())
  vi.useRealTimers()
})

describe('useSettled', () => {
  it('shows a value that is not brief at once', () => {
    render('Examine the pages', null)
    expect(now()).toBe('Examine the pages')
  })

  it('holds a young wait behind the line before it, then shows it', () => {
    render('Examine the pages', null)
    render('Queued', Date.now())
    expect(now()).toBe('Examine the pages')
    wait(GRACE_MS)
    expect(now()).toBe('Queued')
  })

  it('never shows a wait that is over within the grace', () => {
    render('Examine the pages', null)
    render('Queued', Date.now())
    wait(20)
    render('Read the pages', null)
    wait(GRACE_MS)
    expect(shown).not.toContain('Queued')
    expect(now()).toBe('Read the pages')
  })

  it('draws nothing for a young wait with nothing before it', () => {
    render('Queued', Date.now())
    expect(now()).toBeUndefined()
    wait(GRACE_MS)
    expect(now()).toBe('Queued')
  })

  it('shows an old wait at once, as on opening the page', () => {
    render('Queued', Date.now() - 60_000)
    expect(shown).toEqual(expect.arrayContaining(['Queued']))
    expect(shown).not.toContain(undefined)
  })

  it('forgets what another key showed', () => {
    render('Writing the guide…', null, 'q1')
    render('Queued', Date.now(), 'q2')
    expect(now()).toBeUndefined()
  })
})

describe('useShowPending', () => {
  let looks: boolean[]
  function Button({ isPending, submittedAt }: { isPending: boolean; submittedAt: number }) {
    looks.push(useShowPending({ isPending, submittedAt }))
    return null
  }
  const press = (isPending: boolean, submittedAt: number) =>
    act(() => root.render(createElement(Button, { isPending, submittedAt })))
  beforeEach(() => {
    looks = []
  })

  it('never looks busy for a quick answer', () => {
    press(false, 0)
    press(true, Date.now())
    wait(40)
    press(false, 0)
    wait(GRACE_MS)
    expect(looks).not.toContain(true)
  })

  it('looks busy once a request has lasted', () => {
    press(true, Date.now())
    expect(looks[looks.length - 1]).toBe(false)
    wait(GRACE_MS)
    expect(looks[looks.length - 1]).toBe(true)
  })
})
