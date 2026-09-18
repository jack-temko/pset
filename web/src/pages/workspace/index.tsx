import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowUp, Focus, Plus } from 'lucide-react'

import { AppShell } from '@/components/shell'
import { Box, BoxRow, RowValue } from '@/components/box'
import { Button, IconButton } from '@/components/button'
import { UnderlineNav, UnderlineTab } from '@/components/underline-nav'
import {
  BOOK_HOMEWORK,
  PAGE_COUNT,
  TOC,
  bookBySha,
  type BookHomework,
  type TocChapter,
} from '@/lib/sample'
import { cn } from '@/lib/utils'

/**
 * The book workspace: the app's one filled screen. Contents rail, page
 * scan, Ask | Homework panel — each pane scrolls itself, the frame never
 * moves. Focus collapses the rail and hands its width to the panel.
 *
 * Spec: design/workspace.md.
 */

type Tab = 'ask' | 'homework'

/** The panel remembers which face it showed, per book. A blocked
 *  localStorage just means it forgets. */
function readTab(sha: string): Tab {
  try {
    return localStorage.getItem(`pset-panel-tab:${sha}`) === 'homework' ? 'homework' : 'ask'
  } catch {
    return 'ask'
  }
}
function writeTab(sha: string, tab: Tab) {
  try {
    localStorage.setItem(`pset-panel-tab:${sha}`, tab)
  } catch {
    /* forgetting is fine */
  }
}

// ---------------------------------------------------------------- rail

/** The book's contents as a tree of quiet rows; the reader's position
 *  highlights the section it is inside. A book with no TOC has no rail. */
