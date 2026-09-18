import type { ReactNode } from 'react'

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-5">
      <div className="max-w-prose space-y-3">
        <h1 className="font-heading text-3xl font-medium tracking-tight text-balance">
          {title}
        </h1>
        {description && (
          <p className="font-heading text-lg leading-relaxed text-muted-foreground italic">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
