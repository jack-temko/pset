import type { Question } from '@/api/homework'
import type { Block } from '@/api/gen/doc'
import { Box } from '@/components/box'
import { Disclosure } from '@/components/disclosure'
import { AnswersOf, Document } from '@/components/document'
import type { AskWiring } from '@/components/document/selectable'
import type { Sel } from '@/components/document/selection'
import { TITLE, helpMeta, helpRows, type HelpName } from './help-meta'

/**
 * The question's help, as three rows that open in place: Hint, Walkthrough,
 * Answers, each saying how long it is. A row still being written says so and
 * can't be opened; a queued question's says Waiting and does not spin. A row
 * you opened stays open when you come back (what `revealed` records). Which
 * are open is the caller's, so the keys 1 2 3 can toggle them.
 *
 * With `ask`, every element of the hint and the walkthrough is selectable,
 * to ask the tutor about exactly it; the answers card repeats the
 * walkthrough's answer rows, which stay selectable in place.
 */
export type HelpAsk = {
  /** The pending selection for a stage's document, if it holds it and
   *  the element still reads as when it was picked. */
  selected: (stage: 'hint' | 'walkthrough', blocks: Block[]) => Sel | null
  /** A click picked an element of a stage's document. */
  pick: (stage: 'hint' | 'walkthrough', sel: Sel, blocks: Block[]) => void
  /** The toolbar's button on a picked element: compose the About and
   *  hand it up with the selection. */
  ask: (stage: 'hint' | 'walkthrough', sel: Sel, blocks: Block[]) => void
  /** The one way out: drops the selection and its chip. */
  clear: () => void
}

export function HelpRows({
  q,
  queued,
  open,
  onOpenChange,
  onJump,
  ask,
}: {
  q: Question
  /** Nothing is happening to it yet: the rows wait without a spinner. */
  queued: boolean
  open: ReadonlySet<string>
  onOpenChange: (name: HelpName, open: boolean) => void
  onJump: (page: number) => void
  ask?: HelpAsk
}) {
  const rows = helpRows(q)
  return (
    <Box>
      {rows.map(({ name, blocks }, i) => {
        const ready = blocks.length > 0
        const stage = name === 'hint' ? ('hint' as const) : ('walkthrough' as const)
        const wiring: AskWiring | undefined =
          ask && name !== 'answers'
            ? {
                selected: ask.selected(stage, blocks),
                onPick: (sel) => ask.pick(stage, sel, blocks),
                onAsk: (sel) => ask.ask(stage, sel, blocks),
                onClear: ask.clear,
              }
            : undefined
        return (
          <Disclosure
            key={name}
            title={TITLE[name]}
            meta={ready ? helpMeta(name, blocks) : undefined}
            busy={ready ? undefined : queued ? 'Waiting' : 'Writing'}
            still={queued}
            keys={String(i + 1)}
            open={open.has(name)}
            onOpenChange={(o) => onOpenChange(name, o)}
          >
            <div className="space-y-3">
              {name === 'answers' ? <AnswersOf blocks={q.walkthrough} onJump={onJump} /> : <Document blocks={blocks} onJump={onJump} reading ask={wiring} />}
            </div>
          </Disclosure>
        )
      })}
    </Box>
  )
}
