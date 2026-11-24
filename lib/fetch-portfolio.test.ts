import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../data/tokens.json', () => ({ default: {} }));

const ens = vi.hoisted(() => ({ name: null as string | null, failing: false }));
vi.mock('./ens', () => ({
  lookupName: vi.fn(async () => {
    if (ens.failing) throw new Error('ens down');
    return ens.name;
  })
}));

// Mimic unstable_cache: cache only successful results, never a throw; cleared before each test.
const caches = vi.hoisted(() => [] as Map<string, unknown>[]);
vi.mock('next/cache', () => ({
  unstable_cache: (fn: (...args: string[]) => Promise<unknown>) => {
    const store = new Map<string, unknown>();
    caches.push(store);
    return async (...args: string[]) => {
      const key = JSON.stringify(args);
      if (store.has(key)) return store.get(key);
      const value = await fn(...args);
      store.set(key, value);
      return value;
    };
  }
}));

const world = vi.hoisted(() => ({
  used: {} as Record<string, string | null>,
  listed: {} as Record<string, string[]>,
  balances: {} as Record<string, Record<string, bigint>>,
  native: {} as Record<string, bigint>,
  noMulticall3: new Set<string>(),
  failChains: new Set<string>(),
  pools: {} as Record<string, unknown[]>,
  poolFunctions: {} as Record<string, string>,
  protocols: {} as Record<string, { name: string; logo_url: string }>,
  prices: {} as Record<string, number>,
  dropTokenRows: new Set<string>(),
  calls: [] as string[],
  blocks: [] as string[]
}));


