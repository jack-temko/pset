import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import type { BookUsage, Detail } from '@/api/gen/usage'
import { BookUsageDialog, Fig, UsageModal } from '.'

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
    { label: 'Run 1', calls: [{ id: 1, at: '2026-09-29T10:00:00Z', stage: 'Guide', asked: 'x/model-a', answered: 'y/model-b', ms: 4_000, tokensIn: 100, tokensOut: 10, cost: 0.001 }] },
    { label: 'Run 2', calls: [{ id: 2, at: '2026-09-29T10:05:00Z', stage: 'Guide', asked: 'x/model-a', ms: 800, error: 'timeout' }] },
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

  it('sets figures and model ids in mono and labels in Inter', () => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<UsageModal open onClose={noop} name="x" detail={detail} />))
    const mono = [...document.querySelectorAll('dialog .figure, dialog .font-mono')].map((e) => e.textContent ?? '')
    expect(mono.some((t) => t.includes('model-b'))).toBe(true)
    expect(mono).toContain('30,000')
    expect([...document.querySelectorAll('dialog dt')].every((e) => !/figure|font-mono/.test(e.className))).toBe(true)
    act(() => root.unmount())
    host.remove()
  })

  it('says it is loading, failed, or had no calls', () => {
    // Loading holds the layout: the totals' labels and the stages table's header, no spinner line.
    const loading = textOf(<UsageModal open onClose={noop} name="x" loading />)
    expect(loading).toContain('Tokens in')
    expect(loading).toContain('Attempts')
    expect(loading).not.toContain('Loading')
    expect(textOf(<UsageModal open onClose={noop} name="x" error />)).toContain("Couldn't load")
    expect(textOf(<UsageModal open onClose={noop} name="x" detail={null} />)).toContain('No model calls were made')
  })

  it('marks a minimum when a call reported nothing', () => {
    const partial: Detail = { ...detail, total: { ...detail.total, uncounted: 1 } }
    expect(textOf(<UsageModal open onClose={noop} name="x" detail={partial} />)).toMatch(/≥ at least \$0\.0031/)
  })
})

describe('UsageModal layout', () => {
  const labels = (d: Detail, sel: string) => {
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<UsageModal open onClose={noop} name="x" detail={d} />))
    const out = [...document.querySelectorAll(sel)].map((e) => e.textContent)
    act(() => root.unmount())
    host.remove()
    return out
  }

  it('lays the totals out as what happened, then the tokens, leaving out counts nobody gave', () => {
    expect(labels(detail, 'dt')).toEqual(['Time', 'Calls', 'Failed', 'Cost', 'Tokens in', 'Tokens out', 'Cached', 'Reasoning'])
    const bare: Detail = { ...detail, total: { ...detail.total, cached: undefined, reasoning: undefined } }
    expect(labels(bare, 'dt')).toEqual(['Time', 'Calls', 'Failed', 'Cost', 'Tokens in', 'Tokens out'])
  })

  it('shows a call as seconds to the hundredth under Time, and when it started under At', () => {
    const d: Detail = { ...detail, runs: [{ label: 'Calls', calls: [{ id: 1, at: '2026-09-29T10:00:00Z', stage: 'Guide', asked: 'a/b', ms: 6370, cost: 0.001 }] }] }
    const heads = labels(d, 'section:last-of-type th')
    expect(heads.slice(0, 4)).toEqual(['At', 'Stage', 'Model', 'Time'])
    expect(labels(d, 'section:last-of-type td')).toContain('6.37s')
  })

  it('gives every run the same fixed columns, so they line up', () => {
    const cols = (sel: string) => labels(detail, sel)
    expect(cols('table').length).toBeGreaterThan(1)
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<UsageModal open onClose={noop} name="x" detail={detail} />))
    const widths = [...document.querySelectorAll('table')].slice(1).map((t) => [...t.querySelectorAll('col')].map((c) => c.style.width).join())
    expect(new Set(widths).size).toBe(1)
    expect(document.querySelector('table')?.className).toContain('table-fixed')
    act(() => root.unmount())
    host.remove()
  })
})

