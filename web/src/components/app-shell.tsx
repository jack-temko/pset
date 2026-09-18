import type { ReactNode } from 'react'

import { TopBar } from '@/components/top-bar'

/** Every screen: the top bar, then the screen. The shell owns no layout
 *  below the bar — a page-shell page centers its own column, the workspace
 *  runs full-bleed with its rail and panel. */
export function AppShell({ middle, children }: { middle?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-background">
      <TopBar middle={middle} />
      {children}
    </div>
  )
}

/** The centered column shared by Home and Settings: page gutters, the
 *  section rhythm, and nothing else. The workspace does not use it. */
export function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-layout-page space-y-section px-page py-12">{children}</main>
  )
}
