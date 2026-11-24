// One wallet shaped to exercise layouts that have broken before: a chain small enough to need the minimum height,
// a token with an absurd balance, and positions on each side of the health factor bands.
export const WALLET = '0x00000000000000000000000000000000000e2e01';
// Addresses starting with this answer slowly, so a test can see what a page shows while it reads.
export const SLOW_PREFIX = '0x5104';

export const USDC = { eth: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48', base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', arb: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' };
export const USDT = '0xdac17f958d2ee523a2206206994597c13d831ec7';

export const CHAINS = [
  { id: 'eth', name: 'Ethereum', evm_chain_id: '1', native_token_symbol: 'ETH', logo_url: 'image/logo/eth.png' },
  { id: 'base', name: 'Base', evm_chain_id: '8453', native_token_symbol: 'ETH', logo_url: 'image/logo/base.png' },
  { id: 'arb', name: 'Arbitrum', evm_chain_id: '42161', native_token_symbol: 'ETH', logo_url: 'image/logo/arb.png' }
];

const dollars = (n: number) => BigInt(n) * 10n ** 6n;

export const BALANCES: Record<string, Record<string, bigint>> = {
  '1': { [USDC.eth]: dollars(9000), [USDT]: 18n * 10n ** 212n },
  '8453': { [USDC.base]: dollars(900) },
  '42161': { [USDC.arb]: dollars(100) }
};

export const PRICES: Record<string, Record<string, number>> = {
  eth: { [USDC.eth]: 1, [USDT]: 0 },
  base: { [USDC.base]: 1 },
  arb: { [USDC.arb]: 1 }
};

const position = (poolId: string, value: number, health: number) => ({
  pool_id: poolId,
  usd_value: value,
  positions: [{
    name: 'Lending',
    stats: { usd_value: value, debt_usd_value: 100 },
    detail: { health_rate: health, supply_token_list: [{ id: USDC.eth, symbol: 'USDC', amount: value, price: 1 }] }
  }]
});

export const POOLS = [position('0x0e2e000000000000000000000000000000000001', 300, 1.05), position('0x0e2e000000000000000000000000000000000002', 200, 1.3), position('0x0e2e000000000000000000000000000000000003', 100, 2.5)];