describe('UsageModal tool lists', () => {
  it('keeps the tools on one line with the whole list in a tooltip, and lets an error wrap', () => {
    const d: Detail = {
      ...detail,
      runs: [{ label: 'Calls', calls: [
        { id: 1, at: '2026-09-29T10:00:00Z', stage: 'Round 2', tools: 'search_pages,read_page', asked: 'a/b', ms: 100 },
        { id: 2, at: '2026-09-29T10:00:01Z', stage: 'Guide', asked: 'a/b', ms: 100, error: 'rate limited (429)' },
      ] }],
    }
    const host = document.createElement('div')
    document.body.append(host)
    const root = createRoot(host)
    act(() => root.render(<UsageModal open onClose={noop} name="x" detail={d} />))
    const tools = document.querySelector('[title="search_pages, read_page"]')!
    expect(tools.className).toContain('truncate')
    expect(document.body.textContent).toContain('rate limited (429)')
    expect(document.querySelector('.truncate[title*="429"]')).toBeNull()
    act(() => root.unmount())
    host.remove()
  })
})

describe('Fig', () => {
  const render = (partial: boolean) => {
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<Fig text="$0.0054" partial={partial} />))
    return { host, done: () => act(() => root.unmount()) }
  }

  it('hangs the mark outside the number, so a cell with it and one without share a number box', () => {
    const marked = render(true)
    const plain = render(false)
    const box = marked.host.querySelector('.relative')!
    // The number is the box's own text; the mark is absolutely placed to its left.
    expect(box.firstChild?.textContent).toBe('$0.0054')
    const mark = box.querySelector('[aria-hidden]')!
    expect(mark.textContent).toBe('≥')
    expect(mark.className).toMatch(/absolute/)
    expect(mark.className).toMatch(/right-full/)
    expect(mark.className).toContain('font-sans')
    expect(plain.host.textContent).toBe('$0.0054')
    expect(plain.host.querySelector('[aria-hidden]')).toBeNull()
    marked.done()
    plain.done()
  })

  it('puts the mark before the number, in the flow, in a left-aligned value', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<Fig text="43,800" partial inline />))
    expect(host.querySelector('.absolute')).toBeNull()
    expect(host.textContent).toMatch(/^≥ at least 43,800$/)
    act(() => root.unmount())
  })

  it('has no mark on a dash', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    act(() => root.render(<Fig text="–" partial />))
    expect(host.textContent).toBe('–')
    act(() => root.unmount())
  })
})

describe('UsageModal calls', () => {
  const twin = { at: '2026-09-29T10:00:00Z', stage: 'Figures', asked: 'a/b', answered: 'a/b', ms: 0 }
  it('keeps calls that look alike apart, keyed by their row', () => {
    const d: Detail = { ...detail, runs: [{ label: 'Calls', calls: [{ id: 1, ...twin }, { id: 2, ...twin }] }] }
    const text = textOf(<UsageModal open onClose={noop} name="x" detail={d} />)
    expect(text.split('Figures').length - 1).toBe(2)
  })

  it('shows the reasoning column only when a call counted reasoning', () => {
    const none: Detail = { ...detail, runs: [{ label: 'Calls', calls: [{ id: 1, ...twin }] }] }
    const some: Detail = { ...detail, runs: [{ label: 'Calls', calls: [{ id: 1, ...twin, reasoning: 120 }] }] }
    const headers = (d: Detail) => {
      const host = document.createElement('div')
      document.body.append(host)
      const root = createRoot(host)
      act(() => root.render(<UsageModal open onClose={noop} name="x" detail={d} />))
      const th = [...document.querySelectorAll('dialog table:last-of-type th')].map((t) => t.textContent)
      act(() => root.unmount())
      host.remove()
      return th
    }
    expect(headers(none)).not.toContain('Reasoning')
    expect(headers(some)).toContain('Reasoning')
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
      runs: [{ label: 'Calls', calls: [{ id: 3, at: '2026-09-29T10:00:00Z', stage: 'Naming', asked: 'a/b', ms: 2_000, cost: 0.001 }] }],
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
