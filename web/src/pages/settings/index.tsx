import { useState } from 'react'
import { CircleAlert, CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react'

import { applyTheme, currentTheme, type ThemeMode } from '@/components/theme-toggle'
import { PageHeader } from '@/components/page-header'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useBooks } from '@/hooks/use-books'
import { useConfig } from '@/hooks/use-config'
import { useHealth } from '@/hooks/use-health'
import { useMutation } from '@/hooks/use-mutation'
import { api } from '@/lib/api'
import type { ConfigTestPart } from '@/lib/types'

function SettingRow({ label, hint, control }: { label: string; hint?: React.ReactNode; control: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="shrink-0">{control}</div>
    </div>
  )
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">{label}</div>
      {children}
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )
}

function TestRow({ label, result }: { label: string; result: ConfigTestPart }) {
  return (
    <div className="flex items-start gap-2">
      {result.ok ? (
        <CircleCheck className="mt-1 size-4 shrink-0 text-success" />
      ) : (
        <CircleAlert className="mt-1 size-4 shrink-0 text-destructive" />
      )}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="text-sm">
          {label}{' '}
          <span className={result.ok ? 'text-success' : 'text-destructive'}>
            {result.ok ? 'is working' : 'isn’t working'}
          </span>
        </div>
        {!result.ok && result.detail && (
          <div className="font-mono text-xs break-words text-muted-foreground">{result.detail}</div>
        )}
      </div>
    </div>
  )
}

type ConnectionEdits = {
  apiBaseURL?: string
  apiKey?: string
  embedBaseURL?: string
  embedModel?: string
}

