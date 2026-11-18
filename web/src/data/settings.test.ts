import { describe, expect, it } from 'vitest';

import { ApiError, viewOf } from '@/api/client';
import type { Course } from '@/api/gen/course';
import type { Incident, Trace } from '@/api/gen/incident';

import {
  incidentRows,
  keyAnswer,
  settingsData,
  traceLines,
  whenOf,
  type SettingsReads,
} from './settings';

const incident = (p: Partial<Incident>): Incident => ({
  id: 'abc123',
  seq: 1,
  error: { id: 'x', what: 'It broke.', scope: 'inline', chain: ['x'] },
  kind: 'ours',
  born: 'request',
  state: 'open',
  count: 1,
  firstAt: '2026-11-18T10:00:00Z',
  lastAt: '2026-11-18T10:00:00Z',
  ...p,
});

describe('incident rows', () => {
  it('lists open first, newest first in each', () => {
    const rows = incidentRows([
      incident({ id: 'old-open', lastAt: '2026-11-17T10:00:00Z' }),
      incident({
        id: 'resolved',
        state: 'healed',
        lastAt: '2026-11-18T12:00:00Z',
      }),
      incident({ id: 'new-open', lastAt: '2026-11-18T11:00:00Z' }),
    ]);
    expect(rows.map((r) => r.id)).toEqual(['new-open', 'old-open', 'resolved']);
    expect(rows.map((r) => r.open)).toEqual([true, true, false]);
  });

  it('offers Try again only for a step’s failure', () => {
    const [step, waiting] = incidentRows([
      incident({ id: 's', stepId: 'st1', lastAt: '2026-11-18T11:00:00Z' }),
      // A refused key from a request: waiting on the student, nothing to run.
      incident({ id: 'w', kind: 'waiting_on_you' }),
    ]);
    expect(step.canTry).toBe(true);
    expect(waiting.canTry).toBe(false);
  });
});

describe('a key’s answer', () => {
  it('says why a key was refused, and how to fix it', async () => {
    const refused = new ApiError(400, {
      id: 'key.refused',
      what: 'Couldn’t connect with that key.',
      why: 'OpenRouter refused this key.',
      fix: 'Check it and paste it again.',
      scope: 'inline',
      chain: ['key.refused'],
    });
    await expect(keyAnswer(() => Promise.reject(refused))).resolves.toEqual({
      ok: false,
      failure: 'OpenRouter refused this key. Check it and paste it again.',
    });
    await expect(keyAnswer(() => Promise.resolve())).resolves.toEqual({
      ok: true,
    });
  });

  it('leaves a server that failed, or wasn’t there, to the page', async () => {
    const down = new ApiError(0, viewOf('request.unreachable'));
    const broke = new ApiError(500, viewOf('internal.unexpected'));
    await expect(keyAnswer(() => Promise.reject(down))).rejects.toBe(down);
    await expect(keyAnswer(() => Promise.reject(broke))).rejects.toBe(broke);
  });
});

describe('a trace', () => {
  it('reads as its step, its calls, what changed and the detail', () => {
    const t: Trace = {
      incident: incident({ detail: 'open key: 401' }),
      step: {
        id: 'st1',
        seq: 4,
        subjectKind: 'material',
        subjectId: 'm1',
        name: 'read_pages',
        state: 'failed',
        attempts: 3,
      },
      calls: [
        {
          at: '2026-11-18T10:00:00Z',
          attempt: 3,
          model: 'deepseek/v3.2',
          ms: 4100,
          errorId: 'key.refused',
        },
      ],
      changes: [],
    };
    expect(traceLines(t)).toEqual([
      'Step: read pages, failed, try 3',
      'deepseek/v3.2: 4.1 s, key.refused',
      'open key: 401',
    ]);
  });

  it('says so when nothing more was kept', () => {
    expect(
      traceLines({ incident: incident({}), calls: [], changes: [] }),
    ).toEqual(['Nothing more was kept.']);
  });
});

describe('when', () => {
  const now = new Date('2026-11-18T21:00:00');
  it('says today, yesterday, or the date', () => {
    expect(whenOf('2026-11-18T09:41:00', now)).toBe('Today, 9:41 am');
    expect(whenOf('2026-11-17T16:12:00', now)).toBe('Yesterday, 4:12 pm');
    expect(whenOf('2026-10-09T19:30:00', now)).toBe('Oct 9, 7:30 pm');
  });
});

describe('the page’s data', () => {
  const course = (id: string, name: string): Course => ({
    id,
    seq: 1,
    name,
    createdAt: '2026-11-01T00:00:00Z',
  });
  const reads = (courses: Course[]): SettingsReads => ({
    settings: {
      profile: { name: 'Jack' },
      apiKey: '',
      models: [],
      ready: { key: false },
    },
    about: { version: '0.3.0', dataDir: '/data' },
    update: { version: '0.3.0', canUpdate: true, busy: 0 },
    week: { homework: 0, reading: 0, asking: 0, total: 0, byCourse: [] },
    counts: { books: 0, pages: 0 },
    spend: courses.map((c, i) => ({
      course: c,
      spend: {
        models: [],
        total: {
          model: '',
          calls: 1,
          failed: 0,
          uncounted: 0,
          tokens: 1,
          cost: i + 1,
          ms: 1,
        },
      },
    })),
  });

  it('names spend by the store’s courses, so a rename shows', () => {
    const d = settingsData(
      reads([course('c1', 'Old name'), course('c2', 'Circuits')]),
      [course('c1', 'New name'), course('c2', 'Circuits')],
      undefined,
      [],
    );
    expect(d.usage.courses).toEqual([
      { name: 'Circuits', cost: 2 },
      { name: 'New name', cost: 1 },
    ]);
    expect(d.usage.allTime).toBe(3);
  });

  it('leaves out counts it can’t give truly', () => {
    expect(settingsData(reads([]), [], undefined, []).counts).toBeUndefined();
  });
});
