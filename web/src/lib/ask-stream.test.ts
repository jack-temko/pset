import { describe, expect, it } from 'vitest'
import {
  applyChatEvent as applyAskEvent,
  consultedPages,
  messagePages,
  segmentsToText,
} from './ask-stream'
import type { EnvelopePayload, Message } from './types'

describe('applyAskEvent', () => {
  it('folds deltas into prose segments, merging neighbours', () => {
    let segs = applyAskEvent([], { type: 'delta', text: 'One ' })
    segs = applyAskEvent(segs, { type: 'delta', text: 'two [p. 3].' })
    expect(segs).toEqual([{ type: 'prose', text: 'One two [p. 3].' }])
  })

  it('ignores empty deltas and events that carry no content', () => {
    const segs = applyAskEvent([{ type: 'prose', text: 'kept' }], {
      type: 'done',
      messageId: 'm1',
    })
    expect(segs).toEqual([{ type: 'prose', text: 'kept' }])
    expect(applyAskEvent([], { type: 'delta', text: '' })).toEqual([])
  })

  it('holds a pending tail on envelope-start and flags the repair round', () => {
    let segs = applyAskEvent([{ type: 'prose', text: 'Before.' }], {
      type: 'envelope-start',
      kind: 'equation',
    })
    expect(segs).toEqual([
      { type: 'prose', text: 'Before.' },
      { type: 'pending', kind: 'equation', repairing: false },
    ])
    segs = applyAskEvent(segs, { type: 'envelope-repairing', kind: 'equation' })
    expect(segs.at(-1)).toEqual({ type: 'pending', kind: 'equation', repairing: true })
  })

  it('swaps the pending tail for each validated envelope kind', () => {
    for (const kind of ['equation', 'steps', 'theorem', 'definition', 'note'] as const) {
      const segs = applyAskEvent([{ type: 'pending', kind, repairing: false }], {
        type: 'envelope',
        kind,
        payload: { title: 'T' } as EnvelopePayload,
      })
      expect(segs.at(-1)).toMatchObject({ type: 'envelope', kind })
      expect(segs.some((s) => s.type === 'pending')).toBe(false)
    }
  })

  it('replaces the pending tail with a code segment on envelope-failed', () => {
    const segs = applyAskEvent(
      [
        { type: 'prose', text: 'Hi.' },
        { type: 'pending', kind: 'note', repairing: true },
      ],
      { type: 'envelope-failed', kind: 'note', raw: '{"broken": true' },
    )
    expect(segs).toEqual([
      { type: 'prose', text: 'Hi.' },
      { type: 'code', text: '{"broken": true' },
    ])
  })

  it('appends a failed envelope even without a pending tail', () => {
    const segs = applyAskEvent([], { type: 'envelope-failed', kind: 'note', raw: 'raw' })
    expect(segs).toEqual([{ type: 'code', text: 'raw' }])
  })
})

describe('segmentsToText', () => {
  it('renders the answer back to markdown with re-fenced envelopes', () => {
    const text = segmentsToText([
      { type: 'prose', text: 'Here [p. 3].\n' },
      { type: 'envelope', kind: 'equation', payload: { title: 'T', equations: ['x = 1'] } },
      { type: 'code', text: 'broken' },
      { type: 'pending', kind: 'note', repairing: false },
    ])
    expect(text).toBe(
      'Here [p. 3].\n```equation\n{"title":"T","equations":["x = 1"]}\n```\n```\nbroken\n```\n',
    )
  })
})

describe('tool events', () => {
  it('shows a running card, then replaces it with its result in place', () => {
    let segs = applyAskEvent([{ type: 'prose', text: 'Let me check. ' }], {
      type: 'tool-start',
      id: 't1',
      tool: 'calc',
      args: { expression: '7/3' },
    })
    expect(segs[1]).toEqual({
      type: 'tool-running',
      id: 't1',
      tool: 'calc',
      args: { expression: '7/3' },
    })

    segs = applyAskEvent(segs, {
      type: 'tool-result',
      id: 't1',
      tool: 'calc',
      args: { expression: '7/3' },
      ok: true,
      summary: '7/3',
    })
    expect(segs).toEqual([
      { type: 'prose', text: 'Let me check. ' },
      {
        type: 'tool',
        kind: 'calc',
        payload: {
          id: 't1',
          tool: 'calc',
          args: { expression: '7/3' },
          result: '7/3',
          ok: true,
          pages: undefined,
        },
      },
    ])
  })

  it('settles a result whose card is no longer the tail', () => {
    // Two calls in one round: the second card lands after the first, and
    // the first result must still replace the first card.
    let segs = applyAskEvent([], { type: 'tool-start', id: 'a', tool: 'calc' })
    segs = applyAskEvent(segs, { type: 'tool-start', id: 'b', tool: 'read_page' })
    segs = applyAskEvent(segs, { type: 'tool-result', id: 'a', tool: 'calc', ok: true, summary: '4' })
    expect(segs.map((s) => s.type)).toEqual(['tool', 'tool-running'])
    expect(segs[1]).toMatchObject({ id: 'b' })
  })

  it('keeps tool cards out of the copied answer', () => {
    const text = segmentsToText([
      { type: 'tool', kind: 'calc', payload: { id: 't', tool: 'calc', ok: true, result: '4' } },
      { type: 'prose', text: 'It is 4.\n' },
    ])
    expect(text).toBe('It is 4.\n')
  })
})

describe('consultedPages', () => {
  it('lists retrieval first, then what the tools read, deduped in order', () => {
    const pages = consultedPages(
      [3, 7],
      [
        {
          type: 'tool',
          kind: 'search_book',
          payload: { id: 's', tool: 'search_book', ok: true, pages: [7, 12] },
        },
        {
          type: 'tool',
          kind: 'read_page',
          payload: { id: 'r', tool: 'read_page', ok: true, pages: [12, 4] },
        },
      ],
    )
    expect(pages).toEqual([3, 7, 12, 4])
  })

  it('ignores tools that read nothing', () => {
    expect(
      consultedPages([3], [{ type: 'tool', kind: 'calc', payload: { id: 'c', tool: 'calc', ok: true } }]),
    ).toEqual([3])
  })

  it('falls back to a legacy message’s stored citations', () => {
    const legacy: Message = {
      id: 'm1',
      role: 'assistant',
      content: '',
      segments: [{ type: 'prose', text: 'Old answer [p. 3].' }],
      citations: [3, 4],
      createdAt: '2026-01-01T00:00:00Z',
    }
    expect(messagePages(legacy)).toEqual([3, 4])
  })
})
