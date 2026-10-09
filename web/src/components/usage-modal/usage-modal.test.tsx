import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import type { BookUsage, Detail } from '@/api/gen/usage'
import { BookUsageDialog, UsageModal } from '.'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
HTMLDialogElement.prototype.showModal = function () {
  this.setAttribute('open', '')
}

const noop = () => {}

function textOf(node: React.ReactNode): string {
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host)
  act(() => root.render(node))
  const text = document.body.querySelector('dialog')?.textContent ?? ''
  act(() => root.unmount())
  host.remove()
  return text
}

const detail: Detail = {
  total: { ms: 14_000, tokensIn: 30_000, tokensOut: 5_000, reasoning: 2_000, cached: 9_000, cost: 0.0031, calls: 3, failed: 0 },
  stages: [
    { name: 'Guide', attempts: 2, calls: 2, ms: 12_000, tokensIn: 28_000, tokensOut: 4_900, cost: 0.003 },
    { name: 'Rank', attempts: 1, calls: 1, ms: 1_000, tokensIn: 400, tokensOut: 100, cost: 0.0001, shared: 3 },
  ],
  runs: [
    { label: 'Run 1', calls: [{ at: '2026-09-29T10:00:00Z', stage: 'Guide', asked: 'x/model-a', answered: 'y/model-b', ms: 4_000, tokensIn: 100, tokensOut: 10, cost: 0.001 }] },
    { label: 'Run 2', calls: [{ at: '2026-09-29T10:05:00Z', stage: 'Guide', asked: 'x/model-a', ms: 800, error: 'timeout' }] },
  ],
}

describe('UsageModal', () => {
  it('shows totals, stages with attempts and a shared mark, and every call by run', () => {
    const text = textOf(<UsageModal open onClose={noop} name="Problem 3.14" detail={detail} />)
    expect(text).toContain('Usage · Problem 3.14')
    expect(text).toContain('Tokens in30,000')
    expect(text).toContain('Reasoning2,000')
    expect(text).toContain('Shared with 3 questions')
    expect(text).toContain('Run 1')
    expect(text).toContain('Run 2')
    // The model that answered, with the one asked for under it; a dash for a failed call's counts.
    expect(text).toContain('model-b')
    expect(text).toContain('asked model-a')
    expect(text).toContain('timeout')
  })

  it('says it is loading, failed, or had no calls', () => {
    expect(textOf(<UsageModal open onClose={noop} name="x" loading />)).toContain('Loading the details')
    expect(textOf(<UsageModal open onClose={noop} name="x" error />)).toContain("Couldn't load")
    expect(textOf(<UsageModal open onClose={noop} name="x" detail={null} />)).toContain('No model calls were made')
  })

  it('marks a minimum when a call reported nothing', () => {
    const partial: Detail = { ...detail, total: { ...detail.total, uncounted: 1 } }
    expect(textOf(<UsageModal open onClose={noop} name="x" detail={partial} />)).toContain('≥ $0.0031')
  })
})

describe('BookUsageDialog', () => {
  const book: BookUsage = {
    total: { ms: 20_000, tokensIn: 40_000, tokensOut: 6_000, cost: 0.01, calls: 9, failed: 0 },
    kinds: [
      { kind: 'questions', items: 2, total: { ms: 9_000, tokensIn: 20_000, tokensOut: 3_000, cost: 0.005, calls: 4, failed: 0 } },
      { kind: 'ask', items: 1, total: { ms: 3_000, tokensIn: 5_000, tokensOut: 800, cost: 0.002, calls: 2, failed: 0 } },
      { kind: 'import', items: 1, total: { ms: 8_000, tokensIn: 15_000, tokensOut: 2_200, cost: 0.003, calls: 3, failed: 0 } },
    ],
    import: {
      total: { ms: 8_000, cost: 0.003, calls: 3, failed: 0 },
      stages: [{ name: 'Naming', attempts: 1, calls: 1, ms: 2_000, cost: 0.001 }, { name: 'Contents', attempts: 1, calls: 2, ms: 6_000, cost: 0.002 }],
      runs: [{ label: 'Calls', calls: [{ at: '2026-09-29T10:00:00Z', stage: 'Naming', asked: 'a/b', ms: 2_000, cost: 0.001 }] }],
    },
  }

  it('shows the book total, a row for each kind, then the import stages', () => {
    const text = textOf(<BookUsageDialog open onClose={noop} title="Circuits" data={book} />)
    expect(text).toContain('Usage · Circuits')
    for (const k of ['Questions', 'Ask answers', 'Import']) expect(text).toContain(k)
    expect(text).toContain('Naming')
    expect(text).toContain('Contents')
  })
})