vi.mock('./chaintable', () => {
  class ChaintableError extends Error {
    constructor(public status: number, public code: number, message: string) { super(message); }
  }
  const CHAIN_IDS: Record<string, number> = { eth: 1, base: 8453, arb: 42161 };
  const chainOf = (id: number) => Object.keys(CHAIN_IDS).find((k) => CHAIN_IDS[k] === id)!;
  const rows = (table: string, pks: string[]) => {
    world.calls.push(`get ${table}`);
    if (table === 'address.address_used_chain') return [{ id: pks[0], ...world.used }];
    if (table === 'chain.chain') {
      return pks.map((id) => ({ id, name: id.toUpperCase(), logo_url: `image/logo/${id}.png`, native_token_symbol: 'ETH', evm_chain_id: String(CHAIN_IDS[id] ?? 1) }));
    }
    if (table.startsWith('token.token.')) return pks.filter((id) => !world.dropTokenRows.has(id)).reverse().map((id) => ({ id, decimals: '18', symbol: id.slice(2, 6).toUpperCase() }));
    if (table.startsWith('price.price.')) {
      if (world.failChains.has(table.split('.')[2])) throw new ChaintableError(500, 50000, 'boom');
      return pks.filter((id) => id in world.prices).map((id) => ({ id, value: world.prices[id] }));
    }
    if (table === 'token.token_profile') return pks.map((id) => ({ id, logo_url: `image/logo/${id}.png` }));
    if (table.startsWith('balance.pool.')) return pks.filter((id) => id in world.poolFunctions).map((id) => ({ id, function_id: world.poolFunctions[id] }));
    throw new Error(`unexpected rowGet ${table}`);
  };
  return {
    ChaintableError,
    rowGet: async (table: string, pks: string[]) => rows(table, pks),
    rowGetAll: async (table: string, pks: string[]) => (pks.length ? rows(table, pks) : []),
    rowQuery: async (table: string) => {
      world.calls.push(`query ${table}`);
      if (table.startsWith('balance.pool_balance.')) return world.pools[table.split('.')[2]] ?? [];
      if (table === 'protocol.protocol') return Object.entries(world.protocols).map(([id, row]) => ({ id, ...row }));
      throw new Error(`unexpected rowQuery ${table}`);
    },
    // openportfolio.listed_tokens and openportfolio.chain_state, the two reads the site runs as functions.
    invoke: async (id: string, args: unknown[]) => {
      world.calls.push(`invoke ${id} ${args.join(' ')}`);
      if (id === 'openportfolio.listed_tokens') return world.listed;
      if (id === 'openportfolio.chain_state') {
        const chain = String(args[1]);
        if (world.failChains.has(chain)) throw new ChaintableError(500, 50000, 'boom');
        const held = Object.fromEntries(Object.entries(world.balances[chain] ?? {}).filter(([, raw]) => raw > 0n).map(([token, raw]) => [token, raw.toString()]));
        const worth = Object.entries(world.prices).filter(([token]) => token === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' || token in held);
        return { native: (world.native[chain] ?? 0n).toString(), tokens: held, prices: Object.fromEntries(worth) };
      }
      throw new Error(`unexpected invoke ${id}`);
    },
    leafage: async (chainId: number, method: string, params: unknown[]) => {
      const chain = chainOf(chainId);
      world.calls.push(`rpc ${chain} ${method}`);
      if (method === 'getLatestBlock') return { id: `block-${chain}`, height: 1, timestamp: 1 };
      const block = (params.at(-1) as { block_id?: string })?.block_id ?? 'none';
      world.blocks.push(`${chain}:${method}:${block}`);
      if (method === 'getAddressBalance') return `0x${(world.native[chain] ?? 0n).toString(16)}`;
      const calls = params[0] as { to: string; data: string }[];
      // Multicall3's getEthBalance reads the native balance; without Multicall3 on the chain the call returns empty data.
      const hex = (v: bigint) => `0x${v.toString(16)}`;
      return { results: calls.map(({ to, data }) => data.startsWith('0x4d2301cc')
        ? { code: 0, result: world.noMulticall3.has(chain) ? '0x' : hex(world.native[chain] ?? 0n) }
        : { code: 0, result: hex(world.balances[chain]?.[to] ?? 0n) }) };
    }
  };
});

import { profileKey } from './reference';

// Each test loads fresh modules, so reference data cached by one test cannot reach the next.
let ChaintableError: typeof import('./chaintable').ChaintableError;
let fetchPortfolio: typeof import('./fetch-portfolio').fetchPortfolio;
let getPortfolio: typeof import('./fetch-portfolio').getPortfolio;

const ADDR = '0xd8da6bf26964af9d7eed9e03e53415d37aa96045';
const E18 = 10n ** 18n;
const T1 = '0xaaaa000000000000000000000000000000000001';
const T2 = '0xbbbb000000000000000000000000000000000002';

beforeEach(async () => {
  vi.resetModules();
  ({ ChaintableError } = await import('./chaintable'));
  ({ fetchPortfolio, getPortfolio } = await import('./fetch-portfolio'));
  Object.assign(ens, { name: null, failing: false });
  caches.forEach((store) => store.clear());
  Object.assign(world, {
    used: { eth: '2026-01-01T00:00:00Z', base: '2026-01-01T00:00:00Z', arb: null },
    listed: {}, balances: {}, native: {}, noMulticall3: new Set(), failChains: new Set(), pools: {}, poolFunctions: {}, protocols: {},
    prices: {}, dropTokenRows: new Set(), calls: [], blocks: []
  });
});

describe('fetchPortfolio', () => {
  it('derives the token_profile key', () => {
    expect(profileKey('eth', '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48')).toBe('22cd4caeeb5b5a0d01f1bb7e701d05c6');
  });

  it('reads only chains with a non-null column in address_used_chain', async () => {
    const p = await fetchPortfolio(ADDR);
    expect(p.chains.map((c) => c.id).sort()).toEqual(['base', 'eth']);
  });

  it('reads a chain\'s balances and prices in one function call', async () => {
    world.used = { eth: 'x' };
    world.listed.eth = [T1, T2];
    world.balances.eth = { [T1]: 2n * E18 };
    world.native.eth = E18;
    world.prices = { [T1]: 10, '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 5 };
    const p = await fetchPortfolio(ADDR);
    expect(p.tokens.map((t) => [t.symbol, t.value])).toEqual([['AAAA', 20], ['ETH', 5]]);
    expect(world.calls.filter((c) => c.startsWith('invoke openportfolio.chain_state'))).toHaveLength(1);
    expect(world.calls.some((c) => c.startsWith('rpc'))).toBe(false);
  });

  it('reads the allowlist in one call, however many tokens it holds', async () => {
    world.used = { eth: 'x' };
    world.listed.eth = Array.from({ length: 3000 }, (_, i) => `0x${i.toString(16).padStart(40, '0')}`);
    await fetchPortfolio(ADDR);
    expect(world.calls.filter((c) => c === 'invoke openportfolio.listed_tokens ')).toHaveLength(1);
  });

  it('reads no prices in the site itself; the chain function returns the ones it needs', async () => {
    world.used = { eth: 'x' };
    world.listed.eth = [T1, T2];
    world.balances.eth = { [T1]: E18 };
    await fetchPortfolio(ADDR);
    expect(world.calls.filter((c) => c === 'get price.price.eth')).toEqual([]);
  });

  it('matches rows by id, not by position', async () => {
    world.used = { eth: 'x' };
    world.listed.eth = [T1, T2];
    world.balances.eth = { [T1]: 2n * E18, [T2]: 3n * E18 };
    world.prices = { [T1]: 10, [T2]: 1 };
    const p = await fetchPortfolio(ADDR);
    expect(p.tokens.map((t) => [t.symbol, t.value])).toEqual([['AAAA', 20], ['BBBB', 3]]);
  });

  it('skips tokens without a token row', async () => {
    world.used = { eth: 'x' };
    world.listed.eth = [T1];
    world.balances.eth = { [T1]: E18 };
    world.dropTokenRows.add(T1);
    expect((await fetchPortfolio(ADDR)).tokens).toHaveLength(0);
  });

  it('uses the native id for price and logo', async () => {
    world.used = { eth: 'x' };
    world.native.eth = 2n * E18;
    world.prices = { '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 2000 };
    const p = await fetchPortfolio(ADDR);
    expect(p.total).toBe(4000);
    expect(p.tokens[0]).toMatchObject({ symbol: 'ETH', logoUrl: `https://static.chaintable.com/image/logo/${profileKey('eth', '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')}.png` });
  });

  it('resolves protocols through function_id and aliases', async () => {
    world.used = { eth: 'x' };
    world.pools.eth = [
      { pool_id: '0xpool', usd_value: 100, positions: [{ name: 'Lending', stats: { usd_value: 100, debt_usd_value: 0 } }] },
      { pool_id: '0xcake', usd_value: 50, positions: [{ name: 'Liquidity' }] }
    ];
    world.poolFunctions = { '0xpool': 'balance.parse.aave3.lending', '0xcake': 'balance.parse.pancake3.liquidity' };
    world.protocols = { aave3: { name: 'Aave V3', logo_url: 'image/logo/aave.png' }, pancakeswap3: { name: 'PancakeSwap V3', logo_url: 'image/logo/cake.png' } };
    const p = await fetchPortfolio(ADDR);
    expect(p.positions.map((x) => [x.protocol, x.protocolLogoUrl])).toEqual([
      ['Aave V3', 'https://static.chaintable.com/image/logo/aave.png'],
      ['PancakeSwap V3', 'https://static.chaintable.com/image/logo/cake.png']
    ]);
  });

  it('falls back to the position kind when the protocol is unknown', async () => {
    world.used = { eth: 'x' };
    world.pools.eth = [{ pool_id: '0xpool', usd_value: 50, positions: [{ name: 'Yield' }] }];
    expect((await fetchPortfolio(ADDR)).positions[0]).toMatchObject({ protocol: 'Yield', protocolLogoUrl: null });
  });

  it('isolates a failed chain into failedChains', async () => {
    world.failChains.add('base');
    const p = await fetchPortfolio(ADDR);
    expect(p.failedChains.map((c) => c.id)).toEqual(['base']);
    expect(p.chains.map((c) => c.id)).toEqual(['eth']);
  });

  it('throws when every chain fails', async () => {
    world.failChains = new Set(['eth', 'base']);
    await expect(fetchPortfolio(ADDR)).rejects.toBeInstanceOf(ChaintableError);
  });

  it('returns an empty portfolio for an address with no activity', async () => {
    world.used = {};
    expect(await fetchPortfolio(ADDR)).toMatchObject({ total: 0, chains: [], failedChains: [] });
  });

  it('carries the primary name in the snapshot', async () => {
    ens.name = 'vitalik.eth';
    expect((await fetchPortfolio(ADDR)).name).toBe('vitalik.eth');
  });

  it('still reads the wallet when the primary name lookup fails', async () => {
    ens.failing = true;
    const p = await fetchPortfolio(ADDR);
    expect(p.name).toBeNull();
    expect(p.chains.map((c) => c.id).sort()).toEqual(['base', 'eth']);
  });

  it('rejects anything that is not an address', async () => {
    await expect(fetchPortfolio("0x1' OR 1=1")).rejects.toThrow();
  });

  it('reads reference data once for all wallets', async () => {
    world.used = { eth: 'x' };
    world.listed.eth = [T1];
    world.balances.eth = { [T1]: E18 };
    await fetchPortfolio('0x3333333333333333333333333333333333333333');
    await fetchPortfolio('0x4444444444444444444444444444444444444444');
    expect(world.calls.filter((c) => c === 'get token.token.eth')).toHaveLength(1);
    expect(world.calls.filter((c) => c === 'get chain.chain')).toHaveLength(1);
    expect(world.calls.filter((c) => c === 'invoke openportfolio.listed_tokens ')).toHaveLength(1);
  });

  it('reads the protocol table once as reference data, not per wallet', async () => {
    world.used = { eth: 'x' };
    world.pools.eth = [{ pool_id: '0xpool', usd_value: 1, positions: [{ name: 'Lending' }] }];
    world.poolFunctions = { '0xpool': 'balance.parse.aave3.lending' };
    world.protocols = { aave3: { name: 'Aave V3', logo_url: 'image/logo/aave.png' } };
    await fetchPortfolio('0x3333333333333333333333333333333333333333');
    await fetchPortfolio('0x4444444444444444444444444444444444444444');
    expect(world.calls.filter((c) => c.includes('protocol.protocol'))).toEqual(['query protocol.protocol']);
  });

  it('returns a partial result without caching it', async () => {
    world.failChains.add('base');
    expect((await getPortfolio('0x1111111111111111111111111111111111111111')).failedChains).toHaveLength(1);
    world.failChains.clear();
    expect((await getPortfolio('0x1111111111111111111111111111111111111111')).failedChains).toHaveLength(0);
  });

  it('caches a complete result', async () => {
    const address = '0x2222222222222222222222222222222222222222';
    await getPortfolio(address);
    world.failChains.add('base');
    expect((await getPortfolio(address)).failedChains).toHaveLength(0);
  });
});
