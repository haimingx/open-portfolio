import 'server-only';
import { createHash } from 'node:crypto';
import aliases from '../data/protocol-aliases.json';
import extra from '../data/tokens.extra.json';
import snapshot from '../data/tokens.json';
import { rowGet, rowGetAll, rowQuery } from './chaintable';
import { listedTokens } from './platform';
import { logoUrl, NATIVE_ID } from './constants';
import type { ProtocolInfo } from './types';

// Reference data shared by all wallets: the token allowlist, chains, protocol names and logos, and the decimals, symbols and logos of listed tokens.
// Kept in instance memory rather than unstable_cache: wallet reads run inside unstable_cache, and a nested unstable_cache skips its read.
export const REFERENCE_TTL_MS = 600_000;
// Whole tables are read page by page by id (these tables are indexed only by primary key); oversized pages fail on the server.
export const TABLE_PAGE = 5000;

export type ChainRow = { id: string; name: string; logo_url: string | null; native_token_symbol: string; evm_chain_id: string };
type TokenCatalog = { meta: Record<string, { decimals: string; symbol: string }>; logos: Record<string, string> };
// One chain of the token snapshot (data/tokens.json): tokens has every listed token as [symbol, decimals], or null when
// token.token has no row; logos holds token_profile's relative paths, including the native coin.
export type CatalogEntry = { tokens: Record<string, [string, string] | null>; logos: Record<string, string> };
type Allowlist = Map<string, string[]>;

type Entry = { expires: number; value: Promise<unknown> };
const store = new Map<string, Entry>();

// Expire on 10-minute boundaries so every instance treats reference data as stale at the same moment and uses the same list within a window.
const nextBoundary = () => (Math.floor(Date.now() / REFERENCE_TTL_MS) + 1) * REFERENCE_TTL_MS;

// Requests that need the same data at once share one read. An expired value is read again inside the request rather than in the background,
// because the platform can freeze a function once its response is sent. A failed refresh keeps the old value and tries again in the next window; a failed first read is dropped at once so the next request retries.
function remember<T>(key: string, load: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (!hit) {
    const value = load();
    store.set(key, { expires: nextBoundary(), value });
    value.catch(() => store.delete(key));
    return value;
  }
  if (hit.expires <= Date.now()) {
    const previous = hit.value as Promise<T>;
    hit.expires = nextBoundary();
    hit.value = load().catch((error) => {
      console.error(`open-portfolio: refreshing ${key} failed`, error);
      return previous;
    });
  }
  return hit.value as Promise<T>;
}

export function profileKey(chain: string, tokenId: string): string {
  return createHash('md5').update(chain + tokenId.toLowerCase()).digest('hex');
}

export function protocolAlias(slug: string): string | undefined {
  return (aliases as Record<string, string>)[slug];
}


// Allowlist = snapshot ∪ exchange listings ∪ hand-picked extras, whatever a token's current trading status; native coins are counted separately by the read.
// The live table only adds tokens: if the source loses rows, snapshot tokens still count; real delistings drop out when the snapshot is regenerated.
function toAllowlist(sources: Iterable<[string, string]>): Allowlist {
  const sets = new Map<string, Set<string>>();
  for (const [chain, id] of sources) {
    if (id !== NATIVE_ID) (sets.get(chain) ?? sets.set(chain, new Set()).get(chain)!).add(id.toLowerCase());
  }
  return new Map([...sets].map(([chain, ids]) => [chain, [...ids]]));
}

// JSON imports infer [symbol, decimals] as string[], so the snapshot is typed once here.
export const TOKEN_SNAPSHOT = snapshot as unknown as Record<string, CatalogEntry>;

const SNAPSHOT: [string, string][] = [
  ...Object.entries(TOKEN_SNAPSHOT).flatMap(([chain, entry]) => Object.keys(entry.tokens).map((id): [string, string] => [chain, id])),
  ...Object.entries(extra as Record<string, string[]>).flatMap(([chain, ids]) => ids.map((id): [string, string] => [chain, id]))
];

