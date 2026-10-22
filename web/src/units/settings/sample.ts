export type KeyStatus = 'none' | 'ok' | 'failed';
export type Appearance = 'paper' | 'night' | 'system';
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

export interface KeptError {
  /** The catalog id, such as E-KEY-401. */
  id: string;
  reason: string;
  fix: string;
  when: string;
}

export interface SettingsData {
  version: string;
  dataDir: string;
  name: string;
  key: { status: KeyStatus; value: string; failure?: string };
  models: readonly { job: string; model: string }[];
  appearance: Appearance;
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
  checks: readonly Check[];
  errors: readonly KeptError[];
  /** What a reset would take, for the confirms. */
  counts: {
    courses: number;
    sets: number;
    materials: number;
    memories: number;
    studyHours: number;
    answers: number;
  };
}

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
  appearance: 'night',
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
  checks: [
    { id: 'key', name: 'Model key', ok: true, detail: 'Accepted a moment ago' },
    { id: 'pages', name: 'Page reading', ok: true, detail: 'Working' },
    {
      id: 'search',
      name: 'Search',
      ok: true,
      detail: 'Ollama searches your materials',
    },
    { id: 'data', name: 'Study data', ok: true, detail: 'Saved and readable' },
    { id: 'disk', name: 'Disk space', ok: true, detail: '38 GB free' },
  ],
  errors: [],
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
  checks: FINE.checks.map((c) =>
    c.id === 'key'
      ? { ...c, ok: false, detail: 'No key yet', fix: 'Add a key' }
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

export const CHECK_FAILING: SettingsData = {
  ...FINE,
  checks: FINE.checks.map((c) =>
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
  errors: [
    {
      id: 'E-KEY-401',
      reason: 'The model key was refused',
      fix: 'Paste the key again under Model key',
      when: 'Today, 9:41 pm',
    },
    {
      id: 'E-READ-210',
      reason: 'A page of Griffiths could not be read',
      fix: 'Add the file again',
      when: 'Yesterday, 4:12 pm',
    },
    {
      id: 'E-NET-003',
      reason: 'PSet could not reach the internet',
      fix: 'Check the connection, then try again',
      when: 'Oct 9, 7:30 pm',
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
  checks: FINE.checks.map((c, i) => ({
    ...c,
    ok: i % 2 === 0,
    detail: LONG,
    fix: i % 2 === 0 ? undefined : 'Fix it',
  })),
  errors: Array.from({ length: 12 }, (_, i) => ({
    id: `E-LONG-${String(100 + i)}`,
    reason: LONG,
    fix: LONG,
    when: 'Oct 9, 7:30 pm',
  })),
};
