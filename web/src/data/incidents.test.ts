import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, viewOf } from '@/api/client';

import {
  catchFailures,
  dismiss,
  REPORT_EVERY_MS,
  REPORTS_MAX,
  reportFailure,
  resetReportsForTest,
  tryAgain,
} from './incidents';

const fetchMock = vi.fn<typeof fetch>();

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const sent = (i: number) => {
  const call = fetchMock.mock.calls[i];
  const u = call[0];
  const b = call[1]?.body;
  return {
    url: typeof u === 'string' ? u : '',
    body:
      typeof b === 'string' ? (JSON.parse(b) as Record<string, unknown>) : {},
  };
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation(() =>
    Promise.resolve(reply(201, { id: 'abc123' })),
  );
  vi.stubGlobal('fetch', fetchMock);
  resetReportsForTest();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('page incidents', () => {
  it('reports a crash with its stack, route and subject', async () => {
    const got = await reportFailure(new Error('boom'), {
      subjectKind: 'material',
      subjectId: 'm1',
    });
    expect(got?.id).toBe('abc123');
    const { url, body } = sent(0);
    expect(url).toBe('/api/incidents');
    expect(body.chain).toEqual(['internal.unexpected']);
    expect(body.detail).toContain('boom');
    expect(body.route).toBe(window.location.pathname);
    expect(body.subjectId).toBe('m1');
  });

  it('leaves a request’s own failure to the server', async () => {
    await reportFailure(new ApiError(500, viewOf('internal.unexpected')));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the same failure once a minute, and caps a page load', async () => {
    let t = 0;
    const now = () => t;
    await reportFailure(new Error('same'), {}, now);
    await reportFailure(new Error('same'), {}, now);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    t = REPORT_EVERY_MS;
    await reportFailure(new Error('same'), {}, now);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (let i = 0; i < REPORTS_MAX + 5; i++) {
      await reportFailure(new Error(`other ${String(i)}`), {}, now);
    }
    expect(fetchMock).toHaveBeenCalledTimes(REPORTS_MAX);
  });

  it('drops a report the server can’t take', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(reportFailure(new Error('x'))).resolves.toBeUndefined();
  });

  it('catches what nothing else caught, until undone', async () => {
    // Handled here, so the test runner doesn't count these as its own.
    const quiet = (ev: Event) => {
      ev.preventDefault();
    };
    window.addEventListener('error', quiet);
    const undo = catchFailures();
    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('uncaught'), message: 'x' }),
    );
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    undo();
    window.dispatchEvent(
      new ErrorEvent('error', { error: new Error('later'), message: 'y' }),
    );
    await Promise.resolve();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    window.removeEventListener('error', quiet);
  });

  it('tries again and dismisses through the action route', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(reply(200, { seq: 1 })));
    await tryAgain('abc123');
    await dismiss('abc123');
    expect(sent(0)).toEqual({
      url: '/api/actions/incident.try_again',
      body: { id: 'abc123' },
    });
    expect(sent(1).url).toBe('/api/actions/incident.dismiss');
  });
});
