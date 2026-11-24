// The Chaintable functions this project deploys, and the platform functions they rely on.
//   npx tsx scripts/functions.ts deploy     update every function from functions/*.py (needs `chaintable auth login`)
//   npx tsx scripts/functions.ts snapshot   record the id and code hash of the platform's balance and price functions
//   npx tsx scripts/functions.ts check      fail when a deployed function differs from the repo, or a wallet's values drift from the page
// snapshot and check read public data only.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import extra from '../data/tokens.extra.json';
import { API_ORIGIN } from '../lib/data-sources';

// Paths are relative to the repository root, where the scripts run. value_at values wallet history; the other two serve the
// wallet page: its allowlist, and one chain's balances and prices.
const FUNCTIONS = {
  'openportfolio.value_at': 'functions/value_at.py',
  'openportfolio.listed_tokens': 'functions/listed_tokens.py',
  'openportfolio.chain_state': 'functions/chain_state.py'
} as const;
const VALUE_AT = 'openportfolio.value_at';
// The manifest holds ids and hashes only: the platform's own source is not ours to republish. A changed hash means a function
// that wallet history depends on changed, and git shows which.
const PLATFORM = 'functions/platform';
const MANIFEST = 'functions/platform/manifest.json';
// Position values come from these spaces: balance parses and values positions, price unwraps tokens such as LP shares.
const PLATFORM_SPACES = ['balance', 'price'];
// Wallets with tokens, Aave, Curve, Uniswap V3 and many chains between them.
const SAMPLES = ['nick.eth', 'hayden.eth', 'stani.eth', 'banteg.eth', 'griff.eth', 'jesse.base.eth'];
const CHAIN_IDS: Record<string, string> = {
  Ethereum: 'eth', OP: 'op', Monad: 'monad', Polygon: 'matic', Base: 'base', Arbitrum: 'arb', Linea: 'linea', 'BNB Chain': 'bsc',
  Avalanche: 'avax', Robinhood: 'hood', Ink: 'ink', Unichain: 'uni', Soneium: 'soneium', Sonic: 'sonic', HyperEVM: 'hyper'
};
// Prices move between the page's read and the function's, so small chains get an absolute allowance.
const TOLERANCE = 0.015;
const TOLERANCE_USD = 10;
// The page's positions come from the platform's pipeline, which refreshes a pool every few hours. When a comparison fails, the
// chain's stored positions are dated: one older than this is not a fair reference, so it is reported rather than failed.
const STALE_MS = 2 * 3_600_000;

// The deployed code is the source with the extra token list filled in, so the page and the function count the same tokens.
function functionCode(id: string): string {
  const source = readFileSync(FUNCTIONS[id as keyof typeof FUNCTIONS], 'utf8');
  if (!source.includes('EXTRA_TOKENS = {}')) return source;
  return source.replace('EXTRA_TOKENS = {}', `EXTRA_TOKENS = ${JSON.stringify(extra)}`);
}

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API_ORIGIN}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const payload = await res.json().catch(() => null) as { code: number; message: string; data: T } | null;
  if (!res.ok || payload?.code !== 0) throw new Error(`${path} ${res.status} ${payload?.code}: ${payload?.message}`);
  return payload.data;
}

// One call can hit the function's time limit when the platform is busy; that says nothing about the values, so it is tried
// once more before the run fails.
const RETRY_MS = 3000;

async function readValue(address: string, chain: string): Promise<number> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      const call = await api<{ success: boolean; error: string | null; result: { points: { value: number }[] } }>(
        '/v1/function/invoke', { id: VALUE_AT, arguments: [address, chain, 'latest'] });
      if (!call.success) throw new Error(call.error ?? 'invoke failed');
      if (!call.result.points?.length) throw new Error(`returned ${JSON.stringify(call.result).slice(0, 120)}`);
      return call.result.points[0].value;
    } catch (error) {
      if (attempt >= 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, RETRY_MS));
    }
  }
}

