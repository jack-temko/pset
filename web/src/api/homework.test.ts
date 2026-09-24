import { describe, expect, it } from 'vitest'

import { applyQuestion, outstanding, toFind, type Detail, type Question, type Summary } from './homework'

let n = 0
const q = (over: Partial<Question> = {}): Question => ({
  id: `q${++n}`,
  homeworkId: 'h1',
  position: 1,
  text: '3.1',
  inBook: true,
  label: '3.1',
  statement: '',
  figures: [],
  hint: [],
  walkthrough: [],
  state: 'pending',
  memory: [],
  revealed: [],
  done: false,
  updatedAt: '',
  ...over,
})

const h: Summary = {
  id: 'h1',
  bookId: 'b1',
  title: 'Kettle problems',
  dueDate: '',
  turnedInAt: '',
  total: 1,
  done: 0,
  createdAt: '',
}

const detail = (...questions: Question[]): Detail => ({ homework: h, questions })

describe('applyQuestion', () => {
  it('keeps a failed question failed when an older pending snapshot lands late', () => {
    // The P0: a mutation's response carries the question as it was at add
    // time; the failure event already applied must win.
    const d = detail(q({ id: 'x', state: 'failed', failure: 'setup', reason: 'no chat model' }))
    expect(applyQuestion(d, q({ id: 'x', state: 'pending' }))).toBe(d)
  })

  it('applies a forward transition', () => {
    const d = detail(q({ id: 'x', state: 'pending' }))
    const next = applyQuestion(d, q({ id: 'x', state: 'writing', activity: 'Thinking…' }))
    expect(next.questions[0].state).toBe('writing')
  })

  it('applies an equal-state update, like an activity line or a saved hint', () => {
    const d = detail(q({ id: 'x', state: 'writing' }))
    const next = applyQuestion(d, q({ id: 'x', state: 'writing', hint: [] }))
    expect(next).not.toBe(d)
  })

  it('still refuses a backward step between working states', () => {
    const d = detail(q({ id: 'x', state: 'writing' }))
    expect(applyQuestion(d, q({ id: 'x', state: 'locating' }))).toBe(d)
  })

  it('puts located between being found and being written', () => {
    const d = detail(q({ id: 'x', state: 'located', page: 12 }))
    expect(applyQuestion(d, q({ id: 'x', state: 'locating' }))).toBe(d)
    expect(applyQuestion(d, q({ id: 'x', state: 'writing' })).questions[0].state).toBe('writing')
  })

  it('force is a restart: pending applies over failed, and later events follow', () => {
    const d = detail(q({ id: 'x', state: 'failed' }))
    expect(applyQuestion(d, q({ id: 'x', state: 'pending' }), true).questions[0].state).toBe('pending')
    expect(applyQuestion(d, q({ id: 'x', state: 'locating' }), true).questions[0].state).toBe('locating')
  })

  it('keeps the questions in position order', () => {
    const d = detail(q({ id: 'a', position: 2 }), q({ id: 'b', position: 1 }))
    const next = applyQuestion(d, q({ id: 'c', position: 3, homeworkId: 'h1' }))
    expect(next.questions.map((x) => x.id)).toEqual(['b', 'a', 'c'])
  })
})

describe('outstanding', () => {
  it('is true while the engine still owes the question work', () => {
    expect(outstanding(q({ state: 'pending' }))).toBe(true)
    expect(outstanding(q({ state: 'locating' }))).toBe(true)
    expect(outstanding(q({ state: 'located' }))).toBe(true)
    expect(outstanding(q({ state: 'writing' }))).toBe(true)
  })

  it('is false once the question is settled', () => {
    expect(outstanding(q({ state: 'ready' }))).toBe(false)
    expect(outstanding(q({ state: 'failed' }))).toBe(false)
  })
})

describe('toFind', () => {
  it('is a question in the book that is queued or being found', () => {
    expect(toFind(q({ state: 'pending' }))).toBe(true)
    expect(toFind(q({ state: 'locating' }))).toBe(true)
  })

  it('is false once found, and for one that has nothing to find', () => {
    expect(toFind(q({ state: 'located' }))).toBe(false)
    expect(toFind(q({ state: 'writing' }))).toBe(false)
    expect(toFind(q({ state: 'pending', inBook: false }))).toBe(false)
  })
})
