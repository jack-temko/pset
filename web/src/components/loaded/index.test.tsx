import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { GRACE_MS } from '@/lib/settled'
import { Loaded } from '.'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Q = { data: string | undefined; isPending: boolean; isError: boolean }
const pending: Q = { data: undefined, isPending: true, isError: false }
const loaded: Q = { data: 'hello', isPending: false, isError: false }
const failed: Q = { data: undefined, isPending: false, isError: true }

let host: HTMLDivElement
let root: Root
const show = (q: Q) =>
  act(() =>
    root.render(
      <Loaded query={q} skeleton={<span data-testid="sk">...</span>}>
        {(d) => <span>{d}</span>}
      </Loaded>,
    ),
  )
const box = () => host.firstElementChild as HTMLElement

beforeEach(() => {
  vi.useFakeTimers()
  host = document.createElement('div')
  document.body.append(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  vi.useRealTimers()
})

describe('Loaded', () => {
  it('holds the skeleton in layout but hidden during the grace, then shows it', () => {
    show(pending)
    expect(host.querySelector('[data-testid=sk]')).not.toBeNull()
    expect(box().className).toContain('invisible')
    act(() => void vi.advanceTimersByTime(GRACE_MS))
    expect(box().className).not.toContain('invisible')
  })

  it('is busy while pending', () => {
    show(pending)
    expect(box().getAttribute('aria-busy')).toBe('true')
  })

  it('fades content that replaces a skeleton', () => {
    show(pending)
    show(loaded)
    expect(host.textContent).toBe('hello')
    expect(box().className).toContain('fade-in')
    expect(box().hasAttribute('aria-busy')).toBe(false)
  })

  it('shows cached data at once, without the fade', () => {
    show(loaded)
    expect(host.textContent).toBe('hello')
    expect(box().className).not.toContain('fade-in')
  })

  it('says one line when the query failed', () => {
    show(failed)
    expect(host.textContent).toMatch(/Couldn't load/)
  })
})
