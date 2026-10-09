import { describe, expect, it } from 'vitest'

import { atLeast, clock, cost, shortModel, timeOfDay, tokens } from './usage-format'

describe('clock', () => {
  it.each([
    [0, '0.0s'],
    [950, '1.0s'],
    [2100, '2.1s'],
    [9949, '9.9s'],
    // Rounds to ten, so it reads as ten, in whole seconds.
    [9950, '10s'],
    [9999, '10s'],
    [14000, '14s'],
    [59499, '59s'],
    // Rounds to a minute: not "60s".
    [59500, '1m 00s'],
    [59999, '1m 00s'],
    [63000, '1m 03s'],
    [119600, '2m 00s'],
    [187000, '3m 07s'],
    [3599499, '59m 59s'],
    [3599600, '1h 00m'],
    [3725000, '1h 02m'],
    [7325000, '2h 02m'],
  ])('%d ms is %s', (ms, want) => {
    expect(clock(ms)).toBe(want)
  })
})

describe('cost', () => {
  it.each([
    [undefined, '–'],
    // Exactly nothing: a local model, free.
    [0, '$0.0000'],
    // Paid, but under four decimals: never the same as free.
    [0.00001, '<$0.0001'],
    [0.00004999, '<$0.0001'],
    [0.00005, '$0.0001'],
    [0.0004, '$0.0004'],
    [0.0031, '$0.0031'],
    [0.99994, '$0.9999'],
    // Would round to "1.0000": a dollar.
    [0.99996, '$1.00'],
    [1, '$1.00'],
    [1.236, '$1.24'],
    [123.456, '$123.46'],
  ])('%s is %s', (dollars, want) => {
    expect(cost(dollars)).toBe(want)
  })
})

describe('the small ones', () => {
  it('drops the vendor from a model, keeps a bare name', () => {
    expect(shortModel('deepseek/deepseek-v4.1-flash')).toBe('deepseek-v4.1-flash')
    expect(shortModel('qwen')).toBe('qwen')
  })
  it('writes tokens exactly, or a dash', () => {
    expect(tokens(1234567)).toBe('1,234,567')
    expect(tokens(0)).toBe('0')
    expect(tokens(undefined)).toBe('–')
  })
  it('marks a minimum, and leaves a dash alone', () => {
    expect(atLeast('$0.0220', true)).toBe('≥ $0.0220')
    expect(atLeast('$0.0220', false)).toBe('$0.0220')
    expect(atLeast('–', true)).toBe('–')
  })
})

describe('timeOfDay', () => {
  it('is the local time to the second, and a bad stamp is left as it came', () => {
    const at = new Date(2026, 9, 8, 14, 2, 11).toISOString()
    expect(timeOfDay(at)).toBe('14:02:11')
    expect(timeOfDay('not a time')).toBe('not a time')
  })
})
