import type { About } from '@/api/ask'
import type { Block, DerivationStep, PartBlock, Run, StepBlock } from '@/api/gen/doc'
import type { PageMap } from '@/lib/pages'

import { runsSource } from './runs'
import { buildTree } from './tree'

/**
 * What a selection is made of: a block by its index in the flat list,
 * one line of a derivation, or a part or step heading, which selects its
 * whole group. Encoded as a short string so the DOM can carry it
 * (`data-sel`) and two selections compare for free: `b5` a block,
 * `l7.3` a derivation line, `p2` a part, `s4` a step.
 */
export type Sel = string

export const selBlock = (index: number): Sel => `b${index}`
export const selLine = (index: number, line: number): Sel => `l${index}.${line}`
export const selPart = (index: number): Sel => `p${index}`
export const selStep = (index: number): Sel => `s${index}`

export type Parsed = { kind: 'block' | 'part' | 'step'; index: number; line?: number }

export function parseSel(sel: Sel): Parsed | null {
  const m = /^([blps])(\d+)(?:\.(\d+))?$/.exec(sel)
  if (!m) return null
  return {
    kind: m[1] === 'b' || m[1] === 'l' ? 'block' : m[1] === 'p' ? 'part' : 'step',
    index: Number(m[2]),
    line: m[3] === undefined ? undefined : Number(m[3]),
  }
}

/** A pending selection held above the document it came from: which
 *  document owns the outline while its chip rides the composer. */
export type PendingSel = { source: string; sel: Sel }

/** The documents that select, named. */
export const questionSource = (questionId: string, stage: 'hint' | 'walkthrough') => `q:${questionId}:${stage}`
export const turnSource = (turnId: string) => `turn:${turnId}`

// ---------------------------------------------------------------- nouns

const NOUNS: Record<string, string> = {
  hint: 'this hint',
  para: 'this paragraph',
  note: 'this note',
  math: 'this equation',
  derivation: 'this derivation',
  callout: 'this callout',
  statement: 'this statement',
  table: 'this table',
  plot: 'this plot',
  code: 'this code',
  answer: 'this answer',
  raw: 'this block',
}

/** What the student pointed at, nameable: the toolbar's button says
 *  "Ask about this table", "Ask about line 4". */
export function nounOf(sel: Sel, block?: Block): string {
  const p = parseSel(sel)
  if (!p) return 'this'
  if (p.kind === 'part') return 'this part'
  if (p.kind === 'step') return 'this step'
  if (p.line !== undefined) return `line ${p.line + 1}`
  if (block) return NOUNS[block.type] ?? 'this block'
  return 'this block'
}

// ---------------------------------------------------------------- place

type Place = { part?: PartBlock; step?: StepBlock; number: number }

/** The part and step an index sits in, by the tree the page is drawn
 *  from. A part or step marker finds itself; a block finds its group. */
function placeOf(blocks: Block[], index: number): Place | null {
  for (const s of buildTree(blocks)) {
    if (s.part && s.index === index) return { part: s.part, number: 0 }
    for (const g of s.groups) {
      if (g.step && g.index === index) return { part: s.part, step: g.step, number: g.number }
      if (g.items.some((it) => it.index === index)) return { part: s.part, step: g.step, number: g.number }
    }
  }
  return null
}

/** Where a selection sits, in words: "part (a), step 2, line 3". */
export function pathOf(blocks: Block[], sel: Sel): string {
  const p = parseSel(sel)
  const at = p && placeOf(blocks, p.index)
  if (!p || !at) return ''
  const words: string[] = []
  if (at.part) words.push(`part ${at.part.label}`)
  if (at.step || p.kind === 'step') words.push(`step ${at.number}`)
  if (p.line !== undefined) words.push(`line ${p.line + 1}`)
  return words.join(', ')
}

/** The same place as the chip says it: "(a).2", "(a).2 line 3", "(a)".
 *  Answers have no parts, so their chips carry an excerpt instead. */
export function chipOf(blocks: Block[], sel: Sel): string {
  const p = parseSel(sel)
  const at = p && placeOf(blocks, p.index)
  if (!p) return ''
  const words: string[] = []
  if (at?.part) words.push(at.part.label)
  if (at && (at.step || p.kind === 'step')) words.push(at.part ? `${at.number}` : `step ${at.number}`)
  const head = words.length > 1 ? words.slice(0, 2).join('.') : (words[0] ?? '')
  const tail = p.line !== undefined ? ` line ${p.line + 1}` : ''
  return `${head}${tail}`
}

// ---------------------------------------------------------------- text

/** The printed number a PDF page carries, or the PDF number itself when
 *  the map doesn't know it. */
function printed(pdf: number, pages?: PageMap): string {
  const n = pages?.printed(pdf)
  return n === null || n === undefined ? `${pdf}` : `${n}`
}

/** Runs as the model reads them, citations on the printed pages it
 *  cites (the wire carries PDF pages). */
function cited(runs: Run[], pages?: PageMap): string {
  return runsSource(
    runs.map((r) =>
      r.cite === undefined
        ? r
        : {
            t: r.citeTo
              ? `[pp. ${printed(r.cite, pages)}–${printed(r.citeTo, pages)}]`
              : `[p. ${printed(r.cite, pages)}]`,
          },
    ),
  )
}

function lineText(step: DerivationStep, n: number): string {
  const why = step.why?.length ? ` (${runsSource(step.why)})` : ''
  return `${n + 1}. ${step.raw ? step.tex : `\\[${step.tex}\\]`}${why}`
}

