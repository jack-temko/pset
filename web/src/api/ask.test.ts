import { describe, expect, it } from 'vitest'

import { applyTurn, type LiveTurn, type Turn } from './ask'

const turn = (over: Partial<Turn> = {}): Turn => ({
  id: 't1',
  bookId: 'b1',
  question: 'What is an eigenvalue?',
  steps: [],
  answer: [],
  state: 'running',
  createdAt: '2026-09-24T01:00:00.000000000Z',
  updatedAt: '2026-09-24T01:00:00.000000000Z',
  ...over,
})

describe('applyTurn', () => {
  it('keeps a newer turn when an older reply lands late', () => {
    // The job's first step arrived before the reply to the question.
    const stepped: LiveTurn = turn({
      steps: [{ label: 'Searching "eigenvalue"…', running: true, after: 0 }],
      updatedAt: '2026-09-24T01:00:00.200000000Z',
    })
    const list = [stepped]
    expect(applyTurn(list, turn())).toBe(list)
  })

  it('applies a newer copy, and an equal one', () => {
    const list = [turn()]
    const done = turn({ state: 'done', updatedAt: '2026-09-24T01:00:05.000000000Z' })
    expect(applyTurn(list, done)[0].state).toBe('done')
    expect(applyTurn(list, turn({ question: 'same moment' }))[0].question).toBe('same moment')
  })

  it('adds a turn it has not seen', () => {
    expect(applyTurn([], turn())).toHaveLength(1)
  })
})
