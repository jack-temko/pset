import { describe, expect, it } from 'vitest'

import type { Assignment, AssignmentRow } from '@/api/homework'
import {
  actionLabel,
  importOf,
  isEarlier,
  keptGroups,
  localToday,
  questionCount,
  reviewOf,
  shownGroups,
  sourceName,
} from './import-state'

const row = (r: Partial<AssignmentRow> & Pick<AssignmentRow, 'kind' | 'text'>): AssignmentRow => ({
  labels: [],
  notes: [],
  present: [],
  changed: [],
  ...r,
})

// A course page checked on September 5th: one date passed, one already
// added and unchanged, one to come, one with no date, and one added
// before that the professor has changed since.
const page: Assignment = {
  source: 'https://example.edu/202/hw.htm',
  title: 'EECS 202 Homework',
  groups: [
    {
      due: '2026-08-28',
      title: 'Homework due Aug 28',
      gone: [],
      rows: [row({ kind: 'book', text: '1.1 , 1.6 , 1.9 (all on page 24)', labels: ['1.1', '1.6', '1.9'] })],
    },
    {
      due: '2026-09-04',
      title: 'Homework due Sep 4',
      imported: true,
      setId: 'set-sep4',
      gone: [],
      rows: [
        row({
          kind: 'book',
          text: '1.18 , 1.28',
          labels: ['1.18', '1.28'],
          present: ['1.18', '1.28'],
          added: true,
        }),
      ],
    },
    {
      due: '2026-09-11',
      title: 'Homework due Sep 11',
      gone: [],
      rows: [
        row({
          kind: 'book',
          text: '4.27 , 4.25 (no PSpice or MulitSim)',
          labels: ['4.27', '4.25'],
          notes: ['no PSpice or MulitSim'],
        }),
        row({ kind: 'own', text: 'There are 24 letters in the Greek alphabet. (a) How many...' }),
        row({ kind: 'other', text: 'Reading: pages 80-86' }),
        row({ kind: 'book', text: 'the one with the ladder', unread: true }),
      ],
    },
    {
      due: '',
      title: 'Extra practice',
      gone: [],
      rows: [row({ kind: 'book', text: '3.36', labels: ['3.36'] })],
    },
    {
      due: '2026-08-21',
      title: 'Homework due Aug 21',
      imported: true,
      setId: 'set-aug21',
      gone: [{ questionId: 'q-230', label: '2.30' }],
      rows: [
        row({
          kind: 'book',
          text: '2.31, 2.32 (use PSpice), 2.35',
          labels: ['2.31', '2.32', '2.35'],
          notes: ['use PSpice'],
          present: ['2.31', '2.32'],
          changed: [{ questionId: 'q-232', label: '2.32', was: ['no PSpice'], now: ['use PSpice'] }],
        }),
      ],
    },
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
      [true, true, true],
    ])
    expect(r[2].rows.map((x) => [x.keep, x.inBook])).toEqual([
      [true, true],
      [true, false],
      [false, false],
      [true, true],
    ])
  })

  it('makes a set of each kept new date, from its kept lines', () => {
    const r = reviewOf(page, '2026-09-05')
    r[2].rows[3].keep = false
    r[3].rows[0].text = '  '
    r[4].keep = false
    expect(keptGroups(r).map((g) => g.title)).toEqual(['Homework due Sep 11'])
    expect(importOf('read-1', page.source, r)).toEqual({
      readId: 'read-1',
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
    expect(reviewOf({ ...page, groups: [page.groups[0]] }, '2026-09-05')[0].keep).toBe(true)
  })

  it('offers only what changed in a date already added, and removes nothing unasked', () => {
    const r = reviewOf(page, '2026-09-05')
    const changed = r[4]
    expect(changed.rows[0].keep).toBe(true)
    expect(changed.rows[0].changes.map((c) => c.apply)).toEqual([true])
    expect(changed.gone.map((q) => q.remove)).toEqual([false])
    expect(questionCount(changed)).toBe(1)
    expect(importOf('read-1', page.source, [changed]).groups).toEqual([
      {
        title: 'Homework due Aug 21',
        due: '2026-08-21',
        setId: 'set-aug21',
        rows: [{ text: '2.31, 2.32 (use PSpice), 2.35', inBook: true }],
        notes: [{ questionId: 'q-232', notes: ['use PSpice'] }],
        remove: [],
      },
    ])
    // Just a removal is still an update.
    changed.rows[0].keep = false
    changed.rows[0].changes[0].apply = false
    changed.gone[0].remove = true
    expect(importOf('read-1', page.source, [changed]).groups[0]).toMatchObject({
      rows: [],
      notes: [],
      remove: ['q-230'],
    })
  })

  it('never updates a date already added with nothing new, even ticked', () => {
    const r = reviewOf(page, '2026-09-05')
    r[1].keep = true
    expect(keptGroups(r).map((g) => g.due)).not.toContain('2026-09-04')
    expect(isEarlier(r[1])).toBe(true)
    expect(isEarlier(r[4])).toBe(false)
  })

  it('reads as an update to one set, starts with only the first date that changes it', () => {
    const one = (due: string) => ({
      due,
      title: '',
      setId: 'set-1',
      gone: [],
      rows: [row({ kind: 'book', text: '3.36', labels: ['3.36'] })],
    })
    const r = reviewOf({ ...page, groups: [one('2026-09-25'), one('2026-10-02')] }, '2026-09-05')
    expect(r.map((g) => g.keep)).toEqual([true, false])
  })

  it('says what the primary action does', () => {
    const r = reviewOf(page, '2026-09-05')
    expect(actionLabel(r)).toBe('Add 2 sets, update 1')
    r[2].keep = r[3].keep = false
    expect(actionLabel(r)).toBe('Update 1 set')
    r[4].keep = false
    expect(actionLabel(r)).toBe('Add sets')
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
    expect(shownGroups(r, false).map((g) => g.due)).toEqual(['2026-09-11', '', '2026-08-21'])
    r[0].keep = true
    expect(shownGroups(r, false).map((g) => g.due)).toEqual(['2026-08-28', '2026-09-11', '', '2026-08-21'])
    expect(shownGroups(r, true)).toHaveLength(5)
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