/** One block as the exact text the tutor receives: words with their
 *  math as TeX, a table as rows, code verbatim, a plot as its series
 *  and marks. */
export function blockText(block: Block, pages?: PageMap): string {
  switch (block.type) {
    case 'hint':
    case 'para':
    case 'note':
      return cited(block.text, pages)
    case 'callout':
      return block.title?.length ? `${cited(block.title, pages)}: ${cited(block.text, pages)}` : cited(block.text, pages)
    case 'math':
      return block.raw ? block.tex : `\\[${block.tex}\\]`
    case 'derivation':
      return block.steps.map((s, i) => lineText(s, i)).join('\n')
    case 'statement':
      return `${block.kind} ${block.number}${block.name ? ` (${block.name})` : ''}, p. ${printed(block.page, pages)}: ${cited(block.text, pages)}`
    case 'table': {
      const head = block.columns.map((c) => cited(c, pages)).join(' | ')
      const rows = block.rows.map((r) => r.map((c) => cited(c, pages)).join(' | '))
      return [head, ...rows].join('\n')
    }
    case 'plot': {
      const bits = [
        block.title,
        `${block.y.label} against ${block.x.label}`,
        block.series.map((s) => s.label).join('; '),
        block.marks?.length
          ? `marks: ${block.marks.map((m) => `${m.label ?? 'a mark'} at ${m.x}${m.y === undefined ? '' : `, ${m.y}`}`).join('; ')}`
          : '',
      ].filter(Boolean)
      return `[plot: ${bits.join('; ')}]`
    }
    case 'code':
      return block.code
    case 'answer':
      return block.label ? `${block.label}: ${cited(block.text, pages)}` : cited(block.text, pages)
    case 'raw':
      return block.text
    case 'part':
    case 'step':
      return cited(block.title, pages)
  }
  return ''
}

/** The exact text of a selection: a block, one line of a derivation, or
 *  a heading with its whole group. Composed when the student picks, so
 *  a guide rewritten afterwards cannot change what was asked. */
export function selectionText(blocks: Block[], sel: Sel, pages?: PageMap): string {
  const p = parseSel(sel)
  if (!p || blocks[p.index] === undefined) return ''
  if (p.kind === 'block') {
    const block = blocks[p.index]
    if (p.line !== undefined && block.type === 'derivation') {
      const step = block.steps[p.line]
      return step ? lineText(step, p.line) : blockText(block, pages)
    }
    return blockText(block, pages)
  }
  // A heading selects its group: the heading's own words, then every
  // block in the group, each as its own text.
  const group = groupOf(blocks, p)
  if (!group) return ''
  return group
    .map((block) => blockText(block, pages))
    .filter(Boolean)
    .join('\n')
}

/** The blocks a part or step heading owns, heading first. */
function groupOf(blocks: Block[], p: Parsed): Block[] | null {
  for (const s of buildTree(blocks)) {
    if (p.kind === 'part' && s.index === p.index && s.part) {
      return [
        s.part,
        ...s.groups.flatMap((g): Block[] => (g.step ? [g.step, ...g.items.map((it) => it.block)] : g.items.map((it) => it.block))),
      ]
    }
    for (const g of s.groups) {
      if (p.kind === 'step' && g.index === p.index && g.step) return [g.step, ...g.items.map((it) => it.block)]
    }
  }
  return null
}

/** A few plain words of a selection for a chip: the source's marks (TeX
 *  delimiters, bold, code) and runs of whitespace gone, cut to fit. */
export function excerptOf(text: string, max = 28): string {
  const plain = text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\\[()\[\]]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length <= max ? plain : `${plain.slice(0, max).trimEnd()}…`
}

// ---------------------------------------------------------------- the ask

/** The About a selection in a question's guide becomes: one chip naming
 *  the question and the place, carrying the whole problem and the exact
 *  selection for the model. */
export function guideAbout(p: {
  question: string
  /** The problem statement as the model reads it (or the pasted text). */
  problem: string
  blocks: Block[]
  sel: Sel
  stage: 'hint' | 'walkthrough'
  pages?: PageMap
}): About {
  const what = selectionText(p.blocks, p.sel, p.pages)
  if (p.stage === 'hint') {
    return {
      label: p.question,
      text: `${p.problem}\n\nThe student selected this problem's hint:\n\n${what}`,
    }
  }
  const path = pathOf(p.blocks, p.sel)
  const where = path ? `${path} of this problem's walkthrough` : "the opening of this problem's walkthrough"
  return {
    label: [p.question, chipOf(p.blocks, p.sel) || 'the walkthrough'].join(' · '),
    text: `${p.problem}\n\nThe student selected ${where}:\n\n${what}`,
  }
}

/** The About a selection from an earlier answer becomes: the chip is an
 *  excerpt (answers have no parts to name), and the text gives that
 *  turn's question, which the conversation's short history may have
 *  scrolled out. */
export function answerAbout(p: {
  question: string
  /** What that turn itself was about, if anything. */
  about?: string
  blocks: Block[]
  sel: Sel
  pages?: PageMap
}): About {
  const what = selectionText(p.blocks, p.sel, p.pages)
  const path = pathOf(p.blocks, p.sel)
  const of = path ? `${path} of an earlier answer` : 'part of an earlier answer'
  const was = p.about ? `, which you answered about ${p.about}` : ''
  return {
    label: excerptOf(what),
    text: `The student is looking at ${of}, to the question "${p.question}"${was}. They selected:\n\n${what}`,
  }
}
