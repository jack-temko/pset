import { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import type { Block } from '@/api/gen/doc'

import { Document } from '.'
import type { Sel } from './selection'

// React reads this to know updates are wrapped in act().
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const t = (text: string) => [{ t: text }]
const DOC: Block[] = [
  { type: 'part', label: '(a)', title: t('Eigenvalues') },
  { type: 'step', title: t('Solve it') },
  { type: 'para', text: t('First paragraph.') },
  { type: 'para', text: t('Second paragraph.') },
]

let host: HTMLDivElement
let root: Root
let log: string[]

beforeEach(() => {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  log = []
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
})

function Harness() {
  const [selected, setSelected] = useState<Sel | null>(null)
  return (
    <>
      <Document
        blocks={DOC}
        ask={{
          selected,
          onPick: (s) => {
            log.push(`pick ${s}`)
            setSelected(s)
          },
          onAsk: (s) => log.push(`ask ${s}`),
          onClear: () => {
            log.push('clear')
            setSelected(null)
          },
        }}
      />
      <textarea data-esc-lets-go />
      <textarea data-plain />
    </>
  )
}

const click = (el: Element | null) => act(() => void el?.dispatchEvent(new MouseEvent('click', { bubbles: true })))
const over = (el: Element | null) => act(() => void el?.dispatchEvent(new MouseEvent('mouseover', { bubbles: true })))
const text = (s: string) => [...host.querySelectorAll('p')].find((p) => p.textContent === s) ?? null
const esc = (target: Element) => act(() => void target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })))

describe('Document selection', () => {
  beforeEach(() => act(() => root.render(<Harness />)))

  it('picks the block under the pointer, and the heading picks its group', () => {
    click(text('Second paragraph.'))
    expect(log).toEqual(['pick b3'])
    click(host.querySelector('h3'))
    expect(log).toEqual(['pick b3', 'pick s1'])
    click(host.querySelector('header'))
    expect(log.at(-1)).toBe('pick p0')
  })

  it("the group's own whitespace points at nothing", () => {
    // The wrapper around a step's blocks, between the paragraphs.
    const gap = text('First paragraph.')!.closest('[data-sel="s1"]')
    click(gap)
    over(gap)
    expect(log).toEqual([])
    expect(host.querySelector('[class*="bg-muted"]')).toBeNull()
  })

  it('the toolbar keeps its own clicks, padding included', () => {
    click(text('First paragraph.'))
    const bar = host.querySelector('[data-sel-toolbar]')!
    click(bar)
    expect(log).toEqual(['pick b2'])
    click(bar.querySelector('button'))
    expect(log).toEqual(['pick b2', 'ask b2'])
  })

  it('clicking the outlined element again lets go', () => {
    click(text('First paragraph.'))
    click(text('First paragraph.'))
    expect(log).toEqual(['pick b2', 'clear'])
  })

  it('Esc lets go, from the page and from the composer, but not from other text boxes', () => {
    click(text('First paragraph.'))
    esc(host.querySelector('textarea[data-plain]')!)
    expect(log).toEqual(['pick b2'])
    esc(host.querySelector('textarea[data-esc-lets-go]')!)
    expect(log).toEqual(['pick b2', 'clear'])
    click(text('First paragraph.'))
    esc(document.body)
    expect(log.at(-1)).toBe('clear')
  })
})
