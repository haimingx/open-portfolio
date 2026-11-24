import 'server-only';
import { BaseError, createPublicClient, custom, getAddress, type Hex } from 'viem';
import { mainnet } from 'viem/chains';
import { normalize } from 'viem/ens';
import { leafage } from './chaintable';

type CallResult = { results: { code: number; result: Hex; err: string }[] };

// The contract reverted: the name is unregistered or has no address record. A revert with OffchainLookup data continues through CCIP-Read instead.
class Reverted extends Error {
  constructor(message: string, public data: Hex | undefined) {
    super(message);
  }
}

// viem handles ENS encoding, the Universal Resolver and CCIP-Read; chain calls go through leafage and share the wallet reads' rate limit.
// On a revert, hand the revert data to viem so offchain names complete CCIP-Read on their own.
// The Chaintable client owns retries (rate limits only), so viem does not retry and reverts are not requested twice.
const client = createPublicClient({
  chain: mainnet,
  transport: custom({
    async request({ method, params }) {
      if (method !== 'eth_call') throw new Error(`ENS lookups only send eth_call, got ${method}`);
      const [{ to, data }] = params as [{ to: Hex; data: Hex }];
      const { results: [res] } = await leafage<CallResult>(mainnet.id, 'contractMultiCall', [[{ to, data }], { type: 'Equals', block_id: 'latest' }]);
      if (res.code === 0) return res.result;
      throw new Reverted(res.err || 'execution reverted', res.result && res.result !== '0x' ? res.result : undefined);
    }
  }, { retryCount: 0 })
});

const reverted = (error: unknown) => error instanceof BaseError && error.walk((e) => e instanceof Reverted) instanceof Reverted;

// Any input with a dot may be an ENS name; input that fails normalization (characters ENSIP-15 disallows) is not.
export function toEnsName(input: string): string | null {
  if (!input.includes('.')) return null;
  try {
    return normalize(input);
  } catch {
    return null;
  }
}

// Returns null when the name does not resolve; Chaintable errors still throw and must not read as a missing name.
export async function resolveName(name: string): Promise<string | null> {
  try {
    const address = await client.getEnsAddress({ name });
    return address ? address.toLowerCase() : null;
  } catch (error) {
    if (reverted(error)) return null;
    throw error;
  }
}

// Primary name: the Universal Resolver's reverse already verifies it forward; names that are not normalized are hidden to avoid lookalike spoofing.
export async function lookupName(address: string): Promise<string | null> {
  try {
    const name = await client.getEnsName({ address: getAddress(address) });
    return name && toEnsName(name) === name ? name : null;
  } catch (error) {
    if (reverted(error)) return null;
    throw error;
  }
}
