import 'server-only';
import { cache } from 'react';
import { isAddress, normalizeAddress } from './address';
import { sharedCache } from './cache';
import { ChaintableError, rowGet, rowGetAll, rowQuery } from './chaintable';
import { logoUrl, NATIVE_ID, REVALIDATE } from './constants';
import { lookupName } from './ens';
import { chainState } from './platform';
import { buildPortfolio, parseProtocolSlug } from './portfolio';
import { getChains, getProtocols, getTokenCatalog, profileKey, protocolAlias, type ChainRow } from './reference';
import { firstSeenAt } from './story';
import type { ChainMeta, ChainReading, Portfolio, ProtocolInfo, RawPoolBalance, RawToken } from './types';

const byId = <T extends { id: string }>(rows: T[]) => new Map(rows.map((row) => [row.id.toLowerCase(), row]));

// Pool → protocol slug in its function_id → protocol name and logo from reference data.
async function readProtocols(chain: ChainMeta, pools: RawPoolBalance[]): Promise<Map<string, ProtocolInfo>> {
  const poolIds = [...new Set(pools.map((p) => p.pool_id.toLowerCase()))];
  if (!poolIds.length) return new Map();
  const [poolRows, protocols] = await Promise.all([
    rowGetAll<{ id: string; function_id: string | null }>(`balance.pool.${chain.id}`, poolIds).then(byId), getProtocols()
  ]);
  const result = new Map<string, ProtocolInfo>();
  for (const id of poolIds) {
    const slug = parseProtocolSlug(poolRows.get(id)?.function_id ?? null);
    const protocol = slug ? protocols.get((protocolAlias(slug) ?? slug).toLowerCase()) : undefined;
    if (protocol) result.set(id, protocol);
  }
  return result;
}

// Position assets outside the allowlist are not in reference data, so their logos are read per wallet.
async function readExtraLogos(chain: ChainMeta, pools: RawPoolBalance[], known: Record<string, string>): Promise<Map<string, string>> {
  const ids = [...new Set(pools.flatMap((p) => (p.positions ?? []).flatMap((pos) => [
    ...(pos.detail?.supply_token_list ?? []), ...(pos.detail?.borrow_token_list ?? []), ...(pos.detail?.reward_token_list ?? [])
  ].map((a) => a.id.toLowerCase()))))].filter((id) => !(id in known));
  const rows = await rowGetAll<{ id: string; logo_url: string | null }>('token.token_profile', ids.map((id) => profileKey(chain.id, id)));
  const byKey = new Map(rows.map((row) => [row.id, row.logo_url]));
  const logos = new Map<string, string>();
  for (const id of ids) {
    const url = logoUrl(byKey.get(profileKey(chain.id, id)));
    if (url) logos.set(id, url);
  }
  return logos;
}

// One chain: the function reads balances and prices together, while positions and token details are read here in parallel.
async function readChain(chain: ChainMeta, address: string): Promise<ChainReading> {
  const catalogP = getTokenCatalog(chain.id);
  const stateP = chainState(address, chain.id);
  const poolsP = rowQuery<RawPoolBalance>(`balance.pool_balance.${chain.id}`,
    `SELECT * FROM balance.pool_balance.${chain.id} WHERE owner = '${address}' LIMIT 1000`);
  const protocolsP = poolsP.then((pools) => readProtocols(chain, pools));
  const extraLogosP = Promise.all([poolsP, catalogP]).then(([pools, catalog]) => readExtraLogos(chain, pools, catalog.logos));
  const [state, pools, catalog, protocols, extraLogos] = await Promise.all([stateP, poolsP, catalogP, protocolsP, extraLogosP]);

  const prices = new Map(Object.entries(state.prices));
  const balances = new Map(Object.entries(state.tokens).map(([id, raw]) => [id, BigInt(raw)]));
  // Tokens without a token.token row have no known decimals and are not counted.
  const tokens: RawToken[] = [...balances].flatMap(([id, raw]) => {
    const meta = catalog.meta[id];
    return meta ? [{ tokenId: id, symbol: meta.symbol, decimals: meta.decimals, raw, price: prices.get(id) ?? null }] : [];
  });
  const logos = new Map([...Object.entries(catalog.logos), ...extraLogos]);
  return {
    chain,
    nativeRaw: BigInt(state.native),
    nativePrice: prices.get(NATIVE_ID) ?? null,
    nativeLogoUrl: logos.get(NATIVE_ID) ?? null,
    tokens,
    positions: pools,
    protocols,
    logos
  };
}

