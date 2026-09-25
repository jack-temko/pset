import { describe, expect, it } from 'vitest'

import { anchorsOf, runsOf } from './page-numbers'

describe('page number rows', () => {
  it('ask about printed page 1, then each jump where it starts', () => {
    expect(
      anchorsOf([
        { from: 1, offset: 12 },
        { from: 97, offset: 11 },
      ]),
    ).toEqual([
      { pdf: '13', printed: '1' },
      { pdf: '97', printed: '86' },
    ])
  })

  it('turn back into the runs they came from', () => {
    const runs = [
      { from: 1, offset: 12 },
      { from: 97, offset: 11 },
    ]
    expect(runsOf(anchorsOf(runs), 640)).toEqual({ runs })
  })

  it('say what is wrong with a row', () => {
    expect(runsOf([], 640)).toEqual({ error: 'Say where printed page 1 is.' })
    expect(runsOf([{ pdf: '13', printed: '1' }, { pdf: '', printed: '86' }], 640)).toEqual({
      error: 'Give every row both numbers.',
    })
    expect(runsOf([{ pdf: '700', printed: '1' }], 640)).toEqual({ error: 'The PDF has 640 pages.' })
    expect(runsOf([{ pdf: '13', printed: '1' }, { pdf: '13', printed: '5' }], 640)).toEqual({
      error: 'Two rows name the same PDF page.',
    })
  })
})
