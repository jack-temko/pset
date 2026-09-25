import { describe, expect, it } from 'vitest'

import type { Assignment } from '@/api/homework'
import {
  importOf,
  keptGroups,
  localToday,
  questionCount,
  reviewOf,
  shownGroups,
  sourceName,
} from './import-state'

// A course page checked on September 5th: one date passed, one already
// added, one to come, and one with no date.
const page: Assignment = {
  source: 'https://example.edu/202/hw.htm',
  title: 'EECS 202 Homework',
  groups: [
    {
      due: '2026-08-28',
      title: 'Homework due Aug 28',
      rows: [
        { kind: 'book', text: '1.1 , 1.6 , 1.9 (all on page 24)', labels: ['1.1', '1.6', '1.9'], notes: [] },
      ],
    },
    {
      due: '2026-09-04',
      title: 'Homework due Sep 4',
      imported: true,
      rows: [{ kind: 'book', text: '1.18 , 1.28', labels: ['1.18', '1.28'], notes: [] }],
    },
    {
      due: '2026-09-11',
      title: 'Homework due Sep 11',
      rows: [
        {
          kind: 'book',
          text: '4.27 , 4.25 (no PSpice or MulitSim)',
          labels: ['4.27', '4.25'],
          notes: ['no PSpice or MulitSim'],
        },
        {
          kind: 'own',
          text: 'There are 24 letters in the Greek alphabet. (a) How many...',
          labels: [],
          notes: [],
        },
        { kind: 'other', text: 'Reading: pages 80-86', labels: [], notes: [] },
        { kind: 'book', text: 'the one with the ladder', labels: [], notes: [], unread: true },
      ],
    },
    { due: '', title: 'Extra practice', rows: [{ kind: 'book', text: '3.36', labels: ['3.36'], notes: [] }] },
  ],
}

describe('reviewing an assignment', () => {
  it('ticks the dates still to come, and every line that is homework', () => {
    const r = reviewOf(page, '2026-09-05')
    expect(r.map((g) => [g.keep, g.past, g.imported])).toEqual([
      [false, true, false],
      [false, true, true],
      [true, false, false],
      [true, false, false],
    ])
    expect(r[2].rows.map((x) => [x.keep, x.inBook])).toEqual([
      [true, true],
      [true, false],
      [false, false],
      [true, true],
    ])
  })

  it('makes a set of each kept date, from its kept lines', () => {
    const r = reviewOf(page, '2026-09-05')
    r[2].rows[3].keep = false
    r[3].rows[0].text = '  '
    expect(keptGroups(r).map((g) => g.title)).toEqual(['Homework due Sep 11'])
    expect(importOf(page.source, r)).toEqual({
      source: page.source,
      groups: [
        {
          title: 'Homework due Sep 11',
          due: '2026-09-11',
          rows: [
            { text: '4.27 , 4.25 (no PSpice or MulitSim)', inBook: true },
            { text: 'There are 24 letters in the Greek alphabet. (a) How many...', inBook: false },
          ],
        },
      ],
    })
  })

  it('ticks a one-date sheet even when it is late', () => {
    const sheet = { ...page, groups: [page.groups[0]] }
    expect(reviewOf(sheet, '2026-09-05')[0].keep).toBe(true)
    expect(reviewOf({ ...page, groups: [page.groups[1]] }, '2026-09-05')[0].keep).toBe(false)
  })

  it('never adds a date already added, even ticked', () => {
    const r = reviewOf(page, '2026-09-05')
    r[1].keep = true
    expect(keptGroups(r).map((g) => g.due)).not.toContain('2026-09-04')
  })

  it('counts a line of several problems as several questions until it is changed', () => {
    const r = reviewOf(page, '2026-08-01')
    expect(questionCount(r[0])).toBe(3)
    r[0].rows[0].edited = true
    expect(questionCount(r[0])).toBe(1)
    expect(questionCount(r[2])).toBe(4)
  })

  it('folds the earlier dates away, unless one is ticked', () => {
    const r = reviewOf(page, '2026-09-05')
    expect(shownGroups(r, false).map((g) => g.due)).toEqual(['2026-09-11', ''])
    r[0].keep = true
    expect(shownGroups(r, false).map((g) => g.due)).toEqual(['2026-08-28', '2026-09-11', ''])
    expect(shownGroups(r, true)).toHaveLength(4)
  })

  it('names where it came from as a person reads it', () => {
    expect(sourceName('https://people.eecs.ku.edu/~demarest/202/EECS%20202%20Homework%20Assignm.htm')).toBe(
      'https://people.eecs.ku.edu/~demarest/202/EECS 202 Homework Assignm.htm',
    )
    expect(sourceName('pasted')).toBe('the text you pasted')
    expect(sourceName('100%.pdf')).toBe('100%.pdf')
  })

  it('writes today as the server writes dates', () => {
    expect(localToday(new Date(2026, 8, 5, 23, 30))).toBe('2026-09-05')
  })
})
