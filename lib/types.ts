export type ChainMeta = { id: string; name: string; chainId: number; logoUrl: string | null; nativeSymbol: string; firstSeen: number | null };

// price is the unit price, null when there is none (the value then counts as 0).
export type TokenHolding = { symbol: string; chain: string; tokenId: string; amount: number; price: number | null; value: number; logoUrl: string | null };
export type PositionAsset = { symbol: string; tokenId: string; amount: number; price: number | null; value: number; logoUrl: string | null };
export type Position = {
  poolId: string; protocol: string; protocolLogoUrl: string | null; kind: string; chain: string; assets: string[];
  net: number; debt: number; health: number | null; supplied: PositionAsset[]; borrowed: PositionAsset[]; rewards: PositionAsset[];
};
export type ChainTotal = { id: string; name: string; logoUrl: string | null; value: number; share: number; firstSeen: number | null };
export type Portfolio = {
  address: string; total: number; debt: number; chains: ChainTotal[]; tokens: TokenHolding[]; positions: Position[];
  failedChains: { id: string; name: string }[]; generatedAt: number;
  // ENS primary name, null when there is none or it fails normalization.
  name: string | null;
};

// Raw results of the read; buildPortfolio only computes.
export type RawToken = { tokenId: string; symbol: string; decimals: string | number; raw: bigint; price: number | null };
export type RawListedAsset = { id: string; symbol: string; amount: number; price: number | null };
type RawPosition = {
  name?: string; type?: string;
  stats?: { usd_value?: number; debt_usd_value?: number };
  detail?: { supply_token_list?: RawListedAsset[]; borrow_token_list?: RawListedAsset[]; reward_token_list?: RawListedAsset[]; health_rate?: number | null };
};
export type RawPoolBalance = { pool_id: string; usd_value: number; positions: RawPosition[] | null };
export type ProtocolInfo = { name: string; logoUrl: string | null; siteUrl: string | null };
export type ChainReading =
  | {
      chain: ChainMeta; failed?: false; nativeRaw: bigint; nativePrice: number | null; nativeLogoUrl: string | null;
      tokens: RawToken[]; positions: RawPoolBalance[]; protocols: Map<string, ProtocolInfo>; logos: Map<string, string>;
    }
  | { chain: ChainMeta; failed: true };

// One four-hour mark of a wallet's value; null when a chain could not be read for that mark.
export type HistoryPoint = { time: string; value: number | null };