function Rail({
  toc,
  currentPage,
  onJump,
}: {
  toc: TocChapter[]
  currentPage: number
  onJump: (page: number) => void
}) {
  // The current section is the last one that starts at or before the page
  // the scan is showing.
  let currentId: string | undefined
  for (const c of toc)
    for (const s of c.sections) if (s.page <= currentPage) currentId = s.id

  return (
    <aside className="w-rail shrink-0 overflow-y-auto border-r bg-rail py-4">
      <nav aria-label="Contents" className="space-y-4">
        {toc.map((c) => (
          <div key={c.id}>
            <button
              type="button"
              onClick={() => onJump(c.page)}
              className="flex w-full items-center px-4 py-1 text-left text-sm font-medium"
            >
              <span className="min-w-0 flex-1 truncate">{c.title}</span>
            </button>
            {c.sections.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onJump(s.page)}
                aria-current={s.id === currentId ? 'true' : undefined}
                className={cn(
                  'flex w-full items-center gap-2 py-1 pr-4 pl-8 text-left text-sm transition-colors duration-150 ease-out motion-reduce:transition-none',
                  s.id === currentId
                    ? 'bg-primary-soft text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                )}
              >
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="shrink-0 font-mono text-xs tabular-nums">{s.page}</span>
              </button>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  )
}

// ---------------------------------------------------------------- scan

/**
 * Pages stack in one scrolling pane, edge-to-edge paper. Until the backend
 * serves rendered pages, each is a placeholder at print proportions. The
 * only chrome is the floating pill: page · zoom, fading when idle.
 */
function Scan({
  pageCount,
  currentPage,
  onPageChange,
  scrollRef,
  pageRefs,
}: {
  pageCount: number
  currentPage: number
  onPageChange: (p: number) => void
  scrollRef: React.RefObject<HTMLDivElement | null>
  pageRefs: React.RefObject<Map<number, HTMLDivElement>>
}) {
  const [pillAwake, setPillAwake] = useState(false)
  const sleepTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const wake = () => {
    setPillAwake(true)
    clearTimeout(sleepTimer.current)
    sleepTimer.current = setTimeout(() => setPillAwake(false), 1200)
  }
  useEffect(() => () => clearTimeout(sleepTimer.current), [])

  const onScroll = () => {
    wake()
    const el = scrollRef.current
    if (!el) return
    // The current page is the one crossing the pane's vertical middle.
    const middle = el.scrollTop + el.clientHeight / 2
    let page = 1
    for (const [n, node] of pageRefs.current) {
      if (node.offsetTop <= middle) page = Math.max(page, n)
    }
    if (page !== currentPage) onPageChange(page)
  }

  return (
    <div className="relative min-w-0 flex-1">
      <div ref={scrollRef} onScroll={onScroll} className="h-full overflow-y-auto bg-muted/40">
        <div className="mx-auto max-w-layout-reading space-y-6 px-6 py-6">
          {Array.from({ length: pageCount }, (_, i) => i + 1).map((n) => (
            <div
              key={n}
              ref={(node) => {
                if (node) pageRefs.current.set(n, node)
                else pageRefs.current.delete(n)
              }}
              className="grid place-items-center rounded-sm border bg-card"
              style={{ aspectRatio: '8.5 / 11' }}
            >
              <span className="font-mono text-xs text-muted-foreground tabular-nums">{n}</span>
            </div>
          ))}
        </div>
      </div>

      <div
        onMouseEnter={wake}
        className={cn(
          'absolute bottom-6 left-1/2 flex h-control-sm -translate-x-1/2 items-center gap-2 rounded-full border bg-card px-4 font-mono text-xs text-muted-foreground shadow-floating tabular-nums transition-opacity duration-150 ease-out motion-reduce:transition-none',
          pillAwake ? 'opacity-100' : 'opacity-0',
        )}
      >
        <span>
          p. {currentPage} of {pageCount}
        </span>
        <span aria-hidden>·</span>
        <span>100%</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- panel

/** Empty Ask: a prompt line and one sentence of what the agent can do.
 *  No generated suggestions. */
function AskTab() {
  return (
    <>
      <div className="grid min-h-0 flex-1 place-items-center px-6">
        <div className="space-y-2 text-center">
          <p className="text-base">Ask about this book.</p>
          <p className="text-xs font-normal text-muted-foreground">
            It can search the pages, read them, and work through the math.
          </p>
        </div>
      </div>
      <div className="shrink-0 border-t p-card">
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <textarea
            rows={1}
            placeholder="Ask about this book…"
            className="min-h-control flex-1 resize-none rounded-md border border-input bg-card px-3 py-1 text-base placeholder:text-muted-foreground"
          />
          <IconButton type="submit" variant="primary" aria-label="Send">
            <ArrowUp />
          </IconButton>
        </form>
      </div>
    </>
  )
}

/** The homework list — the walkthrough it opens into is not built yet. */
function HomeworkTab({ items }: { items: BookHomework[] }) {
  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-card">
      <Button variant="outline" size="sm" className="w-full">
        <Plus />
        New homework
      </Button>
      <Box>
        {items.map((h) => (
          <BoxRow
            key={h.id}
            href={`/homework/${h.id}`}
            title={h.title}
            description={`${h.done} of ${h.total} questions`}
            trailing={<RowValue className={cn(h.urgent && 'text-warning')}>{h.due}</RowValue>}
          />
        ))}
      </Box>
    </div>
  )
}

function Panel({
  sha,
  focus,
  onFocusToggle,
}: {
  sha: string
  focus: boolean
  onFocusToggle: () => void
}) {
  const [tab, setTab] = useState<Tab>(() => readTab(sha))
  const pick = (t: Tab) => {
    setTab(t)
    writeTab(sha, t)
  }

  return (
    <aside
      className={cn(
        'flex shrink-0 flex-col border-l bg-rail',
        focus ? 'w-panel-wide' : 'w-panel',
      )}
    >
      <div className="flex h-row shrink-0 items-center justify-between border-b px-card">
        <UnderlineNav className="-mb-px h-full">
          <UnderlineTab active={tab === 'ask'} onClick={() => pick('ask')}>
            Ask
          </UnderlineTab>
          <UnderlineTab active={tab === 'homework'} onClick={() => pick('homework')}>
            Homework
          </UnderlineTab>
        </UnderlineNav>
        <IconButton
          variant="ghost"
          size="sm"
          aria-label={focus ? 'Leave focus' : 'Focus on the panel'}
          aria-pressed={focus}
          onClick={onFocusToggle}
          className={cn(focus && 'bg-muted/50 text-foreground')}
        >
          <Focus />
        </IconButton>
      </div>
      {tab === 'ask' ? <AskTab /> : <HomeworkTab items={BOOK_HOMEWORK} />}
    </aside>
  )
}

// ------------------------------------------------------------ workspace

export function Workspace() {
  const { sha } = useParams<{ sha: string }>()
  const book = bookBySha(sha ?? '')

  const [focus, setFocus] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const pageRefs = useRef(new Map<number, HTMLDivElement>())

  if (!book) {
    return (
      <AppShell>
        <div className="grid h-full place-items-center">
          <p className="text-base text-muted-foreground">There is no book here.</p>
        </div>
      </AppShell>
    )
  }

  const jump = (page: number) => {
    pageRefs.current.get(page)?.scrollIntoView()
  }

  return (
    <AppShell scroll="fill" middle={<span>{book.title}</span>}>
      <div className="flex h-full">
        {!focus && <Rail toc={TOC} currentPage={currentPage} onJump={jump} />}
        <Scan
          pageCount={PAGE_COUNT}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          scrollRef={scrollRef}
          pageRefs={pageRefs}
        />
        <Panel sha={book.sha256} focus={focus} onFocusToggle={() => setFocus((f) => !f)} />
      </div>
    </AppShell>
  )
}
