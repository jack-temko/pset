import { useEffect, useRef, useState, type ReactNode } from 'react';

import { money, plural } from '@/lib/format';
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
import type { Appearance, SettingsData } from './sample';

/** How long a "Saved" stays under a field. */
const SAVED_MS = 2000;

const APPEARANCES = [
  { id: 'paper', label: 'Paper' },
  { id: 'night', label: 'Night' },
  { id: 'system', label: 'System' },
];

function Bar({ className }: { className: string }) {
  return (
    <span
      aria-hidden
      className={`block animate-pulse rounded-(--ds-radius-tag) bg-(--ds-border-muted) ${className}`}
    />
  );
}

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
 *  control on the right, as GitHub and macOS settings are laid out. A row
 *  whose control is a field aligns to the top, so the field's note under it
 *  does not push the name off centre. */
function Row({
  name,
  hint,
  top,
  children,
}: {
  name: string;
  hint: ReactNode;
  top?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex min-h-16 min-w-0 justify-between gap-6 px-4 py-3 ${top ? 'items-start' : 'items-center'}`}
    >
      <div className="min-w-0 flex-1">
        <p className="ds-body font-medium text-(--ds-fg)">{name}</p>
        <p className="ds-small text-(--ds-fg-muted)">{hint}</p>
      </div>
      {children !== undefined && <div className="shrink-0">{children}</div>}
    </div>
  );
}

/** A fold inside the box, its rows under a hairline. */
function FoldRow({
  label,
  open,
  children,
}: {
  label: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="px-2">
      <Fold label={label} defaultOpen={open}>
        <div className="-mx-2 divide-y divide-(--ds-border-muted) border-t border-(--ds-border-muted)">
          {children}
        </div>
      </Fold>
    </div>
  );
}

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

/** The Settings page (G1 to G13, confirmed by Jack in settings-view-grill):
 *  four groups on one page, each row a name and what it does on the left and
 *  its control on the right. It reads sample data; nothing is saved or sent. */
export function Settings({
  settings,
  failed,
  unfolded,
  homeHref = '/',
  settingsHref = '/settings',
}: {
  settings: SettingsData;
  /** The read failed: shows the failed page. */
  failed?: boolean;
  /** Opens every fold (the design page only). */
  unfolded?: boolean;
  homeHref?: string;
  settingsHref?: string;
}) {
  const later = useLater();
  const [name, setName] = useState(settings.name);
  const [saved, setSaved] = useState(false);
  const [key, setKey] = useState(settings.key.value);
  /** What the last Test said; editing the key clears it. */
  const [result, setResult] = useState<'ok' | 'failed' | 'saved' | undefined>(
    settings.key.status === 'none'
      ? undefined
      : settings.key.status === 'ok'
        ? 'ok'
        : 'failed',
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
      if (key.trim().startsWith('sk-or-')) setResult(save ? 'saved' : 'ok');
      else {
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
  const keyNote = testing
    ? 'Testing the key'
    : result === 'failed'
      ? failure
      : result === 'saved'
        ? 'Saved'
        : result === 'ok'
          ? 'The key works.'
          : needsKey
            ? 'PSet needs a key to read and guide.'
            : undefined;
  const keyReady = key.trim() === '' ? 'Paste a key first.' : undefined;
  const failing = settings.checks.filter((c) => !c.ok);

  const anyFix = settings.checks.some((c) => c.fix);
  const rows = settings.checks.map((c) => (
    <ListRow
      key={c.id}
      title={c.name}
      meta={[c.detail]}
      status={c.ok ? <Tag>Working</Tag> : <Tag tone="danger">Failing</Tag>}
      aside={
        anyFix ? (
          <div className="flex justify-end">
            {c.fix && <Button>{c.fix}</Button>}
          </div>
        ) : undefined
      }
      asideWidth={140}
    />
  ));

  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        onSettings
        path={[{ label: 'Home', href: homeHref }, { label: 'Settings' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <h1 className="ds-display text-(--ds-fg)">Settings</h1>
          </div>
          {failed ? (
            <div className="flex flex-col items-center py-24 text-center">
              <p className="ds-heading text-(--ds-fg)">
                Could not load Settings
              </p>
              <p className="ds-body mt-2 mb-6 text-(--ds-fg-muted)">
                PSet could not read them. Try again in a moment.
              </p>
              <Button>Try again</Button>
            </div>
          ) : (
            <div className="space-y-10">
              <Group title="You">
                <Row name="Name" hint="What PSet calls you." top>
                  <div className="w-[280px]">
                    <TextField
                      label="Name"
                      labelHidden
                      value={name}
                      onChange={setName}
                      onCommit={commitName}
                      placeholder="Your first name"
                      note={saved ? 'Saved' : ''}
                    />
                  </div>
                </Row>
                <Row
                  name="Appearance"
                  hint="Paper, Night, or follow your computer."
                >
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
                  top
                >
                  <div className="w-[520px]">
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
                      note={keyNote}
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
                          <Button
                            variant="primary"
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
                  name={`pset ${settings.version}`}
                  hint={
                    update === 'current'
                      ? upToDate
                        ? 'You have the latest version.'
                        : 'Up to date.'
                      : `${settings.update.latest ?? ''} is available.`
                  }
                >
                  <Button busy={checking} onPress={check}>
                    Check for updates
                  </Button>
                </Row>
                {update !== 'current' && (
                  <div className="grid px-4 py-3">
                    {/* Both faces stack in one cell, so the row keeps its height. */}
                    <div
                      className={`flex min-w-0 items-start justify-between gap-4 [grid-area:1/1] ${update === 'updating' ? 'invisible' : ''}`}
                      aria-hidden={update === 'updating'}
                      inert={update === 'updating'}
                    >
                      <ul className="ds-small min-w-0 list-disc space-y-1 pl-5 text-(--ds-fg-muted)">
                        {(settings.update.notes ?? []).map((n) => (
                          <li key={n} className="[overflow-wrap:anywhere]">
                            {n}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="primary"
                        onPress={() => {
                          setUpdate('updating');
                        }}
                      >
                        {`Update to ${settings.update.latest ?? ''}`}
                      </Button>
                    </div>
                    <div
                      className={`flex min-w-0 items-start justify-between gap-4 [grid-area:1/1] ${update === 'updating' ? '' : 'invisible'}`}
                      aria-hidden={update !== 'updating'}
                      inert={update !== 'updating'}
                    >
                      <p className="ds-small text-(--ds-fg)">
                        Updating in place. PSet restarts when it is done.
                      </p>
                      <Button variant="primary" busy>
                        {`Update to ${settings.update.latest ?? ''}`}
                      </Button>
                    </div>
                  </div>
                )}
                <Row
                  name="Health"
                  hint={
                    failing.length === 0
                      ? 'Everything is working'
                      : `${plural(failing.length, 'check is', 'checks are')} failing.`
                  }
                />
                <FoldRow label="Checks" open={unfolded || failing.length > 0}>
                  {rows}
                </FoldRow>
                {errors.length > 0 && (
                  <FoldRow
                    label={`Recent errors (${String(errors.length)})`}
                    open={unfolded}
                  >
                    {errors.map((e) => (
                      <ListRow
                        key={e.id}
                        title={e.reason}
                        meta={[e.fix, e.when]}
                        status={<span className="ds-code">{e.id}</span>}
                      />
                    ))}
                    <div className="px-4 py-3">
                      <div ref={setErrorsEl} className="inline-block">
                        <Button
                          onPress={() => {
                            setConfirming('errors');
                          }}
                        >
                          Clear all
                        </Button>
                      </div>
                    </div>
                  </FoldRow>
                )}
                <Row
                  name="Data folder"
                  hint="Where PSet keeps your courses and study."
                >
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
                  hint="Removes every course, set, material and memory."
                >
                  <Button
                    variant="danger"
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
                    confirming === 'history'
                      ? 'Clear study history'
                      : 'Clear errors'
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
                  message={`This deletes ${plural(counts.courses, 'course', 'courses')}, ${plural(counts.sets, 'set', 'sets')}, ${plural(counts.materials, 'material', 'materials')} and ${plural(counts.memories, 'memory', 'memories')}.`}
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
          )}
        </div>
      </div>
    </div>
  );
}

/** Settings while it loads: bars shaped like the sections. */
export function SettingsSkeleton({
  homeHref = '/',
  settingsHref = '/settings',
}: {
  homeHref?: string;
  settingsHref?: string;
}) {
  const heights = [145, 372, 235, 135];
  return (
    <div>
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        onSettings
        path={[{ label: 'Home', href: homeHref }, { label: 'Settings' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="@container mx-auto max-w-(--ds-page-width)">
          <div className="ds-room-display">
            <div className="flex h-(--ds-display-line) items-center">
              <Bar className="h-9 w-[224px]" />
            </div>
          </div>
          <div className="space-y-10">
            {heights.map((h, i) => (
              <div key={i}>
                <div className="flex min-h-8 items-center">
                  <Bar className="h-5 w-32" />
                </div>
                <div className="mt-3">
                  <div style={{ height: h }}>
                    <Bar className="h-full w-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