function ConnectionCard() {
  const { config, loading, error, refetch, save, saving, saveError } = useConfig()
  const [edits, setEdits] = useState<ConnectionEdits>({})
  const [running, setRunning] = useState(false)
  const test = useMutation(() => api.testConfig())

  const edit = (key: keyof ConnectionEdits, value: string) =>
    setEdits((prev) => ({ ...prev, [key]: value }))
  const value = (key: 'apiBaseURL' | 'embedBaseURL' | 'embedModel') =>
    edits[key] ?? config?.[key] ?? ''
  const dirty =
    (['apiBaseURL', 'embedBaseURL', 'embedModel'] as const).some(
      (k) => edits[k] !== undefined && edits[k] !== (config?.[k] ?? ''),
    ) || (edits.apiKey ?? '') !== ''

  // One action: save the patch, then test the saved settings and show the
  // verdicts. The verdicts are the success state — there is no separate
  // "Saved" flash and no standalone test of unsaved text.
  const saveAndTest = () => {
    if (!config) return
    const patch: ConnectionEdits = {}
    for (const k of ['apiBaseURL', 'embedBaseURL', 'embedModel'] as const) {
      if (edits[k] !== undefined && edits[k] !== (config[k] ?? '')) patch[k] = edits[k]
    }
    if (edits.apiKey) patch.apiKey = edits.apiKey
    setRunning(true)
    void save(patch)
      .then((next) => {
        if (!next) return null // the inline save error covers it
        setEdits({})
        return test.mutate()
      })
      .finally(() => setRunning(false))
  }

  const busy = running || saving || test.state === 'loading'

  return (
    <Card>
      <CardHeader>
        <CardTitle>Connection</CardTitle>
        <CardDescription>
          PSet needs two things to work: a chat service for answers and a search service that
          matches questions to pages. Imports only finish once both are connected. The key stays
          on this computer.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-4">
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
            <div className="h-9 w-full animate-pulse rounded-lg bg-muted" />
          </div>
        ) : error ? (
          <div className="space-y-2">
            <p className="text-sm text-destructive" role="alert">
              Couldn’t load the connection settings: {error.message}
            </p>
            <Button variant="outline" size="sm" onClick={refetch}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-4">
              <Field label="API address" hint="Where questions are sent.">
                <Input
                  value={value('apiBaseURL')}
                  onChange={(e) => edit('apiBaseURL', e.target.value)}
                  placeholder="https://…"
                  aria-label="API address"
                  className="font-mono text-xs"
                />
              </Field>
              <Field label="API key" hint="Stored only on this computer.">
                <Input
                  type="password"
                  autoComplete="off"
                  value={edits.apiKey ?? ''}
                  onChange={(e) => edit('apiKey', e.target.value)}
                  placeholder={config?.hasAPIKey ? 'Saved. Type to replace' : ''}
                  aria-label="API key"
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Search service"
                  hint="The default looks for a service on this machine, so leave it as is unless you moved it."
                >
                  <Input
                    value={value('embedBaseURL')}
                    onChange={(e) => edit('embedBaseURL', e.target.value)}
                    aria-label="Search service address"
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label="Search model" hint="The model that matches questions to pages.">
                  <Input
                    value={value('embedModel')}
                    onChange={(e) => edit('embedModel', e.target.value)}
                    aria-label="Search model"
                    className="font-mono text-xs"
                  />
                </Field>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={saveAndTest} disabled={!dirty || busy}>
                {busy && <LoaderCircle className="animate-spin" />}
                Save &amp; test
              </Button>
              {saveError && (
                <p className="text-xs text-destructive" role="alert">
                  Couldn’t save: {saveError.message}
                </p>
              )}
              {test.state === 'error' && test.error && (
                <p className="text-xs text-destructive" role="alert">
                  Couldn’t run the test: {test.error.message}
                </p>
              )}
            </div>

            {test.data && (
              <div className="space-y-2" role="status">
                <TestRow label="Chat" result={test.data.chat} />
                <TestRow label="Semantic search" result={test.data.embed} />
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export function Settings() {
  const { health, refetch: refetchHealth } = useHealth()
  const { refetch: refetchBooks } = useBooks()
  const [theme, setTheme] = useState<ThemeMode>(currentTheme())

  const [confirmOpen, setConfirmOpen] = useState(false)
  // The success line outlives the mutation: apply.reset() on close would
  // otherwise cancel the very state the line reads.
  const [resetDone, setResetDone] = useState(false)
  const preview = useMutation(() => api.reset(false))
  const apply = useMutation(() => api.reset(true))

  const counts = preview.data

  return (
    <div className="mx-auto w-full max-w-2xl space-y-section px-page py-10">
      <PageHeader title="Settings" />

      <ConnectionCard />

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">Appearance</CardTitle>
        </CardHeader>
        <CardContent className="divide-y p-0 px-6">
          <SettingRow
            label="Theme"
            hint="System follows your device setting."
            control={
              <Select
                value={theme}
                onValueChange={(v) => {
                  setTheme(v as ThemeMode)
                  applyTheme(v as ThemeMode)
                }}
              >
                <SelectTrigger className="w-32" aria-label="Theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="system">System</SelectItem>
                </SelectContent>
              </Select>
            }
          />
        </CardContent>
      </Card>

      <Card className="border-destructive/40">
        <CardHeader className="pb-0">
          <div className="flex items-center gap-2">
            <TriangleAlert className="size-4 text-destructive" />
            <CardTitle className="text-destructive">Danger zone</CardTitle>
          </div>
          <CardDescription>
            Removes every book, page, library file and finished task from this computer. Preview
            the counts first.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResetDone(false)
                void preview.mutate()
              }}
              disabled={preview.state === 'loading'}
            >
              {preview.state === 'loading' && <LoaderCircle className="animate-spin" />}
              Preview
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!counts}
              onClick={() => setConfirmOpen(true)}
            >
              Delete everything…
            </Button>
          </div>
          {counts && (
            <p className="font-mono text-xs text-muted-foreground" role="status">
              {counts.books} {counts.books === 1 ? 'book' : 'books'} ·{' '}
              {counts.pages.toLocaleString()} indexed {counts.pages === 1 ? 'page' : 'pages'} ·{' '}
              {counts.libraryFiles.toLocaleString()} library{' '}
              {counts.libraryFiles === 1 ? 'file' : 'files'} · {counts.finishedTasks.toLocaleString()}{' '}
              finished {counts.finishedTasks === 1 ? 'task' : 'tasks'} would be deleted.
            </p>
          )}
          {preview.state === 'error' && preview.error && (
            <p className="text-xs text-destructive" role="alert">
              {preview.error.message}
            </p>
          )}
          {resetDone && (
            <p className="text-xs text-success" role="status">
              Reset complete. The library is empty.
            </p>
          )}
          {apply.state === 'error' && apply.error && (
            <p className="text-xs text-destructive" role="alert">
              {apply.error.message}
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={confirmOpen}
        onOpenChange={(open) => {
          setConfirmOpen(open)
          if (!open) {
            apply.reset()
            setResetDone(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading text-xl">Reset PSet?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 text-sm leading-relaxed text-muted-foreground">
                <p>
                  This permanently deletes{' '}
                  <span className="font-mono text-xs text-foreground">
                    {counts
                      ? `${counts.books} books, ${counts.pages.toLocaleString()} indexed pages, ${counts.libraryFiles.toLocaleString()} library files and ${counts.finishedTasks.toLocaleString()} finished tasks`
                      : 'all books, pages, library files and finished tasks'}
                  </span>{' '}
                  from disk.
                </p>
                <p>This cannot be undone.</p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)} disabled={apply.state === 'loading'}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={apply.state === 'loading'}
              onClick={() =>
                void apply.mutate().then((result) => {
                  if (result) {
                    setResetDone(true)
                    setConfirmOpen(false)
                    preview.reset()
                    refetchBooks()
                    refetchHealth()
                  }
                })
              }
            >
              {apply.state === 'loading' && <LoaderCircle className="animate-spin" />}
              Delete everything
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <p>
            PSet turns your textbooks into study sessions: searchable pages, walkthroughs,
            quizzes and answers. Everything stays on this computer.
          </p>
          <Separator className="my-4" />
          <div className="space-y-3">
            {(
              [
                ['Version', health ? health.version : '…'],
                ['Database', health ? health.databasePath : '…'],
                ['Library', health ? health.libraryDirectory : '…'],
              ] as [string, string][]
            ).map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-6">
                <span className="shrink-0">{k}</span>
                <span className="truncate text-right font-mono text-xs text-foreground">{v}</span>
              </div>
            ))}
          </div>
          <Separator className="my-4" />
          <p className="text-xs">
            Something look off? The Doctor page can check and repair this setup.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
