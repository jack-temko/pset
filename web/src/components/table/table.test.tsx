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

describe('Table fonts', () => {
  it('sets numbers and mono columns in mono, labels in Inter, and lets a column opt out', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const cols: TableColumn<Row>[] = [
      { key: 'stage', header: 'Stage', cell: (r) => r.stage },
      { key: 'model', header: 'Model', mono: true, cell: (r) => r.model },
      { key: 'ms', header: 'ms', numeric: true, cell: (r) => r.ms },
      { key: 'plain', header: 'Plain', numeric: true, mono: false, cell: (r) => r.ms },
    ]
    act(() => root.render(<Table caption="x" columns={cols} rows={rows} rowKey={(r) => r.stage} />))
    const [stage, model, ms, plain] = [...host.querySelectorAll('tbody tr:first-child td')].map((t) => t.className)
    expect(stage).not.toMatch(/font-mono|figure/)
    expect(model).toContain('font-mono')
    expect(ms).toContain('figure')
    expect(plain).not.toContain('figure')
    expect(plain).toContain('tabular-nums')
    // Headers are labels: never mono.
    expect(host.querySelector('thead')?.innerHTML).not.toMatch(/font-mono|figure/)
    act(() => root.unmount())
  })
})

describe('Table options', () => {
  it('goes fixed when columns give widths, and tightens the cells when dense', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const cols: TableColumn<Row>[] = [{ key: 'stage', header: 'Stage', cell: (r) => r.stage }, { key: 'ms', header: 'ms', width: '5rem', numeric: true, cell: (r) => r.ms }]
    act(() => root.render(<Table dense caption="Calls" columns={cols} rows={rows} rowKey={(r) => r.stage} />))
    expect(host.querySelector('table')?.className).toContain('table-fixed')
    expect(host.querySelectorAll('col')[1].style.width).toBe('5rem')
    expect(host.querySelector('td')?.className).toContain('px-3')
    // Its floor is the widths plus 10rem for the column with none.
    expect(host.querySelector('table')?.style.minWidth).toMatch(/15rem|5rem \+ 10rem/)
    act(() => root.unmount())
  })

  it('keeps a secondary line on one line unless its column lets it wrap', () => {
    const host = document.createElement('div')
    const root = createRoot(host)
    const cols: TableColumn<Row>[] = [
      { key: 'a', header: 'A', cell: (r) => r.stage, secondary: (r) => r.model },
      { key: 'b', header: 'B', width: '9rem', wrapSecondary: true, cell: (r) => r.stage, secondary: (r) => r.model },
    ]
    act(() => root.render(<Table caption="x" columns={cols} rows={rows} rowKey={(r) => r.stage} />))
    const [a, b] = [...host.querySelectorAll('tbody tr:first-child td div')]
    expect(a.className).toContain('whitespace-nowrap')
    expect(b.className).toContain('whitespace-normal')
    // Not wider than its column: a fixed table's secondary line is bounded by the cell.
    expect(b.className).not.toContain('min-w-40')
    expect(b.className).toContain('min-w-0')
    expect(b.className).toContain('max-w-full')
    act(() => root.unmount())
  })
})

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

  it('aligns cells on the first baseline', () => {
    const { host, done } = render()
    expect(host.querySelector('tbody td')?.className).toContain('align-baseline')
    done()
  })

  it('scrolls sideways inside its own frame', () => {
    const { host, done } = render()
    expect((host.firstElementChild as HTMLElement).className).toContain('overflow-x-auto')
    done()
  })
})
