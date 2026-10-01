import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import type { Usage } from '@/api/gen/usage'
import { UsageText } from '.'

// React reads this to know updates are wrapped in act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

/** The text of a UsageText, rendered. */
function textOf(u: Usage): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<UsageText usage={u} />))
  const text = host.textContent ?? ''
  act(() => root.unmount())
  return text
}

const usage = (over: Partial<Usage> = {}): Usage => ({
  rows: [
    { model: 'deepseek/deepseek-v4', ms: 21_400, tokens: 9_812, cost: 0.0041, calls: 3 },
    { model: 'perceptron/isaac-0.2', ms: 3_200, tokens: 1_204, cost: 0.0006, calls: 1 },
  ],
  total: { ms: 24_600, tokens: 11_016, cost: 0.0047, calls: 4 },
  failed: 0,
  ...over,
})

describe('UsageText', () => {
  it('reads model, time, tokens, cost, in that order, with the other models counted', () => {
    expect(textOf(usage())).toBe('deepseek-v4 +1·25s·11,016 tokens·$0.0047')
  })

  it('marks a minimum when a call reported nothing, and says nothing for no calls', () => {
    const partial = usage({ total: { ms: 5_000, tokens: 800, cost: 0.001, calls: 2, uncounted: 1 }, rows: [{ model: 'a/b', ms: 5_000, calls: 2 }] })
    expect(textOf(partial)).toBe('b·5.0s·≥ 800 tokens·≥ $0.0010')
    expect(textOf(usage({ rows: [] }))).toBe('')
  })
})
