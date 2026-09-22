import { describe, expect, it } from 'vitest'

import { normalizeMath } from './index'

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