async function readTable<T extends { id: string }>(table: string): Promise<T[]> {
  const all: T[] = [];
  for (let after = ''; ;) {
    const where = after ? ` WHERE id > '${after}'` : '';
    const rows = await rowQuery<T>(table, `SELECT * FROM ${table}${where} ORDER BY id LIMIT ${TABLE_PAGE}`);
    all.push(...rows);
    if (rows.length < TABLE_PAGE) return all;
    after = rows[rows.length - 1].id;
  }
}

// One call returns every listed token as [chain, token]; the table itself carries eight more columns per row.
const readListings = async () =>
  Object.entries(await listedTokens()).flatMap(([chain, tokens]): [string, string][] => tokens.map((token) => [chain, token]));

// If the first read fails, use the snapshot without caching it so the next request tries the live table again; later refresh failures keep the last result through remember.
export const getAllowlist = () => remember('allowlist', async () => toAllowlist([...SNAPSHOT, ...await readListings()]))
  .catch((error) => {
    console.error('open-portfolio: reading exchange listings failed, using the snapshot', error);
    return toAllowlist(SNAPSHOT);
  });

export const getChains = () => remember('chains', async () => rowGet<ChainRow>('chain.chain', [...(await getAllowlist()).keys()]));

// The protocol table has a few hundred rows; caching it whole saves every wallet a read per chain.
export const getProtocols = () => remember('protocols', async () => new Map((await readTable<{ id: string; name: string; logo_url: string | null; site_url: string | null }>('protocol.protocol'))
  .map((row): [string, ProtocolInfo] => [row.id.toLowerCase(), { name: row.name, logoUrl: logoUrl(row.logo_url), siteUrl: row.site_url || null }])));

// Reads the details of a batch of tokens in the snapshot format; the sync script builds the snapshot with it and the site reads tokens added since the snapshot with it.
export async function readTokenCatalog(chain: string, ids: string[]): Promise<CatalogEntry> {
  const tokenIds = ids.filter((id) => id !== NATIVE_ID);
  const [rows, profiles] = await Promise.all([
    rowGetAll<{ id: string; decimals: string; symbol: string }>(`token.token.${chain}`, tokenIds),
    rowGetAll<{ id: string; logo_url: string | null }>('token.token_profile', ids.map((id) => profileKey(chain, id)))
  ]);
  const found = new Map(rows.map((row) => [row.id.toLowerCase(), [row.symbol, row.decimals] as [string, string]]));
  const paths = new Map(profiles.map((row) => [row.id, row.logo_url]));
  const entry: CatalogEntry = { tokens: {}, logos: {} };
  for (const id of tokenIds) entry.tokens[id] = found.get(id) ?? null;
  for (const id of ids) {
    const path = paths.get(profileKey(chain, id));
    if (path) entry.logos[id] = path;
  }
  return entry;
}

// Listed token details rarely change: start from the snapshot and read only tokens added since, so a cold instance does not read the whole list again.
export const getTokenCatalog = (chain: string) => remember(`tokens:${chain}`, async (): Promise<TokenCatalog> => {
  const ids = (await getAllowlist()).get(chain) ?? [];
  const known = TOKEN_SNAPSHOT[chain];
  const fresh = known ? ids.filter((id) => !(id in known.tokens)) : [NATIVE_ID, ...ids];
  const added = fresh.length ? await readTokenCatalog(chain, fresh) : { tokens: {}, logos: {} };
  const tokens = { ...known?.tokens, ...added.tokens };
  const meta: TokenCatalog['meta'] = {};
  for (const [id, row] of Object.entries(tokens)) if (row) meta[id] = { symbol: row[0], decimals: row[1] };
  const logos: TokenCatalog['logos'] = {};
  for (const [id, path] of Object.entries({ ...known?.logos, ...added.logos })) {
    const url = logoUrl(path);
    if (url) logos[id] = url;
  }
  return { meta, logos };
});
