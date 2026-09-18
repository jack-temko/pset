import type { ReactNode } from 'react'

import { PageHeader } from '@/components/page-header'

/** The one page wrapper: centered column, page gutters and rhythm, and the
 *  big serif title with its italic lead. Every page opens with this — same
 *  padding, same vertical placement, everywhere. */
export function PageShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-section px-page py-10">
      <PageHeader title={title} description={description} actions={actions} />
      {children}
    </div>
  )
}
