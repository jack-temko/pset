import { useState } from 'react'

import type { Question } from '@/api/homework'
import { Box } from '@/components/box'
import { Disclosure } from '@/components/disclosure'
import { AnswersOf, Document } from '@/components/document'
import { answersOf } from '@/components/document/tree'
import { HELP_NAMES, TITLE, helpMeta, type HelpName } from './help-meta'

/**
 * The question's help, as three rows that open in place: Hint, Walkthrough,
 * Answers, each saying how long it is. A row still being written says so and
 * can't be opened; a queued question's says Waiting and does not spin. A row
 * you opened stays open when you come back (what `revealed` records).
 */
export function HelpRows({
  q,
  queued,
  onReveal,
  onJump,
}: {
  q: Question
  /** Nothing is happening to it yet: the rows wait without a spinner. */
  queued: boolean
  onReveal: (name: HelpName) => void
  onJump: (page: number) => void
}) {
  const [open, setOpen] = useState<Set<string>>(() => new Set(q.revealed))
  const rows = HELP_NAMES.flatMap((name) => {
    const blocks = name === 'hint' ? q.hint : q.walkthrough
    // The answers are the walkthrough's answer blocks, so they arrive with it.
    if (name === 'answers' && blocks.length > 0 && answersOf(blocks).length === 0) return []
    return [{ name, blocks }]
  })
  return (
    <Box>
      {rows.map(({ name, blocks }, i) => {
        const ready = blocks.length > 0
        return (
          <Disclosure
            key={name}
            title={TITLE[name]}
            meta={ready ? helpMeta(name, blocks) : undefined}
            busy={ready ? undefined : queued ? 'Waiting' : 'Writing'}
            still={queued}
            keys={String(i + 1)}
            open={open.has(name)}
            onOpenChange={(o) => {
              setOpen((prev) => {
                const next = new Set(prev)
                if (o) next.add(name)
                else next.delete(name)
                return next
              })
              if (o && !q.revealed.includes(name)) onReveal(name)
            }}
          >
            <div className="space-y-3">
              {name === 'answers' ? <AnswersOf blocks={q.walkthrough} onJump={onJump} /> : <Document blocks={blocks} onJump={onJump} reading />}
            </div>
          </Disclosure>
        )
      })}
    </Box>
  )
}
