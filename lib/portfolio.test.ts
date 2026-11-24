import { describe, expect, it } from 'vitest';
import { NATIVE_ID } from './constants';
import { buildPortfolio, cardData, decodeBalance, groupTokens, healthLevel, parseProtocolSlug, previewList, splitLayers, toAmount } from './portfolio';
import type { ChainMeta, ChainReading, ChainTotal, Portfolio, Position, RawPoolBalance, RawToken, TokenHolding } from './types';

const ADDRESS = '0x0000000000000000000000000000000000000001';
const meta = (id: string, chainId = 1): ChainMeta => ({ id, name: id.toUpperCase(), chainId, logoUrl: null, nativeSymbol: 'ETH', firstSeen: null });
const e18 = (n: number) => BigInt(Math.round(n * 1e6)) * 10n ** 12n;
const token = (tokenId: string, amount: number, price: number | null, symbol = 'TKN'): RawToken => ({ tokenId, symbol, decimals: '18', raw: e18(amount), price });
const reading = (id: string, parts: Partial<Extract<ChainReading, { failed?: false }>> = {}): ChainReading => ({
  chain: meta(id), nativeRaw: 0n, nativePrice: null, nativeLogoUrl: null, tokens: [], positions: [],
  protocols: new Map(), logos: new Map(), ...parts
});
const pool = (pool_id: string, usd_value: number, debt = 0, extra = {}): RawPoolBalance => ({
  pool_id, usd_value,
  positions: [{ name: 'Lending', stats: { usd_value, debt_usd_value: debt }, detail: { supply_token_list: [{ id: '0xa', symbol: 'A', amount: 1, price: usd_value + debt }], ...extra } }]
});

describe('decoding', () => {
  it('reads empty or failed multicall results as zero', () => {
    expect(decodeBalance('0x', 0)).toBe(0n);
    expect(decodeBalance('0x0a', 1)).toBe(0n);
    expect(decodeBalance('0x0a', 0)).toBe(10n);
  });

  it('converts raw amounts with string decimals', () => {
    expect(toAmount(10n ** 30n, '18')).toBe(1e12);
    expect(toAmount(1500000n, 6)).toBe(1.5);
  });

  it('parses the protocol slug from function_id', () => {
    expect(parseProtocolSlug('balance.parse.aave3.lending')).toBe('aave3');
    expect(parseProtocolSlug(null)).toBeNull();
    expect(parseProtocolSlug('other.thing')).toBeNull();
  });
});

