import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { CircleAlert, CircleCheck } from 'lucide-react';

import { AppShell, PageShell, PageTitle } from '@/components/shell';
import { Box, BoxBody, BoxFooter, BoxHeader, BoxRow } from '@/components/box';
import { Button } from '@/components/button';
import { Field, Input } from '@/components/input';
import { SegmentedControl } from '@/components/segmented-control';
import { Loaded } from '@/components/loaded';
import type { Variant } from '@/variants';
import { Skeleton } from '@/components/skeleton';
import { Spinner } from '@/components/spinner';
import { ApiError } from '@/api/client';
import {
  useAbout,
  useFixCheck,
  useHealth,
  useReset,
  useResetCounts,
  useSaveKey,
  useSaveProfile,
  useSettings,
  useTestKey,
  type ModelUse,
} from '@/api/settings';
import { useLastCount } from '@/lib/last-count';
import { useSettled, useShowPending } from '@/lib/settled';
import { applyTheme, getTheme, type Theme } from '@/lib/theme';
import { cn, plural } from '@/lib/utils';
import { ConfirmPopover } from '@/components/confirm';
import { useClearActivity } from '@/api/activity';
import { Updates } from './updates';

/**
 * Settings: one document page, stacked. You, the OpenRouter key, Health,
 * Updates, Appearance, then the one destructive act in the app, then a line saying
 * what this is and where its files live.
 *
 * Spec: design/settings.md.
 */

// ---------------------------------------------------------------- connections

type Status =
  | { kind: 'idle' }
  | { kind: 'working'; verb: 'Testing' | 'Saving'; since: number }
  | { kind: 'ok'; text: string }
  | { kind: 'failed'; text: string };

const KEY_HINT = 'From openrouter.ai/keys. It pays for the models PSet uses.';

/**
 * The OpenRouter key, with Test and Save. PSet picks its models; the key
 * is the one thing to set up, and the line under it says which models it
 * pays for.
 *
 * Test tries what's on screen and writes nothing: try a different key
 * without losing the one that works. Save tests first and writes only if
 * the test passes, so what's on disk always works. Both are always there;
 * Save sits disabled until there is something to save.
 */
function KeyBox({
  initial,
  ready,
  models,
}: {
  initial: string;
  ready: boolean;
  models: ModelUse[];
}) {
  const [saved, setSaved] = useState(initial);
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const [savedOnce, setSavedOnce] = useState(ready);
  const dirty = value !== saved || !savedOnce;
  const working = status.kind === 'working';
  // OpenRouter often answers in a blink: "Testing…" and the disabled
  // buttons show only once the call has lasted; until then the last
  // verdict stays.
  const shown = useSettled(status, working ? status.since : null) ?? {
    kind: 'idle',
  };
  const looksWorking = shown.kind === 'working';

  const test = useTestKey();
  const saveKey = useSaveKey();

  const run = async (save: boolean) => {
    if (working) return;
    setError(null);
    setStatus({
      kind: 'working',
      verb: save ? 'Saving' : 'Testing',
      since: Date.now(),
    });
    try {
      const r = save
        ? await saveKey.mutateAsync({ apiKey: value })
        : await test.mutateAsync({ apiKey: value });
      if (save) {
        setSaved(value.trim());
        setValue(value.trim());
        setSavedOnce(true);
      }
      setStatus({ kind: 'ok', text: save ? `Saved · ${r.detail}` : r.detail });
    } catch (e) {
      const err = e instanceof ApiError ? e : null;
      // A failure that's the key's lands under it; any other (OpenRouter
      // down, the server itself down) says so in the footer.
      if (err?.field) setError(err.message);
      const what = save ? 'Not saved: the test failed' : 'Test failed';
      setStatus({
        kind: 'failed',
        text: err?.field ? what : (err?.message ?? what),
      });
    }
  };

  return (
    <Box>
      <BoxHeader>OpenRouter</BoxHeader>
      <BoxBody className="space-y-4">
        <Field label="API key" hint={KEY_HINT} error={error ?? undefined}>
          <Input
            value={value}
            spellCheck={false}
            autoComplete="off"
            className="font-mono"
            aria-invalid={error !== null || undefined}
            onChange={(e) => {
              setValue(e.target.value);
              // Editing the key that failed is the fix in progress.
              setError(null);
              if (status.kind !== 'working') setStatus({ kind: 'idle' });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty && !looksWorking) void run(true);
            }}
          />
        </Field>
        <ModelsLine models={models} />
      </BoxBody>
      <BoxFooter>
        <StatusLine status={shown} />
        <span className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={looksWorking}
            onClick={() => {
              void run(false);
            }}
          >
            Test
          </Button>
          <Button
            size="sm"
            disabled={looksWorking || !dirty}
            onClick={() => {
              void run(true);
            }}
          >
            Save
          </Button>
        </span>
      </BoxFooter>
    </Box>
  );
}

