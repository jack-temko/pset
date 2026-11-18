import { api, ApiError, get, post, put } from '@/api/client';
import { ACTIONS, type ActionId } from '@/api/gen/actions';
import type { Course } from '@/api/gen/course';
import type { Health } from '@/api/gen/health';
import type { Incident, Trace } from '@/api/gen/incident';
import type {
  About,
  ResetCounts,
  Settings,
  TestResult,
} from '@/api/gen/settings';
import type { Spend } from '@/api/gen/spend';
import type { Week } from '@/api/gen/study';
import type { Status } from '@/api/gen/update';
import { applyTheme, getTheme } from '@/lib/theme';
import type {
  KeyAnswer,
  SettingsActions,
  UpdateFound,
} from '@/units/settings/actions';
import type {
  Appearance,
  Check,
  IncidentRow,
  SettingsData,
} from '@/units/settings/sample';

import { runAction } from './actions';
import { dismiss, tryAgain } from './incidents';

/**
 * Settings against the server: what the page shows, read from the routes
 * that hold it, and what it does. The settings, the key and the update keep
 * the shapes they had; health, incidents, study time and spend are the new
 * store's.
 */

/** The reads Settings makes as it opens, besides the store's lists. */
export interface SettingsReads {
  settings: Settings;
  about: About;
  update: Status;
  week: Week;
  counts: ResetCounts;
  /** Each course's spend, all time (gap 7: no total or month yet). */
  spend: { course: Course; spend: Spend }[];
}

export async function readSettings(
  courses: readonly Course[],
): Promise<SettingsReads> {
  const [settings, about, update, week, counts, spend] = await Promise.all([
    get<Settings>('/api/settings'),
    get<About>('/api/about'),
    get<Status>('/api/update'),
    get<Week>(`/api/time?since=${encodeURIComponent(weekStart())}`),
    get<ResetCounts>('/api/reset'),
    Promise.all(
      courses.map(async (course) => ({
        course,
        spend: await get<Spend>(`/api/courses/${course.id}/spend`),
      })),
    ),
  ]);
  return { settings, about, update, week, counts, spend };
}

/** The checks PSet can run, each with its fix worded as its action. The
 *  key's own condition lives beside the key, not in Health. */
export async function readChecks(): Promise<Check[]> {
  const h = await get<Health>('/api/health');
  return h.checks
    .filter((c) => c.detail !== undefined)
    .map((c) => ({
      id: c.condition.id,
      name: c.name,
      ok: c.condition.holds,
      detail: c.condition.holds
        ? (c.detail ?? '')
        : (c.condition.error?.what ?? c.detail ?? ''),
      fix:
        c.condition.holds || c.condition.fix === undefined
          ? undefined
          : nameOf(c.condition.fix),
    }));
}

const nameOf = (id: string): string =>
  id in ACTIONS ? ACTIONS[id as ActionId].name : 'Fix';

/** The start of this week (Monday, local midnight), as the server sums
 *  study time from. */
function weekStart(now = new Date()): string {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString();
}

