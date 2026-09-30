import { describe, expect, it } from 'vitest'

import type { Block } from '@/api/gen/doc'
import { helpMeta } from './help-meta'

const t = (text: string) => ({ t: text })

describe('helpMeta', () => {
  it('counts the steps of a walkthrough', () => {
    const blocks = [{ type: 'step', title: [t('a')] }, { type: 'para', text: [t('x')] }, { type: 'step', title: [t('b')] }] as Block[]
    expect(helpMeta('walkthrough', blocks)).toBe('2 steps')
  })

  it('counts parts when a walkthrough has no steps, in the singular for one', () => {
    expect(helpMeta('walkthrough', [{ type: 'para', text: [t('x')] }] as Block[])).toBe('1 part')
  })

  it('counts the answer blocks', () => {
    const blocks = [{ type: 'answer', label: '(a)', text: [t('1')] }, { type: 'answer', label: '(b)', text: [t('2')] }] as Block[]
    expect(helpMeta('answers', blocks)).toBe('2 answers')
  })

  it('reads a hint as lines of about 60 characters, at least one', () => {
    expect(helpMeta('hint', [{ type: 'hint', text: [t('short')] }] as Block[])).toBe('1 line')
    expect(helpMeta('hint', [{ type: 'hint', text: [t('x'.repeat(130))] }] as Block[])).toBe('2 lines')
  })
})
