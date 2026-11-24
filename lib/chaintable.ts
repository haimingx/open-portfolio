import 'server-only';
import pkg from '../package.json';
import { API_ORIGIN } from './data-sources';

const BASE = process.env.CHAINTABLE_API_BASE ?? API_ORIGIN;
const USER_AGENT = `open-portfolio/${pkg.version}`;
// 403 with 40200/40201 means the key's account is out of balance or quota and anonymous access still works; other 403s are permission errors that anonymous access would not fix.
const KEY_FALLBACK_CODES = new Set([40200, 40201]);
// Rendering waits on the server, so a longer Retry-After fails at once and the page shows the partial result.
const MAX_RETRY_AFTER_SECONDS = 5;
// A stuck request fails only its chain instead of holding the page until the function times out.
const REQUEST_TIMEOUT_MS = 10000;

export class ChaintableError extends Error {
  constructor(public status: number, public code: number, message: string) {
    super(message);
    this.name = 'ChaintableError';
  }
}

type Envelope<T> = { code: number; message: string; data: T };

// Every request goes through one token bucket: at most RATE per second per function instance. The account's own limit is a
// quota setting the API does not expose; measured, it tolerates 20 requests a second and rejects bursts of 30 and more, so the
// site paces below it rather than discovering it through 429s. Wallet reads and reference data share this single limiter.
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
// Overridable so the pace can follow the account's limit without a code change.
const RATE = Number(process.env.CHAINTABLE_RATE ?? 20);
let tokens = RATE;
let refilled = Date.now();
let queue: Promise<void> = Promise.resolve();

function take(): Promise<void> {
  queue = queue.then(async () => {
    for (;;) {
      const now = Date.now();
      tokens = Math.min(RATE, tokens + ((now - refilled) / 1000) * RATE);
      refilled = now;
      if (tokens >= 1) {
        tokens -= 1;
        return;
      }
      await sleep(((1 - tokens) / RATE) * 1000);
    }
  });
  return queue;
}

// API keys are limited per account per second and a 429 has no Retry-After but clears within a second: back off with jitter so concurrent requests do not retry together.
const MAX_RETRIES = 3;
const BACKOFF_MS = 150;

async function request<T>(path: string, body?: unknown, useKey = true, attempt = 0): Promise<T> {
  await take();
  const key = useKey ? process.env.CHAINTABLE_API_KEY : undefined;
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT };
  if (key) headers['API-Key'] = key;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${BASE}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
  });
  // Only a body that is not JSON counts as empty; a timeout or dropped connection while reading it must surface as itself.
  const payload = (await res.json().catch((error) => {
    if (error instanceof SyntaxError) return null;
    throw error;
  })) as Envelope<T> | null;
  const code = payload?.code ?? -1;
  if (res.ok && code === 0) return payload!.data;

  if (res.status === 403 && key && KEY_FALLBACK_CODES.has(code)) return request(path, body, false, attempt);
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const header = res.headers.get('Retry-After');
    const wait = header === null ? BACKOFF_MS * 2 ** attempt + Math.random() * 100 : Number(header) * 1000;
    if (Number.isFinite(wait) && wait <= MAX_RETRY_AFTER_SECONDS * 1000) {
      await sleep(wait);
      return request(path, body, useKey, attempt + 1);
    }
  }
  throw new ChaintableError(res.status, code, `${path} ${res.status} ${code}: ${payload?.message || res.statusText || 'no message'}`);
}

export async function rowGet<T>(tableId: string, pks: string[]): Promise<T[]> {
  const data = await request<{ rows: (T | null)[] }>('/v1/table/row/get', { table_id: tableId, pks });
  return data.rows.filter((row): row is T => row !== null);
}

// row/get fails with too many keys (50106 from about 1,500), so keys go in batches of 500.
const ROW_BATCH = 500;
export async function rowGetAll<T>(tableId: string, pks: string[]): Promise<T[]> {
  const batches = Array.from({ length: Math.ceil(pks.length / ROW_BATCH) }, (_, i) => pks.slice(i * ROW_BATCH, (i + 1) * ROW_BATCH));
  return (await Promise.all(batches.map((batch) => rowGet<T>(tableId, batch)))).flat();
}

export async function rowQuery<T>(tableId: string, sql: string): Promise<T[]> {
  const data = await request<{ rows: T[] }>('/v1/table/row/query', { table_id: tableId, sql });
  return data.rows;
}

export async function leafage<T>(chainId: number, method: string, params: unknown[]): Promise<T> {
  const data = await request<{ result?: T; error?: { code: number; message: string } }>(
    `/v1/leafage/${chainId}`, { jsonrpc: '2.0', id: 1, method, params });
  if (data.error) throw new ChaintableError(200, data.error.code, `${method} on chain ${chainId}: ${data.error.message}`);
  return data.result as T;
}

// A function call holds a platform executor for its whole run, and too many at once makes every call run past its time
// limit, so calls beyond this many wait for a free slot. The rate limiter above paces starts; this caps what runs.
const MAX_RUNNING = 24;
let running = 0;
const waiting: (() => void)[] = [];

async function slot<T>(run: () => Promise<T>): Promise<T> {
  if (running >= MAX_RUNNING) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await run();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

// A Chaintable function's own failure comes back as success: false inside a 200 response.
export async function invoke<T>(functionId: string, args: unknown[]): Promise<T> {
  const data = await slot(() => request<{ success: boolean; error: string | null; result: T }>('/v1/function/invoke', { id: functionId, arguments: args }));
  if (!data.success) throw new ChaintableError(200, -1, `${functionId}: ${data.error ?? 'failed'}`);
  return data.result;
}
