import { describe, expect, it } from 'vitest'

import { escapeBlockStart, normalizeMath } from './index'

describe('normalizeMath', () => {
  it('makes a one-line $$..$$ a display block', () => {
    expect(normalizeMath('So\n$$x = 1$$\nthen')).toBe('So\n$$\nx = 1\n$$\nthen')
  })
  it('leaves a $$..$$ inside a sentence alone', () => {
    expect(normalizeMath('where $$x$$ is small')).toBe('where $$x$$ is small')
  })
  it('turns \\[..\\] into a block and \\(..\\) into inline math', () => {
    expect(normalizeMath('Here \\[ a^2 + b^2 \\] and \\(c\\).')).toBe('Here \n$$\na^2 + b^2\n$$\n and $c$.')
  })
  it('leaves citations and plain brackets alone', () => {
    expect(normalizeMath('See [p. 42] and [1].')).toBe('See [p. 42] and [1].')
  })
})

describe('escapeBlockStart', () => {
  it('keeps a comparison or a signed number from becoming a quote or a list', () => {
    expect(escapeBlockStart('> 0')).toBe('\\> 0')
    expect(escapeBlockStart('- 3')).toBe('\\- 3')
    expect(escapeBlockStart('1. first')).toBe('1\\. first')
    expect(escapeBlockStart('# of roots')).toBe('\\# of roots')
  })
  it('leaves everything else alone', () => {
    for (const s of ['= 0', '< 0', '$x > 0$', '-3', '>0', 'a > b']) expect(escapeBlockStart(s)).toBe(s)
  })
})