/** Which model does which job: said, not chosen. */
function ModelsLine({ models }: { models: ModelUse[] }) {
  return (
    <p className="text-xs text-muted-foreground">
      PSet picks the models.{' '}
      {models.map((m, i) => (
        <span key={m.job}>
          {i > 0 && ' · '}
          <span className="whitespace-nowrap">
            {m.job}: <span className="font-mono">{m.model}</span>
          </span>
        </span>
      ))}
    </p>
  );
}

/** The key Box before the settings arrive: the same rows at their real
 *  height, so the values land without moving anything. */
function KeySkeleton() {
  return (
    <Box>
      <BoxHeader>OpenRouter</BoxHeader>
      <BoxBody className="space-y-4">
        <Field label="API key" hint={KEY_HINT}>
          <Skeleton className="block h-control w-full rounded-md" />
        </Field>
        {/* The models line: PSet's own sentence, three lines at this width. */}
        <span className="block" aria-hidden>
          {['w-full', 'w-full', 'w-2/3'].map((w, i) => (
            <span key={i} className="flex h-4 items-center">
              <Skeleton className={`block h-3 ${w}`} />
            </span>
          ))}
        </span>
      </BoxBody>
      <BoxFooter>
        <span />
        <span className="flex gap-2">
          <Button variant="outline" size="sm" disabled>
            Test
          </Button>
          <Button size="sm" disabled>
            Save
          </Button>
        </span>
      </BoxFooter>
    </Box>
  );
}

/** What the last Test or Save found. Nothing until you ask: opening the
 *  page dials nothing. */
function StatusLine({ status }: { status: Status }) {
  if (status.kind === 'idle') return <span />;
  if (status.kind === 'working')
    return (
      <span className="flex items-center gap-2">
        <Spinner className="size-3" label={status.verb} />
        {status.verb}…
      </span>
    );
  return (
    <span
      className={
        status.kind === 'ok'
          ? 'flex items-center gap-2 text-success'
          : 'flex items-center gap-2 text-destructive'
      }
    >
      {status.kind === 'ok' ? (
        <CircleCheck className="size-4" />
      ) : (
        <CircleAlert className="size-4" />
      )}
      {status.text}
    </span>
  );
}

// ---------------------------------------------------------------- you

/** The name PSet greets you by, and the tutor calls you. Same shape as a
 *  connection Box: Save appears once there's something to save. */
function You() {
  const settings = useSettings();
  return (
    <Loaded
      query={settings}
      skeleton={
        <Box>
          <BoxBody>
            <Field label="Your name" hint={YOU_HINT}>
              <Skeleton className="block h-control w-full rounded-md" />
            </Field>
          </BoxBody>
        </Box>
      }
    >
      {(data) => <YouForm saved={data.profile.name} />}
    </Loaded>
  );
}

const YOU_HINT =
  'Home greets you by it, and so does the tutor. Leave it empty to go without.';

function YouForm({ saved }: { saved: string }) {
  const saveProfile = useSaveProfile();
  const savingShown = useShowPending(saveProfile);
  const [value, setValue] = useState<string | null>(null);
  const current = value ?? saved;
  const dirty = current.trim() !== saved;

  return (
    <Box>
      <BoxBody>
        <Field
          label="Your name"
          hint={YOU_HINT}
          error={
            saveProfile.error instanceof ApiError
              ? saveProfile.error.message
              : undefined
          }
        >
          <Input
            value={current}
            maxLength={60}
            autoComplete="given-name"
            onChange={(e) => {
              setValue(e.target.value);
              saveProfile.reset();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && dirty && !saveProfile.isPending)
                saveProfile.mutate({ name: current });
            }}
          />
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
            <Button
              size="sm"
              disabled={savingShown}
              onClick={() => {
                if (!saveProfile.isPending)
                  saveProfile.mutate({ name: current });
              }}
            >
              Save
            </Button>
          )}
        </BoxFooter>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------- health