/** "Today, 9:41 pm", "Yesterday, 4:12 pm", "Oct 9, 7:30 pm". */
export function whenOf(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const time = d
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();
  const day = (x: Date) => new Date(x).setHours(0, 0, 0, 0);
  const days = Math.round((day(now) - day(d)) / 86_400_000);
  if (days === 0) return `Today, ${time}`;
  if (days === 1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
  return `${date}, ${time}`;
}

/** Settings' rows: open first, then resolved, newest first in each. */
export function incidentRows(all: readonly Incident[]): IncidentRow[] {
  return [...all]
    .sort(
      (a, b) =>
        Number(b.state === 'open') - Number(a.state === 'open') ||
        b.lastAt.localeCompare(a.lastAt),
    )
    .map((i) => ({
      id: i.id,
      what: i.error.what,
      fix: i.error.fix,
      open: i.state === 'open',
      when: whenOf(i.lastAt),
      count: i.count,
      // A step's failure reruns; one waiting on a condition heals it.
      canTry: i.stepId !== undefined || i.kind === 'waiting_on_you',
    }));
}

const APPEARANCE_OF = { light: 'paper', dark: 'night', system: 'system' };

/** Everything the page shows. `checks` is apart: it comes later. */
export function settingsData(
  r: SettingsReads,
  courses: readonly Course[],
  checks: Check[] | undefined,
  incidents: readonly Incident[],
): SettingsData {
  const byCourse = r.spend
    .map((s) => ({ name: s.course.name, cost: s.spend.total.cost }))
    .filter((c) => c.cost > 0)
    .sort((a, b) => b.cost - a.cost);
  const allTime = byCourse.reduce((n, c) => n + c.cost, 0);
  const checked = r.update.checked;
  return {
    version: r.about.version,
    dataDir: r.about.dataDir,
    name: r.settings.profile.name,
    key: {
      status: r.settings.ready.key ? 'ok' : 'none',
      value: r.settings.apiKey,
    },
    models: r.settings.models,
    appearance: APPEARANCE_OF[getTheme()] as Appearance,
    update:
      checked?.newer === true
        ? {
            status: 'available',
            latest: checked.version,
            notes: notesOf(checked.notes),
          }
        : { status: 'current' },
    // Gap 7: no spend over a range yet, so the month shows all time too.
    usage: {
      month: new Date().toLocaleDateString('en-US', { month: 'long' }),
      total: allTime,
      courses: byCourse,
      allTime,
    },
    checks,
    incidents: incidentRows(incidents),
    // Gaps 8 and 9: no all-time study total, and reset counts the old
    // library; courses are the store's.
    counts: {
      courses: courses.length,
      sets: 0,
      materials: r.counts.books,
      memories: 0,
      studyHours: Math.round(r.week.total / 60),
      answers: 0,
    },
  };
}

/** A release's notes, one line each, without list marks. */
const notesOf = (notes: string): string[] =>
  notes
    .split('\n')
    .map((l) => l.replace(/^\s*[-*]\s*/, '').trim())
    .filter((l) => l !== '');

const keyAnswer = async (send: () => Promise<unknown>): Promise<KeyAnswer> => {
  try {
    await send();
    return { ok: true };
  } catch (e) {
    // A refused key is the answer, not a failure of the page.
    if (e instanceof ApiError && e.status < 500) {
      return { ok: false, failure: e.view.what };
    }
    throw e;
  }
};

/** How long the page waits for PSet to come back after an update. */
const POLL_MS = 1500;
const GIVE_UP_MS = 90_000;

/** Asks until PSet answers as `version`, then reloads onto the new app. */
async function comesBack(version: string): Promise<void> {
  const began = Date.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, POLL_MS));
    try {
      const s = await get<Status>('/api/update');
      if (s.version === version) {
        window.location.reload();
        return;
      }
    } catch {
      // Down while it restarts: expected.
    }
    if (Date.now() - began > GIVE_UP_MS) {
      throw new Error(
        `PSet did not come back as ${version}. Start it again by hand.`,
      );
    }
  }
}

/** The page's actions against the server. `changed` reads what an action
 *  changed that the store doesn't follow (settings, health). */
export function serverActions(changed: {
  settings: () => void;
  checks: () => void;
}): SettingsActions {
  return {
    saveName: async (name) => {
      await put('/api/settings/profile', { name });
      changed.settings();
    },
    testKey: (key) =>
      keyAnswer(() => post<TestResult>('/api/settings/test', { apiKey: key })),
    saveKey: async (key) => {
      const a = await keyAnswer(() => put('/api/settings', { apiKey: key }));
      if (a.ok) {
        changed.settings();
        changed.checks();
      }
      return a;
    },
    setAppearance: (a) => {
      applyTheme(a === 'paper' ? 'light' : a === 'night' ? 'dark' : 'system');
    },
    checkUpdate: async (): Promise<UpdateFound> => {
      const s = await post<Status>('/api/update/check');
      const c = s.checked;
      return c?.newer === true
        ? { status: 'available', latest: c.version, notes: notesOf(c.notes) }
        : { status: 'current' };
    },
    applyUpdate: async () => {
      const a = await post<{ version: string }>('/api/update/apply');
      await comesBack(a.version);
    },
    fix: async (id) => {
      const fix = (await get<Health>('/api/health')).checks.find(
        (c) => c.condition.id === id,
      )?.condition.fix;
      // The fixes PSet makes take no input.
      if (fix !== undefined && fix in ACTIONS) {
        await api('POST', `/api/actions/${fix}`, {});
      }
      changed.checks();
    },
    tryAgain: async (id) => {
      await tryAgain(id);
    },
    dismiss: async (id) => {
      await dismiss(id);
    },
    trace: async (id) => traceLines(await get<Trace>(`/api/incidents/${id}`)),
    clearHistory: async () => {
      await runAction('time.clear', {});
    },
    reset: async () => {
      await post('/api/reset');
      window.location.assign('/');
    },
  };
}

/** An incident's trace, as lines a student (or Jack) can read. */
export function traceLines(t: Trace): string[] {
  const lines: string[] = [];
  if (t.step !== undefined) {
    lines.push(
      `Step: ${t.step.name.replace('_', ' ')}, ${t.step.state}, try ${String(t.step.attempts)}`,
    );
  }
  for (const c of t.calls) {
    const what = c.errorId ?? 'answered';
    lines.push(
      `${c.answered ?? c.model}: ${(c.ms / 1000).toFixed(1)} s, ${what}${c.cost === undefined ? '' : `, $${c.cost.toFixed(4)}`}`,
    );
  }
  if (t.changes.length > 0) {
    lines.push(
      `${String(t.changes.length)} changes to it around then, the last ${t.changes.at(-1)?.op ?? ''}`,
    );
  }
  if (t.incident.detail !== undefined && t.incident.detail !== '') {
    lines.push(t.incident.detail);
  }
  return lines.length > 0 ? lines : ['Nothing more was kept.'];
}
