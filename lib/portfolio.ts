import { LIST_PREVIEW, MIN_LAYER_SHARE, NATIVE_ID } from './constants';
import type { ChainReading, ChainTotal, Portfolio, Position, PositionAsset, RawListedAsset, RawPoolBalance, TokenHolding } from './types';

// multicall returns 0x or a non-zero code for missing or failing contracts; both mean no balance.
export function decodeBalance(result: string, code: number): bigint {
  if (code !== 0 || !result || result === '0x') return 0n;
  return BigInt(result);
}

// Split the integer and fractional parts in BigInt before converting, so huge balances neither become Infinity nor lose their magnitude.
export function toAmount(raw: bigint, decimals: string | number): number {
  const scale = 10n ** BigInt(Number(decimals));
  return Number(raw / scale) + Number(raw % scale) / Number(scale);
}

export function parseProtocolSlug(functionId: string | null): string | null {
  const match = functionId?.match(/^balance\.parse\.([^.]+)\./);
  return match ? match[1] : null;
}

const share = (part: number, total: number) => (total > 0 ? (part / total) * 100 : 0);

function assetsOf(list: RawListedAsset[] | undefined, logos: Map<string, string>): PositionAsset[] {
  return (list ?? []).map((asset) => {
    const tokenId = asset.id.toLowerCase();
    return { symbol: asset.symbol, tokenId, amount: asset.amount, price: asset.price ?? null, value: asset.amount * (asset.price ?? 0), logoUrl: logos.get(tokenId) ?? null };
  });
}

// Highest value first; worthless and unpriced assets both have a value of 0 and fall to the end.
const byValue = (assets: PositionAsset[]) => [...assets].sort((a, b) => b.value - a.value);

function buildPosition(chain: string, row: RawPoolBalance, protocol: { name: string; logoUrl: string | null } | undefined, logos: Map<string, string>): Position {
  const parts = row.positions ?? [];
  const supplied = parts.flatMap((p) => assetsOf(p.detail?.supply_token_list, logos));
  const borrowed = parts.flatMap((p) => assetsOf(p.detail?.borrow_token_list, logos));
  const rewards = parts.flatMap((p) => assetsOf(p.detail?.reward_token_list, logos));
  const healths = parts.map((p) => p.detail?.health_rate).filter((h): h is number => typeof h === 'number');
  const kind = parts[0]?.name ?? parts[0]?.type ?? 'Position';
  return {
    poolId: row.pool_id.toLowerCase(),
    protocol: protocol?.name ?? kind,
    protocolLogoUrl: protocol?.logoUrl ?? null,
    kind,
    chain,
    assets: [...new Set((supplied.length ? supplied : borrowed).map((a) => a.symbol))],
    net: row.usd_value,
    debt: parts.reduce((sum, p) => sum + (p.stats?.debt_usd_value ?? 0), 0),
    health: healths.length ? Math.min(...healths) : null,
    supplied: byValue(supplied), borrowed: byValue(borrowed), rewards: byValue(rewards)
  };
}

// No price is null (shown as a dash, valued at 0); a price of 0 is a known zero and shows as $0.
export function buildPortfolio(input: ChainReading[], address: string): Omit<Portfolio, 'name'> {
  const tokens: TokenHolding[] = [];
  const positions: Position[] = [];
  const chainValues: Omit<ChainTotal, 'share'>[] = [];
  const failedChains: { id: string; name: string }[] = [];

  for (const reading of input) {
    const { chain } = reading;
    if (reading.failed) {
      failedChains.push({ id: chain.id, name: chain.name });
      continue;
    }
    // A token whose address is a pool_id (such as JLP) is already in the position's net value, so it is not counted again as a token.
    const poolIds = new Set(reading.positions.map((p) => p.pool_id.toLowerCase()));
    const chainTokens: TokenHolding[] = [];
    if (reading.nativeRaw > 0n) {
      const amount = toAmount(reading.nativeRaw, 18);
      chainTokens.push({ symbol: chain.nativeSymbol, chain: chain.id, tokenId: NATIVE_ID, amount, price: reading.nativePrice ?? null, value: amount * (reading.nativePrice ?? 0), logoUrl: reading.nativeLogoUrl });
    }
    for (const t of reading.tokens) {
      const tokenId = t.tokenId.toLowerCase();
      if (poolIds.has(tokenId) || t.raw <= 0n) continue;
      const amount = toAmount(t.raw, t.decimals);
      chainTokens.push({ symbol: t.symbol, chain: chain.id, tokenId, amount, price: t.price ?? null, value: amount * (t.price ?? 0), logoUrl: reading.logos.get(tokenId) ?? null });
    }
    const chainPositions = reading.positions.map((row) => buildPosition(chain.id, row, reading.protocols.get(row.pool_id.toLowerCase()), reading.logos));
    tokens.push(...chainTokens);
    positions.push(...chainPositions);
    const value = chainTokens.reduce((s, t) => s + t.value, 0) + chainPositions.reduce((s, p) => s + p.net, 0);
    chainValues.push({ id: chain.id, name: chain.name, logoUrl: chain.logoUrl, value, firstSeen: chain.firstSeen });
  }

  const total = chainValues.reduce((s, c) => s + c.value, 0);
  return {
    address,
    total,
    debt: positions.reduce((s, p) => s + p.debt, 0),
    chains: chainValues.map((c) => ({ ...c, share: share(c.value, total) })).sort((a, b) => b.value - a.value),
    tokens: tokens.sort((a, b) => b.value - a.value),
    positions: positions.sort((a, b) => b.net - a.net),
    failedChains,
    generatedAt: Date.now()
  };
}

