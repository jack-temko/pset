import { afterEach, describe, expect, it } from 'vitest';

import { ApiError, viewOf } from './client';
import { makeQueryClient } from './query';
import { screenError } from './screen-error';

afterEach(() => {
  screenError.clear();
});

describe('the query client and the screen error', () => {
  it('raises it when the server does not answer, and clears it on any answer', async () => {
    const qc = makeQueryClient();
    await qc
      .query({
        queryKey: ['a'],
        queryFn: () =>
          Promise.reject(new ApiError(0, viewOf('request.unreachable'))),
        retry: false,
      })
      .catch(() => {});
    expect(screenError.current()?.id).toBe('request.unreachable');
    await qc.query({ queryKey: ['b'], queryFn: () => 'ok' });
    expect(screenError.current()).toBeNull();
  });

  it('leaves an error that belongs to one thing to that thing', async () => {
    const qc = makeQueryClient();
    await qc
      .query({
        queryKey: ['c'],
        queryFn: () =>
          Promise.reject(new ApiError(500, viewOf('internal.unexpected'))),
        retry: false,
      })
      .catch(() => {});
    expect(screenError.current()).toBeNull();
  });
});
