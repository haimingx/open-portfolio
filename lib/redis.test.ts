import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { pipeline, redis, redisConfig, RedisError } from './redis';

let fetchMock: ReturnType<typeof vi.fn>;
const reply = (body: unknown, status = 200) => fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(body), { status }));

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example/');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('redis client', () => {
  it('is off without configuration and prefers the Vercel variables', () => {
    expect(redisConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(redisConfig({ UPSTASH_REDIS_REST_URL: 'https://b', UPSTASH_REDIS_REST_TOKEN: 'u' } as unknown as NodeJS.ProcessEnv)).toEqual({ url: 'https://b', token: 'u' });
    expect(redisConfig({ KV_REST_API_URL: 'https://a', KV_REST_API_TOKEN: 't', UPSTASH_REDIS_REST_URL: 'https://b', UPSTASH_REDIS_REST_TOKEN: 'u' } as unknown as NodeJS.ProcessEnv)).toEqual({ url: 'https://a', token: 't' });
  });

  it('sends commands as a JSON array with a bearer token', async () => {
    reply({ result: 'OK' });
    expect(await redis(['SET', 'k', 1])).toBe('OK');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://kv.example');
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer token');
    expect(JSON.parse(init.body)).toEqual(['SET', 'k', 1]);
  });

  it('posts batches to /pipeline', async () => {
    reply([{ result: 1 }, { result: 2 }]);
    expect(await pipeline([['GET', 'a'], ['GET', 'b']])).toEqual([1, 2]);
    expect(fetchMock.mock.calls[0][0]).toBe('https://kv.example/pipeline');
  });

  it('throws RedisError on HTTP failures and command errors', async () => {
    reply({ error: 'bad' }, 400);
    await expect(redis(['GET', 'a'])).rejects.toBeInstanceOf(RedisError);
    reply([{ result: 1 }, { error: 'WRONGTYPE' }]);
    await expect(pipeline([['GET', 'a'], ['GET', 'b']])).rejects.toBeInstanceOf(RedisError);
  });

  it('throws RedisError when it is not configured', async () => {
    vi.unstubAllEnvs();
    await expect(redis(['GET', 'a'])).rejects.toBeInstanceOf(RedisError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
