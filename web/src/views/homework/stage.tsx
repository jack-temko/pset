import { useMemo, useState } from 'react'
import { Columns2 } from 'lucide-react'

import { useAddBoxed, usePointOut } from '@/api/homework'
import type { About } from '@/api/ask'
import { IconButton } from '@/components/button'
import type { PendingSel } from '@/components/document/selection'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import { BoxingBar, BoxingProvider } from '@/pages/workspace/boxing'
import { useBoxing } from '@/pages/workspace/boxing-state'
import { BookHereContext } from '@/pages/workspace/book-here'
import { PageMap, Pages } from '@/lib/pages'
import { cn } from '@/lib/utils'
import type { Harness } from '../types'
import { HomeworkTab } from '.'
import { BOOK, BOOK_ID } from './world'

/** While the student boxes a problem, the bar takes the scan pill's place;
 *  here there is no scan, so it sits above the panel. */
function BoxingStandIn() {
  const b = useBoxing()
  if (!b.target) return null
  return (
    <div className="space-y-2 border-b border-dashed bg-muted/40 p-card">
      <p className="text-xs text-muted-foreground">On the workspace this bar sits over the page scan.</p>
      <BoxingBar />
    </div>
  )
}

/** The Ask tab, as far as this view goes: what arrives with "Ask about this".
 *  The real one is the workspace's; here it only shows the chip the question
 *  would carry, so going there and back can be judged. */
function AskStub({ about }: { about: About | null }) {
  return (
    <div className="min-h-0 flex-1 space-y-3 p-card">
      <p className="text-xs text-muted-foreground">The Ask tab is the workspace's. Here it shows what it would be given.</p>
      {about ? (
        <div className="space-y-1 rounded-md border bg-card p-3 text-sm">
          <p className="font-medium">Asking about {about.label}</p>
          <p className="text-muted-foreground">{about.text.slice(0, 160)}</p>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Nothing to ask about yet.</p>
      )}
    </div>
  )
}

/**
 * The homework view where the workspace puts it: the panel's column, under
 * its Ask | Homework header, with the providers the workspace gives it (the
 * book's page numbering, the boxing session, the book) and every way out
 * of it wired to the handoff log instead of another screen.
 */
export function HomeworkStage({ harness }: { harness: Harness }) {
  const pages = useMemo(() => new PageMap(BOOK.pageRuns), [])
  const addBoxed = useAddBoxed()
  const pointOut = usePointOut()
  // As in the workspace: opens on Homework, and both tabs stay mounted, so
  // Ask and back is the same question, in the same place.
  const [tab, setTab] = useState<'ask' | 'homework'>('homework')
  const [about, setAbout] = useState<About | null>(null)
  // The pending selection, held here as the workspace's panel holds it
  // above the tabs; every way out logs the handoff.
  const [selection, setSelection] = useState<PendingSel | null>(null)

  return (
    <Pages value={pages}>
      <BoxingProvider
        onDone={async (target, boxes) => {
          if (target.kind === 'add') return (await addBoxed.mutateAsync({ setId: target.setId, boxes })).id
          await pointOut.mutateAsync({ id: target.questionId, boxes })
        }}
      >
        <BookHereContext
          value={{
            bookId: BOOK_ID,
            problems: BOOK.problems,
            editBook: () => harness.handoff({ to: 'Book dialog', what: 'Edit how the book numbers its problems' }),
          }}
        >
          <aside
            style={{ height: 'min(760px, calc(100dvh - 15rem))' }}
            className={cn('flex shrink-0 flex-col overflow-hidden rounded-md border bg-rail', harness.wide ? 'w-panel-wide' : 'w-panel')}
          >
            <div className="flex h-row shrink-0 items-center justify-between border-b px-card">
              <UnderlineNav className="-mb-px h-full">
                <UnderlineTab active={tab === 'ask'} onClick={() => setTab('ask')}>
                  Ask
                </UnderlineTab>
                <UnderlineTab active={tab === 'homework'} onClick={() => setTab('homework')}>
                  Homework
                </UnderlineTab>
              </UnderlineNav>
              <IconButton variant="ghost" size="sm" aria-label="Focus on the panel" disabled>
                <Columns2 />
              </IconButton>
            </div>
            <BoxingStandIn />
            <div className={cn('flex min-h-0 flex-1 flex-col', tab !== 'ask' && 'hidden')}>
              <AskStub about={about} />
            </div>
            <div className={cn('flex min-h-0 flex-1 flex-col', tab !== 'homework' && 'hidden')}>
              <HomeworkTab
                bookId={BOOK_ID}
                initialSet={harness.props.initialSet as string | undefined}
                onJump={(page) => harness.handoff({ to: 'Page scan', what: 'Jump to a page', carries: `PDF page ${page}` })}
                onAskAbout={(a, sel) => {
                  harness.handoff({ to: 'Ask', what: 'Ask about this question', carries: `${a.label}: ${a.text.slice(0, 70)}` })
                  setAbout(a)
                  setSelection(sel ?? null)
                  setTab('ask')
                }}
                onPickSelection={(sel) => setSelection(sel)}
                onClearAbout={() => {
                  setSelection(null)
                  setAbout(null)
                  harness.handoff({ to: 'Ask', what: 'Drop the context chip', carries: 'the chip and its outline go together' })
                }}
                selection={selection}
                onOpenSettings={() => harness.handoff({ to: 'Settings', what: 'Open Settings', carries: 'the connections section' })}
                wide={harness.wide}
              />
            </div>
          </aside>
        </BookHereContext>
      </BoxingProvider>
    </Pages>
  )
}
