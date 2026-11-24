import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../data/protocols.json', () => ({ default: { aave3: ['arb', 'eth'], uniswap3: ['eth'], erc4626: ['eth'], pharaoh: ['arb'], phargg: ['arb', 'eth'] } }));
vi.mock('./reference', () => ({
  getAllowlist: async () => new Map([['eth', ['0xa0b8', '0xc02a', '0xdead']], ['arb', ['0xaf88']]]),
  getChains: async () => [
    { id: 'arb', name: 'Arbitrum', logo_url: null, native_token_symbol: 'ETH', evm_chain_id: '42161' },
    { id: 'eth', name: 'Ethereum', logo_url: 'image/logo/eth.png', native_token_symbol: 'ETH', evm_chain_id: '1' }
  ],
  getProtocols: async () => new Map([
    ['aave3', { name: 'Aave V3', logoUrl: null, siteUrl: 'https://aave.com' }],
    ['uniswap3', { name: 'Uniswap V3', logoUrl: null, siteUrl: null }],
    ['pharaoh', { name: 'Pharaoh Exchange', logoUrl: null, siteUrl: null }],
    ['phargg', { name: 'Pharaoh Exchange', logoUrl: null, siteUrl: null }]
  ]),
  // 0xdead has no decimals, so wallet reads skip it and the page does not list it.
  getTokenCatalog: async (chain: string) => ({
    meta: chain === 'eth' ? { '0xa0b8': { decimals: '6', symbol: 'USDC' }, '0xc02a': { decimals: '18', symbol: 'WETH' } } : { '0xaf88': { decimals: '6', symbol: 'USDC' } },
    logos: {}
  })
}));

import { getCoverage, searchTokens } from './coverage';

describe('getCoverage', () => {
  it('lists chains by token count, counting the native coin and only tokens with metadata', async () => {
    const { chains } = await getCoverage();
    expect(chains.map((c) => [c.id, c.tokens, c.protocols])).toEqual([['eth', 3, 3], ['arb', 2, 2]]);
  });

  it('lists only protocols found in the protocol table, widest support first', async () => {
    const { protocols } = await getCoverage();
    expect(protocols.map((p) => [p.name, p.chains])).toEqual([['Aave V3', 2], ['Pharaoh Exchange', 2], ['Uniswap V3', 1]]);
  });
});

describe('searchTokens', () => {
  const tokens = [
    { chain: 'eth', chainName: 'Ethereum', id: '0xa0b8', symbol: 'USDC.e', logoUrl: null },
    { chain: 'arb', chainName: 'Arbitrum', id: '0xaf88', symbol: 'USDC', logoUrl: null },
    { chain: 'eth', chainName: 'Ethereum', id: '0xeeee', symbol: 'ETH', logoUrl: null }
  ];

  it('matches symbols case-insensitively, exact symbols first', () => {
    expect(searchTokens(tokens, ' usdc ').matches.map((t) => t.symbol)).toEqual(['USDC', 'USDC.e']);
  });

  it('matches contract addresses by prefix', () => {
    expect(searchTokens(tokens, '0xAF8').matches.map((t) => t.chain)).toEqual(['arb']);
  });

  it('returns nothing for an empty query and caps the results', () => {
    expect(searchTokens(tokens, '  ')).toEqual({ matches: [], total: 0 });
    expect(searchTokens(tokens, 'e', 1)).toMatchObject({ total: 2, matches: [{ symbol: 'USDC.e' }] });
  });
});
