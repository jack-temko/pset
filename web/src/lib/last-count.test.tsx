import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'

import { useLastCount, useLastShape } from './last-count'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

function Probe({ k, count }: { k: string; count?: number }) {
  return <span>{useLastCount(k, count)}</span>
}

function render(k: string, count?: number): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<Probe k={k} count={count} />))
  const text = host.textContent ?? ''
  act(() => root.unmount())
  return text
}

beforeEach(() => localStorage.clear())

describe('useLastCount', () => {
  it('is 3 when nothing is saved', () => {
    expect(render('a')).toBe('3')
  })

  it('returns what the list showed last time, per key', () => {
    render('a', 7)
    expect(render('a')).toBe('7')
    expect(render('b')).toBe('3')
  })

  it('falls back to 3 when storage throws', () => {
    const real = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('off')
    }
    try {
      expect(render('a')).toBe('3')
    } finally {
      Storage.prototype.getItem = real
    }
  })
})

const isNums = (x: unknown): x is number[] => Array.isArray(x) && x.length <= 4 && x.every((n) => n === 0 || n === 1)

function ShapeProbe({ k, shape }: { k: string; shape?: number[] }) {
  return <span>{JSON.stringify(useLastShape(k, shape, [9], isNums))}</span>
}

function renderShape(k: string, shape?: number[]): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  act(() => root.render(<ShapeProbe k={k} shape={shape} />))
  const text = host.textContent ?? ''
  act(() => root.unmount())
  return text
}

describe('useLastShape', () => {
  it('draws the fallback when nothing is saved', () => {
    expect(renderShape('s')).toBe('[9]')
  })

  it('returns the saved shape, per key', () => {
    renderShape('s', [0, 1])
    expect(renderShape('s')).toBe('[0,1]')
    expect(renderShape('t')).toBe('[9]')
  })

  it('is fixed at mount: the new shape only shows next time', () => {
    renderShape('s', [1])
    expect(renderShape('s', [0, 0, 0])).toBe('[1]')
    expect(renderShape('s')).toBe('[0,0,0]')
  })

  it('falls back on an invalid, foreign or unparsable saved value', () => {
    for (const bad of ['[2]', '{"a":1}', '"x"', '[0,0,0,0,0]', 'not json']) {
      localStorage.setItem('pset:last-count:s', bad)
      expect(renderShape('s')).toBe('[9]')
    }
  })

  it('falls back when storage throws', () => {
    const real = Storage.prototype.getItem
    Storage.prototype.getItem = () => {
      throw new Error('off')
    }
    try {
      expect(renderShape('s')).toBe('[9]')
    } finally {
      Storage.prototype.getItem = real
    }
  })
})
