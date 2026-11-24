import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
// Token snapshot: listed tokens with their details. 0x5a has details; 0xdead on bsc is known to have no token.token row.
vi.mock('../data/tokens.json', () => ({ default: {
  eth: { tokens: { '0x5a': ['FIVE', '6'] }, logos: { '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee': 'image/logo/eth.png', '0x5a': 'image/logo/5a.png' } },
  bsc: { tokens: { '0x5b': ['BSC', '18'], '0xdead': null }, logos: {} }
} }));

const api = vi.hoisted(() => ({ listings: {} as Record<string, string[]>, protocols: [] as Record<string, unknown>[], failing: false, queries: [] as string[], invokes: [] as string[], gets: [] as string[], keys: [] as string[] }));

vi.mock('./chaintable', () => ({
  invoke: vi.fn(async (id: string) => {
    api.invokes.push(id);
    if (api.failing) throw new Error('boom');
    if (id === 'openportfolio.listed_tokens') return api.listings;
    throw new Error(`unexpected invoke ${id}`);
  }),
  rowQuery: vi.fn(async (table: string, sql: string) => {
    api.queries.push(sql);
    if (api.failing) throw new Error('boom');
    const after = sql.match(/id > '([0-9a-z]+)'/)?.[1] ?? '';
    const limit = Number(sql.match(/LIMIT (\d+)/)![1]);
    return api.protocols.filter((row) => String(row.id) > after).slice(0, limit);
  }),
  rowGet: vi.fn(async (table: string, pks: string[]) => {
    api.gets.push(table);
    return pks.map((id) => ({ id, name: id.toUpperCase(), logo_url: null, native_token_symbol: 'ETH', evm_chain_id: '1' }));
  }),
  rowGetAll: vi.fn(async (table: string, pks: string[]) => {
    api.gets.push(table);
    api.keys.push(...pks);
    return table.startsWith('token.token.') ? pks.map((id) => ({ id, decimals: '18', symbol: 'T' })) : [];
  })
}));

import { NATIVE_ID } from './constants';
import { profileKey, protocolAlias, readTokenCatalog, REFERENCE_TTL_MS, TABLE_PAGE } from './reference';

// Each test loads a fresh module, so reference data cached by one test cannot reach the next.
let getAllowlist: typeof import('./reference').getAllowlist;
let getChains: typeof import('./reference').getChains;
let getProtocols: typeof import('./reference').getProtocols;
let getTokenCatalog: typeof import('./reference').getTokenCatalog;

beforeEach(async () => {
  vi.resetModules();
  ({ getAllowlist, getChains, getProtocols, getTokenCatalog } = await import('./reference'));
  vi.useFakeTimers({ toFake: ['Date'] });
  Object.assign(api, { listings: {}, protocols: [], failing: false, queries: [], invokes: [], gets: [], keys: [] });
});
afterEach(() => vi.useRealTimers());

describe('getAllowlist', () => {
  it('takes the exchange listings from one function call, lower-cased and deduplicated', async () => {
    api.listings = { eth: ['0xAA', '0xaa', '0xbb'] };
    const allowlist = await getAllowlist();
    expect(api.invokes).toEqual(['openportfolio.listed_tokens']);
    expect(allowlist.get('eth')).toEqual(['0x5a', '0xaa', '0xbb']);
  });

  it('keeps every snapshot token when the live list loses rows', async () => {
    api.listings = { eth: ['0xaa'] };
    const allowlist = await getAllowlist();
    expect(allowlist.get('eth')).toEqual(['0x5a', '0xaa']);
    expect(allowlist.get('bsc')).toEqual(['0x5b', '0xdead']);
  });

  it('falls back to the snapshot when the first live read fails, and retries on the next call', async () => {
    api.failing = true;
    expect((await getAllowlist()).get('eth')).toEqual(['0x5a']);
    api.failing = false;
    api.listings = { eth: ['0xaa'] };
    expect((await getAllowlist()).get('eth')).toEqual(['0x5a', '0xaa']);
  });

  it('adds the hand-picked extras', async () => {
    expect((await getAllowlist()).get('ink')).toContain('0x4200000000000000000000000000000000000006');
  });

  it('reads the list again in the request after ten minutes', async () => {
    api.listings = { eth: ['0xaa'] };
    await getAllowlist();
    api.listings = { eth: ['0xaa', '0xbb'] };
    vi.setSystemTime(Date.now() + REFERENCE_TTL_MS + 1);
    expect((await getAllowlist()).get('eth')).toEqual(['0x5a', '0xaa', '0xbb']);
  });

  it('shares one read between requests that arrive after expiry', async () => {
    await getAllowlist();
    vi.setSystemTime(Date.now() + REFERENCE_TTL_MS + 1);
    await Promise.all([getAllowlist(), getAllowlist()]);
    expect(api.invokes).toHaveLength(2);
  });

  it('keeps the old list when a refresh fails and tries again in the next window', async () => {
    api.listings = { eth: ['0xaa'] };
    await getAllowlist();
    api.listings = { eth: ['0xaa', '0xbb'] };
    vi.setSystemTime(Date.now() + REFERENCE_TTL_MS + 1);
    api.failing = true;
    expect((await getAllowlist()).get('eth')).toEqual(['0x5a', '0xaa']);
    api.failing = false;
    expect((await getAllowlist()).get('eth')).toEqual(['0x5a', '0xaa']);
    expect(api.invokes).toHaveLength(2);
    vi.setSystemTime(Date.now() + REFERENCE_TTL_MS + 1);
    expect((await getAllowlist()).get('eth')).toEqual(['0x5a', '0xaa', '0xbb']);
  });

  it('expires on the same ten-minute boundary in every instance', async () => {
    vi.setSystemTime(new Date('2026-11-07T12:09:00Z'));
    api.listings = { eth: ['0xaa'] };
    await getAllowlist();
    vi.setSystemTime(new Date('2026-11-07T12:09:59Z'));
    await getAllowlist();
    expect(api.invokes).toHaveLength(1);
    vi.setSystemTime(new Date('2026-11-07T12:10:01Z'));
    await getAllowlist();
    await vi.waitFor(() => expect(api.invokes).toHaveLength(2));
  });

  it('reads once for concurrent callers', async () => {
    await Promise.all([getAllowlist(), getAllowlist()]);
    expect(api.invokes).toHaveLength(1);
  });
});

