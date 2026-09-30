import { describe, expect, it } from 'vitest'

import { bandFor, bands, fill, greeting } from './greeting'

describe('greeting', () => {
  it('covers every hour with a band, midnight first', () => {
    expect(bands[0].from).toBe(0)
    for (let h = 0; h < 24; h++) expect(bandFor(h).from).toBeLessThanOrEqual(h)
    expect(bandFor(1).label).toBe('1am')
    expect(bandFor(8).label).toBe('7am')
    expect(bandFor(23).label).toBe('11pm')
  })

  it('drops the name whole when there is none', () => {
    expect(fill('Up late, {name}?', 'Jack')).toBe('Up late, Jack?')
    expect(fill('Up late, {name}?', '')).toBe('Up late?')
  })

  it('picks a line from the pick, and never runs off the end', () => {
    expect(greeting(0, 'Jack', 'a', 0)).toBe('Up late, Jack?')
    expect(greeting(0, 'Jack', 'a', 0.999999)).toBe('Still up, Jack?')
    expect(greeting(0, 'Jack', 'b', 0.5)).toBe('The books are still here, Jack.')
  })

  it('leaves no placeholder, em dash or double space in any line', () => {
    for (const b of bands)
      for (const line of [...b.a, ...b.b]) {
        for (const name of ['Jack', '']) {
          const out = fill(line, name)
          expect(out).not.toMatch(/\{|—|\s\s| [?.!,]/)
        }
        expect(line.match(/\{name\}/g)?.length).toBe(1)
        expect(line).toContain(', {name}')
      }
  })
})
