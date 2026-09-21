import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { AppShell, PageShell } from '@/components/shell'
import { Box, BoxBody, BoxFooter, BoxHeader, BoxRow } from '@/components/box'
import { Button } from '@/components/button'
import { Dialog } from '@/components/dialog'
import { Field, Input } from '@/components/input'
import { SegmentedControl } from '@/components/segmented-control'
import { Spinner } from '@/components/spinner'
import { ABOUT, CONNECTIONS, HEALTH, RESET_COUNTS, type HealthCheck } from '@/lib/sample'
import { applyTheme, getTheme, type Theme } from '@/lib/theme'

/**
 * Settings: one document page, stacked. Connections, Health, Appearance,
 * then the one destructive act in the app, then a line saying what this
 * is and where its files live.
 *
 * Spec: design/settings.md.
 */

// ---------------------------------------------------------------- probe

type Probe = { ok: true; detail: string } | { ok: false; field: string; error: string }

/** Stands in for the engine's TestConnection(override): it dials the values
 *  on screen, never the saved ones, and writes nothing. Each failure names
 *  the field that caused it, so the error lands under that field. */
function probe(kind: 'chat' | 'embeddings', v: Record<string, string>): Promise<Probe> {
  const result = (): Probe => {
    if (!/^https?:\/\//.test(v.endpoint))
      return { ok: false, field: 'endpoint', error: 'Not a URL — it should start with http:// or https://' }
    if (kind === 'chat') {
      if (!v.apiKey) return { ok: false, field: 'apiKey', error: 'No API key' }
      if (!v.apiKey.startsWith('zk-'))
        return { ok: false, field: 'apiKey', error: 'The endpoint refused this key (401)' }
    }
    if (!v.model) return { ok: false, field: 'model', error: 'No model named' }
    return {
      ok: true,
      detail: kind === 'chat' ? `Connected · ${v.model}` : `Connected · ${v.model} · 768 dimensions`,
    }
  }
  return new Promise((resolve) => setTimeout(() => resolve(result()), 700))
}

// ---------------------------------------------------------------- connections

type FieldSpec = { key: string; label: string; hint?: string; mono?: boolean }

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; verb: 'Testing' | 'Saving' }
  | { kind: 'ok'; text: string }
  | { kind: 'failed'; text: string }

/**
 * One endpoint's fields, with Test and Save.
 *
 * Test dials what's on screen and writes nothing — try a different key
 * without losing the one that works. Save tests first and writes only if
 * the test passes, so what's on disk always works. Test is always there;
 * Save appears only when there is something to save.
 */
function ConnectionBox({
  kind,
  title,
  fields,
  initial,
}: {
  kind: 'chat' | 'embeddings'
  title: string
  fields: FieldSpec[]
  initial: Record<string, string>
}) {
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<{ field: string; text: string } | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const dirty = fields.some((f) => values[f.key] !== saved[f.key])
  const working = status.kind === 'working'

  const run = async (save: boolean) => {
    setError(null)
    setStatus({ kind: 'working', verb: save ? 'Saving' : 'Testing' })
    const r = await probe(kind, values)
    if (!r.ok) {
      setError({ field: r.field, text: r.error })
      setStatus({ kind: 'failed', text: save ? 'Not saved — the test failed' : 'Test failed' })
      return
    }
    if (save) setSaved(values)
    setStatus({ kind: 'ok', text: save ? `Saved · ${r.detail}` : r.detail })
  }

  // A column, with the body taking the slack: side by side, both Boxes
  // stretch to the taller one and their footers line up at the bottom.
  return (
    <Box className="flex flex-col">
      <BoxHeader>{title}</BoxHeader>
      <BoxBody className="flex-1 space-y-4">
        {fields.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            hint={f.hint}
            error={error?.field === f.key ? error.text : undefined}
          >
            <Input
              value={values[f.key]}
              spellCheck={false}
              className={f.mono ? 'font-mono' : undefined}
              aria-invalid={error?.field === f.key || undefined}
              onChange={(e) => {
                setValues((v) => ({ ...v, [f.key]: e.target.value }))
                // Editing the field that failed is the fix in progress.
                if (error?.field === f.key) setError(null)
                if (status.kind !== 'working') setStatus({ kind: 'idle' })
              }}
            />
          </Field>
        ))}
      </BoxBody>
      <BoxFooter>
        <StatusLine status={status} />
        <span className="flex gap-2">
          <Button variant="outline" size="sm" disabled={working} onClick={() => run(false)}>
            Test
          </Button>
          {dirty && (
            <Button size="sm" disabled={working} onClick={() => run(true)}>
              Save
            </Button>
          )}
        </span>
      </BoxFooter>
    </Box>
  )
}

/** What the last Test or Save found. Nothing until you ask: opening the
 *  page dials nothing. */
function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return <span />
  if (status.kind === 'working')
    return (
      <span className="flex items-center gap-2">
        <Spinner className="size-3" label={status.verb} />
        {status.verb}…
      </span>
    )
  return (
    <span
      className={
        status.kind === 'ok'
          ? 'flex items-center gap-2 text-success'
          : 'flex items-center gap-2 text-destructive'
      }
    >
      {status.kind === 'ok' ? <CircleCheck className="size-4" /> : <CircleAlert className="size-4" />}
      {status.text}
    </span>
  )
}

