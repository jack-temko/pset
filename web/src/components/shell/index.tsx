import type { ReactNode } from 'react'

import { TopBar } from '@/components/top-bar'

/**
 * Every screen: the top bar as fixed chrome, then the screen below it.
 *
 * The window itself never scrolls. The shell is exactly the viewport, the
 * bar takes its 56px, and what's left is the scroll region — so a scrollbar
 * begins under the bar rather than running past it.
 *
 * Two kinds of screen:
 *
 * - `page` — a document that scrolls as one: Home, Settings. Nothing inside
 *   it gets its own vertical scrollbar.
 * - `fill` — a screen that is exactly the remaining height and never
 *   scrolls as a whole: the book workspace. Its panes scroll themselves,
 *   because each is a separate stream of content.
 */
export function AppShell({
  middle,
  scroll = 'page',
  children,
}: {
  middle?: ReactNode
  scroll?: 'page' | 'fill'
  children: ReactNode
}) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background">
      <TopBar middle={middle} />
      <div className={scroll === 'page' ? 'min-h-0 flex-1 overflow-y-auto' : 'min-h-0 flex-1 overflow-hidden'}>
        {children}
      </div>
    </div>
  )
}

/** The centered column shared by Home and Settings: `layout-page` wide, page
 *  gutters, `section` rhythm between children. The workspace does not use
 *  it. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-layout-page space-y-section px-page py-12">{children}</main>
  )
}