const HEALTH_NAMES = [
  'Data directory',
  'Database',
  'Poppler',
  'Tesseract',
  'Ollama',
];

/** The checks' details name plumbing ("pdftoppm 24.02.0"); the purpose is
 *  ours to say, keyed by check id. */
const HEALTH_PURPOSE: Record<string, string> = {
  poppler: 'renders PDF pages',
  tesseract: 'reads scanned pages',
  ollama: 'searches your books',
};

/** The local system, checked on open, Ollama included: it runs on this
 *  machine. OpenRouter isn't here: its status lives beside the key, so
 *  each fact is said once. */
function Health() {
  const health = useHealth();
  const fix = useFixCheck();
  // "Fixing…" only for a fix that takes a while; a quick one just lands.
  const fixing = useShowPending(fix) ? fix.variables : null;

  return (
    <Loaded
      query={health}
      skeleton={
        // The checks are always the same five, so draw five rows at their
        // real height; the results then land without moving anything.
        <Box>
          {HEALTH_NAMES.map((name) => (
            <BoxRow
              key={name}
              leading={<Skeleton className="size-4 rounded-full" />}
              title={name}
              description={<Skeleton className="h-3 w-48" />}
            />
          ))}
        </Box>
      }
    >
      {({ checks }) => (
        <Box>
          {checks.map((c) => (
            <BoxRow
              key={c.id}
              leading={
                c.ok ? (
                  <CircleCheck className="text-success" aria-label="OK" />
                ) : (
                  <CircleAlert
                    className="text-warning"
                    aria-label="Needs attention"
                  />
                )
              }
              title={c.name}
              description={
                fix.isError && fix.variables === c.id ? (
                  <span className="text-destructive">{fix.error.message}</span>
                ) : HEALTH_PURPOSE[c.id] ? (
                  `${c.detail} · ${HEALTH_PURPOSE[c.id]}`
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
                    onClick={() => {
                      if (!fix.isPending) fix.mutate(c.id);
                    }}
                  >
                    {fixing === c.id ? 'Fixing…' : 'Fix'}
                  </Button>
                ) : undefined
              }
            />
          ))}
        </Box>
      )}
    </Loaded>
  );
}

// ---------------------------------------------------------------- appearance

const THEMES = [
  { value: 'light', label: 'Paper' },
  { value: 'dark', label: 'Night' },
  { value: 'system', label: 'System' },
] as const;

function Appearance() {
  const [theme, setTheme] = useState<Theme>(getTheme);
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
            applyTheme(t);
            setTheme(t);
          }}
        />
      </BoxBody>
    </Box>
  );
}

// ---------------------------------------------------------------- reset

/** Two ways to start over, smallest first: forget the time Home counts,
 *  or everything. Each asks first, under its own button, naming what goes;
 *  Reset's counts come from the engine's dry run as it asks. */
function Reset() {
  return (
    <Box tone="destructive">
      <ClearActivity />
      <ResetEverything />
    </Box>
  );
}

/** One act in the Reset Box: what it is, what it does, and its button.
 *  Outline, not destructive: the destructive button is destructive-soft,
 *  the same ground as this Box, and vanished into it. On card it reads as
 *  a control; the red ink says what kind. */
function ResetRow({
  title,
  description,
  action,
  actionRef,
  asking,
  onAsk,
  className,
  children,
}: {
  title: string;
  description: string;
  /** The button's label, and the ref its popover hangs from. */
  action: string;
  actionRef: RefObject<HTMLButtonElement | null>;
  asking: boolean;
  onAsk: () => void;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <BoxBody
      className={cn('flex items-center justify-between gap-4', className)}
    >
      <span>
        <span className="block text-sm font-medium">{title}</span>
        <span className="block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
      <Button
        ref={actionRef}
        variant="outline"
        className="text-destructive"
        aria-haspopup="dialog"
        aria-expanded={asking}
        onClick={onAsk}
      >
        {action}
      </Button>
      {children}
    </BoxBody>
  );
}

