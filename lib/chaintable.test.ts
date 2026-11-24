import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { ChaintableError, leafage, rowGet, rowGetAll, rowQuery } from './chaintable';

type Reply = { status?: number; body: unknown; headers?: Record<string, string> };
const ok = (data: unknown): Reply => ({ body: { code: 0, message: 'ok', data } });
const fail = (status: number, code: number, headers?: Record<string, string>): Reply => ({ status, body: { code, message: 'x', data: null }, headers });

let fetchMock: ReturnType<typeof vi.fn>;
function replies(...items: Reply[]) {
  for (const r of items) {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(r.body), { status: r.status ?? 200, headers: r.headers }));
  }
}
const headersOf = (call: number) => new Headers((fetchMock.mock.calls[call][1] as RequestInit).headers);

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('CHAINTABLE_API_KEY', '');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('chaintable client', () => {
  it('sends API-Key when configured', async () => {
    vi.stubEnv('CHAINTABLE_API_KEY', 'k');
    replies(ok({ rows: [] }));
    await rowGet('token.token.eth', ['0x1']);
    expect(headersOf(0).get('API-Key')).toBe('k');
  });

  it('sends no credential without a key', async () => {
    replies(ok({ rows: [] }));
    await rowGet('token.token.eth', ['0x1']);
    expect(headersOf(0).has('API-Key')).toBe(false);
    expect(headersOf(0).has('Authorization')).toBe(false);
  });

  it('sets the User-Agent', async () => {
    replies(ok({ rows: [] }));
    await rowQuery('balance.pool_balance.eth', 'SELECT * FROM balance.pool_balance.eth LIMIT 1');
    expect(headersOf(0).get('User-Agent')).toMatch(/^open-portfolio\//);
  });

  it.each([40200, 40201])('retries anonymously on 403 %i', async (code) => {
    vi.stubEnv('CHAINTABLE_API_KEY', 'k');
    replies(fail(403, code), ok({ rows: [{ id: 'a' }] }));
    expect(await rowGet('token.token.eth', ['a'])).toEqual([{ id: 'a' }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(headersOf(1).has('API-Key')).toBe(false);
  });

  it('does not retry anonymously on 403 40140', async () => {
    vi.stubEnv('CHAINTABLE_API_KEY', 'k');
    replies(fail(403, 40140));
    await expect(rowGet('token.token.eth', ['a'])).rejects.toMatchObject({ status: 403, code: 40140 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a 429 up to 3 times, then gives up', async () => {
    replies(...Array.from({ length: 4 }, () => fail(429, 40080, { 'Retry-After': '0' })));
    const err = await rowGet('token.token.eth', ['a']).catch((e) => e);
    expect(err).toBeInstanceOf(ChaintableError);
    expect(err).toMatchObject({ status: 429, code: 40080 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('backs off on a 429 without Retry-After, the per-second key limit', async () => {
    replies(fail(429, 40080), fail(429, 40080), ok({ rows: [{ id: 'a' }] }));
    const started = Date.now();
    expect(await rowGet('token.token.eth', ['a'])).toEqual([{ id: 'a' }]);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(Date.now() - started).toBeGreaterThanOrEqual(400);
  });

  it('gives up at once when Retry-After is longer than 5 seconds', async () => {
    replies(fail(429, 40080, { 'Retry-After': '30' }));
    await expect(rowGet('token.token.eth', ['a'])).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('gives every request a timeout', async () => {
    replies(ok({ rows: [] }));
    await rowGet('token.token.eth', ['a']);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBeInstanceOf(AbortSignal);
  });

  it('reports a timeout while reading the body as itself', async () => {
    const timeout = new DOMException('The operation was aborted due to timeout', 'TimeoutError');
    fetchMock.mockResolvedValueOnce(new Response(new ReadableStream({ start: (controller) => controller.error(timeout) })));
    await expect(rowGet('token.token.eth', ['0x1'])).rejects.toBe(timeout);
  });

  it('treats a body that is not JSON as an error with the HTTP status', async () => {
    fetchMock.mockResolvedValueOnce(new Response('<html>', { status: 502 }));
    await expect(rowGet('token.token.eth', ['0x1'])).rejects.toMatchObject({ status: 502, code: -1 });
  });

  it('names the status and code in the error message', async () => {
    replies(fail(502, 50106));
    await expect(rowGet('token.token.eth', ['a'])).rejects.toThrow('/v1/table/row/get 502 50106');
  });

  it('reads many ids in batches of 500', async () => {
    replies(ok({ rows: [] }), ok({ rows: [] }), ok({ rows: [] }));
    await rowGetAll('token.token.eth', Array.from({ length: 1200 }, (_, i) => `0x${i}`));
    const sizes = fetchMock.mock.calls.map((c) => JSON.parse((c[1] as RequestInit).body as string).pks.length);
    expect(sizes).toEqual([500, 500, 200]);
  });

  it('paces all requests to the per-second budget', async () => {
    for (let i = 0; i < 70; i++) replies(ok({ rows: [] }));
    const started = Date.now();
    await Promise.all(Array.from({ length: 70 }, () => rowGet('token.token.eth', ['a'])));
    expect(Date.now() - started).toBeGreaterThanOrEqual(140);
  });

  it('throws ChaintableError on a non-zero code', async () => {
    replies(fail(404, 40400));
    await expect(rowGet('nope', ['a'])).rejects.toMatchObject({ status: 404, code: 40400 });
  });

  it('drops missing rows from row/get', async () => {
    replies(ok({ rows: [{ id: 'a' }, null] }));
    expect(await rowGet('token.token.eth', ['a', 'b'])).toEqual([{ id: 'a' }]);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ table_id: 'token.token.eth', pks: ['a', 'b'] });
  });

  it('returns the JSON-RPC result', async () => {
    replies(ok({ jsonrpc: '2.0', id: 1, result: '0x10' }));
    expect(await leafage<string>(1, 'eth_blockNumber', [])).toBe('0x10');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.chaintable.com/v1/leafage/1');
  });

  it('throws when JSON-RPC returns an error', async () => {
    replies(ok({ jsonrpc: '2.0', id: 1, error: { code: -32000, message: 'execution reverted' } }));
    await expect(leafage(1, 'eth_call', [])).rejects.toBeInstanceOf(ChaintableError);
  });
});
