import 'server-only';
import { invoke } from './chaintable';

// The two reads this project runs as Chaintable functions instead of round trips: the allowlist in one compact map, and one
// chain's balances with their prices in a single call. The functions live in functions/ and are deployed by scripts/functions.ts.

export type ChainState = {
  // Balances are decimal strings so large amounts keep their precision.
  native: string;
  tokens: Record<string, string>;
  prices: Record<string, number>;
};

export const listedTokens = () => invoke<Record<string, string[]>>('openportfolio.listed_tokens', []);

export const chainState = (address: string, chain: string) => invoke<ChainState>('openportfolio.chain_state', [address, chain]);
