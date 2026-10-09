import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { INTENT_MS, usePrefetchIntent } from './prefetch-intent'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let host: HTMLDivElement
let root: Root
const prefetch = vi.fn()

function Trigger({ run }: { run: () => void }) {
  const intent = usePrefetchIntent(run)
  return <button {...intent}>x</button>
}

const button = () => host.querySelector('button')!
const fire = (type: string, init: PointerEventInit = {}) =>
  act(() => void button().dispatchEvent(new PointerEvent(type, { bubbles: true, pointerType: 'mouse', ...init })))

beforeEach(() => {
  vi.useFakeTimers()
  prefetch.mockClear()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
  act(() => root.render(<Trigger run={prefetch} />))
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

describe('usePrefetchIntent', () => {
  it('does nothing for a pointer passing through', () => {
    fire('pointerover')
    act(() => void vi.advanceTimersByTime(INTENT_MS - 10))
    fire('pointerout')
    act(() => void vi.advanceTimersByTime(200))
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('prefetches once after the dwell', () => {
    fire('pointerover')
    act(() => void vi.advanceTimersByTime(INTENT_MS))
    expect(prefetch).toHaveBeenCalledTimes(1)
  })

  it('prefetches at once on a press and on focus', () => {
    fire('pointerdown')
    expect(prefetch).toHaveBeenCalledTimes(1)
    act(() => void button().dispatchEvent(new FocusEvent('focusin', { bubbles: true })))
    expect(prefetch).toHaveBeenCalledTimes(2)
  })

  it('ignores a touch pointer hovering', () => {
    fire('pointerover', { pointerType: 'touch' })
    act(() => void vi.advanceTimersByTime(500))
    expect(prefetch).not.toHaveBeenCalled()
  })

  it('asks the server once for repeated hovers while the answer is cached', async () => {
    vi.useRealTimers()
    const qc = new QueryClient()
    const queryFn = vi.fn(async () => 1)
    const run = () => void qc.prefetchQuery({ queryKey: ['x'], queryFn, staleTime: Infinity })
    act(() => root.render(<Trigger run={run} />))
    for (let i = 0; i < 3; i++) {
      fire('pointerdown')
      await act(async () => void (await new Promise((r) => setTimeout(r, 5))))
    }
    expect(queryFn).toHaveBeenCalledTimes(1)
  })
})
