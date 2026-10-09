import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it } from 'vitest'

import { useLastCount } from './last-count'

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