describe('buildPortfolio', () => {
  it('carries the unit price, keeping a zero price apart from a missing one', () => {
    const p = buildPortfolio([reading('eth', {
      tokens: [token('0xa', 2, 10), token('0xb', 1, null), token('0xc', 3, 0)],
      positions: [pool('0xp', 50), pool('0xq', 0)],
      nativeRaw: e18(1), nativePrice: 0
    })], ADDRESS);
    const prices = Object.fromEntries(p.tokens.map((t) => [t.tokenId, t.price]));
    expect(prices).toMatchObject({ '0xa': 10, '0xb': null, '0xc': 0, [NATIVE_ID]: 0 });
    expect(p.positions.map((x) => x.supplied[0].price).sort()).toEqual([0, 50]);
  });

  it('counts the tokens it is given', () => {
    expect(buildPortfolio([reading('eth', { tokens: [token('0xa', 2, 10)] })], ADDRESS).total).toBe(20);
  });

  it('counts a token whose id equals a pool_id only once', () => {
    const p = buildPortfolio([reading('eth', { tokens: [token('0xjlp', 10, 5)], positions: [pool('0xjlp', 50)] })], ADDRESS);
    expect(p.total).toBe(50);
    expect(p.tokens).toHaveLength(0);
  });

  it('sums native, tokens and positions to the total', () => {
    const p = buildPortfolio([
      reading('eth', { nativeRaw: e18(1), nativePrice: 2000, tokens: [token('0xa', 100, 1)], positions: [pool('0xp', 300, 50)] }),
      reading('base', { tokens: [token('0xb', 10, 10)] })
    ], ADDRESS);
    expect(p.total).toBe(2000 + 100 + 300 + 100);
    expect(p.debt).toBe(50);
    expect(p.tokens.find((t) => t.tokenId === NATIVE_ID)?.symbol).toBe('ETH');
  });

  it('computes shares against the total', () => {
    const p = buildPortfolio([reading('eth', { tokens: [token('0xa', 75, 1)] }), reading('base', { tokens: [token('0xb', 25, 1)] })], ADDRESS);
    expect(p.chains.find((c) => c.id === 'eth')?.share).toBe(75);
    expect(p.chains.find((c) => c.id === 'base')?.share).toBe(25);
  });

  it('sorts tokens by value descending', () => {
    const p = buildPortfolio([reading('eth', { tokens: [token('0xa', 1, 1, 'A'), token('0xb', 1, 9, 'B'), token('0xc', 1, 5, 'C')] })], ADDRESS);
    expect(p.tokens.map((t) => t.symbol)).toEqual(['B', 'C', 'A']);
  });

  it('keeps a negative net position and total', () => {
    const p = buildPortfolio([reading('eth', { positions: [pool('0xp', -300, 1300)] })], ADDRESS);
    expect(p.total).toBe(-300);
    expect(p.positions[0].net).toBe(-300);
    expect(p.chains.every((c) => Number.isFinite(c.share))).toBe(true);
  });

  it('returns total 0 and no NaN for an empty wallet', () => {
    const p = buildPortfolio([reading('eth')], ADDRESS);
    expect(p.total).toBe(0);
    expect(p.chains.every((c) => c.share === 0)).toBe(true);
  });

  it('survives huge raw balances', () => {
    const p = buildPortfolio([reading('eth', { tokens: [{ tokenId: '0xa', symbol: 'BIG', decimals: '18', raw: 10n ** 60n, price: 0 }] })], ADDRESS);
    expect(p.tokens[0].amount).toBe(1e42);
    expect(Number.isFinite(p.total)).toBe(true);
  });

  it('records failed chains without counting them', () => {
    const p = buildPortfolio([reading('eth', { tokens: [token('0xa', 1, 1)] }), { chain: meta('arb'), failed: true }], ADDRESS);
    expect(p.failedChains).toEqual([{ id: 'arb', name: 'ARB' }]);
    expect(p.chains.map((c) => c.id)).toEqual(['eth']);
  });

  it('builds positions with protocol, kind, assets, debt and health', () => {
    const p = buildPortfolio([reading('eth', {
      positions: [pool('0xp', 300, 50, { borrow_token_list: [{ id: '0xu', symbol: 'USDC', amount: 50, price: 1 }], health_rate: 2.31 })],
      protocols: new Map([['0xp', { name: 'Aave V3', logoUrl: 'aave.png', siteUrl: null }]])
    })], ADDRESS);
    expect(p.positions[0]).toMatchObject({ protocol: 'Aave V3', kind: 'Lending', assets: ['A'], net: 300, debt: 50, health: 2.31 });
    expect(p.positions[0].borrowed[0]).toMatchObject({ symbol: 'USDC', value: 50 });
  });

  it('sorts position assets by value, last when worthless or unpriced, and keeps the listed asset names in order', () => {
    const list = [
      { id: '0xa', symbol: 'A', amount: 9, price: 0 },
      { id: '0xb', symbol: 'B', amount: 1, price: 5 },
      { id: '0xc', symbol: 'C', amount: 2, price: null },
      { id: '0xd', symbol: 'D', amount: 2, price: 10 }
    ];
    const p = buildPortfolio([reading('eth', {
      positions: [{ pool_id: '0xp', usd_value: 25, positions: [{ name: 'Lending', detail: { supply_token_list: list, borrow_token_list: list, reward_token_list: list } }] }]
    })], ADDRESS);
    const [position] = p.positions;
    for (const rows of [position.supplied, position.borrowed, position.rewards]) expect(rows.map((a) => a.symbol)).toEqual(['D', 'B', 'A', 'C']);
    expect(position.assets).toEqual(['A', 'B', 'C', 'D']);
  });

  it('falls back to the position kind when the protocol is unknown', () => {
    const p = buildPortfolio([reading('eth', { positions: [pool('0xp', 10)] })], ADDRESS);
    expect(p.positions[0]).toMatchObject({ protocol: 'Lending', protocolLogoUrl: null });
  });
});

describe('splitLayers', () => {
  const chain = (id: string, value: number, total: number): ChainTotal => ({ id, name: id, logoUrl: null, value, share: (value / total) * 100, firstSeen: null });

  it('folds chains under 3.5% into others', () => {
    const values = { eth: 61967, base: 31820, arb: 19930, op: 9371, bsc: 5372, a: 1192, b: 994, c: 897, d: 449, e: 338, f: 311, g: 112 };
    const total = Object.values(values).reduce((s, v) => s + v, 0);
    const { layers, others } = splitLayers(Object.entries(values).map(([id, v]) => chain(id, v, total)));
    expect(layers.map((c) => c.id)).toEqual(['bsc', 'op', 'arb', 'base', 'eth']);
    expect(others?.chains).toHaveLength(7);
    expect(others?.chains[0].id).toBe('a');
  });

  it('keeps a single small chain as its own layer', () => {
    const { layers, others } = splitLayers([chain('eth', 98, 100), chain('op', 2, 100)]);
    expect(layers.map((c) => c.id)).toEqual(['op', 'eth']);
    expect(others).toBeNull();
  });

  it('leaves non-positive chains out of the layers', () => {
    const { layers, others } = splitLayers([chain('eth', 120, 100), chain('arb', -20, 100)]);
    expect(layers.map((c) => c.id)).toEqual(['eth']);
    expect(others).toBeNull();
  });
});

