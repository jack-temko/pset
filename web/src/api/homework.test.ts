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
  reading: [],
  readingEdited: false,
  boxes: [],
  revealed: [],
  done: false,
  updatedAt: '',
  rev: 0,
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
    // A mutation's response carries the question as it was at add time;
    // the failure event already applied is newer and must win.
    const d = detail(q({ id: 'x', state: 'failed', failure: 'setup', reason: 'no chat model', rev: 2 }))
    expect(applyQuestion(d, q({ id: 'x', state: 'pending', rev: 0 }))).toBe(d)
  })

  it('applies a newer snapshot', () => {
    const d = detail(q({ id: 'x', state: 'pending', rev: 0 }))
    const next = applyQuestion(d, q({ id: 'x', state: 'writing', activity: 'Thinking…', rev: 3 }))
    expect(next.questions[0].state).toBe('writing')
  })

  it('applies a change within a state, like an activity line', () => {
    const d = detail(q({ id: 'x', state: 'writing', activity: 'Thinking…', rev: 3 }))
    const next = applyQuestion(d, q({ id: 'x', state: 'writing', activity: 'Computing…', rev: 4 }))
    expect(next.questions[0].activity).toBe('Computing…')
  })

  it('drops an older snapshot in the same state', () => {
    // The student revealed the hint (drawn at once, same rev); a stale
    // event from before the reveal lands after: the reveal stays.
    const d = detail(q({ id: 'x', state: 'ready', revealed: ['hint'], rev: 5 }))
    expect(applyQuestion(d, q({ id: 'x', state: 'ready', revealed: [], rev: 5 }))).toBe(d)
    expect(applyQuestion(d, q({ id: 'x', state: 'ready', revealed: [], rev: 4 }))).toBe(d)
    // The server's own reveal comes back one rev on, and applies.
    expect(applyQuestion(d, q({ id: 'x', state: 'ready', revealed: ['hint'], rev: 6 }))).not.toBe(d)
  })

  it('force draws a restart ahead of the server, and what the run says next follows', () => {
    const d = detail(q({ id: 'x', state: 'failed', rev: 7 }))
    const restarted = applyQuestion(d, q({ id: 'x', state: 'pending', rev: 7 }), true)
    expect(restarted.questions[0].state).toBe('pending')
    // The old failure, arriving late, doesn't undo the restart.
    expect(applyQuestion(restarted, q({ id: 'x', state: 'failed', rev: 7 }))).toBe(restarted)
    // The run's own events do apply, even an instant second failure.
    expect(applyQuestion(restarted, q({ id: 'x', state: 'failed', rev: 9 })).questions[0].state).toBe('failed')
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
