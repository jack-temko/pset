import type { Block } from '@/api/gen/doc'
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

