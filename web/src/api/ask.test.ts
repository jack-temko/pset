import { describe, expect, it } from 'vitest'

import { applyTurn, stream, type LiveTurn, type Turn } from './ask'
import type { Block } from './gen/doc'

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

describe('the block stream', () => {
  const para: Block = { type: 'para', text: [{ t: 'Since ' }, { m: '1/p' }] }

  it('draws a skeleton, fills it as the text streams, and replaces it with the block', () => {
    let t: LiveTurn = turn()
    t = stream.start(t, 'para')
    expect(t.pending).toEqual({ type: 'para', runs: [], repairing: false })
    t = stream.text(t, [{ t: 'Since ' }])
    t = stream.text(t, [{ m: '1/p' }])
    expect(t.pending?.runs).toEqual([{ t: 'Since ' }, { m: '1/p' }])
    t = stream.block(t, para)
    expect(t.pending).toBeUndefined()
    expect(t.answer).toEqual([para])
  })

  it('says a block is being tidied, and keeps the words already there', () => {
    let t = stream.text(stream.start(turn(), 'para'), [{ t: 'So' }])
    t = stream.repairing(t, 'para')
    expect(t.pending).toEqual({ type: 'para', runs: [{ t: 'So' }], repairing: true })
  })

  it('a block that repairs before its type was seen still gets a skeleton', () => {
    expect(stream.repairing(turn(), 'derivation').pending?.type).toBe('derivation')
  })
})
