import { describe, expect, it } from 'vitest'

import { PageMap } from './pages'

// Boyce's Differential Equations as scanned: printed page 85 is lost.
const boyce = new PageMap([
  { from: 1, offset: 12 },
  { from: 97, offset: 11 },
])

describe('PageMap', () => {
  it('names pages on both sides of a lost page', () => {
    for (const [pdf, printed] of [
      [13, 1],
      [45, 33],
      [96, 84],
      [97, 86],
      [123, 112],
    ]) {
      expect(boyce.printed(pdf)).toBe(printed)
      expect(boyce.pdf(printed)).toBe(pdf)
    }
    expect(boyce.label(3)).toBe('iii')
    expect(boyce.printed(12)).toBeNull()
  })

  it('knows the lost page is lost, and lands beside it', () => {
    expect(boyce.pdf(85)).toBeNull()
    expect(boyce.nearest(85)).toBe(97)
    expect(boyce.gaps()).toEqual([{ at: 97, missing: [85], extra: 0 }])
  })

  it('tidies its runs', () => {
    const m = new PageMap([
      { from: 50, offset: 3 },
      { from: 5, offset: 3 },
      { from: 90, offset: 4 },
    ])
    expect(m.runs).toEqual([
      { from: 1, offset: 3 },
      { from: 90, offset: 4 },
    ])
    expect(new PageMap().label(7)).toBe('7')
    expect(PageMap.single(16).pdf(142)).toBe(158)
  })
})
