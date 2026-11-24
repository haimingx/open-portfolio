import { API_ORIGIN } from './data-sources';

const USDC_ETH = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';

function curl(path: string, body: unknown): string {
  const payload = JSON.stringify(body).replaceAll("'", `'\\''`);
  return `curl -X POST ${API_ORIGIN}${path} \\\n  -H 'Content-Type: application/json' \\\n  -d '${payload}'`;
}

const rowGet = (table: string, pks: string[]) => curl('/v1/table/row/get', { table_id: table, pks });
const rowQuery = (table: string, sql: string) => curl('/v1/table/row/query', { table_id: table, sql });

// One request per panel that runs as pasted, without an API key. Reads that first need a token list, a hashed key or derived call data would not.
export const CURL = {
  chains: (...addresses: string[]) => rowGet('address.address_used_chain', addresses),
  tokens: (address: string) => curl('/v1/leafage/1', {
    jsonrpc: '2.0', id: 1, method: 'contractMultiCall',
    params: [[{ to: USDC_ETH, data: `0x70a08231${address.slice(2).padStart(64, '0')}` }], { type: 'Equals', block_id: 'latest' }]
  }),
  positions: (address: string, chain: string) => rowQuery(`balance.pool_balance.${chain}`, `SELECT * FROM balance.pool_balance.${chain} WHERE owner = '${address}' LIMIT 100`),
  coverageChains: () => rowGet('chain.chain', ['eth']),
  coverageProtocols: () => rowQuery('protocol.protocol', 'SELECT * FROM protocol.protocol ORDER BY id LIMIT 100'),
  coverageTokens: () => rowQuery('cex.cex_listed_token', 'SELECT * FROM cex.cex_listed_token ORDER BY id LIMIT 100')
};
