import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it } from 'vitest'

import { Table, type TableColumn } from '.'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Row = { stage: string; model: string; ms: number; failed?: string }
const rows: Row[] = [
  { stage: 'Find', model: 'a/b', ms: 2100 },
  { stage: 'Guide', model: 'c/d', ms: 900, failed: 'rate limited (429)' },
]
const columns: TableColumn<Row>[] = [
  { key: 'stage', header: 'Stage', cell: (r) => r.stage, secondary: (r) => r.failed },
  { key: 'ms', header: 'ms', numeric: true, cell: (r) => r.ms },
]

function render() {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<Table caption="Calls" columns={columns} rows={rows} rowKey={(r) => r.stage} error={(r) => !!r.failed} />))
  return { host, done: () => act(() => root.unmount()) }
}

describe('Table', () => {
  it('names itself, heads its columns, and aligns numbers right', () => {
    const { host, done } = render()
    expect(host.querySelector('caption')?.textContent).toBe('Calls')
    const heads = [...host.querySelectorAll('th')]
    expect(heads.map((h) => h.textContent)).toEqual(['Stage', 'ms'])
    expect(heads[1].className).toContain('text-right')
    expect(heads[1].className).toContain('tabular-nums')
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2)
    expect(host.querySelector('tbody td:nth-child(2)')?.className).toContain('text-right')
    done()
  })

  it('shows a secondary line and tints only the error row', () => {
    const { host, done } = render()
    const [ok, bad] = [...host.querySelectorAll('tbody tr')]
    expect(bad.textContent).toContain('rate limited (429)')
    expect(bad.className).toContain('bg-destructive-soft')
    expect(ok.className).not.toContain('bg-destructive-soft')
    // Only the secondary line carries the error ink, not every cell.
    expect(bad.querySelector('td:nth-child(2)')?.className).not.toContain('text-destructive')
    expect(bad.querySelector('td:first-child div')?.className).toContain('text-destructive')
    done()
  })

  it('scrolls sideways inside its own frame', () => {
    const { host, done } = render()
    expect((host.firstElementChild as HTMLElement).className).toContain('overflow-x-auto')
    done()
  })
})