// Long lists start with their first items; when only one would be hidden, show it rather than a button for a single row.
export function previewList<T>(items: T[], showAll: boolean): { visible: T[]; expandable: boolean } {
  const expandable = items.length > LIST_PREVIEW + 1;
  return { visible: showAll || !expandable ? items : items.slice(0, LIST_PREVIEW), expandable };
}

export type Others = { chains: ChainTotal[]; value: number; share: number };

// Layers go from smallest at the top to largest; chains under MIN_LAYER_SHARE fold into Other chains unless only one would fold; chains with no positive value get no layer.
export function splitLayers(chains: ChainTotal[]): { layers: ChainTotal[]; others: Others | null } {
  const positive = chains.filter((c) => c.value > 0);
  let small = positive.filter((c) => c.share < MIN_LAYER_SHARE);
  if (small.length === 1) small = [];
  const layers = positive.filter((c) => !small.includes(c)).sort((a, b) => a.value - b.value);
  if (!small.length) return { layers, others: null };
  const folded = [...small].sort((a, b) => b.value - a.value);
  return {
    layers,
    others: { chains: folded, value: folded.reduce((s, c) => s + c.value, 0), share: folded.reduce((s, c) => s + c.share, 0) }
  };
}

export type TokenGroup = { key: string; symbol: string; logoUrl: string | null; amount: number; price: number | null; value: number; holdings: TokenHolding[] };

// Chaintable has no cross-chain asset id, so one asset is one symbol at about one price. A wrong merge only changes
// how rows are shown; the total stays the sum of the holdings.
const SAME_PRICE = 0.02;

export function groupTokens(tokens: TokenHolding[], merge: boolean): TokenGroup[] {
  const groups: TokenGroup[] = [];
  for (const token of [...tokens].sort((a, b) => b.value - a.value)) {
    const group = merge && token.price ? groups.find((g) => {
      const reference = g.holdings[0].price;
      return g.symbol === token.symbol && !!reference && Math.abs(token.price! - reference) <= SAME_PRICE * reference;
    }) : undefined;
    if (group) {
      group.holdings.push(token);
      group.amount += token.amount;
      group.value += token.value;
      group.price = group.value / group.amount;
    } else {
      groups.push({ key: `${token.chain}:${token.tokenId}`, symbol: token.symbol, logoUrl: token.logoUrl, amount: token.amount, price: token.price, value: token.value, holdings: [token] });
    }
  }
  return groups.sort((a, b) => b.value - a.value);
}

// Health factors differ a little between protocols, so these are two broad bands above the usual liquidation line of 1.
const HEALTH_CRITICAL = 1.1;
const HEALTH_LOW = 1.5;

export function healthLevel(health: number): 'critical' | 'low' | null {
  if (health < HEALTH_CRITICAL) return 'critical';
  return health < HEALTH_LOW ? 'low' : null;
}

// Every chain fits; a chain's assets can run into the hundreds, and each logo is one more image to fetch for the card.
const CARD_PILE = 15;

// A share card covers the whole wallet in chain layers, or one chain in layers of its assets. The folded group has no single chain, so it uses the whole wallet.
export function cardData(portfolio: Portfolio, chain: string | null) {
  const scope = portfolio.chains.find((c) => c.id === chain) ?? null;
  const tokens = portfolio.tokens.filter((t) => !scope || t.chain === scope.id);
  const positions = portfolio.positions.filter((p) => !scope || p.chain === scope.id);
  const total = scope ? scope.value : portfolio.total;
  const assets = [
    ...tokens.map((t) => ({ id: `${t.chain}:${t.tokenId}`, name: t.symbol, logoUrl: t.logoUrl, value: t.value })),
    ...positions.map((p) => ({ id: `${p.chain}:${p.poolId}`, name: p.protocol, logoUrl: p.protocolLogoUrl, value: p.net }))
  ].map((a): ChainTotal => ({ ...a, share: share(a.value, total), firstSeen: null }));
  const { layers, others } = splitLayers(scope ? assets : portfolio.chains);
  return {
    total, scope, layers, others, pile: others?.chains.slice(0, CARD_PILE) ?? [], unit: scope ? 'assets' as const : 'chains' as const,
    tokens: tokens.reduce((s, t) => s + t.value, 0),
    positions: positions.reduce((s, p) => s + p.net, 0)
  };
}
