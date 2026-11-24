// Contents of the data source panels: what each section reads, through which endpoint, from which table. Plain data, so server pages and client components can both import it.
export const API_ORIGIN = 'https://api.chaintable.com';
export const DOCS = 'https://docs.chaintable.com/reference/openapi';
export const SITE = 'https://chaintable.com';
export const ENDPOINTS = {
  get: ['POST', '/v1/table/row/get', 'post-table-row-get'],
  query: ['POST', '/v1/table/row/query', 'post-table-row-query'],
  leafage: ['POST', '/v1/leafage/{chain_id}', 'post-leafage-chain-id'],
  invoke: ['POST', '/v1/function/invoke', 'post-function-invoke'],
  sql: ['POST', '/v1/query/run', 'post-query-run']
} as const;
// The site path for each kind of source: tables by their table type, and functions by their own path.
export const TABLE_PATH = { normal: 'table', block_state: 'block_table', time: 'time_table', function: 'functions' } as const;

export type Row = [label: string, endpoint: keyof typeof ENDPOINTS, table: string, type?: keyof typeof TABLE_PATH];

export const SOURCE_ROWS = {
  chains: (): Row[] => [
    ['Active chains and first activity', 'get', 'address.address_used_chain'],
    ['Chain names and logos', 'get', 'chain.chain'],
    ['ENS name', 'leafage', 'contractMultiCall on eth'],
    // The trend behind the total: the function is ours and returns one chain's total at each moment it is asked for.
    ['Listed tokens', 'invoke', 'openportfolio.listed_tokens', 'function'],
    ['Wallet value at a time', 'invoke', 'openportfolio.value_at', 'function']
  ],
  tokens: (chain: string): Row[] => [
    ['Balances and prices', 'invoke', 'openportfolio.chain_state', 'function'],
    ['Token details', 'get', `token.token.${chain}`, 'block_state'],
    ['Token logos', 'get', 'token.token_profile']
  ],
  positions: (chain: string): Row[] => [
    ['Positions', 'query', `balance.pool_balance.${chain}`],
    ['Pools', 'get', `balance.pool.${chain}`],
    ['Protocol names and logos', 'query', 'protocol.protocol']
  ],
  // A comparison's totals are whole wallets, so it reads everything the three wallet panels list.
  comparison: (): Row[] => [...SOURCE_ROWS.chains(), ...SOURCE_ROWS.tokens('{chain}'), ...SOURCE_ROWS.positions('{chain}')],
  // The three sections of /coverage; protocols with position data are counted offline with SQL by the sync script and stored in data/protocols.json.
  coverageChains: (): Row[] => [
    ['Chain names and logos', 'get', 'chain.chain'],
    ['Token list', 'query', 'cex.cex_listed_token'],
    ['Protocols with position data', 'sql', 'balance.pool.{chain}']
  ],
  coverageProtocols: (): Row[] => [
    ['Protocols with position data', 'sql', 'balance.pool.{chain}'],
    ['Protocol names, logos and sites', 'query', 'protocol.protocol']
  ],
  coverageTokens: (): Row[] => [
    ['Token list', 'query', 'cex.cex_listed_token'],
    ['Token details', 'get', 'token.token.{chain}', 'block_state'],
    ['Token logos', 'get', 'token.token_profile']
  ]
};
