import { describe, expect, it } from 'vitest'

import { walkthroughKey } from './keys'
import { countWords, firstUnfinished, listSegments, markOf, nextUnfinished, primaryOf, segments, stageWord, timeLeftWords, isWorking, type Q, type HomeworkSet } from './progress'
import { makeQuestion, makeSet } from './world'
import type { Question } from '@/api/homework'

const q = (over: Partial<Question> & { state?: Question['state'] } = {}, extra: { difficulty?: number; seconds?: number } = {}): Q => ({
  ...makeQuestion({ homeworkId: 'h', position: 0, label: 'x', state: over.state ?? 'ready', done: over.done }),
  ...over,
  ...extra,
})
const set = (estimate?: HomeworkSet['estimate']): HomeworkSet => ({ ...makeSet('Set', null), estimate })

describe('marks', () => {
  it('marks failed first, then done, then here, then waiting', () => {
    expect(markOf(q({ state: 'failed', done: true }), true)).toBe('failed')
    expect(markOf(q({ done: true }), true)).toBe('done')
    expect(markOf(q(), true)).toBe('current')
    expect(markOf(q(), false)).toBe('waiting')
  })

  it('weights each segment by its difficulty', () => {
    const s = segments([q({}, { difficulty: 4 }), q({ done: true })], 0)
    expect(s).toEqual([
      { mark: 'current', weight: 4 },
      { mark: 'done', weight: undefined },
    ])
  })

  it('counts what is done', () => {
    expect(countWords([q({ done: true }), q(), q({ done: true })])).toBe('2 of 3')
  })
})

describe('where Next goes', () => {
  const qs = [q({ done: true }), q(), q({ done: true }), q()]

  it('opens on the first question not done, or none when all are', () => {
    expect(firstUnfinished(qs)).toBe(1)
    expect(firstUnfinished([q({ done: true })])).toBeNull()
    expect(firstUnfinished([])).toBeNull()
  })

  it('goes to the next not done, wrapping, never to itself', () => {
    expect(nextUnfinished(qs, 1)).toBe(3)
    expect(nextUnfinished(qs, 3)).toBe(1)
    expect(nextUnfinished(qs, 0)).toBe(1)
  })

  it('has nowhere to go when nothing else is left', () => {
    expect(nextUnfinished([q({ done: true }), q()], 1)).toBeNull()
    expect(nextUnfinished([q()], 0)).toBeNull()
  })
})

describe('the one button', () => {
  it('is Next on a ready question, Mark incomplete on a done one', () => {
    expect(primaryOf(q())).toBe('next')
    expect(primaryOf(q({ done: true }))).toBe('incomplete')
  })

  it('is Skip for now when the question cannot be finished yet', () => {
    for (const state of ['pending', 'locating', 'located', 'reading', 'writing', 'failed', 'unwritten'] as const) {
      expect(primaryOf(q({ state }))).toBe('skip')
    }
  })

  it('never marks a failed question done, even one already ticked', () => {
    expect(primaryOf(q({ state: 'failed' }))).toBe('skip')
  })
})

describe('the list words', () => {
  it('says only the stage of work in progress', () => {
    expect(stageWord(q({ state: 'pending' }))).toBe('Queued')
    expect(stageWord(q({ state: 'located' }))).toBe('Queued')
    expect(stageWord(q({ state: 'locating' }))).toBe('Finding it')
    expect(stageWord(q({ state: 'reading' }))).toBe('Reading the figure')
    expect(stageWord(q({ state: 'writing' }))).toBe('Writing the guide')
  })

  it('says nothing for done, failed, to do or no guide', () => {
    expect(stageWord(q({ done: true }))).toBeNull()
    expect(stageWord(q({ state: 'failed' }))).toBeNull()
    expect(stageWord(q())).toBeNull()
    expect(stageWord(q({ state: 'unwritten' }))).toBeNull()
  })

  it('spins only while the engine is working on it', () => {
    expect(isWorking(q({ state: 'writing' }))).toBe(true)
    expect(isWorking(q({ state: 'pending' }))).toBe(false)
    expect(isWorking(q({ state: 'writing', done: true }))).toBe(false)
  })
})

