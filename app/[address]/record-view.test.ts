import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock('@/lib/chaintable', () => ({ rowGet: vi.fn(async () => []) }));
const getPortfolio = vi.hoisted(() => vi.fn());
const requestHeaders = vi.hoisted(() => ({ value: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => requestHeaders.value }));
vi.mock('@/lib/fetch-portfolio', () => ({ getPortfolio }));

import { recordWalletView } from './record-view';

const ADDRESS = `0x${'a'.repeat(40)}`;
const portfolio = { total: 100, generatedAt: 1, chains: [{ id: 'eth', value: 100 }], failedChains: [] };
const report = (address: string, ip = '1.2.3.4, 10.0.0.1') => {
  requestHeaders.value = new Headers({ 'x-forwarded-for': ip, 'user-agent': 'ua' });
  return recordWalletView(address);
};

let bodies: unknown[];
let failing: boolean;

beforeEach(() => {
  bodies = [];
  failing = false;
  getPortfolio.mockReset().mockResolvedValue(portfolio);
  vi.stubEnv('KV_REST_API_URL', 'https://kv.example');
  vi.stubEnv('KV_REST_API_TOKEN', 'token');
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit) => {
    if (failing) return new Response('{}', { status: 500 });
    const body = JSON.parse(init.body as string);
    bodies.push(body);
    if (url.endsWith('/pipeline')) return new Response(JSON.stringify([{ result: 'OK' }, { result: 'salt' }]));
    return new Response(JSON.stringify({ result: 1 }));
  }));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

const evals = () => bodies.filter((b) => Array.isArray(b) && b[0] === 'EVAL') as unknown[][];

describe('recordWalletView', () => {
  it('counts a same-origin report for a wallet with assets', async () => {
    await report(ADDRESS.toUpperCase().replace('0X', '0x'));
    expect(getPortfolio).toHaveBeenCalledWith(ADDRESS);
    expect(evals()).toHaveLength(1);
    expect(evals()[0]).toContain(ADDRESS);
  });

  it('gives the same visitor the same key and another IP a different one', async () => {
    await report(ADDRESS);
    await report(ADDRESS);
    await report(ADDRESS, '5.6.7.8');
    const seen = evals().map((e) => e[3]);
    expect(seen[0]).toBe(seen[1]);
    expect(seen[2]).not.toBe(seen[0]);
  });

  it('skips counting when Redis is not configured', async () => {
    vi.stubEnv('KV_REST_API_URL', '');
    await expect(report(ADDRESS)).resolves.toBeUndefined();
    expect(getPortfolio).not.toHaveBeenCalled();
  });

  it('ignores invalid addresses and wallets with a total of 0', async () => {
    await expect(report('0x123')).resolves.toBeUndefined();
    expect(getPortfolio).not.toHaveBeenCalled();
    getPortfolio.mockResolvedValue({ ...portfolio, total: 0 });
    await expect(report(ADDRESS)).resolves.toBeUndefined();
    expect(evals()).toHaveLength(0);
  });

  it('does not record a wallet whose chains partly failed', async () => {
    getPortfolio.mockResolvedValue({ ...portfolio, failedChains: [{ id: 'eth', name: 'Ethereum' }] });
    await expect(report(ADDRESS)).resolves.toBeUndefined();
    expect(evals()).toHaveLength(0);
  });

  it('swallows Redis and portfolio read failures', async () => {
    failing = true;
    await expect(report(ADDRESS)).resolves.toBeUndefined();
    failing = false;
    getPortfolio.mockRejectedValue(new Error('boom'));
    await expect(report(ADDRESS)).resolves.toBeUndefined();
  });
});
