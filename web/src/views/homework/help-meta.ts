import type { Block } from '@/api/gen/doc'
import type { Question } from '@/api/homework'
import { runsText } from '@/components/document/runs'
import { answersOf } from '@/components/document/tree'

export const HELP_NAMES = ['hint', 'walkthrough', 'answers'] as const
export type HelpName = (typeof HELP_NAMES)[number]

export const TITLE: Record<HelpName, string> = { hint: 'Hint', walkthrough: 'Walkthrough', answers: 'Answers' }
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

/** What a row says about what is inside it, in a few words: how long it is. */
export function helpMeta(name: HelpName, blocks: Block[]): string {
  if (name === 'answers') return plural(answersOf(blocks).length, 'answer', 'answers')
  if (name === 'walkthrough') {
    const steps = blocks.filter((b) => b.type === 'step').length
    return steps > 0 ? plural(steps, 'step', 'steps') : plural(blocks.length, 'part', 'parts')
  }
  const chars = blocks.reduce((n, b) => n + ('text' in b && Array.isArray(b.text) ? runsText(b.text).length : 0), 0)
  return plural(Math.max(1, Math.round(chars / 60)), 'line', 'lines')
}


/** The rows a question has, in order, each with its blocks: the answers are
 *  the walkthrough's answer blocks, so they are there once it is. */
export function helpRows(q: Question): { name: HelpName; blocks: Block[] }[] {
  return HELP_NAMES.flatMap((name) => {
    const blocks = name === 'hint' ? q.hint : q.walkthrough
    if (name === 'answers' && blocks.length > 0 && answersOf(blocks).length === 0) return []
    return [{ name, blocks }]
  })
}
