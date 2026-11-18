import { Arrives } from '@/design/arrives';
import type { Waits } from '@/design/loading';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { money, plural } from '@/lib/format';
import { Bone } from '@/units/bone';
import { Button } from '@/units/button';
import { Confirm } from '@/units/confirm';
import { errorView } from '@/api/client';
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
import { SAMPLE_ACTIONS, type SettingsActions } from './actions';
import type { Appearance, IncidentRow, SettingsData } from './sample';

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
  actions,
}: {
  settings: SettingsData;
  unfolded?: boolean;
  actions: SettingsActions;
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
  const [found, setFound] = useState({
    latest: settings.update.latest,
    notes: settings.update.notes,
  });
  const [updateFailure, setUpdateFailure] = useState<string>();
  const [nameFailure, setNameFailure] = useState<string>();
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const [confirming, setConfirming] = useState<'history' | 'all'>();
  const [historyEl, setHistoryEl] = useState<HTMLElement | null>(null);
  const [fixing, setFixing] = useState<string>();
  const [resetFailure, setResetFailure] = useState<string>();

  const { counts } = settings;

  const commitName = () => {
    setNameFailure(undefined);
    actions.saveName(name.trim()).then(
      () => {
        setSaved(true);
        later(() => {
          setSaved(false);
        }, SAVED_MS);
      },
      (e: unknown) => {
        setNameFailure(errorView(e).what);
      },
    );
  };

  /** Tests the key, or tests it and keeps it if it works. What it said
   *  takes the hint's place: "The key works.", "Saved", or why not. */
  const test = (save: boolean) => {
    setTesting(true);
    (save ? actions.saveKey(key) : actions.testKey(key))
      .then(
        (a) => {
          if (a.ok) {
            setResult(save ? 'saved' : 'ok');
            if (save) setSavedKey(key);
            later(() => {
              setResult((r) => (r === 'failed' ? r : undefined));
            }, SAVED_MS);
          } else {
            setResult('failed');
            setFailure(a.failure);
          }
        },
        (e: unknown) => {
          setResult('failed');
          setFailure(errorView(e).what);
        },
      )
      .finally(() => {
        setTesting(false);
      });
  };

  const check = () => {
    setChecking(true);
    setUpToDate(false);
    setUpdateFailure(undefined);
    actions
      .checkUpdate()
      .then(
        (f) => {
          setUpdate(f.status);
          setFound({ latest: f.latest, notes: f.notes });
          setUpToDate(f.status === 'current');
        },
        (e: unknown) => {
          setUpdateFailure(errorView(e).what);
        },
      )
      .finally(() => {
        setChecking(false);
      });
  };

  const runFix = (id: string) => {
    setFixing(id);
    actions
      .fix(id)
      .catch(() => undefined)
      .finally(() => {
        setFixing(undefined);
      });
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
          {'ok' in c && c.fix && (
            <Button
              busy={fixing === c.id}
              onPress={() => {
                runFix(c.id);
              }}
            >
              {c.fix}
            </Button>
          )}
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
          note={nameFailure ?? (saved ? 'Saved' : undefined)}
          tone={nameFailure === undefined ? 'success' : 'danger'}
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
              actions.setAppearance(id as Appearance);
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
          note={updateFailure}
          tone="danger"
          hint={
            update === 'current'
              ? upToDate
                ? 'You have the latest version.'
                : 'Up to date.'
              : update === 'updating'
                ? 'Updating in place. PSet restarts when it is done.'
                : `${found.latest ?? ''} is available.`
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
              {(found.notes ?? []).map((n) => (
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
                setUpdateFailure(undefined);
                actions.applyUpdate().catch((e: unknown) => {
                  setUpdate('available');
                  setUpdateFailure(errorView(e).what);
                });
              }}
            >
              {`Update to ${found.latest ?? ''}`}
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
        {settings.incidents.length > 0 && (
          <FoldRow label={incidentsLabel(settings.incidents)} open={unfolded}>
            {settings.incidents.map((i) => (
              <IncidentItem key={i.id} incident={i} actions={actions} />
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
          note={resetFailure}
          tone="danger"
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

      {/* These two can't be undone, so they still ask first: everything
          that can be undone is done at once and offers Undo instead. */}
      {confirming === 'history' && (
        <Confirm
          anchor={historyEl}
          message={`This deletes ${String(counts.studyHours)} h of study time and ${plural(counts.answers, 'answer', 'answers')}.`}
          confirmLabel="Clear study history"
          onConfirm={() => {
            void actions.clearHistory().catch(() => undefined);
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
            setResetFailure(undefined);
            actions.reset().catch((e: unknown) => {
              setResetFailure(errorView(e).what);
            });
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
  actions = SAMPLE_ACTIONS,
  onRetry,
  homeHref = '/',
  settingsHref = '/settings',
  loading,
}: Waits<
  {
    /** The read failed: the Error notice under the title. */
    failed?: boolean;
    /** Opens every fold (the design page only). */
    unfolded?: boolean;
    /** What the page does; the design page's fakes by default. */
    actions?: SettingsActions;
    /** Reads the settings again, after a failed read. */
    onRetry?: () => void;
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
                  actions={[{ label: 'Try again', onPress: onRetry }]}
                />
              </div>
            ) : loading === true ? null : (
              <Groups
                settings={settings}
                unfolded={unfolded}
                actions={actions}
              />
            )}
          </Arrives>
        </div>
      </div>
    </div>
  );
}

/** "Recent errors (3 open)": open ones are what matters; resolved ones are
 *  listed under them for a week. */
function incidentsLabel(all: readonly IncidentRow[]): string {
  const open = all.filter((i) => i.open).length;
  return open === 0
    ? `Recent errors (${String(all.length)}, all resolved)`
    : `Recent errors (${String(open)} open)`;
}

/** One incident: what went wrong and its fix, when and how often, its id
 *  to quote, and what can be done. Details opens its trace in place. */
function IncidentItem({
  incident: i,
  actions,
}: {
  incident: IncidentRow;
  actions: SettingsActions;
}) {
  const [busy, setBusy] = useState<'try' | 'dismiss'>();
  const [trace, setTrace] = useState<readonly string[]>();
  const [open, setOpen] = useState(false);
  const run = (which: 'try' | 'dismiss') => {
    setBusy(which);
    (which === 'try' ? actions.tryAgain(i.id) : actions.dismiss(i.id))
      .catch(() => undefined)
      .finally(() => {
        setBusy(undefined);
      });
  };
  const details = () => {
    setOpen((o) => !o);
    if (trace === undefined) {
      actions.trace(i.id).then(setTrace, (e: unknown) => {
        setTrace([errorView(e).what]);
      });
    }
  };
  const times =
    i.count > 1 ? `${String(i.count)} times, last ${i.when}` : i.when;
  return (
    <div>
      <ListRow
        title={i.what}
        meta={[...(i.fix === undefined ? [] : [i.fix]), times]}
        status={
          i.open ? (
            <Tag tone="danger">Open</Tag>
          ) : (
            <span className="ds-small text-(--ds-fg-muted)">Resolved</span>
          )
        }
        aside={
          <div className="flex items-center justify-end gap-2">
            <Button variant="quiet" onPress={details}>
              {open ? 'Hide details' : 'Details'}
            </Button>
            {i.open && i.canTry && (
              <Button
                busy={busy === 'try'}
                onPress={() => {
                  run('try');
                }}
              >
                Try again
              </Button>
            )}
            {i.open && (
              <Button
                busy={busy === 'dismiss'}
                onPress={() => {
                  run('dismiss');
                }}
              >
                Dismiss
              </Button>
            )}
          </div>
        }
        asideWidth={320}
      />
      {open && (
        <div className="px-4 pb-3">
          <p className="ds-code text-(--ds-fg-muted)">{i.id}</p>
          {trace === undefined ? (
            <p className="ds-small ds-shimmer">Reading its trace</p>
          ) : (
            <ul className="ds-small space-y-1 text-(--ds-fg-muted)">
              {trace.map((line, n) => (
                // oxlint-disable-next-line react/no-array-index-key -- lines of one trace, fixed once read
                <li key={n} className="[overflow-wrap:anywhere]">
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