describe('reference data built on the allowlist', () => {
  it('reads the chains and token metadata of the listed chains', async () => {
    api.listings = { eth: ['0xaa'], base: ['0xbb'] };
    expect((await getChains()).map((c) => c.id).sort()).toEqual(['base', 'bsc', 'eth', 'ink', 'soneium', 'sonic', 'uni']);
    expect((await getTokenCatalog('eth')).meta['0xaa']).toEqual({ decimals: '18', symbol: 'T' });
  });

  it('serves snapshot tokens without reading them and reads only tokens listed since', async () => {
    api.listings = { eth: ['0xaa'] };
    const catalog = await getTokenCatalog('eth');
    expect(catalog.meta['0x5a']).toEqual({ symbol: 'FIVE', decimals: '6' });
    expect(catalog.meta['0xaa']).toEqual({ decimals: '18', symbol: 'T' });
    expect(catalog.logos[NATIVE_ID]).toBe('https://static.chaintable.com/image/logo/eth.png');
    expect(catalog.logos['0x5a']).toBe('https://static.chaintable.com/image/logo/5a.png');
    expect(api.keys).toEqual(['0xaa', profileKey('eth', '0xaa')]);
  });

  it('does not read again a snapshot token that has no token row', async () => {
    const catalog = await getTokenCatalog('bsc');
    expect(catalog.meta['0xdead']).toBeUndefined();
    expect(api.keys).toEqual([]);
  });

  it('reads the native coin and every token of a chain only the live table has', async () => {
    api.listings = { zzz: ['0xcc'] };
    await getTokenCatalog('zzz');
    expect(api.keys).toEqual(['0xcc', profileKey('zzz', NATIVE_ID), profileKey('zzz', '0xcc')]);
  });

  it('builds a snapshot entry with every checked token, including those without metadata', async () => {
    const entry = await readTokenCatalog('eth', [NATIVE_ID, '0xaa']);
    expect(entry).toEqual({ tokens: { '0xaa': ['T', '18'] }, logos: {} });
  });

  it('reads the whole protocol table page by page, keyed by lower-case id', async () => {
    api.protocols = Array.from({ length: TABLE_PAGE + 1 }, (_, i) => ({ id: `p${String(i).padStart(5, '0')}`, name: `P${i}`, logo_url: i ? null : 'image/logo/p.png' }));
    api.protocols.unshift({ id: 'Aave3', name: 'Aave V3', logo_url: null, site_url: 'https://aave.com' });
    const protocols = await getProtocols();
    expect(protocols.size).toBe(TABLE_PAGE + 2);
    expect(protocols.get('p00000')).toEqual({ name: 'P0', logoUrl: 'https://static.chaintable.com/image/logo/p.png', siteUrl: null });
    expect(protocols.get('aave3')).toEqual({ name: 'Aave V3', logoUrl: null, siteUrl: 'https://aave.com' });
    expect(api.queries.filter((q) => q.includes('protocol.protocol'))).toHaveLength(2);
  });

  it('maps protocol slugs that differ from protocol ids', () => {
    expect(protocolAlias('pancake3')).toBe('pancakeswap3');
    expect(protocolAlias('aave3')).toBeUndefined();
  });
});
