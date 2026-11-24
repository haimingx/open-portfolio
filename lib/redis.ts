import 'server-only';

// Redis only serves the ranking, so a slow Redis must not hold the page.
const TIMEOUT_MS = 2000;

export class RedisError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RedisError';
  }
}

type Command = (string | number)[];
type Reply = { result?: unknown; error?: string };

// Vercel Marketplace injects KV_*, a database created on Upstash directly uses UPSTASH_*; with neither, the ranking is off.
export function redisConfig(env: NodeJS.ProcessEnv = process.env): { url: string; token: string } | null {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const config = redisConfig();
  if (!config) throw new RedisError('Redis is not configured');
  const res = await fetch(`${config.url}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.token}` },
    body: JSON.stringify(body),
    cache: 'no-store',
    signal: AbortSignal.timeout(TIMEOUT_MS)
  });
  if (!res.ok) throw new RedisError(`Redis responded ${res.status}`);
  return res.json() as Promise<T>;
}

function resultOf({ result, error }: Reply): unknown {
  if (error) throw new RedisError(error);
  return result;
}

export async function redis(command: Command): Promise<unknown> {
  return resultOf(await post<Reply>('', command));
}

export async function pipeline(commands: Command[]): Promise<unknown[]> {
  return (await post<Reply[]>('/pipeline', commands)).map(resultOf);
}
