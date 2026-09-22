import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'

import { AppShell, PageShell, PageTitle } from '@/components/shell'
import { Box, BoxBody, BoxFooter, BoxHeader, BoxRow } from '@/components/box'
import { Button } from '@/components/button'
import { Dialog } from '@/components/dialog'
import { Field, Input } from '@/components/input'
import { SegmentedControl } from '@/components/segmented-control'
import { Skeleton } from '@/components/skeleton'
import { Spinner } from '@/components/spinner'
import { ApiError } from '@/api/client'
import {
  useAbout,
  useFixCheck,
  useHealth,
  useReset,
  useResetCounts,
  useSaveConnection,
  useSaveProfile,
  useSettings,
  useTestConnection,
  type ConnectionInput,
} from '@/api/settings'
import { applyTheme, getTheme, type Theme } from '@/lib/theme'

/**
 * Settings: one document page, stacked. Connections, Health, Appearance,
 * then the one destructive act in the app, then a line saying what this
 * is and where its files live.
 *
 * Spec: design/settings.md.
 */

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
 * Test dials what's on screen and writes nothing: try a different key
 * without losing the one that works. Save tests first and writes only if
 * the test passes, so what's on disk always works. Test is always there;
 * Save appears only when there is something to save.
 */
function ConnectionBox({
  kind,
  title,
  fields,
  initial,
  ready,
}: {
  kind: 'chat' | 'embeddings'
  title: string
  fields: FieldSpec[]
  initial: Record<string, string>
  /** Saved (and so tested) before. A side never saved shows defaults that
   *  still need a Save, even untouched. */
  ready: boolean
}) {
  const [saved, setSaved] = useState(initial)
  const [values, setValues] = useState(initial)
  const [error, setError] = useState<{ field: string; text: string } | null>(null)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const [savedOnce, setSavedOnce] = useState(ready)
  const dirty = fields.some((f) => values[f.key] !== saved[f.key]) || !savedOnce
  const working = status.kind === 'working'

  const test = useTestConnection()
  const saveConnection = useSaveConnection()

  const run = async (save: boolean) => {
    setError(null)
    setStatus({ kind: 'working', verb: save ? 'Saving' : 'Testing' })
    // Exactly one side per call: the values on screen, not the saved ones.
    const body: ConnectionInput =
      kind === 'chat'
        ? { chat: { endpoint: values.endpoint, apiKey: values.apiKey, model: values.model } }
        : { embeddings: { endpoint: values.endpoint, model: values.model } }
    try {
      const r = save ? await saveConnection.mutateAsync(body) : await test.mutateAsync(body)
      if (save) {
        setSaved(values)
        setSavedOnce(true)
      }
      setStatus({ kind: 'ok', text: save ? `Saved · ${r.detail}` : r.detail })
    } catch (e) {
      const err = e instanceof ApiError ? e : null
      // A failure that names a field lands under it; one that doesn't
      // (the server itself is down) says so in the footer.
      if (err?.field) setError({ field: err.field, text: err.message })
      const what = save ? 'Not saved: the test failed' : 'Test failed'
      setStatus({ kind: 'failed', text: err?.field ? what : (err?.message ?? what) })
    }
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

/** A connection Box before the settings arrive: the same fields at their
 *  real height, so the values land without moving anything. */
function ConnectionSkeleton({ title, fields }: { title: string; fields: FieldSpec[] }) {
  return (
    <Box className="flex flex-col">
      <BoxHeader>{title}</BoxHeader>
      <BoxBody className="flex-1 space-y-4">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint}>
            <Skeleton className="block h-control w-full rounded-md" />
          </Field>
        ))}
      </BoxBody>
      <BoxFooter>
        <span />
        <Button variant="outline" size="sm" disabled>
          Test
        </Button>
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

// ---------------------------------------------------------------- you

/** The name PSet greets you by, and the tutor calls you. Same shape as a
 *  connection Box: Save appears once there's something to save. */
function You() {
  const { data } = useSettings()
  const saveProfile = useSaveProfile()
  const [value, setValue] = useState<string | null>(null)
  const saved = data?.profile.name ?? ''
  const current = value ?? saved
  const dirty = data !== undefined && current.trim() !== saved

  return (
    <Box>
      <BoxBody>
        <Field
          label="Your name"
          hint="Home greets you by it, and so does the tutor. Leave it empty to go without."
          error={saveProfile.error instanceof ApiError ? saveProfile.error.message : undefined}
        >
          {data ? (
            <Input
              value={current}
              maxLength={60}
              autoComplete="given-name"
              onChange={(e) => {
                setValue(e.target.value)
                saveProfile.reset()
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dirty) saveProfile.mutate({ name: current })
              }}
            />
          ) : (
            <Skeleton className="block h-control w-full rounded-md" />
          )}
        </Field>
      </BoxBody>
      {(dirty || saveProfile.isSuccess) && (
        <BoxFooter>
          {saveProfile.isSuccess && !dirty ? (
            <span className="flex items-center gap-2 text-success">
              <CircleCheck className="size-4" />
              Saved
            </span>
          ) : (
            <span />
          )}
          {dirty && (
            <Button size="sm" disabled={saveProfile.isPending} onClick={() => saveProfile.mutate({ name: current })}>
              Save
            </Button>
          )}
        </BoxFooter>
      )}
    </Box>
  )
}