describe('time left', () => {
  const timed = [q({}, { seconds: 600 }), q({}, { seconds: 900 }), q()]

  it('says nothing without an estimate', () => {
    expect(timeLeftWords(set(), timed)).toBeNull()
    expect(timeLeftWords(undefined, timed)).toBeNull()
  })

  it('says nothing until two questions have been timed', () => {
    expect(timeLeftWords(set({ seconds: 6000 }), [q({}, { seconds: 600 }), q(), q()])).toBeNull()
  })

  it('says nothing once everything is done', () => {
    expect(timeLeftWords(set({ seconds: 600 }), [q({ done: true }, { seconds: 600 }), q({ done: true }, { seconds: 600 })])).toBeNull()
  })

  it('rounds to five minutes and says "about"', () => {
    expect(timeLeftWords(set({ seconds: 6100 }), timed)).toBe('about 1 h 40 m left')
    expect(timeLeftWords(set({ seconds: 1000 }), timed)).toBe('about 15 min left')
    expect(timeLeftWords(set({ seconds: 7200 }), timed)).toBe('about 2 h left')
    expect(timeLeftWords(set({ seconds: 30 }), timed)).toBe('about 5 min left')
  })

  it('gives a range when the spread is wide, and a number when it is tight', () => {
    expect(timeLeftWords(set({ seconds: 3600, low: 1800, high: 7200 }), timed)).toBe('30 min to 2 h left')
    expect(timeLeftWords(set({ seconds: 3600, low: 3300, high: 3900 }), timed)).toBe('about 1 h left')
  })
})

describe('keys', () => {
  it('browses with the arrows and opens rows with 1 2 3', () => {
    expect(walkthroughKey('ArrowRight', false, false)).toEqual({ kind: 'browse', by: 1 })
    expect(walkthroughKey('ArrowLeft', false, false)).toEqual({ kind: 'browse', by: -1 })
    expect(walkthroughKey('3', false, false)).toEqual({ kind: 'row', index: 2 })
  })

  it('does nothing while typing or with a modifier held, or for other keys', () => {
    expect(walkthroughKey('1', false, true)).toBeNull()
    expect(walkthroughKey('ArrowLeft', true, false)).toBeNull()
    expect(walkthroughKey('4', false, false)).toBeNull()
    expect(walkthroughKey('Enter', false, false)).toBeNull()
  })
})

describe('a set on the list', () => {
  it('takes its bar from the per-question entries, with failed and weights', () => {
    const h = { ...set(), total: 3, done: 1, bar: [{ done: true, weight: 2 }, { done: false, failed: true }, { done: false, weight: 4 }] }
    expect(listSegments(h)).toEqual([
      { mark: 'done', weight: 2 },
      { mark: 'failed', weight: undefined },
      { mark: 'waiting', weight: 4 },
    ])
  })

  it('falls back to equal segments, done first, when the list carries only counts', () => {
    expect(listSegments({ ...set(), total: 3, done: 2 }).map((s) => s.mark)).toEqual(['done', 'done', 'waiting'])
    expect(listSegments({ ...set(), total: 0, done: 0 })).toEqual([])
  })

  it('has time left only from the set’s own count of timed questions', () => {
    const e = { seconds: 3600 }
    expect(timeLeftWords({ ...set(e), total: 4, done: 1, timed: 2 })).toBe('about 1 h left')
    expect(timeLeftWords({ ...set(e), total: 4, done: 1, timed: 1 })).toBeNull()
    expect(timeLeftWords({ ...set(e), total: 4, done: 1 })).toBeNull()
    expect(timeLeftWords({ ...set(e), total: 4, done: 4, timed: 4 })).toBeNull()
  })
})
