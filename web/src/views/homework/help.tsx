import type { Question } from '@/api/homework'
import { Box } from '@/components/box'
import { Disclosure } from '@/components/disclosure'
import { AnswersOf, Document } from '@/components/document'
import { TITLE, helpMeta, helpRows, type HelpName } from './help-meta'

/**
 * The question's help, as three rows that open in place: Hint, Walkthrough,
 * Answers, each saying how long it is. A row still being written says so and
 * can't be opened; a queued question's says Waiting and does not spin. A row
 * you opened stays open when you come back (what `revealed` records). Which
 * are open is the caller's, so the keys 1 2 3 can toggle them.
 */
export function HelpRows({
  q,
  queued,
  open,
  onOpenChange,
  onJump,
}: {
  q: Question
  /** Nothing is happening to it yet: the rows wait without a spinner. */
  queued: boolean
  open: ReadonlySet<string>
  onOpenChange: (name: HelpName, open: boolean) => void
  onJump: (page: number) => void
}) {
  const rows = helpRows(q)
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
            onOpenChange={(o) => onOpenChange(name, o)}
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