// ---------------------------------------------------------------- health

/** The local system, checked on open. The endpoints aren't here: their
 *  status lives beside their fields, so each fact is said once. */
function Health() {
  const [checks, setChecks] = useState<HealthCheck[] | null>(null)
  const [fixing, setFixing] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setChecks(HEALTH), 500)
    return () => clearTimeout(t)
  }, [])

  const fix = (name: string) => {
    setFixing(name)
    setTimeout(() => {
      setChecks((cs) =>
        cs!.map((c) => (c.name === name ? { ...c, ok: true, detail: 'migrated schema v11 to v12' } : c)),
      )
      setFixing(null)
    }, 700)
  }

  return (
    <Box>
      {checks === null ? (
        <BoxRow
          leading={<Spinner className="size-3" />}
          title="Checking…"
          className="text-muted-foreground"
        />
      ) : (
        checks.map((c) => (
          <BoxRow
            key={c.name}
            leading={
              c.ok ? (
                <CircleCheck className="text-success" aria-label="OK" />
              ) : (
                <CircleAlert className="text-warning" aria-label="Needs attention" />
              )
            }
            title={c.name}
            description={c.detail}
            trailing={
              !c.ok && c.fixable ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={fixing === c.name}
                  onClick={() => fix(c.name)}
                >
                  {fixing === c.name ? 'Fixing…' : 'Fix'}
                </Button>
              ) : undefined
            }
          />
        ))
      )}
    </Box>
  )
}

// ---------------------------------------------------------------- appearance

const THEMES = [
  { value: 'light', label: 'Paper' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
] as const

function Appearance() {
  const [theme, setTheme] = useState<Theme>(getTheme)
  return (
    <Box>
      <BoxBody className="flex items-center justify-between gap-4">
        <span>
          <span className="block text-sm font-medium">Theme</span>
          <span className="block text-xs text-muted-foreground">
            System follows your computer, and keeps following it.
          </span>
        </span>
        <SegmentedControl
          label="Theme"
          options={THEMES}
          value={theme}
          onChange={(t) => {
            applyTheme(t)
            setTheme(t)
          }}
        />
      </BoxBody>
    </Box>
  )
}

// ---------------------------------------------------------------- reset

/** The app's one destructive act: everything goes, settings included, as
 *  if it had never been installed. The dialog names exactly what, from the
 *  engine's dry run. */
function Reset() {
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      <Box tone="destructive">
        <BoxBody className="flex items-center justify-between gap-4">
          <span>
            <span className="block text-sm font-medium">Reset PSet</span>
            <span className="block text-xs text-muted-foreground">
              Deletes every book, every homework set, and these settings. It's a fresh install.
            </span>
          </span>
          {/* Outline, not destructive: the destructive button is
              destructive-soft, the same ground as this Box, and vanished
              into it. On card it reads as a control; the red ink says what
              kind. */}
          <Button variant="outline" className="text-destructive" onClick={() => setOpen(true)}>
            Reset everything
          </Button>
        </BoxBody>
      </Box>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Reset everything?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                // The engine's Reset, extended to remove config.json too.
                setOpen(false)
                navigate('/')
              }}
            >
              Reset everything
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            This deletes{' '}
            <span className="font-medium tabular-nums">{RESET_COUNTS.books} books</span> and their{' '}
            <span className="font-medium tabular-nums">
              {RESET_COUNTS.pages.toLocaleString()} pages
            </span>
            , every homework set and conversation, and your settings — including the API key.
          </p>
          <p className="text-muted-foreground">
            PSet will be as it was the first time you opened it. There's no undo.
          </p>
        </div>
      </Dialog>
    </>
  )
}

// ---------------------------------------------------------------- page

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="font-heading text-xl">{title}</h2>
      {children}
    </section>
  )
}

export function Settings() {
  return (
    // No middle: the h1 already says where you are, and the bar never
    // repeats it.
    <AppShell>
      <PageShell>
        <h1 className="font-heading text-3xl">Settings</h1>

        <Section title="Connections">
          <div className="grid grid-cols-2 gap-6">
            <ConnectionBox
              kind="chat"
              title="Chat"
              initial={CONNECTIONS.chat}
              fields={[
                { key: 'endpoint', label: 'Endpoint', mono: true },
                { key: 'apiKey', label: 'API key', mono: true },
                { key: 'model', label: 'Model', mono: true },
              ]}
            />
            <ConnectionBox
              kind="embeddings"
              title="Embeddings"
              initial={CONNECTIONS.embeddings}
              fields={[
                {
                  key: 'endpoint',
                  label: 'Endpoint',
                  mono: true,
                  hint: 'Any OpenAI-compatible embeddings server. Books need it to be prepared.',
                },
                { key: 'model', label: 'Model', mono: true },
              ]}
            />
          </div>
        </Section>

        <Section title="Health">
          <Health />
        </Section>

        <Section title="Appearance">
          <Appearance />
        </Section>

        <Section title="Reset">
          <Reset />
        </Section>

        <p className="font-mono text-xs text-muted-foreground">
          pset {ABOUT.version} · {ABOUT.dataDir}
        </p>
      </PageShell>
    </AppShell>
  )
}