function ClearActivity() {
  const [asking, setAsking] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const clear = useClearActivity();
  return (
    <ResetRow
      title="Activity history"
      description="The time Home counts for homework, reading and asking."
      action="Clear history"
      actionRef={button}
      asking={asking}
      onAsk={() => {
        setAsking(true);
      }}
    >
      {asking && (
        <ConfirmPopover
          anchor={button}
          question="Clear activity history?"
          detail="Time spent starts again from zero, in every book. Books, homework, conversations and the questions you've worked stay."
          action="Clear history"
          error={clear.isError ? clear.error.message : undefined}
          onCancel={() => {
            setAsking(false);
          }}
          onConfirm={() => {
            if (!clear.isPending)
              clear.mutate(undefined, {
                onSuccess: () => {
                  setAsking(false);
                },
              });
          }}
        />
      )}
    </ResetRow>
  );
}

/** A count in a sentence that hasn't arrived: a slot as wide as the text it
 *  showed last time, so the sentence doesn't reflow when the number lands. */
function CountSlot({ width }: { width: number }) {
  return <Skeleton className="h-3" style={{ width: `${width}ch` }} />;
}

/** The app's one total act: everything goes, settings included, as if it
 *  had never been installed. */
function ResetEverything() {
  const [asking, setAsking] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const counts = useResetCounts();
  const books = counts.data && plural(counts.data.books, 'book');
  const pages = counts.data && plural(counts.data.pages, 'page');
  const booksWidth = useLastCount('reset-books-width', books?.length, 8);
  const pagesWidth = useLastCount('reset-pages-width', pages?.length, 8);
  const reset = useReset();
  const resetting = useShowPending(reset);
  return (
    <ResetRow
      title="Reset PSet"
      description="Deletes every book, every homework set, and these settings. It's a fresh install."
      action="Reset everything"
      actionRef={button}
      asking={asking}
      onAsk={() => {
        setAsking(true);
      }}
      className="border-t border-destructive"
    >
      {asking && (
        <ConfirmPopover
          anchor={button}
          question="Reset everything?"
          detail={
            <>
              Deletes{' '}
              <span className="tabular-nums">
                {books ?? <CountSlot width={booksWidth} />}
              </span>{' '}
              and their{' '}
              <span className="tabular-nums">
                {pages ?? <CountSlot width={pagesWidth} />}
              </span>
              , every homework set and conversation, and your settings, API key
              included. There&apos;s no undo.
            </>
          }
          action="Reset everything"
          busy={resetting ? 'Resetting…' : undefined}
          error={reset.isError ? reset.error.message : undefined}
          onCancel={() => {
            setAsking(false);
          }}
          onConfirm={() => {
            if (!reset.isPending)
              reset.mutate(undefined, {
                onSuccess: () => {
                  setAsking(false);
                  void navigate('/');
                },
              });
          }}
        />
      )}
    </ResetRow>
  );
}

// ---------------------------------------------------------------- page

function Connections() {
  // The key box has the same shape saved or not; the variant is named so the
  // audit opens both, and it is the data's, so the neutral skeleton is the same.
  return (
    <Loaded
      query={useSettings()}
      view="settingsKey"
      variant={undefined}
      neutral={<KeySkeleton />}
      skeletons={{ missing: <KeySkeleton />, saved: <KeySkeleton /> }}
      variantOf={(data): Variant<'settingsKey'> =>
        data.ready.key ? 'saved' : 'missing'
      }
    >
      {(data) => (
        <KeyBox
          initial={data.apiKey}
          ready={data.ready.key}
          models={data.models}
        />
      )}
    </Loaded>
  );
}

function AboutLine() {
  return (
    <Loaded
      query={useAbout()}
      skeleton={
        <p className="font-mono text-xs text-muted-foreground">
          <Skeleton className="h-3 w-80" />
        </p>
      }
    >
      {(data) => (
        <p className="font-mono text-xs text-muted-foreground">{`pset ${data.version} · ${data.dataDir}`}</p>
      )}
    </Loaded>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-5">
      <h2 className="font-heading text-xl">{title}</h2>
      {children}
    </section>
  );
}

export function Settings() {
  // /settings#connections, from a failure that needs the key fixed. Every
  // section holds its size while it loads, so one scroll lands.
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView();
  }, []);
  return (
    // No middle of its own: the bar picks up "Settings" once the h1 has
    // scrolled away, and never repeats it while it's on screen.
    <AppShell>
      <PageShell>
        <PageTitle className="text-3xl">Settings</PageTitle>

        <Section title="You">
          <You />
        </Section>

        <Section id="connections" title="Connections">
          <Connections />
        </Section>

        <Section title="Health">
          <Health />
        </Section>

        <Section title="Updates">
          <Updates />
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
  );
}