describe('previewList', () => {
  const items = (n: number) => Array.from({ length: n }, (_, i) => i);

  it('shows a short list whole, including when only one item would be hidden', () => {
    expect(previewList(items(8), false)).toEqual({ visible: items(8), expandable: false });
    expect(previewList(items(9), false)).toEqual({ visible: items(9), expandable: false });
  });

  it('shows the first items of a long list until expanded', () => {
    expect(previewList(items(10), false)).toEqual({ visible: items(8), expandable: true });
    expect(previewList(items(10), true)).toEqual({ visible: items(10), expandable: true });
  });
});

const holding = (symbol: string, chain: string, amount: number, price: number | null): TokenHolding => ({
  symbol, chain, tokenId: `0x${symbol}${chain}`, amount, price, value: amount * (price ?? 0), logoUrl: null
});

describe('groupTokens', () => {
  it('merges one symbol across chains when prices agree within 2%, largest first', () => {
    const groups = groupTokens([holding('ETH', 'eth', 1, 2000), holding('USDC', 'eth', 300, 1), holding('USDC', 'arb', 100, 1.01), holding('USDC', 'op', 100, 0.99)], true);
    expect(groups.map((g) => [g.symbol, g.holdings.length, g.value])).toEqual([['ETH', 1, 2000], ['USDC', 3, 500]]);
    expect(groups[1].amount).toBe(500);
    expect(groups[1].price).toBeCloseTo(1, 5);
    expect(groups[1].holdings.map((h) => h.chain)).toEqual(['eth', 'arb', 'op']);
  });

  it('keeps tokens apart when the prices differ, or when a price is missing or zero', () => {
    expect(groupTokens([holding('X', 'eth', 1, 100), holding('X', 'arb', 1, 105)], true)).toHaveLength(2);
    expect(groupTokens([holding('X', 'eth', 1, null), holding('X', 'arb', 1, null)], true)).toHaveLength(2);
    expect(groupTokens([holding('X', 'eth', 1, 0), holding('X', 'arb', 1, 0)], true)).toHaveLength(2);
  });

  it('leaves every token on its own when merging is off', () => {
    expect(groupTokens([holding('USDC', 'eth', 1, 1), holding('USDC', 'arb', 1, 1)], false)).toHaveLength(2);
  });
});

describe('healthLevel', () => {
  it('marks positions close to liquidation', () => {
    expect(healthLevel(1.05)).toBe('critical');
    expect(healthLevel(1.1)).toBe('low');
    expect(healthLevel(1.49)).toBe('low');
    expect(healthLevel(1.5)).toBeNull();
  });
});

describe('cardData', () => {
  const chainTotal = (id: string, value: number, share: number): ChainTotal => ({ id, name: id.toUpperCase(), logoUrl: `${id}.png`, value, share, firstSeen: null });
  const holding = (chain: string, tokenId: string, symbol: string, value: number): TokenHolding => ({ symbol, chain, tokenId, amount: 1, price: value, value, logoUrl: `${symbol}.png` });
  const position = (chain: string, poolId: string, protocol: string, net: number) => ({ poolId, protocol, protocolLogoUrl: `${protocol}.png`, chain, net }) as Position;
  const portfolio = {
    total: 1000,
    chains: [chainTotal('eth', 800, 80), chainTotal('base', 200, 20)],
    tokens: [holding('eth', '0xa', 'USDC', 800), holding('base', '0xb', 'USDC', 120), holding('base', '0xc', 'ETH', 30)],
    positions: [position('base', '0xd', 'Aave', 50), position('base', '0xe', 'Debt', -10)]
  } as Portfolio;

  it('keeps chain layers for the whole wallet', () => {
    const data = cardData(portfolio, null);
    expect(data).toMatchObject({ total: 1000, tokens: 950, positions: 40, scope: null, unit: 'chains' });
    expect(data.layers.map((l) => l.id)).toEqual(['base', 'eth']);
  });

  it('turns one chain into layers of its assets, skipping negative positions', () => {
    const data = cardData(portfolio, 'base');
    expect(data).toMatchObject({ total: 200, tokens: 150, positions: 40, unit: 'assets' });
    expect(data.scope?.name).toBe('BASE');
    expect(data.layers.map((l) => [l.name, l.share, l.logoUrl])).toEqual([['ETH', 15, 'ETH.png'], ['Aave', 25, 'Aave.png'], ['USDC', 60, 'USDC.png']]);
  });

  it('falls back to the whole wallet for an unknown chain or the folded group', () => {
    expect(cardData(portfolio, 'nope').scope).toBeNull();
    expect(cardData(portfolio, 'other').scope).toBeNull();
  });

  it('limits the logos of a long folded row', () => {
    const tokens = Array.from({ length: 40 }, (_, i) => holding('base', `0x${i}`, `T${i}`, 1));
    const data = cardData({ ...portfolio, positions: [], tokens: [holding('base', '0xbig', 'BIG', 960), ...tokens], chains: [chainTotal('base', 1000, 100)] }, 'base');
    expect(data.others?.chains).toHaveLength(40);
    expect(data.pile).toHaveLength(15);
  });
});
