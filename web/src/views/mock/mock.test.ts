import { QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { api, ApiError, assets } from '@/api/client';
import { emit, on } from '@/api/events';
import { assetUrl } from './assets';
import { installMock } from './install';
import { MockError, MockServer, match } from './server';

let restore: (() => void) | undefined;
afterEach(() => restore?.());

const realFetch = () =>
  vi.fn(() => Promise.resolve(new Response('real server', { status: 200 })));

function mount(server: MockServer) {
  const real = realFetch();
  window.fetch = real;
  restore = installMock(server, assetUrl);
  return real;
}

describe('match', () => {
  it('reads params out of a pattern', () => {
    expect(match('/api/homework/:id', '/api/homework/h%201')).toEqual({
      id: 'h 1',
    });
  });
  it('needs the same shape', () => {
    expect(match('/api/homework/:id', '/api/homework')).toBeNull();
    expect(match('/api/homework/:id', '/api/books/x')).toBeNull();
  });
});

describe('the mock server', () => {
  it('answers a route, and 404s a path nothing answers, without ever reaching the real fetch', async () => {
    const real = mount(
      new MockServer([['GET', '/api/ping', () => ({ ok: true })]]),
    );
    expect(await api('GET', '/api/ping')).toEqual({ ok: true });
    const err = (await api('GET', '/api/books').catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(404);
    expect(err.view.id).toBe('request.not_found');
    expect(real).not.toHaveBeenCalled();
  });

  it('lets what is not the API through to the real fetch', async () => {
    const real = mount(new MockServer([]));
    await fetch('/src/main.tsx');
    expect(real).toHaveBeenCalledTimes(1);
  });

  it('fails as the server does, with its catalog words and field', async () => {
    mount(
      new MockServer([
        [
          'POST',
          '/api/things',
          () => {
            throw new MockError(422, 'homework.title_empty', 'title');
          },
        ],
      ]),
    );
    const err = (await api('POST', '/api/things', {}).catch(
      (e: unknown) => e,
    )) as ApiError;
    expect(err).toMatchObject({
      status: 422,
      message: 'Give it a title.',
      field: 'title',
    });
  });

  it('lets a mutation change what the next read sees', async () => {
    let title = 'Set 1';
    mount(
      new MockServer([
        [
          'GET',
          '/api/homework/:id',
          ({ params }) => ({ id: params.id, title }),
        ],
        [
          'PATCH',
          '/api/homework/:id',
          ({ body }) => void (title = (body as { title: string }).title),
        ],
      ]),
    );
    expect(
      await api('PATCH', '/api/homework/a', { title: 'Set 2' }),
    ).toBeUndefined();
    expect(await api('GET', '/api/homework/a')).toEqual({
      id: 'a',
      title: 'Set 2',
    });
  });

  it('reports each call it answered', async () => {
    const seen: string[] = [];
    mount(
      new MockServer([['GET', '/api/ping', () => ({})]], {
        onTraffic: (t) => seen.push(`${t.method} ${t.path} ${t.status}`),
      }),
    );
    await api('GET', '/api/ping');
    await api('GET', '/api/nope').catch(() => {});
    expect(seen).toEqual(['GET /api/ping 200', 'GET /api/nope 404']);
  });

  it('puts the real fetch and asset URLs back when the view goes', () => {
    const before = window.fetch;
    const url = assets.url;
    const uninstall = installMock(new MockServer([]), assetUrl);
    expect(window.fetch).not.toBe(before);
    expect(assets.url).not.toBe(url);
    uninstall();
    expect(window.fetch).toBe(before);
    expect(assets.url).toBe(url);
  });
});

describe('emit', () => {
  it('runs a registered handler against the cache it is given', () => {
    const qc = new QueryClient();
    const seen: unknown[] = [];
    on<{ n: number }>('mock.test', (d, client) => {
      seen.push([d.n, client === qc]);
    });
    emit('mock.test', { n: 3 }, qc);
    expect(seen).toEqual([[3, true]]);
  });
});

describe('assetUrl', () => {
  it('maps figures and page scans to samples, and anything else to nothing', () => {
    expect(assetUrl('/api/questions/q1/figures/0')).toMatch(
      /^data:image\/svg\+xml/,
    );
    expect(assetUrl('/api/books/b/pages/12/image?w=900')).toMatch(
      /^data:image\/svg\+xml/,
    );
    expect(assetUrl('/api/unknown')).toBe('data:,');
  });
});
