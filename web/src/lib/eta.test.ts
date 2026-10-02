import { beforeEach, describe, expect, it } from 'vitest'

import { LONGER_THAN_USUAL, forget, observe, timeLeft, timeLeftWords, typical } from './eta'

const s = 1000
const min = 60 * s

beforeEach(() => {
  localStorage.clear()
  for (const e of ['a', 'b', 'c']) forget(e)
})

describe('timeLeftWords', () => {
  it('gets coarser the further out it is', () => {
    const cases: [number, string][] = [
      [-5 * s, 'a few seconds left'],
      [3 * s, 'a few seconds left'],
      [30 * s, 'less than a minute left'],
      [70 * s, 'about a minute left'],
      [3.4 * min, 'about 3 minutes left'],
      [9.4 * min, 'about 9 minutes left'],
      [23 * min, 'about 25 minutes left'],
      [60 * min, 'about an hour left'],
      [100 * min, 'about 2 hours left'],
    ]
    for (const [ms, words] of cases) expect(timeLeftWords(ms), `${ms}ms`).toBe(words)
  })
})

describe('a counted step', () => {
  it('says nothing until it has a pace, then goes by it', () => {
    observe('a', 'import:read', { done: 10, total: 310 }, 0)
    expect(timeLeft('a', 2 * s)).toBeUndefined()
    observe('a', 'import:read', { done: 20, total: 310 }, 10 * s)
    // A page a second, 290 pages to go.
    expect(timeLeft('a', 10 * s)).toBe('about 5 minutes left')
  })

  it("doesn't count down while it stalls", () => {
    observe('a', 'import:read', { done: 0, total: 100 }, 0)
    observe('a', 'import:read', { done: 60, total: 100 }, 60 * s)
    // 40 pages at a page a second; ten minutes with no page later, the
    // estimate has moved on by one page's worth, not ten minutes.
    expect(timeLeft('a', 60 * s)).toBe('less than a minute left')
    expect(timeLeft('a', 10 * min)).toBe('less than a minute left')
  })

  it('follows a pace that changes', () => {
    observe('a', 'import:read', { done: 0, total: 1000 }, 0)
    observe('a', 'import:read', { done: 600, total: 1000 }, 60 * s) // fast pages
    for (let t = 61; t <= 360; t++) observe('a', 'import:read', { done: 600 + (t - 60), total: 1000 }, t * s) // then slow
    // A page a second over the last few minutes: 100 to go.
    expect(timeLeft('a', 360 * s)).toBe('about 2 minutes left')
  })
})

describe('an uncounted step', () => {
  const run = (entity: string, start: number, ms: number) => {
    observe(entity, 'import:contents', undefined, start)
    observe(entity, undefined, undefined, start + ms)
  }

  it('has nothing to say without history', () => {
    observe('a', undefined, undefined, 0)
    observe('a', 'import:contents', undefined, 1 * s)
    expect(timeLeft('a', 2 * s)).toBeUndefined()
  })

  it('learns from runs it saw whole, by the median', () => {
    observe('a', undefined, undefined, 0)
    run('a', 0, 40 * s)
    run('a', 0, 50 * s)
    run('a', 0, 400 * s) // one odd run
    expect(typical('import:contents')).toBe(50 * s)

    observe('b', undefined, undefined, 0)
    observe('b', 'import:contents', undefined, 0)
    expect(timeLeft('b', 5 * s)).toBe('less than a minute left')
    expect(timeLeft('b', 45 * s)).toBe('a few seconds left')
    expect(timeLeft('b', 2 * min)).toBe(LONGER_THAN_USUAL)
  })

  it("doesn't learn from a run it found under way", () => {
    observe('c', 'import:contents', undefined, 0) // first sight: already running
    observe('c', undefined, undefined, 5 * s)
    expect(typical('import:contents')).toBeUndefined()
  })

  it('keeps the last five runs', () => {
    observe('a', undefined, undefined, 0)
    for (const secs of [1, 2, 3, 100, 100, 100, 100, 100]) run('a', 0, secs * s)
    expect(typical('import:contents')).toBe(100 * s)
  })
})
