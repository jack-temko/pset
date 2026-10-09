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

/** jsdom has no layout: a box's height is the data-h of its first child. */
function mockHeights() {
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get(this: HTMLElement) {
      return Number((this.firstElementChild as HTMLElement | null)?.dataset.h ?? 0)
    },
  })
}

describe('Loaded morph', () => {
  const sized = (q: Q, skeletonH: number, contentH: number) =>
    act(() =>
      root.render(
        <Loaded query={q} skeleton={<span data-h={skeletonH}>...</span>}>
          {(d) => <span data-h={contentH}>{d}</span>}
        </Loaded>,
      ),
    )
  const frame = () => act(() => void vi.advanceTimersByTime(20))

  beforeEach(mockHeights)
  afterEach(() => {
    delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight
    vi.unstubAllGlobals()
  })

  it('morphs from the skeleton height to the content height when they differ', () => {
    sized(pending, 100, 40)
    sized(loaded, 100, 40)
    frame()
    const morph = host.querySelector<HTMLElement>('[data-morph]')
    expect(morph).not.toBeNull()
    expect(morph!.style.height).toBe('40px')
    expect(morph!.style.transition).toContain('200ms')
    act(() => void vi.advanceTimersByTime(300))
    expect(host.querySelector('[data-morph]')).toBeNull()
    expect(host.textContent).toBe('hello')
  })

  it('skips the morph when the heights are within 2px', () => {
    sized(pending, 100, 101)
    sized(loaded, 100, 101)
    frame()
    expect(host.querySelector('[data-morph]')).toBeNull()
    expect(box().className).toContain('fade-in')
  })

  it('does not morph cached data', () => {
    sized(loaded, 100, 40)
    frame()
    expect(host.querySelector('[data-morph]')).toBeNull()
    expect(box().className).not.toContain('fade-in')
  })

  it('neither morphs nor fades under reduced motion', () => {
    vi.stubGlobal('matchMedia', () => ({ matches: true }))
    sized(pending, 100, 40)
    sized(loaded, 100, 40)
    frame()
    expect(host.querySelector('[data-morph]')).toBeNull()
    expect(box().className).not.toContain('fade-in')
    expect(host.textContent).toBe('hello')
  })
})
