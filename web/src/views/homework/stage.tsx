import { useMemo } from 'react'
import { Focus } from 'lucide-react'

import { useAddBoxed, usePointOut } from '@/api/homework'
import { IconButton } from '@/components/button'
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
                <UnderlineTab active={false} onClick={() => harness.handoff({ to: 'Ask', what: 'Switch to the Ask tab' })}>
                  Ask
                </UnderlineTab>
                <UnderlineTab active onClick={() => {}}>
                  Homework
                </UnderlineTab>
              </UnderlineNav>
              <IconButton variant="ghost" size="sm" aria-label="Focus on the panel" disabled>
                <Focus />
              </IconButton>
            </div>
            <BoxingStandIn />
            <HomeworkTab
              bookId={BOOK_ID}
              initialSet={harness.props.initialSet as string | undefined}
              onJump={(page) => harness.handoff({ to: 'Page scan', what: 'Jump to a page', carries: `PDF page ${page}` })}
              onAskAbout={(about) =>
                harness.handoff({ to: 'Ask', what: 'Ask about this question', carries: `${about.label}: ${about.text.slice(0, 70)}` })
              }
              onOpenSettings={() => harness.handoff({ to: 'Settings', what: 'Open Settings', carries: 'the connections section' })}
            />
          </aside>
        </BookHereContext>
      </BoxingProvider>
    </Pages>
  )
}
