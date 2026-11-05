import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, api, errorView } from './client';

afterEach(() => {
  vi.unstubAllGlobals();
});

const answer = (status: number, body: unknown) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() =>
      Promise.resolve({
        status,
        ok: status < 400,
        json: () =>
          body === undefined
            ? Promise.reject(new Error('not json'))
            : Promise.resolve(body),
      }),
    ),
  );

describe('api errors', () => {
  it('carries the server view as it came', async () => {
    const view = {
      id: 'book.not_found',
      what: "That book isn't on your shelf.",
      scope: 'inline',
      chain: ['book.not_found'],
    };
    answer(404, view);
    const err = await api('GET', '/api/books/x').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(404);
    expect((err as ApiError).view).toEqual(view);
    expect((err as ApiError).message).toBe("That book isn't on your shelf.");
  });

  it('turns a server that does not answer into request.unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new TypeError('x'))),
    );
    const err = (await api('GET', '/api/x').catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err.status).toBe(0);
    expect(err.view.id).toBe('request.unreachable');
    expect(err.view.scope).toBe('screen');
    expect(err.view.fix).toBeTruthy();
  });

  it('turns an answer that is not the error shape into internal.unexpected', async () => {
    answer(502, undefined);
    const err = (await api('GET', '/api/x').catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err.view.id).toBe('internal.unexpected');
    answer(500, { message: 'old shape' });
    const err2 = (await api('GET', '/api/x').catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err2.view.id).toBe('internal.unexpected');
    expect(errorView(new Error('x')).id).toBe('internal.unexpected');
  });
});
