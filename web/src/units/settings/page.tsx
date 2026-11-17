import { Arrives } from '@/design/arrives';
import type { Waits } from '@/design/loading';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { money, plural } from '@/lib/format';
import { Bone } from '@/units/bone';
import { Button } from '@/units/button';
import { Confirm } from '@/units/confirm';
import { DangerDialog } from '@/units/danger-dialog';
import { Fold } from '@/units/fold';
import { List } from '@/units/list';
import { ListRow } from '@/units/list-row';
import { Meter } from '@/units/meter';
import { SectionHeading } from '@/units/section-heading';
import { SegmentedControl } from '@/units/segmented-control';
import { Tag } from '@/units/tag';
import { TextField } from '@/units/text-field';
import { TopBar } from '@/units/top-bar';
import { ErrorNotice } from '@/units/error-notice';
import type { Appearance, SettingsData } from './sample';

/** How long a "Saved" stays under a field. */
const SAVED_MS = 2000;

const APPEARANCES = [
  { id: 'paper', label: 'Paper' },
  { id: 'night', label: 'Night' },
  { id: 'system', label: 'System' },
];

/** One group of the page: a heading over an outlined box of rows
 *  (settings-d15). */
function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-3">
        <List>{children}</List>
      </div>
    </section>
  );
}

/** One setting: its name and a line saying what it does on the left, the
 *  control on the right and centred on both lines, as GitHub and macOS
 *  settings are laid out. A field's state ("Saved", why it failed) takes the
 *  hint's place while it lasts, so it reads where the student already looks
 *  and nothing moves. */
