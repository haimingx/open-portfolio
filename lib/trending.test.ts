import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('./reference', () => ({
  getChains: vi.fn(async () => ['eth', 'base'].map((id) => ({ id, name: id.toUpperCase(), logo_url: `image/logo/${id}.png` })))
}));

import { dayKey, getTrending, getWalletHeat, heatLevel, recordView, summarize, visitorId } from './trending';
import type { Portfolio } from './types';

type Command = (string | number)[];
let commands: Command[];
let store: { scores: string[]; metas: Record<string, string[]>; zscore: Record<string, string | null> };
let failing: boolean;

function run(command: Command): unknown {
  const [name, key] = command;
  if (name === 'ZREMRANGEBYRANK') return 0;
  if (name === 'ZRANGE') return store.scores;
  if (name === 'HGETALL') return store.metas[String(key).replace('op:meta:', '')] ?? [];
  if (name === 'ZSCORE') return store.zscore[String(command[2])] ?? null;
  return 1;
}

beforeEach(() => {
  commands = [];
  failing = false;
  store = { scores: [], metas: {}, zscore: {} };
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubEnv('TRENDING_EXCLUDE', '');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (failing) return new Response('{}', { status: 500 });
    const body = JSON.parse(init.body as string);
    if (url.endsWith('/pipeline')) {
      commands.push(...body);
      return new Response(JSON.stringify(body.map((c: Command) => ({ result: run(c) }))));
    }
    commands.push(body);
    return new Response(JSON.stringify({ result: run(body) }));
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const meta = (total: number, top: string) => ['total', String(total), 'chains', '3', 'top', top, 'at', '1000'];
const A = `0x${'a'.repeat(40)}`;
const B = `0x${'b'.repeat(40)}`;

describe('counting helpers', () => {
  it('uses UTC days', () => {
    expect(dayKey(new Date('2026-11-07T23:59:59Z'))).toBe('2026-11-07');
  });

  it('hashes visitors with the daily salt', async () => {
    expect(await visitorId('s', '1.2.3.4', 'ua')).toMatch(/^[0-9a-f]{16}$/);
    expect(await visitorId('s', '1.2.3.4', 'ua')).not.toBe(await visitorId('t', '1.2.3.4', 'ua'));
  });

  it('summarizes the top 3 chains by value', () => {
    const portfolio = {
      total: 100, generatedAt: 5, name: 'vitalik.eth',
      chains: [{ id: 'op', value: 1 }, { id: 'eth', value: 60 }, { id: 'arb', value: 9 }, { id: 'base', value: 30 }]
    } as Portfolio;
    expect(summarize(portfolio)).toEqual({ total: 100, chains: 4, top: ['eth', 'base', 'arb'], at: 5, name: 'vitalik.eth' });
  });

  it('converts scores to 1–5 heat relative to the leader', () => {
    expect([412, 287, 164, 9].map((n) => heatLevel(n, 412))).toEqual([5, 5, 4, 1]);
    expect(heatLevel(500, 412)).toBe(5);
  });
});

describe('recordView', () => {
  it('refreshes the summary on every view, counting only the first view of the day', async () => {
    await recordView(A, 'visitor', { total: 10, chains: 2, top: ['eth', 'base'], at: 7, name: null });
    const lua = String(commands[0][1]);
    const branch = lua.slice(lua.indexOf('then'), lua.indexOf('end'));
    expect(branch).toContain('ZINCRBY');
    expect(branch).not.toContain('HSET');
    expect(lua.indexOf('HSET')).toBeGreaterThan(lua.indexOf('end'));
  });

  it('sends one script that counts only after SET NX succeeds', async () => {
    await recordView(A, 'visitor', { total: 10, chains: 2, top: ['eth', 'base'], at: 7, name: null });
    expect(commands).toHaveLength(1);
    const [name, script, keyCount, ...rest] = commands[0];
    expect(name).toBe('EVAL');
    expect(keyCount).toBe(3);
    const day = dayKey(new Date());
    expect(rest.slice(0, 3)).toEqual([`op:seen:${day}:visitor:${A}`, 'op:hot:all', `op:meta:${A}`]);
    expect(rest.slice(3)).toEqual([A, 10, 2, 'eth,base', 7, '']);
    const lua = String(script);
    expect(lua).toContain("'name', ARGV[6]");
    expect(lua.indexOf("'NX'")).toBeLessThan(lua.indexOf('ZINCRBY'));
    expect(lua.match(/ZINCRBY/g)).toHaveLength(1);
    expect(lua.trim().startsWith('if ')).toBe(true);
  });
});

describe('getTrending', () => {
  it('trims op:hot:all, reads the top 50 and skips addresses without meta', async () => {
    store.scores = [A, '9', B, '7'];
    store.metas[A] = meta(100, 'eth,base');
    expect(await getTrending()).toMatchObject([{ address: A, score: 9, total: 100, chains: 3, top: ['eth', 'base'], at: 1000 }]);
    expect(commands[0]).toEqual(['ZREMRANGEBYRANK', 'op:hot:all', 0, -10001]);
    expect(commands[1]).toEqual(['ZRANGE', 'op:hot:all', 0, 49, 'REV', 'WITHSCORES']);
  });

  it('reads the primary name, and none from summaries written before names', async () => {
    store.scores = [A, '9', B, '7'];
    store.metas[A] = [...meta(100, 'eth'), 'name', 'vitalik.eth'];
    store.metas[B] = meta(50, 'eth');
    expect((await getTrending()).map((item) => item.name)).toEqual(['vitalik.eth', null]);
  });

  it('resolves chain names and logos for the ranking', async () => {
    store.scores = [A, '9'];
    store.metas[A] = meta(100, 'eth');
    const [item] = await getTrending();
    expect(item.topChains).toEqual([{ id: 'eth', name: 'ETH', logoUrl: 'https://static.chaintable.com/image/logo/eth.png' }]);
  });

  it('keeps up to ten wallets with at least two visitors', async () => {
    const ids = Array.from({ length: 30 }, (_, i) => `0x${String(i).padStart(40, '0')}`);
    store.scores = ids.flatMap((id, i) => [id, String(i < 20 ? 100 - i : 1)]);
    for (const id of ids) store.metas[id] = meta(1, 'eth');
    expect((await getTrending()).map((t) => t.address)).toEqual(ids.slice(0, 10));
    store.scores = [A, '9', B, '1'];
    store.metas[A] = meta(100, 'eth');
    store.metas[B] = meta(50, 'eth');
    expect((await getTrending()).map((t) => t.address)).toEqual([A]);
  });

  it('honors TRENDING_EXCLUDE case-insensitively', async () => {
    vi.stubEnv('TRENDING_EXCLUDE', ` ${A.toUpperCase().replace('0X', '0x')} `);
    store.scores = [A, '9', B, '7'];
    store.metas[A] = meta(100, 'eth');
    store.metas[B] = meta(50, 'eth');
    expect((await getTrending()).map((t) => t.address)).toEqual([B]);
  });

  it('returns an empty list when Redis is not configured or fails', async () => {
    failing = true;
    expect(await getTrending()).toEqual([]);
    vi.stubEnv('KV_REST_API_URL', '');
    expect(await getTrending()).toEqual([]);
  });
});

describe('getWalletHeat', () => {
  beforeEach(() => {
    store.scores = [A, '100', B, '25'];
    store.metas[A] = meta(100, 'eth');
  });

  it('reads the score from the cached top 50, relative to the leader', async () => {
    expect(await getWalletHeat(B)).toBe(3);
    expect(commands.some((c) => c[0] === 'ZSCORE')).toBe(false);
  });

  it('is null outside the top 50, below the threshold, for excluded addresses or when Redis fails', async () => {
    expect(await getWalletHeat(`0x${'c'.repeat(40)}`)).toBeNull();
    store.scores = [A, '100', B, '1'];
    expect(await getWalletHeat(B)).toBeNull();
    store.scores = [A, '100', B, '25'];
    vi.stubEnv('TRENDING_EXCLUDE', B);
    expect(await getWalletHeat(B)).toBeNull();
    vi.stubEnv('TRENDING_EXCLUDE', '');
    failing = true;
    expect(await getWalletHeat(B)).toBeNull();
  });
});