// ---------------------------------------------------------------- health

const HEALTH_NAMES = ['Data directory', 'Database', 'Poppler', 'Tesseract']

/** The local system, checked on open. The endpoints aren't here: their
 *  status lives beside their fields, so each fact is said once. */
function Health() {
  const { data } = useHealth()
  const fix = useFixCheck()
  const checks = data?.checks ?? null
  const fixing = fix.isPending ? fix.variables : null

  return (
    <Box>
      {checks === null ? (
        // The four checks are always the same four, so draw four rows at
        // their real height; the results then land without moving
        // anything.
        HEALTH_NAMES.map((name) => (
          <BoxRow
            key={name}
            leading={<Skeleton className="size-4 rounded-full" />}
            title={name}
            description={<Skeleton className="h-3 w-48" />}
          />
        ))
      ) : (
        checks.map((c) => (
          <BoxRow
            key={c.id}
            leading={
              c.ok ? (
                <CircleCheck className="text-success" aria-label="OK" />
              ) : (
                <CircleAlert className="text-warning" aria-label="Needs attention" />
              )
            }
            title={c.name}
            description={
              fix.isError && fix.variables === c.id ? (
                <span className="text-destructive">{fix.error.message}</span>
              ) : (
                c.detail
              )
            }
            trailing={
              !c.ok && c.fixable ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={fixing === c.id}
                  onClick={() => fix.mutate(c.id)}
                >
                  {fixing === c.id ? 'Fixing…' : 'Fix'}
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
  const counts = useResetCounts(open)
  const reset = useReset()

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
            <Button variant="ghost" disabled={reset.isPending} onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={reset.isPending}
              onClick={() =>
                reset.mutate(undefined, {
                  onSuccess: () => {
                    setOpen(false)
                    navigate('/')
                  },
                })
              }
            >
              {reset.isPending ? 'Resetting…' : 'Reset everything'}
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>
            This deletes{' '}
            <span className="font-medium tabular-nums">
              {counts.data ? plural(counts.data.books, 'book') : <Skeleton className="h-3 w-12" />}
            </span>{' '}
            and their{' '}
            <span className="font-medium tabular-nums">
              {counts.data ? plural(counts.data.pages, 'page') : <Skeleton className="h-3 w-16" />}
            </span>
            , every homework set and conversation, and your settings, including the API key.
          </p>
          {reset.isError && <p className="text-destructive">{reset.error.message}</p>}
          <p className="text-muted-foreground">
            PSet will be as it was the first time you opened it. There's no undo.
          </p>
        </div>
      </Dialog>
    </>
  )
}

function plural(n: number, word: string) {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`
}

// ---------------------------------------------------------------- page

const CHAT_FIELDS: FieldSpec[] = [
  { key: 'endpoint', label: 'Endpoint', mono: true },
  { key: 'apiKey', label: 'API key', mono: true },
  { key: 'model', label: 'Model', mono: true },
]

const EMBED_FIELDS: FieldSpec[] = [
  {
    key: 'endpoint',
    label: 'Endpoint',
    mono: true,
    hint: 'Any OpenAI-compatible embeddings server. Books need it to be prepared.',
  },
  { key: 'model', label: 'Model', mono: true },
]

function Connections() {
  const { data } = useSettings()
  if (!data)
    return (
      <div className="grid grid-cols-2 gap-6">
        <ConnectionSkeleton title="Chat" fields={CHAT_FIELDS} />
        <ConnectionSkeleton title="Embeddings" fields={EMBED_FIELDS} />
      </div>
    )
  return (
    <div className="grid grid-cols-2 gap-6">
      <ConnectionBox kind="chat" title="Chat" initial={{ ...data.chat }} ready={data.ready.chat} fields={CHAT_FIELDS} />
      <ConnectionBox
        kind="embeddings"
        title="Embeddings"
        initial={{ ...data.embeddings }}
        ready={data.ready.embeddings}
        fields={EMBED_FIELDS}
      />
    </div>
  )
}

function AboutLine() {
  const { data } = useAbout()
  return (
    <p className="font-mono text-xs text-muted-foreground">
      {data ? (
        `pset ${data.version} · ${data.dataDir}`
      ) : (
        <Skeleton className="h-3 w-80" />
      )}
    </p>
  )
}

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
    // No middle of its own: the bar picks up "Settings" once the h1 has
    // scrolled away, and never repeats it while it's on screen.
    <AppShell>
      <PageShell>
        <PageTitle className="text-3xl">Settings</PageTitle>

        <Section title="You">
          <You />
        </Section>

        <Section title="Connections">
          <Connections />
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

        <AboutLine />
      </PageShell>
    </AppShell>
  )
}