function Row({
  name,
  hint,
  note,
  tone,
  children,
}: {
  name: string;
  hint: ReactNode;
  /** The field's state, shown in the hint's place while it lasts. */
  note?: ReactNode;
  /** The state's colour: success for done, danger for failed. */
  tone?: 'success' | 'danger';
  children?: ReactNode;
}) {
  const shown = note !== undefined && note !== '' && note !== false;
  const colour =
    shown && tone === 'success'
      ? 'text-(--ds-success)'
      : 'text-(--ds-fg-muted)';
  return (
    <div className="flex min-h-16 min-w-0 items-center justify-between gap-6 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="ds-body font-medium text-(--ds-fg)">{name}</p>
        {shown && tone === 'danger' && typeof note === 'string' ? (
          <ErrorNotice variant="line" error={{ what: note }} />
        ) : (
          <p className={`ds-small ${colour}`}>{shown ? note : hint}</p>
        )}
      </div>
      {children !== undefined && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** A fold inside the box, its rows under a hairline. */
function FoldRow({
  label,
  open,
  action,
  children,
}: {
  label: string;
  open?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="px-2">
      <Fold label={label} defaultOpen={open} action={action}>
        <div className="-mx-2 divide-y divide-(--ds-border-muted) border-t border-(--ds-border-muted)">
          {children}
        </div>
      </Fold>
    </div>
  );
}

/** The checks PSet runs, known before their results: their rows are drawn
 *  while they run. */
const CHECK_NAMES = [
  { id: 'key', name: 'Model key' },
  { id: 'pages', name: 'Page reading' },
  { id: 'search', name: 'Search' },
  { id: 'data', name: 'Study data' },
  { id: 'disk', name: 'Disk space' },
] as const;

/** Runs `fn` after `ms`, once, and forgets it when the page goes. */
function useLater() {
  const timers = useRef(new Set<number>());
  useEffect(() => {
    const held = timers.current;
    return () => {
      held.forEach((t) => {
        window.clearTimeout(t);
      });
    };
  }, []);
  return (fn: () => void, ms: number) => {
    timers.current.add(window.setTimeout(fn, ms));
  };
}

/** The four groups, each row a name and what it does on the left and its
 *  control on the right. Drawn once the settings are in. */
function Groups({
  settings,
  unfolded,
}: {
  settings: SettingsData;
  unfolded?: boolean;
}) {
  const later = useLater();
  const [name, setName] = useState(settings.name);
  const [saved, setSaved] = useState(false);
  const [key, setKey] = useState(settings.key.value);
  const [savedKey, setSavedKey] = useState(settings.key.value);
  /** What the last Test said, for a moment; a failure stays until the key is edited. */
  const [result, setResult] = useState<'ok' | 'failed' | 'saved' | undefined>(
    settings.key.status === 'failed' ? 'failed' : undefined,
  );
  const [failure, setFailure] = useState(settings.key.failure);
  const [testing, setTesting] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(settings.appearance);
  const [update, setUpdate] = useState(settings.update.status);
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const [errors, setErrors] = useState(settings.errors);
  const [confirming, setConfirming] = useState<'history' | 'errors' | 'all'>();
  const [historyEl, setHistoryEl] = useState<HTMLElement | null>(null);
  const [errorsEl, setErrorsEl] = useState<HTMLElement | null>(null);

  const { counts } = settings;

  const commitName = () => {
    setSaved(true);
    later(() => {
      setSaved(false);
    }, SAVED_MS);
  };

  /** Tests the key; the sample accepts any that looks like one. Save tests
   *  first, then keeps it. */
  const test = (save: boolean) => {
    setTesting(true);
    later(() => {
      setTesting(false);
      if (key.trim().startsWith('sk-or-')) {
        setResult(save ? 'saved' : 'ok');
        if (save) setSavedKey(key);
        later(() => {
          setResult((r) => (r === 'failed' ? r : undefined));
        }, SAVED_MS);
      } else {
        setResult('failed');
        setFailure('OpenRouter refused this key. Check it and paste it again.');
      }
    }, 800);
  };

  const check = () => {
    setChecking(true);
    setUpToDate(false);
    later(() => {
      setChecking(false);
      setUpToDate(true);
    }, 1000);
  };

  const needsKey =
    settings.key.status === 'none' &&
    result === undefined &&
    key === settings.key.value;
  const keyNote = testing ? (
    <span className="ds-shimmer">Testing the key</span>
  ) : result === 'failed' ? (
    failure
  ) : result === 'saved' ? (
    'Saved'
  ) : result === 'ok' ? (
    'The key works.'
  ) : needsKey ? (
    'PSet needs a key to read and guide.'
  ) : undefined;
  const keyReady = key.trim() === '' ? 'Paste a key first.' : undefined;
  // The checks are the slowest read here (a second or so): until they are
  // in, Health says it is checking and each check's result is a bar.
  const checks = settings.checks;
  const failing = (checks ?? []).filter((c) => !c.ok);

  // "Working" is quiet text and only "Failing" is a tag, at the row's right
  // edge with its fix to the left (settings-d22).
  const rows = (checks ?? CHECK_NAMES).map((c) => (
    <ListRow
      key={c.id}
      title={c.name}
      meta={['detail' in c ? c.detail : <Bone key="detail" ch={28} />]}
      aside={
        <div className="flex items-center justify-end gap-3">
          {'ok' in c && c.fix && <Button>{c.fix}</Button>}
          {!('ok' in c) ? (
            <span className="ds-small">
              <Bone ch={7} />
            </span>
          ) : c.ok ? (
            <span className="ds-small text-(--ds-fg-muted)">Working</span>
          ) : (
            <Tag tone="danger">Failing</Tag>
          )}
        </div>
      }
      asideWidth={240}
    />
  ));

  return (
    <div className="space-y-10">
      <Group title="You">
        <Row
          name="Name"
          hint="What PSet calls you."
          note={saved ? 'Saved' : undefined}
          tone="success"
        >
          <div className="w-[280px]">
            <TextField
              label="Name"
              labelHidden
              value={name}
              onChange={setName}
              onCommit={commitName}
              placeholder="Your first name"
              note={false}
            />
          </div>
        </Row>
        <Row name="Appearance" hint="Paper, Night, or follow your computer.">
          <SegmentedControl
            label="Appearance"
            options={APPEARANCES}
            value={appearance}
            onChange={(id) => {
              setAppearance(id as Appearance);
            }}
          />
        </Row>
      </Group>

      <Group title="Model">
        <Row
          name="OpenRouter key"
          hint="Lets PSet read pages and guide you."
          note={keyNote}
          tone={
            result === 'failed'
              ? 'danger'
              : result === 'ok' || result === 'saved'
                ? 'success'
                : undefined
          }
        >
          <div className="w-[440px]">
            <TextField
              label="OpenRouter key"
              labelHidden
              value={key}
              onChange={(v) => {
                setKey(v);
                setResult(undefined);
              }}
              mono
              secret
              placeholder="sk-or-v1-"
              failed={result === 'failed'}
              note={false}
              action={
                <div className="flex gap-2">
                  <Button
                    busy={testing}
                    notReady={keyReady}
                    onPress={() => {
                      test(false);
                    }}
                  >
                    Test
                  </Button>
                  {/* Primary only while there is an edit to keep
                      (settings-d24). */}
                  <Button
                    variant={key === savedKey ? 'default' : 'primary'}
                    busy={testing}
                    notReady={keyReady}
                    onPress={() => {
                      test(true);
                    }}
                  >
                    Save
                  </Button>
                </div>
              }
            />
          </div>
        </Row>
        <FoldRow label="Models PSet uses" open={unfolded}>
          {settings.models.map((m) => (
            <ListRow key={m.job} title={m.job} meta={[m.model]} />
          ))}
        </FoldRow>
        <Row
          name={`Spent in ${settings.usage.month}`}
          hint="What the models cost you, by course below."
        >
          <span className="ds-body ds-tabular text-(--ds-fg)">
            {money(settings.usage.total)}
          </span>
        </Row>
        {settings.usage.courses.map((c) => (
          <ListRow
            key={c.name}
            title={c.name}
            aside={
              <div className="flex items-center gap-3">
                <Meter value={c.cost} max={settings.usage.total} />
                <span className="ds-small ds-tabular w-20 shrink-0 text-right text-(--ds-fg-muted)">
                  {money(c.cost)}
                </span>
              </div>
            }
            asideWidth={320}
          />
        ))}
        <Row name="All time" hint="Everything PSet has spent for you.">
          <span className="ds-body ds-tabular text-(--ds-fg)">
            {money(settings.usage.allTime)}
          </span>
        </Row>
      </Group>

      <Group title="PSet">
        <Row
          name={`PSet ${settings.version}`}
          hint={
            update === 'current'
              ? upToDate
                ? 'You have the latest version.'
                : 'Up to date.'
              : update === 'updating'
                ? 'Updating in place. PSet restarts when it is done.'
                : `${settings.update.latest ?? ''} is available.`
          }
        >
          <Button busy={checking} onPress={check}>
            Check for updates
          </Button>
        </Row>
        {update !== 'current' && (
          // The notes stay while it updates; only the button turns busy
          // and the hint above says what is happening (settings-d19).
          <div className="flex min-w-0 items-center justify-between gap-4 px-4 py-3">
            <ul className="ds-small min-w-0 list-disc space-y-1 pl-5 text-(--ds-fg-muted)">
              {(settings.update.notes ?? []).map((n) => (
                <li key={n} className="[overflow-wrap:anywhere]">
                  {n}
                </li>
              ))}
            </ul>
            <Button
              variant="primary"
              busy={update === 'updating'}
              busyLabel="Updating"
              onPress={() => {
                setUpdate('updating');
              }}
            >
              {`Update to ${settings.update.latest ?? ''}`}
            </Button>
          </div>
        )}
        <Row
          name="Health"
          hint={
            checks === undefined ? (
              <span className="ds-shimmer">Checking</span>
            ) : (
              'Everything is working'
            )
          }
          note={
            failing.length === 0
              ? undefined
              : `${plural(failing.length, 'check is', 'checks are')} failing.`
          }
          tone="danger"
        />
        {/* Opened for a failure only when the results were in as the page
            drew: one that comes later says so in Health's line, and the
            fold stays as it is, so nothing under it moves. */}
        <FoldRow label="Checks" open={unfolded || failing.length > 0}>
          {rows}
        </FoldRow>
        {errors.length > 0 && (
          <FoldRow
            label={`Recent errors (${String(errors.length)})`}
            open={unfolded}
            action={
              <div ref={setErrorsEl} className="pr-2">
                <Button
                  onPress={() => {
                    setConfirming('errors');
                  }}
                >
                  Clear all
                </Button>
              </div>
            }
          >
            {errors.map((e) => (
              <ListRow
                key={e.id}
                title={e.reason}
                meta={[e.fix, e.when]}
                status={<span className="ds-code">{e.id}</span>}
              />
            ))}
          </FoldRow>
        )}
        <Row name="Data folder" hint="Where PSet keeps your courses and study.">
          <span className="ds-code text-(--ds-fg-muted)">
            {settings.dataDir}
          </span>
        </Row>
      </Group>

      <Group title="Reset">
        <Row
          name="Clear study history"
          hint="Removes time studied and answers; keeps your courses."
        >
          <div ref={setHistoryEl}>
            <Button
              onPress={() => {
                setConfirming('history');
              }}
            >
              Clear
            </Button>
          </div>
        </Row>
        <Row
          name="Reset everything"
          hint="Removes every course, assignment, material and memory."
        >
          {/* Outlined: the solid red is the dialog's final button only
              (settings-d23). */}
          <Button
            onPress={() => {
              setConfirming('all');
            }}
          >
            Reset
          </Button>
        </Row>
      </Group>

      {(confirming === 'history' || confirming === 'errors') && (
        <Confirm
          anchor={confirming === 'history' ? historyEl : errorsEl}
          message={
            confirming === 'history'
              ? `This deletes ${String(counts.studyHours)} h of study time and ${plural(counts.answers, 'answer', 'answers')}.`
              : `This clears ${plural(errors.length, 'kept error', 'kept errors')}.`
          }
          confirmLabel={
            confirming === 'history' ? 'Clear study history' : 'Clear errors'
          }
          onConfirm={() => {
            if (confirming === 'errors') setErrors([]);
            setConfirming(undefined);
          }}
          onCancel={() => {
            setConfirming(undefined);
          }}
        />
      )}
      {confirming === 'all' && (
        <DangerDialog
          title="Reset everything"
          message={`This deletes ${plural(counts.courses, 'course', 'courses')}, ${plural(counts.sets, 'assignment', 'assignments')}, ${plural(counts.materials, 'material', 'materials')} and ${plural(counts.memories, 'memory', 'memories')}.`}
          word="reset"
          confirmLabel="Reset everything"
          onConfirm={() => {
            setConfirming(undefined);
          }}
          onCancel={() => {
            setConfirming(undefined);
          }}
        />
      )}
    </div>
  );
}

/** The settings screen, loaded or as its quiet form: the top bar and the
 *  title, and nothing past them (loading D2). A failed read keeps that and
 *  says so under the title (A3). */
export function Page({
  settings,
  failed,
  unfolded,
  homeHref = '/',
  settingsHref = '/settings',
  loading,
}: Waits<
  {
    /** The read failed: the Error notice under the title. */
    failed?: boolean;
    /** Opens every fold (the design page only). */
    unfolded?: boolean;
    homeHref?: string;
    settingsHref?: string;
  },
  { settings: SettingsData }
>) {
  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        onSettings
        path={[{ label: 'Settings' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <h1 className="ds-display text-(--ds-fg)">Settings</h1>
          </div>
          <Arrives screen="settings" ready={loading !== true}>
            {failed === true ? (
              <div className="flex justify-center py-24">
                <ErrorNotice
                  error={{
                    what: "Couldn't load Settings",
                    why: "PSet couldn't read your settings. Nothing was changed.",
                    chain: ['settings.load'],
                  }}
                  actions={[{ label: 'Try again' }]}
                />
              </div>
            ) : loading === true ? null : (
              <Groups settings={settings} unfolded={unfolded} />
            )}
          </Arrives>
        </div>
      </div>
    </div>
  );
}
