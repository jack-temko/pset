import {
  CircleAlert,
  CircleCheck,
  LoaderCircle,
  RefreshCw,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { PageShell } from '@/components/page-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useDoctor } from '@/hooks/use-doctor'
import { useMutation } from '@/hooks/use-mutation'
import { api } from '@/lib/api'
import type { CheckStatus, DoctorFinding, DoctorReport, Severity } from '@/lib/types'
import { cn } from '@/lib/utils'

const severityTone: Record<Severity, string> = {
  info: 'text-muted-foreground',
  warning: 'text-warning',
  error: 'text-destructive',
}

const statusChip: Record<CheckStatus, string> = {
  ok: 'border-success/40 text-success',
  fixed: 'border-success/40 bg-success/10 text-success',
  warn: 'border-warning/50 text-warning',
  failed: 'border-destructive/40 text-destructive',
}

function StatusBanner({ report }: { report: DoctorReport }) {
  const warnCount = report.checks.filter((c) => c.status === 'warn').length
  const failedCount = report.checks.filter((c) => c.status === 'failed').length
  const fixedCount = report.checks.filter((c) => c.status === 'fixed').length

  const failed = !report.ok
  const Icon = failed ? CircleAlert : warnCount > 0 ? TriangleAlert : CircleCheck
  const title = failed
    ? 'Needs attention'
    : warnCount > 0
      ? 'Usable, with warnings'
      : 'All checks passed'
  const bannerTone = failed
    ? 'border-destructive/40 bg-destructive/[0.06]'
    : warnCount > 0
      ? 'border-warning/40 bg-warning/[0.06]'
      : 'border-success/40 bg-success/[0.06]'
  const iconTone = failed ? 'text-destructive' : warnCount > 0 ? 'text-warning' : 'text-success'
  const chip = failed ? statusChip.failed : warnCount > 0 ? statusChip.warn : statusChip.ok

  const parts = [
    `${report.checks.length} ${report.checks.length === 1 ? 'check' : 'checks'}`,
    fixedCount > 0 && `${fixedCount} fixed`,
    warnCount > 0 && `${warnCount} ${warnCount === 1 ? 'warning' : 'warnings'}`,
    failedCount > 0 && `${failedCount} failed`,
  ].filter(Boolean)

  return (
    <Card className={bannerTone}>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <Icon className={cn('size-5', iconTone)} />
        <span className="font-medium">{title}</span>
        <span className="text-sm text-muted-foreground">{parts.join(' · ')}</span>
        <Badge variant="outline" className={cn('ml-auto', chip)}>
          {failed ? 'attention' : warnCount > 0 ? 'warnings' : 'ok'}
        </Badge>
      </CardContent>
    </Card>
  )
}

function FindingLine({ finding }: { finding: DoctorFinding }) {
  return (
    <div className="space-y-1 text-sm">
      <p className={cn('leading-relaxed', severityTone[finding.severity])}>{finding.message}</p>
      {finding.link && (
        <Link
          to={finding.link.href}
          className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
        >
          {finding.link.label}
        </Link>
      )}
    </div>
  )
}

function CheckRows({ report }: { report: DoctorReport }) {
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {report.checks.map((check) => (
        <li key={check.name} className="space-y-3 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
              {check.name}
            </h2>
            <Badge variant="outline" className={statusChip[check.status]}>
              {check.status}
            </Badge>
          </div>
          <div className="space-y-2">
            {check.findings.length === 0 && (
              <p className="text-sm text-muted-foreground">Everything looks fine.</p>
            )}
            {check.findings.map((f, i) => (
              <FindingLine key={i} finding={f} />
            ))}
          </div>
        </li>
      ))}
    </ul>
  )
}

function DoctorSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full rounded-xl" />
      <ul className="divide-y rounded-xl border bg-card">
        {Array.from({ length: 4 }, (_, i) => (
          <li key={i} className="space-y-2 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-14 rounded-4xl" />
            </div>
            <Skeleton className="h-4 w-4/5" />
          </li>
        ))}
      </ul>
    </div>
  )
}

export function Doctor() {
  const { report, loading, error, refetch } = useDoctor()
  const fix = useMutation(api.doctorFix)
  const view = fix.data ?? report
  const repairing = fix.state === 'loading'

  return (
    <PageShell
      title="Doctor"
      description="Makes sure PSet's storage, database and AI connections are ready to go, and repairs what it safely can."
      actions={
        <>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Run the checks again"
            title="Run the checks again"
            onClick={() => {
              fix.reset()
              refetch()
            }}
            disabled={repairing}
          >
            <RefreshCw className={cn(loading && 'animate-spin')} />
          </Button>
          <Button onClick={() => void fix.mutate()} disabled={repairing}>
            {repairing ? <LoaderCircle className="animate-spin" /> : <Wrench />}
            {repairing ? 'Repairing…' : 'Repair'}
          </Button>
        </>
      }
    >
      {repairing && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <LoaderCircle className="size-4 animate-spin text-primary" />
          Running every check and applying safe repairs…
        </p>
      )}

      {loading && !view ? (
        <DoctorSkeleton />
      ) : error && !view ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-14 text-center">
            <Badge variant="destructive">Error</Badge>
            <p className="font-heading text-lg">Couldn’t run the doctor.</p>
            <p className="max-w-prose text-sm text-muted-foreground">{error.message}</p>
            <Button variant="outline" className="mt-2" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      ) : view ? (
        <>
          <StatusBanner report={view} />
          <CheckRows report={view} />
        </>
      ) : null}

      {fix.state === 'error' && fix.error && (
        <p className="text-center text-sm text-destructive" role="alert">
          Repair failed: {fix.error.message}
        </p>
      )}
    </PageShell>
  )
}
