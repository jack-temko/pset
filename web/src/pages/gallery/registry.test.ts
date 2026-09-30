import { describe, expect, it } from 'vitest'

import { filterEntries, groupsOf, type GalleryEntry } from './registry'

const entries: GalleryEntry[] = [
  { id: 'button', title: 'Button', group: 'Controls' },
  { id: 'box', title: 'Box', group: 'Containers' },
  { id: 'form-controls', title: 'Form controls', group: 'Controls' },
]

describe('groupsOf', () => {
  it('keeps groups and their entries in the order first seen', () => {
    expect(groupsOf(entries).map((g) => [g.name, g.entries.map((e) => e.id)])).toEqual([
      ['Controls', ['button', 'form-controls']],
      ['Containers', ['box']],
    ])
  })
})

describe('filterEntries', () => {
  it('keeps everything for an empty query', () => {
    expect(filterEntries(entries, '  ')).toEqual(entries)
  })

  it('matches a title in any case', () => {
    expect(filterEntries(entries, 'BUT').map((e) => e.id)).toEqual(['button'])
  })

  it('needs every word, across title and group', () => {
    expect(filterEntries(entries, 'controls form').map((e) => e.id)).toEqual(['form-controls'])
    expect(filterEntries(entries, 'containers button')).toEqual([])
  })

  it('matches an id spelled with hyphens as words', () => {
    expect(filterEntries(entries, 'form controls').map((e) => e.id)).toEqual(['form-controls'])
  })
})
