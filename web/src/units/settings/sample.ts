export type KeyStatus = 'none' | 'ok' | 'failed';
export type UpdateStatus = 'current' | 'available' | 'updating';

export interface Check {
  id: string;
  name: string;
  ok: boolean;
  /** What it found, one line. */
  detail: string;
  /** The button that mends it, when something can. */
  fix?: string;
}

/** One incident as Settings lists it (ideas/errors-grill.md, E4): open
 *  ones first, then those resolved in the last week. */
export interface IncidentRow {
  /** The short incident id, said when a failure is reported. */
  id: string;
  /** What went wrong, in the catalog's words. */
  what: string;
  /** How to fix it, when the catalog says. */
  fix?: string;
  open: boolean;
  /** When it last happened, as read: "Today, 9:41 pm". */
  when: string;
  /** How many times the same cause came back. */
  count: number;
  /** Try again can rerun it: a step's failure, or one that waits on a
   *  condition. */
  canTry: boolean;
}

export interface SettingsData {
  version: string;
  dataDir: string;
  name: string;
  key: { status: KeyStatus; value: string; failure?: string };
  models: readonly { job: string; model: string }[];
  update: {
    status: UpdateStatus;
    latest?: string;
    notes?: readonly string[];
  };
  usage: {
    month: string;
    total: number;
    courses: readonly { name: string; cost: number }[];
    allTime: number;
  };
  /** The health checks; undefined while PSet is still running them, which
   *  takes a second or so (the slowest read in Settings). */
  checks?: readonly Check[];
  incidents: readonly IncidentRow[];
  /** What a clear or a reset would take, for the confirms; absent while
   *  PSet can't count it truly, and the confirm then names no numbers. */
  counts?: {
    courses: number;
    sets: number;
    materials: number;
    memories: number;
    studyHours: number;
    answers: number;
  };
}

/** Every check working. */
const CHECKS: readonly Check[] = [
  {
    id: 'key',
    name: 'Model key',
    ok: true,
    detail: 'Lets PSet read and guide',
  },
  {
    id: 'pages',
    name: 'Page reading',
    ok: true,
    detail: 'Reads scanned pages',
  },
  {
    id: 'search',
    name: 'Search',
    ok: true,
    detail: 'Ollama searches your materials',
  },
  {
    id: 'data',
    name: 'Study data',
    ok: true,
    detail: 'Keeps your courses and study time',
  },
  {
    id: 'disk',
    name: 'Disk space',
    ok: true,
    detail: 'Room for your materials: 38 GB free',
  },
];

export const FINE: SettingsData = {
  version: '0.2.1',
  dataDir: '~/.local/share/pset',
  name: 'Jack',
  key: { status: 'ok', value: 'sk-or-v1-4f2a9c1e77b0a1d3' },
  models: [
    { job: 'Reading pages', model: 'Perceptron Mk1' },
    { job: 'Checking an answer', model: 'DeepSeek V3.2' },
    { job: 'Guiding a problem', model: 'DeepSeek V3.2' },
    { job: 'Finding a passage', model: 'Luna' },
  ],
  update: { status: 'current' },
  usage: {
    month: 'October',
    total: 6.4,
    courses: [
      { name: 'ECE 210', cost: 3.1 },
      { name: 'Circuits I', cost: 2.2 },
      { name: 'Thermodynamics', cost: 1.1 },
    ],
    allTime: 41.8,
  },
  checks: CHECKS,
  incidents: [],
  counts: {
    courses: 4,
    sets: 31,
    materials: 52,
    memories: 24,
    studyHours: 86,
    answers: 1032,
  },
};

export const NO_KEY: SettingsData = {
  ...FINE,
  key: { status: 'none', value: '' },
  checks: CHECKS.map((c) =>
    c.id === 'key'
      ? {
          ...c,
          ok: false,
          detail: 'Lets PSet read and guide',
          fix: 'Add a key',
        }
      : c,
  ),
};

export const KEY_FAILED: SettingsData = {
  ...FINE,
  key: {
    status: 'failed',
    value: 'sk-or-v1-0000',
    failure: 'OpenRouter refused this key. Check it and paste it again.',
  },
};

export const UPDATE_AVAILABLE: SettingsData = {
  ...FINE,
  update: {
    status: 'available',
    latest: '0.3.0',
    notes: [
      'A course page for each course',
      'Settings is rebuilt, with a usage total',
      'Fixes a crash on a set with no hint',
    ],
  },
};

export const UPDATING: SettingsData = {
  ...UPDATE_AVAILABLE,
  update: { ...UPDATE_AVAILABLE.update, status: 'updating' },
};

/** The checks still running: everything else is in. */
export const CHECKING: SettingsData = { ...FINE, checks: undefined };

export const CHECK_FAILING: SettingsData = {
  ...FINE,
  checks: CHECKS.map((c) =>
    c.id === 'search'
      ? {
          ...c,
          ok: false,
          detail: 'Ollama is not running, so PSet cannot search your materials',
          fix: 'Start Ollama',
        }
      : c,
  ),
};

export const ERRORS_KEPT: SettingsData = {
  ...FINE,
  incidents: [
    {
      id: 'k4m2qa',
      what: 'OpenRouter refused the model key.',
      fix: 'Paste the key again under OpenRouter key.',
      open: true,
      when: 'Today, 9:41 pm',
      count: 3,
      // A request's failure, not a step's: nothing to run again.
      canTry: false,
    },
    {
      id: 'r7d1xc',
      what: 'A page of Griffiths could not be read.',
      fix: 'Try again, or add the file again.',
      open: true,
      when: 'Yesterday, 4:12 pm',
      count: 1,
      canTry: true,
    },
    {
      id: 'n0w8ez',
      what: 'PSet could not reach the internet.',
      open: false,
      when: 'Oct 9, 7:30 pm',
      count: 2,
      canTry: false,
    },
  ],
};

const LONG =
  'Electromagnetics and the physics of electrical machines, lecture notes, week 6: magnetic circuits';

export const STRESS: SettingsData = {
  ...ERRORS_KEPT,
  name: 'Maximilian Alexander Featherstonehaugh',
  key: { status: 'failed', value: 'sk-or-v1-'.padEnd(140, 'x'), failure: LONG },
  models: Array.from({ length: 8 }, (_, i) => ({
    job: `A job with a long name, number ${String(i + 1)}`,
    model: `provider/a-model-with-a-very-long-identifier-${String(i + 1)}:free`,
  })),
  update: {
    status: 'available',
    latest: '0.3.0',
    notes: Array.from({ length: 8 }, (_, i) => `${LONG} (${String(i + 1)})`),
  },
  usage: {
    month: 'October',
    total: 1234.56,
    courses: Array.from({ length: 12 }, (_, i) => ({
      name: `${LONG} ${String(i + 1)}`,
      cost: 100 - i * 7,
    })),
    allTime: 98765.43,
  },
  checks: CHECKS.map((c, i) => ({
    ...c,
    ok: i % 2 === 0,
    detail: LONG,
    fix: i % 2 === 0 ? undefined : 'Fix it',
  })),
  incidents: Array.from({ length: 12 }, (_, i) => ({
    id: `long${String(10 + i)}`,
    what: LONG,
    fix: LONG,
    open: i < 6,
    when: 'Oct 9, 7:30 pm',
    count: 120 + i,
    canTry: i % 2 === 0,
  })),
};
