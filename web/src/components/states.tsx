import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

/** The standard load-failure card: destructive badge, one heading, the
 *  message, a retry. Used by any page whose data fetch can fail. */
export function ErrorState({
  title,
  message,
  onRetry,
}: {
  title: string
  message: string | null
  onRetry: () => void
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
        <Badge variant="destructive">Error</Badge>
        <p className="font-heading text-lg">{title}</p>
        {message && <p className="max-w-prose text-sm text-muted-foreground">{message}</p>}
        <Button variant="outline" className="mt-2" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  )
}

/** The standard empty card: icon roundel, serif heading, one supporting
 *  line, optional action. The same card everywhere a collection is empty —
 *  same design, same padding, same spot under the page header. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: ReactNode
  title: string
  message: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border bg-card py-14 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <p className="font-heading text-lg">{title}</p>
      <p className="max-w-prose text-sm text-muted-foreground">{message}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  )
}

