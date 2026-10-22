import { useEffect, useRef, useState, type ReactNode } from 'react';

import { Button } from '@/units/button';
import { Confirm } from '@/units/confirm';
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

const money = (n: number) =>
  `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;

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

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <SectionHeading>{title}</SectionHeading>
      <div className="mt-3">{children}</div>
    </section>
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

/** The Settings page (G1 to G12, all assumed, to confirm with Jack): one
 *  column of short sections in the order a student needs them. It reads
 *  sample data; nothing is saved or sent. */
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
  const [keyStatus, setKeyStatus] = useState(settings.key.status);
  const [keyNote, setKeyNote] = useState(settings.key.failure);
  const [testing, setTesting] = useState(false);
  const [appearance, setAppearance] = useState<Appearance>(settings.appearance);
  const [update, setUpdate] = useState(settings.update.status);
  const [checking, setChecking] = useState(false);
  const [upToDate, setUpToDate] = useState(false);
  const [errors, setErrors] = useState(settings.errors);
  const [confirming, setConfirming] = useState<'history' | 'all'>();

  const { counts } = settings;

  const commitName = () => {
    setSaved(true);
    later(() => {
      setSaved(false);
    }, SAVED_MS);
  };

  /** Tests the key; the sample accepts any that looks like one. */
  const test = (then?: () => void) => {
    setTesting(true);
    later(() => {
      setTesting(false);
      if (key.trim().startsWith('sk-or-')) {
        setKeyStatus('ok');
        setKeyNote('The key works.');
        then?.();
      } else {
        setKeyStatus('failed');
        setKeyNote('OpenRouter refused this key. Check it and paste it again.');
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

  const keyReady = key.trim() === '' ? 'Paste a key first.' : undefined;
  const failing = settings.checks.filter((c) => !c.ok);

  const rows = settings.checks.map((c) => (
    <ListRow
      key={c.id}
      title={c.name}
      meta={[c.detail]}
      status={c.ok ? <Tag>Working</Tag> : <Tag tone="danger">Failing</Tag>}
      aside={
        c.fix ? (
          <div className="flex justify-end">
            <Button>{c.fix}</Button>
          </div>
        ) : undefined
      }
      asideWidth={c.fix ? 140 : 0}
    />
  ));

  return (
    <div className="@container">
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[{ label: 'Home', href: homeHref }, { label: 'Settings' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="mx-auto max-w-180">
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
            <div className="space-y-12">
              <Section title="You">
                <TextField
                  label="Name"
                  value={name}
                  onChange={setName}
                  onCommit={commitName}
                  placeholder="Your first name"
                  note={saved ? 'Saved' : 'What PSet calls you.'}
                />
              </Section>

              <Section title="Model key">
                {keyStatus === 'none' && (
                  <p className="ds-body mb-3 text-(--ds-fg)">
                    PSet needs a key to read and guide.
                  </p>
                )}
                <TextField
                  label="OpenRouter key"
                  value={key}
                  onChange={(v) => {
                    setKey(v);
                    setKeyNote(undefined);
                  }}
                  mono
                  secret
                  placeholder="sk-or-v1-"
                  failed={keyStatus === 'failed'}
                  note={
                    testing
                      ? 'Testing the key'
                      : (keyNote ??
                        (keyStatus === 'ok' ? 'The key works.' : undefined))
                  }
                  action={
                    <div className="flex gap-2">
                      <Button
                        busy={testing}
                        notReady={keyReady}
                        onPress={() => {
                          test();
                        }}
                      >
                        Test
                      </Button>
                      <Button
                        variant="primary"
                        busy={testing}
                        notReady={keyReady}
                        onPress={() => {
                          test();
                        }}
                      >
                        Save
                      </Button>
                    </div>
                  }
                />
                <Fold label="Models PSet uses" defaultOpen={unfolded}>
                  <List>
                    {settings.models.map((m) => (
                      <ListRow key={m.job} title={m.job} meta={[m.model]} />
                    ))}
                  </List>
                </Fold>
              </Section>

              <Section title="Appearance">
                <SegmentedControl
                  label="Appearance"
                  options={APPEARANCES}
                  value={appearance}
                  onChange={(id) => {
                    setAppearance(id as Appearance);
                  }}
                />
              </Section>

              <Section title="Updates">
                <div className="flex min-h-8 items-center justify-between gap-4">
                  <p className="ds-body text-(--ds-fg)">
                    pset {settings.version}
                    <span className="text-(--ds-fg-muted)">
                      {upToDate
                        ? ' · You have the latest version'
                        : update === 'current'
                          ? ' · Up to date'
                          : ''}
                    </span>
                  </p>
                  <Button busy={checking} onPress={check}>
                    Check for updates
                  </Button>
                </div>
                {update !== 'current' && (
                  <div className="mt-3 rounded-(--ds-radius-control) border border-(--ds-border) px-4 py-3">
                    <div className="flex min-w-0 items-center justify-between gap-4">
                      <p className="ds-body min-w-0 font-medium text-(--ds-fg)">
                        pset {settings.update.latest} is available
                      </p>
                      <Button
                        variant="primary"
                        busy={update === 'updating'}
                        onPress={() => {
                          setUpdate('updating');
                        }}
                      >
                        {`Update to v${settings.update.latest ?? ''}`}
                      </Button>
                    </div>
                    <ul className="ds-small mt-2 list-disc space-y-1 pl-5 text-(--ds-fg-muted)">
                      {(settings.update.notes ?? []).map((n) => (
                        <li key={n} className="[overflow-wrap:anywhere]">
                          {n}
                        </li>
                      ))}
                    </ul>
                    {update === 'updating' && (
                      <p className="ds-small mt-3 text-(--ds-fg)">
                        Updating in place. PSet restarts when it is done.
                      </p>
                    )}
                  </div>
                )}
              </Section>

              <Section title="Usage">
                <p className="ds-body ds-tabular text-(--ds-fg)">
                  {money(settings.usage.total)}{' '}
                  <span className="text-(--ds-fg-muted)">
                    in {settings.usage.month}
                  </span>
                </p>
                <div className="mt-3">
                  <List empty="Nothing spent yet this month.">
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
                        asideWidth={280}
                      />
                    ))}
                  </List>
                </div>
                <p className="ds-small ds-tabular mt-2 text-(--ds-fg-muted)">
                  {money(settings.usage.allTime)} all time
                </p>
              </Section>

              <Section title="Health">
                {failing.length === 0 ? (
                  <Fold label="Everything is working" defaultOpen={unfolded}>
                    <List>{rows}</List>
                  </Fold>
                ) : (
                  <>
                    <p className="ds-body mb-3 text-(--ds-fg)">
                      {plural(failing.length, 'check is', 'checks are')}{' '}
                      failing.
                    </p>
                    <List>{rows}</List>
                  </>
                )}
                <div className="mt-2">
                  <Fold
                    label={`Recent errors (${String(errors.length)})`}
                    defaultOpen={unfolded}
                  >
                    <List empty="No errors kept.">
                      {errors.map((e) => (
                        <ListRow
                          key={e.id}
                          title={e.reason}
                          meta={[e.fix, e.when]}
                          status={<span className="ds-code">{e.id}</span>}
                        />
                      ))}
                    </List>
                    {errors.length > 0 && (
                      <div className="mt-3">
                        <Button
                          onPress={() => {
                            setErrors([]);
                          }}
                        >
                          Clear all
                        </Button>
                      </div>
                    )}
                  </Fold>
                </div>
              </Section>

              <Section title="Reset">
                <List>
                  <ListRow
                    title="Clear study history"
                    meta={[
                      'Removes time studied and answers; keeps your courses',
                    ]}
                    aside={
                      <div className="flex justify-end">
                        <Button
                          onPress={() => {
                            setConfirming('history');
                          }}
                        >
                          Clear history
                        </Button>
                      </div>
                    }
                    asideWidth={140}
                  />
                  <ListRow
                    title="Reset everything"
                    meta={['Removes every course, set, material and memory']}
                    aside={
                      <div className="flex justify-end">
                        <Button
                          variant="danger"
                          onPress={() => {
                            setConfirming('all');
                          }}
                        >
                          Reset
                        </Button>
                      </div>
                    }
                    asideWidth={140}
                  />
                </List>
                {confirming && (
                  <div className="mt-3">
                    <Confirm
                      message={
                        confirming === 'history'
                          ? `This deletes ${String(counts.studyHours)} h of study time and ${plural(counts.answers, 'answer', 'answers')}.`
                          : `This deletes ${plural(counts.courses, 'course', 'courses')}, ${plural(counts.sets, 'set', 'sets')}, ${plural(counts.materials, 'material', 'materials')} and ${plural(counts.memories, 'memory', 'memories')}.`
                      }
                      confirmLabel={
                        confirming === 'history'
                          ? 'Clear history'
                          : 'Reset everything'
                      }
                      onConfirm={() => {
                        setConfirming(undefined);
                      }}
                      onCancel={() => {
                        setConfirming(undefined);
                      }}
                    />
                  </div>
                )}
              </Section>

              <p className="ds-small text-(--ds-fg-muted)">
                pset {settings.version} · {settings.dataDir}
              </p>
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
  const heights = [72, 128, 40, 72, 200, 96, 120];
  return (
    <div className="@container">
      <TopBar
        homeHref={homeHref}
        settingsHref={settingsHref}
        path={[{ label: 'Home', href: homeHref }, { label: 'Settings' }]}
      />
      <div className="px-(--ds-gutter) pb-16">
        <div className="mx-auto max-w-180">
          <div className="ds-room-display">
            <div className="flex h-(--ds-display-line) items-center">
              <Bar className="h-9 w-56" />
            </div>
          </div>
          <div className="space-y-12">
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