const toMeta = (id: string, row: ChainRow, firstSeen: number | null): ChainMeta =>
  ({ id, name: row.name, chainId: Number(row.evm_chain_id), logoUrl: logoUrl(row.logo_url), nativeSymbol: row.native_token_symbol, firstSeen });

// The chains a wallet has used, in the order they were first seen; the value history needs nothing else from the wallet read.
export async function usedChains(addr: string): Promise<ChainMeta[]> {
  const [used] = await rowGet<Record<string, string | null>>('address.address_used_chain', [addr]);
  const active = used ? Object.keys(used).filter((key) => key !== 'id' && used[key] != null) : [];
  if (!active.length) return [];
  const known = byId(await getChains());
  const missing = active.filter((id) => !known.has(id));
  const rows = missing.length ? new Map([...known, ...byId(await rowGet<ChainRow>('chain.chain', missing))]) : known;
  return active.flatMap((id) => (rows.has(id) ? [toMeta(id, rows.get(id)!, firstSeenAt(used[id]))] : []));
}

async function readValuation(addr: string): Promise<Omit<Portfolio, 'name'>> {
  const started = Date.now();
  const chains = await usedChains(addr);
  if (!chains.length) return buildPortfolio([], addr);

  const failures: { chain: string; status?: number; code?: number; error: string }[] = [];
  const readings = await Promise.all(chains.map((chain) => readChain(chain, addr).catch((error): ChainReading => {
    failures.push({ chain: chain.id, status: (error as ChaintableError).status, code: (error as ChaintableError).code, error: String((error as Error).message ?? error).slice(0, 160) });
    return { chain, failed: true };
  })));
  // One structured log line per read, to trace addresses, durations and failures in production.
  console.info(JSON.stringify({ event: 'wallet_read', address: addr, ms: Date.now() - started, chains: chains.length, failures }));
  if (readings.length && readings.every((r) => r.failed)) {
    throw new ChaintableError(502, 50200, `Every chain failed for ${addr}`);
  }
  return buildPortfolio(readings, addr);
}

export async function fetchPortfolio(address: string): Promise<Portfolio> {
  // The address is spliced into row/query SQL, so it must be a plain hex address.
  if (!isAddress(address)) throw new Error(`Not an EVM address: ${address}`);
  const addr = normalizeAddress(address);
  // The primary name is read alongside the wallet; failing to read it only hides the name.
  const [valuation, name] = await Promise.all([
    readValuation(addr),
    lookupName(addr).catch((error) => {
      console.error(`open-portfolio: reading the primary name of ${addr} failed`, error);
      return null;
    })
  ]);
  return { ...valuation, name };
}

// A result with failed chains throws to skip the cache so the next visit reads again; a cached complete result survives a failed refresh.
class PartialPortfolio extends Error {
  constructor(public portfolio: Portfolio) {
    super('partial portfolio');
  }
}

const cachedPortfolio = sharedCache(async (address: string) => {
  const portfolio = await fetchPortfolio(address);
  if (portfolio.failedChains.length) throw new PartialPortfolio(portfolio);
  return portfolio;
}, ['portfolio'], { revalidate: REVALIDATE });

// React cache merges repeat calls within one render; otherwise metadata and the page body would each run a full read on a cache miss.
export const getPortfolio = cache(async (address: string): Promise<Portfolio> => {
  try {
    return await cachedPortfolio(address);
  } catch (error) {
    if (error instanceof PartialPortfolio) return error.portfolio;
    throw error;
  }
});

const SKELETON_DELAY_MS = 150;

// When the data is ready almost at once (a cache hit), a page renders it directly: once React shows a fallback it keeps it for about 300ms, which would flash.
export const walletsReadySoon = (addresses: string[]): Promise<boolean> => Promise.race([
  Promise.all(addresses.map((address) => getPortfolio(address))).then(() => true, () => true),
  new Promise<boolean>((resolve) => setTimeout(() => resolve(false), SKELETON_DELAY_MS))
]);