// How old the page's oldest stored position is on a chain, in hours: the page's total for that chain is at least that old.
// Null when the page holds no positions there. A position the pipeline has not touched in a while is exactly where a lending
// pool's value drifts, so the whole chain is reported instead of compared.
async function staleHours(address: string, chain: string): Promise<number | null> {
  const { rows } = await api<{ rows: { block_timestamp: string }[] }>('/v1/table/row/query', {
    table_id: `balance.pool_balance.${chain}`,
    sql: `SELECT * FROM balance.pool_balance.${chain} WHERE owner = '${address}' LIMIT 50`
  });
  const ages = rows.map((row) => Date.now() - Date.parse(row.block_timestamp)).filter(Number.isFinite);
  const oldest = Math.max(...ages);
  return ages.length && oldest > STALE_MS ? Math.round(oldest / 3_600_000) : null;
}

function deploy() {
  const dir = mkdtempSync(join(tmpdir(), 'openportfolio-'));
  try {
    for (const [id, source] of Object.entries(FUNCTIONS)) {
      const file = join(dir, source.split('/').pop()!);
      writeFileSync(file, functionCode(id));
      execFileSync('chaintable', ['function', 'update', '--id', id, '--code', `@${file}`], { stdio: 'inherit' });
    }
  } finally {
    rmSync(dir, { recursive: true });
  }
}

async function snapshot() {
  const hashes = new Map<string, string>();
  for (const space of PLATFORM_SPACES) {
    for (let start = 0; ; start += 100) {
      const page = await api<{ items: { id: string; code: string }[] }>(`/v1/function/list?space=${space}&limit=100&start=${start}`);
      for (const item of page.items) hashes.set(item.id, createHash('sha256').update(item.code).digest('hex'));
      if (page.items.length < 100) break;
    }
  }
  const manifest = Object.fromEntries([...hashes].sort(([a], [b]) => a.localeCompare(b)));
  rmSync(PLATFORM, { recursive: true, force: true });
  mkdirSync(PLATFORM, { recursive: true });
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`recorded ${hashes.size} functions from ${PLATFORM_SPACES.join(', ')}`);
}

async function check() {
  const failures: string[] = [];
  for (const id of Object.keys(FUNCTIONS)) {
    const deployed = (await api<{ code: string }>(`/v1/function?id=${id}`)).code;
    if (deployed.trim() !== functionCode(id).trim()) failures.push(`${id} differs from ${FUNCTIONS[id as keyof typeof FUNCTIONS]}; run the deploy step`);
  }

  for (const wallet of SAMPLES) {
    const page = await (await fetch(`https://openportfolio.io/${wallet}/intro.md`)).text();
    const address = page.match(/^Address: (0x[0-9a-f]{40})$/m)?.[1];
    if (!address) {
      failures.push(`${wallet}: no address in intro.md`);
      continue;
    }
    for (const [, name, value] of page.matchAll(/^\| ([^|]+?) \| \$([\d,.]+) \|/gm)) {
      const chain = CHAIN_IDS[name];
      const expected = Number(value.replace(/,/g, ''));
      if (!chain || expected < TOLERANCE_USD) continue;
      try {
        const actual = await readValue(address, chain);
        const off = actual - expected;
        const line = `${wallet} ${chain}: page $${expected}, function $${actual.toFixed(2)} (${(off / expected * 100).toFixed(2)}%)`;
        console.log(line);
        if (Math.abs(off) > Math.max(expected * TOLERANCE, TOLERANCE_USD)) {
          const stale = await staleHours(address, chain);
          if (stale) console.log(`${wallet} ${chain}: not compared, the page's positions are ${stale}h old`);
          else failures.push(line);
        }
      } catch (error) {
        failures.push(`${wallet} ${chain}: ${(error as Error).message}`);
      }
    }
  }
  if (failures.length) {
    console.error(`\n${failures.length} problem(s):\n${failures.join('\n')}`);
    process.exit(1);
  }
}

const commands: Record<string, () => unknown> = { deploy, snapshot, check };
const command = commands[process.argv[2]];
if (!command) {
  console.error(`usage: npx tsx scripts/functions.ts ${Object.keys(commands).join('|')}`);
  process.exit(2);
}
Promise.resolve(command()).catch((error) => {
  console.error(error);
  process.exit(1);
});
