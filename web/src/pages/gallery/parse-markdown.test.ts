import { describe, expect, it } from 'vitest'

import { parseInline, parseMarkdown } from './parse-markdown'

describe('parseMarkdown', () => {
  it('reads headings, and joins a hard-wrapped paragraph into one', () => {
    expect(parseMarkdown('# Button\n\nThe one control\nfor every action.\n')).toEqual([
      { t: 'h', level: 1, text: 'Button' },
      { t: 'p', text: 'The one control for every action.' },
    ])
  })

  it('reads a table, with a pipe escaped inside a cell', () => {
    expect(parseMarkdown('| Tone | Use |\n|---|---|\n| `a\\|b` | Quiet ink. |\n')).toEqual([
      { t: 'table', head: ['Tone', 'Use'], rows: [['`a|b`', 'Quiet ink.']] },
    ])
  })

  it('continues a list item through its indented lines, and nests one level', () => {
    expect(parseMarkdown('- one\n  runs on\n  - nested\n- two\n')).toEqual([
      {
        t: 'list',
        ordered: false,
        items: [
          { text: 'one runs on', depth: 0 },
          { text: 'nested', depth: 1 },
          { text: 'two', depth: 0 },
        ],
      },
    ])
  })

  it('reads numbered lists, fences and quotes', () => {
    expect(parseMarkdown('1. a\n2. b\n\n```\nx = 1\n\ny = 2\n```\n\n> said\n> twice')).toEqual([
      { t: 'list', ordered: true, items: [{ text: 'a', depth: 0 }, { text: 'b', depth: 0 }] },
      { t: 'code', text: 'x = 1\n\ny = 2' },
      { t: 'quote', text: 'said twice' },
    ])
  })

  it('ends a paragraph where a list begins', () => {
    expect(parseMarkdown('Intro\n- item')).toEqual([
      { t: 'p', text: 'Intro' },
      { t: 'list', ordered: false, items: [{ text: 'item', depth: 0 }] },
    ])
  })
})

describe('parseInline', () => {
  it('splits code, bold, italic and links out of the text', () => {
    expect(parseInline('a `b` **c** *d* [e](https://x.y) f')).toEqual([
      { k: 'text', text: 'a ' },
      { k: 'code', text: 'b' },
      { k: 'text', text: ' ' },
      { k: 'strong', text: 'c' },
      { k: 'text', text: ' ' },
      { k: 'em', text: 'd' },
      { k: 'text', text: ' ' },
      { k: 'link', text: 'e', href: 'https://x.y' },
      { k: 'text', text: ' f' },
    ])
  })

  it('leaves a lone asterisk alone', () => {
    expect(parseInline('2 * 3')).toEqual([{ k: 'text', text: '2 * 3' }])
  })
})
