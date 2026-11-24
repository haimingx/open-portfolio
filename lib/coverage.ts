import 'server-only';
import { cache } from 'react';
import parsedProtocols from '../data/protocols.json';
import { logoUrl, NATIVE_ID } from './constants';
import { getAllowlist, getChains, getProtocols, getTokenCatalog } from './reference';

type CoverageChain = { id: string; name: string; logoUrl: string | null; nativeSymbol: string; tokens: number; protocols: number };
type CoverageProtocol = { id: string; name: string; logoUrl: string | null; siteUrl: string | null; chains: number };
type CoverageToken = { chain: string; chainName: string; id: string; symbol: string; logoUrl: string | null };

// /coverage lists what a total includes. Everything comes from reference data and data/protocols.json, so the page adds no Chaintable reads.
// It follows the wallet read: each chain's native coin and the listed tokens that have decimals; protocols appear when the protocol table has their name, so generic parsers such as erc4626 do not.
export const getCoverage = cache(async () => {
  const [allowlist, chainRows, protocolRows] = await Promise.all([getAllowlist(), getChains(), getProtocols()]);
  // The protocol table sometimes has different ids with one name (such as pharaoh and phargg); merge them by name and join their chains.
  const byName = new Map<string, Omit<CoverageProtocol, 'chains'> & { chainIds: Set<string> }>();
  for (const [id, chains] of Object.entries(parsedProtocols as Record<string, string[]>)) {
    const row = protocolRows.get(id);
    if (!row) continue;
    const entry = byName.get(row.name) ?? byName.set(row.name, { id, ...row, chainIds: new Set() }).get(row.name)!;
    for (const chain of chains) entry.chainIds.add(chain);
  }
  const supported = [...byName.values()];
  const perChain = await Promise.all(chainRows.map(async (row) => {
    const catalog = await getTokenCatalog(row.id);
    const listed = (allowlist.get(row.id) ?? []).filter((id) => catalog.meta[id]);
    const tokens: CoverageToken[] = [NATIVE_ID, ...listed].map((id) => ({
      chain: row.id, chainName: row.name, id, symbol: id === NATIVE_ID ? row.native_token_symbol : catalog.meta[id].symbol, logoUrl: catalog.logos[id] ?? null
    }));
    const chain: CoverageChain = {
      id: row.id, name: row.name, logoUrl: logoUrl(row.logo_url), nativeSymbol: row.native_token_symbol,
      tokens: tokens.length, protocols: supported.filter((p) => p.chainIds.has(row.id)).length
    };
    return { chain, tokens };
  }));
  perChain.sort((a, b) => b.chain.tokens - a.chain.tokens);
  return {
    chains: perChain.map((c) => c.chain),
    tokens: perChain.flatMap((c) => c.tokens),
    protocols: supported
      .map(({ chainIds, ...p }): CoverageProtocol => ({ ...p, chains: chainIds.size }))
      .sort((a, b) => b.chains - a.chains || a.name.localeCompare(b.name))
  };
});

// Matches symbols that contain the query or addresses that start with it, exact symbols first.
export function searchTokens(tokens: CoverageToken[], query: string, limit = 50): { matches: CoverageToken[]; total: number } {
  const q = query.trim().toLowerCase();
  if (!q) return { matches: [], total: 0 };
  const hits = tokens.filter((t) => t.symbol.toLowerCase().includes(q) || (q.startsWith('0x') && t.id.startsWith(q)));
  hits.sort((a, b) => Number(b.symbol.toLowerCase() === q) - Number(a.symbol.toLowerCase() === q));
  return { matches: hits.slice(0, limit), total: hits.length };
}
