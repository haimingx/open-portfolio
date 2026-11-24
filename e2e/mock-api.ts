import { createServer } from 'node:http';
import { BALANCES, CHAINS, POOLS, PRICES, SLOW_PREFIX, WALLET } from './fixture';

// Stands in for the Chaintable API so these tests depend neither on live data nor on its rate limits and timeouts.
const MULTICALL3 = '0xca11bde05977b3631167028862be2a173976ca11';
const SLOW_MS = 1200;
const hex = (n: bigint) => `0x${n.toString(16).padStart(64, '0')}`;
const isSlow = (key: string) => key.startsWith(SLOW_PREFIX);

function rows(table: string, keys: string[]): unknown[] {
  const [space, name, chain] = table.split('.');
  if (table === 'address.address_used_chain') return [{ id: keys.find(isSlow) ?? WALLET, eth: '2019-03-05T00:00:00Z', base: '2023-08-10T00:00:00Z', arb: '1970-01-01T00:00:01Z' }];
  if (table === 'chain.chain') return CHAINS.filter((c) => keys.includes(c.id));
  if (space === 'price') return keys.flatMap((id) => (id in (PRICES[chain] ?? {}) ? [{ id, value: PRICES[chain][id] }] : []));
  if (space === 'balance' && name === 'pool') return chain === 'eth' ? POOLS.map((p) => ({ id: p.pool_id, function_id: 'balance.parse.aave3.lending' })) : [];
  return [];
}

function query(table: string): unknown[] {
  if (table === 'protocol.protocol') return [{ id: 'aave3', name: 'Aave V3', logo_url: null, site_url: null }];
  return table === 'balance.pool_balance.eth' ? POOLS : [];
}

// Calls that are not wallet balances are ENS lookups, which revert: the wallet has no primary name.
function multicall(chainId: string, calls: { to: string; data: string }[]) {
  return { results: calls.map(({ to, data }) => {
    if (to.toLowerCase() === MULTICALL3) return { code: 0, result: hex(0n), err: '' };
    if (data.startsWith('0x70a08231')) return { code: 0, result: hex(BALANCES[chainId]?.[to.toLowerCase()] ?? 0n), err: '' };
    return { code: -39000, result: '0x', err: 'execution revert' };
  }) };
}

// The project's own functions: the allowlist, one chain's balances and prices, and a wallet's past marks.
function invoke(body: { id: string; arguments: unknown[] }): unknown {
  if (body.id === 'openportfolio.listed_tokens') {
    return Object.fromEntries(CHAINS.map((c) => [c.id, Object.keys(BALANCES[c.evm_chain_id] ?? {})]));
  }
  if (body.id === 'openportfolio.chain_state') {
    const chain = CHAINS.find((c) => c.id === body.arguments[1])!;
    const held = Object.entries(BALANCES[chain.evm_chain_id] ?? {}).filter(([, raw]) => raw > 0n);
    return { native: '0', tokens: Object.fromEntries(held.map(([token, raw]) => [token, raw.toString()])), prices: PRICES[chain.id] ?? {} };
  }
  // Every chain is worth the same at every mark.
  return { points: String(body.arguments[2]).split(',').map((time: string) => ({ time, value: 125 })), skipped: 0 };
}

createServer((req, res) => {
  let raw = '';
  req.on('data', (chunk) => { raw += chunk; });
  req.on('end', () => {
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/health') return res.end('{}');
    const body = JSON.parse(raw);
    const data = req.url === '/v1/table/row/get' ? { rows: rows(body.table_id, body.pks) }
      : req.url === '/v1/table/row/query' ? { rows: query(body.table_id) }
        : req.url === '/v1/function/invoke' ? { success: true, error: null, result: invoke(body) }
          : { result: multicall(req.url!.split('/').pop()!, body.params[0]) };
    setTimeout(() => res.end(JSON.stringify({ code: 0, message: 'ok', data })), body.pks?.some(isSlow) ? SLOW_MS : 0);
  });
}).listen(Number(process.env.PORT));
