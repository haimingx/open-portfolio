// Builds the token snapshot data/tokens.json from the exchange listings that scripts/sync-data.sh queried:
// every listed token with its symbol, decimals and logo, plus each native coin's logo. Details are read with the
// same code the site uses at runtime, so both agree.
// Usage: npx tsx --conditions=react-server scripts/build-tokens.ts <query result from chaintable query run --out>
import { readFileSync, writeFileSync } from 'node:fs';
import extra from '../data/tokens.extra.json';
import { NATIVE_ID } from '../lib/constants';
import { readTokenCatalog, TOKEN_SNAPSHOT, type CatalogEntry } from '../lib/reference';

const DEST = 'data/tokens.json';
// The source once dropped over a hundred tokens that were still trading. Too many removals mean bad data, so nothing
// is written; rerun with ALLOW_REMOVALS=1 once the delistings are confirmed.
const MAX_REMOVALS = 20;

const sortKeys = <T>(record: Record<string, T>) => Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));

async function main() {
  const result = JSON.parse(readFileSync(process.argv[2], 'utf8')) as { data: { chain_id: string; token_id: string }[] };
  // Fewer rows than rows_count means the query's row limit truncated the list.
  const total = Number(JSON.stringify(result).match(/"rows_count":(\d+)/)?.[1] ?? result.data.length);
  if (total > result.data.length) throw new Error(`only ${result.data.length} of ${total} rows came back, the list would be truncated`);

  const listed = new Map<string, Set<string>>();
  const add = (chain: string, id: string) => (listed.get(chain) ?? listed.set(chain, new Set()).get(chain)!).add(id.toLowerCase());
  for (const row of result.data) add(row.chain_id, row.token_id);
  for (const [chain, ids] of Object.entries(extra as Record<string, string[]>)) for (const id of ids) add(chain, id);

  const removed = Object.entries(TOKEN_SNAPSHOT).flatMap(([chain, entry]) => Object.keys(entry.tokens).filter((id) => !listed.get(chain)?.has(id)).map((id) => `${chain}:${id}`));
  if (removed.length > MAX_REMOVALS && process.env.ALLOW_REMOVALS !== '1') {
    throw new Error(`${removed.length} tokens would be removed, more than ${MAX_REMOVALS}; the source looks incomplete, so ${DEST} is unchanged. First ones: ${removed.slice(0, 10).join(', ')}`);
  }

  const snapshot: Record<string, CatalogEntry> = {};
  for (const chain of [...listed.keys()].sort()) {
    const entry = await readTokenCatalog(chain, [NATIVE_ID, ...[...listed.get(chain)!].sort()]);
    snapshot[chain] = { tokens: sortKeys(entry.tokens), logos: sortKeys(entry.logos) };
  }
  writeFileSync(DEST, JSON.stringify(snapshot) + '\n');
  const tokens = Object.values(snapshot).reduce((n, entry) => n + Object.keys(entry.tokens).length, 0);
  const missing = Object.values(snapshot).reduce((n, entry) => n + Object.values(entry.tokens).filter((row) => !row).length, 0);
  console.error(`wrote ${DEST}: ${tokens} tokens on ${Object.keys(snapshot).length} chains, ${removed.length} removed, ${missing} without a token row`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
